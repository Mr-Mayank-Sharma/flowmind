import pino from "pino";
import { buildLoggerOptions } from "../lib/log-redaction";

const isDev = process.env.NODE_ENV !== "production";

// The same options the Fastify server logger is built from, so a secret masked in a
// request log is masked here too.
export const logger = pino({
  ...buildLoggerOptions(),
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});
