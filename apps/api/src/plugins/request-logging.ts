import type { FastifyInstance, FastifyRequest } from "fastify";
import type { IncomingHttpHeaders } from "node:http";
import { REQUEST_ID_HEADER, resolveRequestId } from "../lib/request-id";

/**
 * `createContext` writes the authenticated user onto the Fastify request, so the
 * completion log can attribute a request without verifying its token a second time.
 */
type AttributedRequest = FastifyRequest & { userId?: string | null };

/**
 * Supplies `req.id`, and with it the `reqId` every child logger in the request
 * inherits. Takes the only shape it actually reads, so it satisfies both of Fastify's
 * `genReqId` overloads (the `FastifyRequest` one and the raw `IncomingMessage` one)
 * instead of depending on which one the compiler resolves.
 */
export function genRequestId(req: { headers: IncomingHttpHeaders }): string {
  return resolveRequestId(req.headers[REQUEST_ID_HEADER]);
}

/**
 * The matched route template rather than the concrete URL, so `/trpc/pipeline.getById`
 * reports one operation instead of one line per pipeline id.
 */
function operationOf(req: FastifyRequest): string {
  return req.routeOptions?.url ?? req.url;
}

/**
 * Adds the request-id and completion hooks to the root instance rather than as a
 * `register`ed plugin: Fastify encapsulates a registered plugin, and its hooks would
 * never reach the routes declared directly in `main`.
 */
export function registerRequestLogging(server: FastifyInstance): void {
  server.addHook("onRequest", async (req, reply) => {
    reply.header(REQUEST_ID_HEADER, req.id);
  });

  server.addHook("onResponse", async (req, reply) => {
    // `event` is the stage marker here rather than a separate `step` field: a single
    // HTTP request has no internal steps to report, so a constant `step` would be
    // noise. Pipeline runs, which genuinely have steps, log them from their own
    // executor rather than through this envelope.
    req.log.info(
      {
        event: "request.completed",
        requestId: req.id,
        userId: (req as AttributedRequest).userId ?? null,
        operation: operationOf(req),
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      `${req.method} ${req.url} ${reply.statusCode}`,
    );
  });
}
