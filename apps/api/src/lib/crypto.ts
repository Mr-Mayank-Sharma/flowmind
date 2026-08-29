import crypto from "crypto"
import { config } from "./config"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16
const DEV_KEY = "flowmind-dev-encryption-key"

function resolveKey(): Buffer {
  const raw = config.encryptionKey
  if (raw) return crypto.createHash("sha256").update(raw).digest()
  if (config.nodeEnv === "production") {
    throw new Error("ENCRYPTION_KEY must be set in production")
  }
  console.warn("WARNING: ENCRYPTION_KEY not set, using insecure development-derived key")
  return crypto.createHash("sha256").update(DEV_KEY).digest()
}

export function encrypt(plaintext: string): string {
  const key = resolveKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decrypt(ciphertext: string): string {
  const data = Buffer.from(ciphertext, "base64")
  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid ciphertext: too short")
  }
  const key = resolveKey()
  const iv = data.subarray(0, IV_LENGTH)
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString("utf8")
}
