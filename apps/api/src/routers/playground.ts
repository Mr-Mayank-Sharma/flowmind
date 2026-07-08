import { z } from "zod";
import { router, protectedProcedure } from "../middleware/trpc";

export const playgroundRouter = router({
  execute: protectedProcedure
    .input(z.object({
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
      url: z.string().url(),
      headers: z.record(z.string()).optional(),
      body: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const start = Date.now();
      try {
        const headers: Record<string, string> = {
          ...(input.headers || {}),
        };
        if (input.body && !headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }

        const res = await fetch(input.url, {
          method: input.method,
          headers,
          body: input.body || undefined,
          signal: AbortSignal.timeout(30000),
        });

        const text = await res.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = text; }

        const duration = Date.now() - start;

        return {
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(res.headers.entries()),
          data,
          duration,
          success: true,
        };
      } catch (e) {
        return {
          status: 0,
          statusText: "Error",
          headers: {},
          data: e instanceof Error ? e.message : "Request failed",
          duration: Date.now() - start,
          success: false,
        };
      }
    }),
});
