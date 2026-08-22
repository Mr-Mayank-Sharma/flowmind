import { tRPCQuery, tRPCMutation, tRPCQueryAsHost, tRPCMutationAsHost } from "./core"

export interface HostGroup {
  id: string
  name: string
  slug: string
  role: string
  memberCount: number
  pipelineCount: number
  skillCount: number
  knowledgeCount: number
  members: { id: string; name: string | null; email: string; role: string }[]
}

export interface ConnectToken {
  clientId: string
  clientName: string
  token: string
  groupId: string
  expiresAt: string
}

export interface HostClientInfo {
  id: string
  name: string
  url: string | null
  status: string
  lastConnectedAt: string | null
  lastSyncAt: string | null
  createdAt: string
}

export interface ProposalComment {
  id: string
  authorId: string | null
  authorName: string | null
  body: string
  createdAt: string
}

export interface PipelineProposal {
  id: string
  name: string
  description: string | null
  status: "PROPOSED" | "APPROVED" | "REJECTED" | "MERGED"
  baseVersion: number
  proposedByName: string | null
  proposedByClient: string | null
  message: string | null
  rejectedReason: string | null
  rejectedAt: string | null
  diff?: any
  proposedGraph?: any
  baseGraph?: any
  createdAt: string
  mergedAt: string | null
  group?: { id: string; name: string }
  _count?: { comments: number }
  comments?: ProposalComment[]
}

export const hostApi = {
  listGroups: () => tRPCQuery<{ groups: HostGroup[] }>("host.listGroups"),
  createGroup: (input: { name: string; slug?: string }) => tRPCMutation<HostGroup>("host.createGroup", input),
  addGroupMember: (input: { groupId: string; email: string; role?: string }) => tRPCMutation<any>("host.addGroupMember", input),
  removeGroupMember: (input: { groupId: string; userId: string }) => tRPCMutation<{ success: boolean }>("host.removeGroupMember", input),
  createConnectToken: (input: { groupId: string; clientName: string; expiresInHours?: number }) =>
    tRPCMutation<ConnectToken>("host.createConnectToken", input),
  listClients: () => tRPCQuery<{ clients: HostClientInfo[] }>("host.listClients"),
  revokeClient: (clientId: string) => tRPCMutation<{ success: boolean }>("host.revokeClient", { clientId }),
  createPipeline: (input: { groupId: string; name: string; description?: string; graph: any }) =>
    tRPCMutation<any>("host.createPipeline", input),
  upsertKnowledge: (input: { groupId: string; name: string; content: string; docId?: string; description?: string }) =>
    tRPCMutation<{ docId: string }>("host.upsertKnowledge", input),
  deleteKnowledge: (input: { groupId: string; docId: string }) => tRPCMutation<{ success: boolean }>("host.deleteKnowledge", input),
  listProposals: (input: { groupId?: string; status?: string; limit?: number }) =>
    tRPCQuery<{ proposals: PipelineProposal[]; nextCursor?: string }>("host.listProposals", input),
  getProposal: (id: string) => tRPCQuery<PipelineProposal & { group: any; comments: ProposalComment[] }>("host.getProposal", { id }),
  addProposalComment: (input: { proposalId: string; body: string }) => tRPCMutation<ProposalComment>("host.addProposalComment", input),
  approveProposal: (id: string) => tRPCMutation<PipelineProposal>("host.approveProposal", { id }),
  rejectProposal: (input: { id: string; reason: string }) => tRPCMutation<PipelineProposal>("host.rejectProposal", input),
  mergeProposal: (id: string) => tRPCMutation<PipelineProposal>("host.mergeProposal", { id }),
}

export const hostClientApi = (hostUrl: string, token: string) => ({
  connect: (input: { token: string; email: string; name?: string; url?: string }) =>
    tRPCMutationAsHost<{ hostClientToken: string; clientId: string; groupId: string; groupName: string; expiresInHours: number }>("host.connect", hostUrl, input.token, input),
  pull: () => tRPCQueryAsHost<{ groupId: string; syncedAt: string; pipelines: any[]; skills: any[]; knowledge: any[] }>("host.client.pull", hostUrl, token),
  searchContext: (input: { text: string; topK?: number }) =>
    tRPCQueryAsHost<{ chunks: any[] }>("host.client.searchContext", hostUrl, token, input),
  proposePipeline: (input: { basePipelineId: string; name: string; description?: string; proposedGraph: any; message?: string }) =>
    tRPCMutationAsHost<any>("host.client.proposePipeline", hostUrl, token, input),
  routeInference: (input: { model?: string; prompt: string; system?: string; temperature?: number }) =>
    tRPCMutationAsHost<any>("host.client.routeInference", hostUrl, token, input),
})
