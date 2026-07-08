import crypto from "crypto"
import type { CredentialStore } from "./types"

const ALGORITHM = "aes-256-gcm"
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16

export function createCredentialStore(encryptionKey?: string): CredentialStore {
  const key = encryptionKey ?? process.env.FLOWMIND_CREDENTIAL_KEY ?? crypto.randomBytes(KEY_LENGTH).toString("hex")
  const derivedKey = crypto.scryptSync(key, "flowmind-credentials", KEY_LENGTH)

  const stored = new Map<string, { id: string; name: string; type: string; encrypted: string }>()

  return {
    async encrypt(value: string): Promise<string> {
      const iv = crypto.randomBytes(IV_LENGTH)
      const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)
      let encrypted = cipher.update(value, "utf8", "hex")
      encrypted += cipher.final("hex")
      const tag = cipher.getAuthTag().toString("hex")
      return `${iv.toString("hex")}:${tag}:${encrypted}`
    },

    async decrypt(value: string): Promise<string> {
      const [ivHex, tagHex, encrypted] = value.split(":")
      if (!ivHex || !tagHex || !encrypted) throw new Error("Invalid encrypted value format")
      const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, Buffer.from(ivHex, "hex"))
      decipher.setAuthTag(Buffer.from(tagHex, "hex"))
      let decrypted = decipher.update(encrypted, "hex", "utf8")
      decrypted += decipher.final("utf8")
      return decrypted
    },

    async save(credential): Promise<void> {
      stored.set(credential.id, { id: credential.id, name: credential.name, type: credential.type, encrypted: credential.encrypted })
    },

    async get(id): Promise<{ id: string; name: string; type: string; encrypted: string } | null> {
      return stored.get(id) ?? null
    },

    async listByType(type): Promise<Array<{ id: string; name: string; type: string }>> {
      return Array.from(stored.values()).filter((c) => c.type === type).map(({ encrypted: _, ...rest }) => rest)
    },

    async delete(id): Promise<void> {
      stored.delete(id)
    },
  }
}

export function createEphemeralCredentialStore(): CredentialStore {
  return createCredentialStore(crypto.randomBytes(32).toString("hex"))
}
