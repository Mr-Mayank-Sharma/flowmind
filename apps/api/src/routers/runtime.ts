import { z } from "zod"
import { router, publicProcedure } from "../middleware/trpc"
import { runtimeRegistry, RuntimeManifestSchema } from "@flowmind/runtime-registry"

export const runtimeRouter = router({
  list: publicProcedure.query(() => {
    return runtimeRegistry.list().map((r) => ({
      id: r.id,
      name: r.manifest.name,
      endpoint: r.manifest.endpoint,
      description: r.manifest.description,
      version: r.manifest.version,
      status: r.status,
      capabilities: r.manifest.capabilities,
      registeredAt: r.registeredAt.toISOString(),
      lastHealthCheck: r.lastHealthCheck?.toISOString() ?? null,
      currentLoad: r.currentLoad,
    }))
  }),

  register: publicProcedure
    .input(RuntimeManifestSchema)
    .mutation(({ input }) => {
      const runtime = runtimeRegistry.register(input)
      return {
        id: runtime.id,
        name: runtime.manifest.name,
        status: runtime.status,
      }
    }),

  unregister: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const success = runtimeRegistry.unregister(input.id)
      return { success }
    }),

  dispatch: publicProcedure
    .input(z.object({ nodeType: z.string(), inputType: z.string().optional() }))
    .query(({ input }) => {
      const result = runtimeRegistry.dispatch(input)
      return result ?? { error: "No matching runtime available" }
    }),

  healthCheck: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const runtime = runtimeRegistry.get(input.id)
      if (!runtime) return { error: "Runtime not found" }
      return {
        id: runtime.id,
        status: runtime.status,
        lastHealthCheck: runtime.lastHealthCheck?.toISOString() ?? null,
      }
    }),
})
