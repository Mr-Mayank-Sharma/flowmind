import { randomUUID } from "node:crypto";

/** The header a caller uses to supply or read a request id. */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * A request id is written back into a response header and into every log line for the
 * request, so it must not be able to carry newlines, quotes or unbounded length into
 * either. Anything outside this set is discarded rather than cleaned, because a mangled
 * id is worse than a replaced one: it would not match what the caller was told.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/** Mints an id for a request that did not arrive with one. */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * The caller's id when it is safe to echo, otherwise `null`. Returning `null` rather
 * than a repaired value keeps the caller's id and the logged id identical, so a
 * correlation search can never silently miss.
 */
export function parseIncomingRequestId(value: string | string[] | undefined | null): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return SAFE_REQUEST_ID.test(trimmed) ? trimmed : null;
}

/** Inherits a safe caller id, otherwise mints one. Never returns an unsafe value. */
export function resolveRequestId(value: string | string[] | undefined | null): string {
  return parseIncomingRequestId(value) ?? newRequestId();
}
