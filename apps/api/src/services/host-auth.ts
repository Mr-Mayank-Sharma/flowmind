import jwt from "jsonwebtoken"
import type { SignOptions } from "jsonwebtoken"
import crypto from "crypto"

import { JWT_SECRET } from "../lib/jwt-secret"

export interface ConnectTokenPayload {
  type: "host-connect"
  clientId: string
  groupId: string
}

export interface HostClientTokenPayload {
  type: "host-client"
  clientId: string
  groupId: string
  email: string
}

export interface HostGroupTokenPayload {
  type: "host-group"
  userId: string
  groupId: string
}

export function hashConnectToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export function signConnectToken(payload: ConnectTokenPayload, expiresIn: SignOptions["expiresIn"]): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

export function signHostClientToken(payload: HostClientTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" })
}

export function verifyHostClientToken(token: string): HostClientTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as HostClientTokenPayload
    if (payload.type !== "host-client") return null
    return payload
  } catch {
    return null
  }
}
