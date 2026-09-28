/**
 * One place decides what may never appear in a log line. Every logger in the API is
 * built from `buildLoggerOptions`, so a field that is secret here is secret in the
 * Fastify request logger, in the tRPC child loggers that inherit it, and in the
 * standalone `infrastructure` logger. A secret is defined once and enforced once.
 */

import type { LogFn } from "pino";

/** What a secret is replaced with. Deliberately obviously fake so nobody reads it. */
export const REDACTED = "[redacted]";

/**
 * Field names that carry a credential outright, written already normalised (lowercase,
 * letters and digits only) so `X-Internal-Token`, `x_internal_token` and
 * `xInternalToken` are all recognised as the same field.
 */
const SECRET_FIELDS: ReadonlySet<string> = new Set([
  "authorization",
  "proxyauthorization",
  "cookie",
  "setcookie",
  "password",
  "passwordhash",
  "passwd",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "bearertoken",
  "sessiontoken",
  "verificationsignature",
  "hubverifytoken",
  "apikey",
  "xapikey",
  "xinternaltoken",
  "internaltoken",
  "secret",
  "clientsecret",
  "signingsecret",
  "webhooksecret",
  "privatekey",
  "encryptedvalue",
  "decryptedvalue",
  "signature",
  "stripesignature",
  "xhubsignature",
  "xwebhooksignature",
]);

/**
 * Suffixes for namespaced fields such as `openaiApiKey` or `slackBotToken`, which are
 * just as much secrets as the bare name. Kept as suffixes rather than substrings so
 * `keywords`, `maxTokens` and `monkey` are left alone.
 */
const SECRET_SUFFIXES: readonly string[] = [
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "privatekey",
  "signature",
  "encryptedvalue",
];

const normaliseField = (field: string): string => field.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Whether a field name denotes a credential and so must never be logged verbatim. */
export function isSecretField(field: string): boolean {
  const name = normaliseField(field);
  if (SECRET_FIELDS.has(name)) return true;
  return SECRET_SUFFIXES.some((suffix) => name.length > suffix.length && name.endsWith(suffix));
}

/** Credentials that get embedded in free text -- URLs, headers, error messages. */
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g;

/** Masks credentials that were interpolated into a message instead of passed as a field. */
export function scrubText(text: string): string {
  return text.replace(BEARER_TOKEN, `Bearer ${REDACTED}`).replace(JWT, REDACTED);
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A deep copy of `value` with every credential masked. Errors keep their stack, because
 * the stack is usually the only thing that says where a failure came from, but it is
 * scrubbed too since paths and URLs end up in it. The `seen` set holds the current
 * descent path only, so a value referenced twice in a sibling position is copied twice
 * while a genuine cycle is reported rather than followed.
 */
export function redactSecrets<T>(value: T, seen: Set<object> = new Set()): T {
  if (typeof value === "string") return scrubText(value) as T;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (ArrayBuffer.isView(value)) return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubText(value.message),
      ...(value.stack ? { stack: scrubText(value.stack) } : {}),
    } as T;
  }

  if (seen.has(value)) return "[circular]" as T;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => redactSecrets(item, seen)) as T;
    }
    const output: Record<string, unknown> = {};
    for (const [field, nested] of Object.entries(value)) {
      output[field] = isSecretField(field) ? REDACTED : redactSecrets(nested, seen);
    }
    return output as T;
  } finally {
    seen.delete(value);
  }
}

/**
 * Paths pino masks on its own. These cover the structural leaks -- credentials in
 * headers, webhook bodies, the raw Stripe body and the encrypted column -- including
 * the ones pino sees through `req`/`res`/`err` child bindings, which bypass `logMethod`.
 * The deep field-name rules in `redactSecrets` handle everything else.
 */
export const LOG_REDACT_PATHS: readonly string[] = [
  "req.headers.authorization",
  'req.headers["x-internal-token"]',
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "headers.authorization",
  'headers["x-internal-token"]',
  "headers.cookie",
  "payload",
  "*.payload",
  "rawBody",
  "*.rawBody",
  "body.rawBody",
  "encryptedValue",
  "*.encryptedValue",
  "*.password",
  "*.passwordHash",
  "*.apiKey",
  "*.accessToken",
  "*.refreshToken",
  "*.secret",
  "*.token",
];

type LogMethodArgs = Parameters<LogFn>;

/**
 * The single enforcement point for field-level redaction. Every explicit `.info(obj,
 * msg)` call reaches a logger through this hook, so a call site cannot leak a
 * credential by forgetting to sanitise. Child loggers created with `req`/`res`/`err`
 * bindings do not pass through here, which is why `LOG_REDACT_PATHS` exists as well.
 *
 * pino hands over the original log function and expects the hook to *call* it. A hook
 * that only returns the rewritten arguments writes nothing at all, which is the worst
 * possible failure here: the log would silently vanish rather than leak.
 */
function redactLogArgs(this: unknown, inputArgs: LogMethodArgs, method: LogFn): void {
  const [first, ...rest] = inputArgs;

  if (isPlainRecord(first)) {
    method.apply(this, [redactSecrets(first), ...rest] as LogMethodArgs);
    return;
  }
  if (typeof first === "string") {
    method.apply(this, [scrubText(first), ...rest] as LogMethodArgs);
    return;
  }
  method.apply(this, inputArgs);
}

export interface FlowMindLoggerOptions {
  level: string;
  redact: { paths: string[]; censor: string };
  hooks: { logMethod: (this: unknown, inputArgs: LogMethodArgs, method: LogFn) => void };
}

/** The pino options every logger in the API is constructed from. */
export function buildLoggerOptions(): FlowMindLoggerOptions {
  return {
    level: process.env.LOG_LEVEL || "info",
    redact: { paths: [...LOG_REDACT_PATHS], censor: REDACTED },
    hooks: { logMethod: redactLogArgs },
  };
}
