import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16
const DEV_KEY = "flowmind-dev-encryption-key"

export interface SmtpConfig {
  host: string
  port: number
  user?: string
  pass?: string
  from?: string
  secure: boolean
}

function resolveKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (raw) return crypto.createHash("sha256").update(raw).digest()
  if (process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY must be set in production")
  }
  return crypto.createHash("sha256").update(DEV_KEY).digest()
}

export function decryptSmtp(ciphertext: string): SmtpConfig {
  const data = Buffer.from(ciphertext, "base64")
  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid SMTP credential ciphertext")
  }
  const key = resolveKey()
  const iv = data.subarray(0, IV_LENGTH)
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(decrypted)
  } catch {
    throw new Error("SMTP credential plaintext is not valid JSON")
  }
  if (typeof parsed.host !== "string" || !parsed.host) {
    throw new Error("SMTP credential is missing a 'host' field")
  }
  return {
    host: parsed.host,
    port: parsed.port != null ? Number(parsed.port) : 587,
    user: typeof parsed.user === "string" ? parsed.user : undefined,
    pass: typeof parsed.pass === "string" ? parsed.pass : undefined,
    from: typeof parsed.from === "string" ? parsed.from : undefined,
    secure: parsed.secure === true || parsed.secure === "true",
  }
}
