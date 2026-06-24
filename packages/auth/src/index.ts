import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "@flowmind/db";
import { OrgRole, Tier, type User, type UserRole } from "@flowmind/shared";
import { JwtPayload } from "./strategies/jwt";
import { hasPermission, Permission } from "./rbac";

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback-secret-change-in-production";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const BCRYPT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: Omit<User, "passwordHash">;
  tokens: AuthTokens;
}

function generateTokens(payload: Omit<JwtPayload, "type">): AuthTokens {
  const accessToken = jwt.sign(
    { ...payload, type: "access" },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY, issuer: "flowmind", algorithm: "HS256" },
  );

  const refreshToken = jwt.sign(
    { ...payload, type: "refresh" },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY, issuer: "flowmind", algorithm: "HS256" },
  );

  return { accessToken, refreshToken };
}

function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, { issuer: "flowmind", algorithms: ["HS256"] }) as JwtPayload;
}

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error("User with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name ?? null,
    },
  });

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
    tier: user.tier,
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: null,
      role: user.role as unknown as UserRole,
      tier: user.tier as unknown as Tier,
      orgId: user.orgId,
      stripeId: null,
      createdAt: user.createdAt,
    },
    tokens: generateTokens(payload),
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password");
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
    tier: user.tier,
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: null,
      role: user.role as unknown as UserRole,
      tier: user.tier as unknown as Tier,
      orgId: user.orgId,
      stripeId: user.stripeId,
      createdAt: user.createdAt,
    },
    tokens: generateTokens(payload),
  };
}

function refreshAccessToken(refreshToken: string): AuthTokens {
  const payload = verifyToken(refreshToken);
  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  return generateTokens({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    orgId: payload.orgId,
    tier: payload.tier,
  });
}

function revokeToken(token: string): void {
  void token;
}

export interface OAuth2Profile {
  provider: "google" | "github" | "microsoft";
  providerAccountId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
}

async function oauth2Login(profile: OAuth2Profile): Promise<AuthResult> {
  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existingAccount) {
    const user = existingAccount.user;
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      tier: user.tier,
    };

    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role as unknown as UserRole,
        tier: user.tier as unknown as Tier,
        orgId: user.orgId,
        stripeId: user.stripeId,
        createdAt: user.createdAt,
      },
      tokens: generateTokens(payload),
    };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: profile.email } });
  let user;

  if (existingUser) {
    user = existingUser;
  } else {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name ?? null,
        avatarUrl: profile.avatarUrl ?? null,
      },
    });
  }

  await prisma.account.create({
    data: {
      userId: user.id,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
    },
  });

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
    tier: user.tier,
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role as unknown as UserRole,
      tier: user.tier as unknown as Tier,
      orgId: user.orgId,
      stripeId: user.stripeId,
      createdAt: user.createdAt,
    },
    tokens: generateTokens(payload),
  };
}

export interface SamlSSOInput {
  orgId: string;
  email: string;
  name: string;
  nameId: string;
}

async function samlSSOLogin(input: SamlSSOInput): Promise<AuthResult> {
  const org = await prisma.org.findUnique({ where: { id: input.orgId } });
  if (!org) {
    throw new Error("Organization not found");
  }

  let membership = await prisma.orgMember.findFirst({
    where: {
      orgId: input.orgId,
      userId: (await prisma.user.findUnique({ where: { email: input.email } }))?.id ?? "",
    },
    include: { user: true },
  });

  if (membership) {
    const user = membership.user;
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      tier: user.tier,
    };
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role as unknown as UserRole,
        tier: user.tier as unknown as Tier,
        orgId: user.orgId,
        stripeId: user.stripeId,
        createdAt: user.createdAt,
      },
      tokens: generateTokens(payload),
    };
  }

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name },
    create: {
      email: input.email,
      name: input.name,
      orgId: input.orgId,
    },
  });

  await prisma.orgMember.create({
    data: {
      orgId: input.orgId,
      userId: user.id,
      role: OrgRole.MEMBER,
    },
  });

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
    tier: user.tier,
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role as unknown as UserRole,
      tier: user.tier as unknown as Tier,
      orgId: user.orgId,
      stripeId: user.stripeId,
      createdAt: user.createdAt,
    },
    tokens: generateTokens(payload),
  };
}

export interface RbacCheck {
  userId: string;
  orgId: string;
  requiredPermission: Permission;
}

async function enforceRbac(input: RbacCheck): Promise<boolean> {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId: input.orgId,
        userId: input.userId,
      },
    },
  });

  if (!membership) {
    return false;
  }

  return hasPermission(membership.role as unknown as OrgRole, input.requiredPermission);
}

export interface MfaTOTPSetup {
  secret: string;
  qrCodeUrl: string;
}

async function setupMfaTOTP(userId: string): Promise<MfaTOTPSetup> {
  void userId;
  return {
    secret: "PLACEHOLDER_SECRET",
    qrCodeUrl: "otpauth://totp/flowmind:user@example.com?secret=PLACEHOLDER&issuer=flowmind",
  };
}

async function verifyMfaTOTP(userId: string, token: string): Promise<boolean> {
  void userId;
  void token;
  return false;
}

export interface WebAuthnCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports: string[];
}

async function registerWebAuthn(userId: string): Promise<Record<string, unknown>> {
  void userId;
  return { challenge: "PLACEHOLDER_CHALLENGE", rp: { name: "FlowMind" }, user: { id: userId, name: "user" } };
}

async function verifyWebAuthn(userId: string, credential: Record<string, unknown>): Promise<boolean> {
  void userId;
  void credential;
  return false;
}

export const AuthService = {
  register,
  login,
  refreshAccessToken,
  revokeToken,
  oauth2Login,
  samlSSOLogin,
  enforceRbac,
  setupMfaTOTP,
  verifyMfaTOTP,
  registerWebAuthn,
  verifyWebAuthn,
  generateTokens,
  verifyToken,
  hashPassword,
  comparePassword,
};
