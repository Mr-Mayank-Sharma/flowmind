import { tRPCQuery, tRPCMutation } from "./core"

export interface WorkflowSettings {
  timezone?: string
  executionOrder?: "sequential" | "parallel"
  errorWorkflowId?: string
  saveDataOnError?: "all" | "none"
  saveManualExecutions?: boolean
  retryOnFail?: boolean
  maxRetries?: number
  timeout?: number
}

export const pipelineApi = {
  list: () => tRPCQuery<{ pipelines: any[]; nextCursor?: string }>("pipeline.list"),
  create: (input: { name: string; description?: string; graph: { nodes: any[]; edges: any[] }; settings?: WorkflowSettings }) =>
    tRPCMutation<any>("pipeline.create", { ...input, settings: input.settings ?? {} }),
  update: (input: { id: string; name?: string; description?: string; graph?: any; isActive?: boolean }) =>
    tRPCMutation<any>("pipeline.update", input),
  delete: (id: string) => tRPCMutation<{ success: boolean }>("pipeline.delete", { id }),
  getById: (id: string) => tRPCQuery<any>("pipeline.getById", { id }),
  trigger: (id: string, input?: Record<string, unknown>, settings?: WorkflowSettings) =>
    tRPCMutation<{ runId: string; status: "SUCCESS" | "FAILED" | "CANCELLED"; outputs: any[]; durationMs: number }>("pipeline.trigger", { id, input, settings: settings ?? {} }),
  executeNode: (pipelineId: string, nodeId: string, input?: Record<string, unknown>) =>
    tRPCMutation<any>("pipeline.executeNode", { pipelineId, nodeId, input }),
  validate: (graph: { nodes: any[]; edges: any[] }) =>
    tRPCQuery<{ errors: string[] }>("pipeline.validate", { graph }),
  simulate: (graph: { nodes: any[]; edges: any[] }) =>
    tRPCQuery<any>("pipeline.simulate", { graph }),
  loadOptions: (nodeType: string, field: string, config?: Record<string, unknown>, filter?: string) =>
    tRPCQuery<Array<{ label: string; value: string; description?: string }>>("pipeline.loadOptions", { nodeType, field, config, filter }),
  getRuns: (pipelineId: string) =>
    tRPCQuery<any[]>("pipeline.getRuns", { pipelineId }),
  cancelRun: (runId: string) =>
    tRPCMutation<{ success: boolean }>("pipeline.cancelRun", { runId }),
  getRunLogs: (runId: string) =>
    tRPCQuery<any[]>("pipeline.getRunLogs", { runId }),
  listMarketplace: (category?: string) =>
    tRPCQuery<any[]>("pipeline.listMarketplace", { category }),
  getMarketplaceById: (id: string) =>
    tRPCQuery<any>("pipeline.getMarketplaceById", { id }),
  publishToMarketplace: (input: { pipelineId: string; title: string; description: string; category: string; tags?: string[]; price?: number }) =>
    tRPCMutation<any>("pipeline.publishToMarketplace", input),
  cloneFromMarketplace: (marketplaceId: string) =>
    tRPCMutation<any>("pipeline.cloneFromMarketplace", { marketplaceId }),
  marketplaceCategories: () =>
    tRPCQuery<any[]>("pipeline.marketplaceCategories"),
}
