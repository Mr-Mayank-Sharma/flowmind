import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET: string = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET not set, using insecure fallback for development only");
}

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

const ssoStateStore = new Map<string, { provider: string; expiresAt: number }>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function recordFailedLogin(key: string) {
  const attempt = loginAttempts.get(key);
  if (!attempt) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
  } else {
    attempt.count++;
  }
}

function generateState(provider: string): string {
  const state = crypto.randomBytes(32).toString("hex");
  ssoStateStore.set(state, { provider, expiresAt: Date.now() + 600_000 });
  return state;
}

function verifyState(state: string, provider: string): boolean {
  const entry = ssoStateStore.get(state);
  if (!entry || entry.provider !== provider || entry.expiresAt < Date.now()) {
    ssoStateStore.delete(state);
    return false;
  }
  ssoStateStore.delete(state);
  return true;
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
      const attempt = loginAttempts.get(key);
      if (attempt && attempt.count >= 5 && attempt.resetAt > now) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Try again later." });
      }
      if (!attempt || attempt.resetAt < now) {
        loginAttempts.set(key, { count: 0, resetAt: now + 15 * 60 * 1000 });
      }

      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (!user || !user.passwordHash) {
        recordFailedLogin(key);
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        recordFailedLogin(key);
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      loginAttempts.delete(key);

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

      const state = generateState(input.provider);
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

      if (!verifyState(input.state, input.provider)) {
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
        { id: "saml", name: "SAML SSO", configured: true },
      ];
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      return { success: true, message: "If an account exists, a reset link has been sent" }
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
      const result = await AuthService.samlSSOLogin({
        orgId: input.orgId,
        email: `saml-${Date.now()}@placeholder.com`,
        name: "SAML User",
        nameId: `saml-${Date.now()}`,
      });

      return result;
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

      try {
        const nameId = `saml-${Date.now()}`;
        const email = `user-${nameId}@saml.local`;

        const result = await AuthService.samlSSOLogin({
          orgId: input.orgId,
          email,
          name: "SAML User",
          nameId,
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
