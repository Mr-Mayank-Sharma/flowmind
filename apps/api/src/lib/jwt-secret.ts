function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production")
  }
  console.warn("WARNING: JWT_SECRET not set, using insecure fallback for development only")
  return "dev-secret-change-in-production-32chars!"
}

export const JWT_SECRET = resolveJwtSecret()
