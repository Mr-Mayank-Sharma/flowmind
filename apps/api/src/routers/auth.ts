import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { JWT_SECRET } from "../lib/jwt-secret";
import { sendMail, smtpConfigured } from "../lib/mailer";
import { getStateStore } from "../lib/redis";

const APP_URL = process.env.APP_URL || "http://localhost:4000";

const SSO_CLIENTS: Record<string, { authorizeUrl: string; tokenUrl: string; clientId: string; clientSecret: string; scopes: string[]; userUrl: string }> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    scopes: ["openid", "email", "profile"],
    userUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    scopes: ["user:email"],
    userUrl: "https://api.github.com/user",
  },
};

const stateStore = getStateStore();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const SSO_STATE_TTL_MS = 600_000;

interface LoginAttemptEntry {
  count: number;
  resetAt: number;
}

async function readLoginAttempts(key: string): Promise<LoginAttemptEntry | null> {
  const raw = await stateStore.get(`auth:attempts:${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LoginAttemptEntry;
    if (typeof parsed.count !== "number" || typeof parsed.resetAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function recordFailedLogin(key: string): Promise<void> {
  const now = Date.now();
  const current = await readLoginAttempts(key);
  const entry: LoginAttemptEntry =
    current && current.resetAt > now
      ? { count: current.count + 1, resetAt: current.resetAt }
      : { count: 1, resetAt: now + LOGIN_WINDOW_MS };
  await stateStore.set(`auth:attempts:${key}`, JSON.stringify(entry), Math.max(1, entry.resetAt - now));
}

async function clearLoginAttempts(key: string): Promise<void> {
  await stateStore.del(`auth:attempts:${key}`);
}

async function generateState(provider: string): Promise<string> {
  const state = crypto.randomBytes(32).toString("hex");
  await stateStore.set(`auth:sso:${state}`, JSON.stringify({ provider, expiresAt: Date.now() + SSO_STATE_TTL_MS }), SSO_STATE_TTL_MS);
  return state;
}

async function verifyState(state: string, provider: string): Promise<boolean> {
  const key = `auth:sso:${state}`;
  const raw = await stateStore.get(key);
  await stateStore.del(key);
  if (!raw) return false;
  try {
    const entry = JSON.parse(raw) as { provider: string; expiresAt: number };
    return entry.provider === provider && entry.expiresAt >= Date.now();
  } catch {
    return false;
  }
}

export const authRouter = router({
  register: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });

      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await ctx.prisma.user.create({
        data: { email: input.email, passwordHash, name: input.name },
      });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "15m" });
      const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

      return { user: { id: user.id, email: user.email, name: user.name }, token, refreshToken };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const key = `${ctx.req.ip}:${input.email.toLowerCase()}`;
      const now = Date.now();
      const attempt = await readLoginAttempts(key);
      if (attempt && attempt.count >= MAX_LOGIN_ATTEMPTS && attempt.resetAt > now) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Try again later." });
      }

      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (!user || !user.passwordHash) {
        await recordFailedLogin(key);
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        await recordFailedLogin(key);
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await clearLoginAttempts(key);

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "15m" });
      const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

      return {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, tier: user.tier },
        token,
        refreshToken,
      };
    }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId! } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: user.id, email: user.email, name: user.name, role: user.role, tier: user.tier };
    }),

  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const payload = jwt.verify(input.refreshToken, JWT_SECRET) as unknown as { userId: string };
        const user = await ctx.prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "15m" });
        const newRefreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

        return {
          user: { id: user.id, email: user.email, name: user.name, role: user.role, tier: user.tier },
          token,
          refreshToken: newRefreshToken,
        };
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired refresh token" });
      }
    }),

  ssoUrl: publicProcedure
    .input(z.object({ provider: z.enum(["google", "github"]) }))
    .query(async ({ input }) => {
      const client = SSO_CLIENTS[input.provider];
      if (!client || !client.clientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${input.provider} SSO not configured` });
      }

      const state = await generateState(input.provider);
      const params = new URLSearchParams({
        client_id: client.clientId,
        redirect_uri: `${APP_URL}/auth/callback`,
        response_type: "code",
        scope: client.scopes.join(" "),
        state,
        ...(input.provider === "google" ? { access_type: "offline", prompt: "consent" } : {}),
      });

      return { url: `${client.authorizeUrl}?${params.toString()}`, state };
    }),

  ssoCallback: publicProcedure
    .input(z.object({
      provider: z.enum(["google", "github"]),
      code: z.string(),
      state: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const client = SSO_CLIENTS[input.provider];
      if (!client || !client.clientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${input.provider} SSO not configured` });
      }

      if (!(await verifyState(input.state, input.provider))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired state parameter" });
      }

      const tokenRes = await fetch(client.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          code: input.code,
          client_id: client.clientId,
          client_secret: client.clientSecret,
          redirect_uri: `${APP_URL}/auth/callback`,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Failed to exchange authorization code" });
      }

      const tokenData = await tokenRes.json() as any;
      const accessToken = tokenData.access_token;

      const userRes = await fetch(client.userUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userRes.ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Failed to fetch user profile" });
      }

      const profile = await userRes.json() as any;
      const email = profile.email || profile.login + "@github.com";
      const name = profile.name || profile.login || email.split("@")[0];
      const avatarUrl = profile.picture || profile.avatar_url;

      const providerAccountId = input.provider === "google" ? profile.id : String(profile.id);

      const existingAccount = await ctx.prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: input.provider,
            providerAccountId,
          },
        },
        include: { user: true },
      });

      let user;
      if (existingAccount) {
        user = existingAccount.user;
        await ctx.prisma.account.update({
          where: { id: existingAccount.id },
          data: { accessToken },
        });
      } else {
        const existingUser = await ctx.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          user = existingUser;
        } else {
          user = await ctx.prisma.user.create({
            data: { email, name, avatarUrl },
          });
        }
        await ctx.prisma.account.create({
          data: {
            userId: user.id,
            provider: input.provider,
            providerAccountId,
            accessToken,
          },
        });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "15m" });
      const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

      return {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, tier: user.tier, avatarUrl: user.avatarUrl },
        token,
        refreshToken,
      };
    }),

  ssoProviders: publicProcedure
    .query(async () => {
      return [
        { id: "google", name: "Google", configured: !!SSO_CLIENTS.google?.clientId },
        { id: "github", name: "GitHub", configured: !!SSO_CLIENTS.github?.clientId },
        { id: "saml", name: "SAML SSO", configured: !!process.env.SAML_ENTRY_POINT && !!process.env.SAML_CERT },
      ];
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (!user || !user.passwordHash) {
        return { success: true, message: "If an account exists, a reset link has been sent" };
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: tokenHash, passwordResetExpiresAt: expiresAt },
      });

      const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;

      const sent = await sendMail({
        to: user.email,
        subject: "FlowMind password reset",
        text: `Reset your FlowMind password:\n${resetUrl}\n\nThis link expires in 1 hour.`,
      });

      if (!sent) {
        ctx.req.log.info?.(
          { email: user.email, smtpConfigured },
          "Password reset requested but email could not be delivered",
        );
      }

      return { success: true, message: "If an account exists, a reset link has been sent" };
    }),

  resetPassword: publicProcedure
    .input(z.object({ token: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const tokenHash = crypto.createHash("sha256").update(input.token).digest("hex");
      const user = await ctx.prisma.user.findFirst({
        where: { passwordResetToken: tokenHash, passwordResetExpiresAt: { gt: new Date() } },
      });

      if (!user) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset token" });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null },
      });

      return { success: true };
    }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId! } });
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No password set for this account" });
      }
      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect" });
      }
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      return { success: true };
    }),

  samlMetadata: publicProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ input, ctx }) => {
      const org = await ctx.prisma.org.findUnique({ where: { id: input.orgId } });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const config = org.samlConfig as Record<string, unknown> | null;
      if (!config) throw new TRPCError({ code: "BAD_REQUEST", message: "SAML not configured for this organization" });

      return {
        entityId: `urn:flowmind:${org.id}`,
        acsUrl: `${APP_URL}/api/auth/saml/callback?orgId=${org.id}`,
        metadataUrl: `${APP_URL}/api/auth/saml/metadata?orgId=${org.id}`,
        idpEntityId: config.idpEntityId,
        idpSsoUrl: config.idpSsoUrl,
        idpCertificate: config.idpCertificate,
      };
    }),

  samlLogin: publicProcedure
    .input(z.object({ orgId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const org = await ctx.prisma.org.findUnique({ where: { id: input.orgId } });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const config = org.samlConfig as Record<string, unknown> | null;
      if (!config) throw new TRPCError({ code: "BAD_REQUEST", message: "SAML not configured" });

      const { AuthService } = await import("@flowmind/auth");
      const relayState = crypto.randomBytes(24).toString("hex");

      try {
        const url = await AuthService.samlBuildLoginUrl(input.orgId, config as never, relayState);
        return { url, relayState };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message ?? "Failed to build SAML login request" });
      }
    }),

  samlCallback: publicProcedure
    .input(z.object({
      orgId: z.string(),
      samlResponse: z.string(),
      relayState: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const org = await ctx.prisma.org.findUnique({ where: { id: input.orgId } });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const config = org.samlConfig as Record<string, unknown> | null;
      if (!config) throw new TRPCError({ code: "BAD_REQUEST", message: "SAML not configured" });

      const { AuthService } = await import("@flowmind/auth");

      let profile;
      try {
        profile = await AuthService.samlValidateCallback(input.orgId, config as never, input.samlResponse, input.relayState);
      } catch (err: any) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: err.message ?? "SAML authentication failed" });
      }

      try {
        const result = await AuthService.samlSSOLogin({
          orgId: input.orgId,
          email: profile.email,
          name: profile.name,
          nameId: profile.nameId,
        });
        return result;
      } catch (err: any) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: err.message ?? "SAML authentication failed" });
      }
    }),

  setupSaml: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      idpEntityId: z.string(),
      idpSsoUrl: z.string(),
      idpCertificate: z.string(),
      attributeMapping: z.object({
        email: z.string().optional(),
        name: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const membership = await ctx.prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: input.orgId, userId: ctx.userId! } },
      });
      if (!membership || membership.role !== "OWNER") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only org owner can configure SAML" });
      }

      await ctx.prisma.org.update({
        where: { id: input.orgId },
        data: {
          samlConfig: {
            idpEntityId: input.idpEntityId,
            idpSsoUrl: input.idpSsoUrl,
            idpCertificate: input.idpCertificate,
            attributeMapping: input.attributeMapping ?? { email: "email", name: "name" },
          },
        },
      });

      return { success: true };
    }),

  setupMfa: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { AuthService } = await import("@flowmind/auth");
      return AuthService.setupMfaTOTP(ctx.userId!);
    }),

  getMfaStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId! },
        select: { mfaEnabled: true, mfaSecret: true },
      });
      return { enabled: !!user?.mfaEnabled, pendingSetup: !!user?.mfaSecret };
    }),

  verifyMfa: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { AuthService } = await import("@flowmind/auth");
      return AuthService.verifyMfaTOTP(ctx.userId!, input.token);
    }),

  confirmMfa: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { AuthService } = await import("@flowmind/auth");
      return AuthService.confirmMfaTOTP(ctx.userId!, input.token);
    }),

  disableMfa: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { AuthService } = await import("@flowmind/auth");
      await AuthService.disableMfaTOTP(ctx.userId!);
      return { success: true };
    }),

  registerWebauthn: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { AuthService } = await import("@flowmind/auth");
      return AuthService.registerWebAuthn(ctx.userId!);
    }),

  verifyWebauthn: protectedProcedure
    .input(z.object({ credential: z.record(z.unknown()) }))
    .mutation(async ({ input, ctx }) => {
      const { AuthService } = await import("@flowmind/auth");
      return AuthService.verifyWebAuthn(ctx.userId!, input.credential);
    }),
});
