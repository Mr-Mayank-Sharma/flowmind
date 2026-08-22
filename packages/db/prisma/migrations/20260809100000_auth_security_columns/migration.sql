-- AlterTable
ALTER TABLE "users"
  ADD COLUMN     "mfaSecret" TEXT,
  ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "webauthnChallenge" TEXT,
  ADD COLUMN     "webauthnCredentials" JSONB,
  ADD COLUMN     "passwordResetToken" TEXT,
  ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3);

-- Migrate legacy MFA/WebAuthn state out of defaultModel
UPDATE "users"
SET "mfaSecret" = replace("defaultModel", 'mfa_secret:', ''),
    "mfaEnabled" = true,
    "defaultModel" = NULL
WHERE "defaultModel" LIKE 'mfa_secret:%';

UPDATE "users"
SET "webauthnChallenge" = replace("defaultModel", 'webauthn_challenge:', ''),
    "defaultModel" = NULL
WHERE "defaultModel" LIKE 'webauthn_challenge:%';
