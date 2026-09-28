import { logger } from "../infrastructure";
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production")
  }
  logger.warn("JWT_SECRET not set; using an insecure development fallback")
  return "dev-secret-change-in-production-32chars!"
}

export const JWT_SECRET = resolveJwtSecret()
