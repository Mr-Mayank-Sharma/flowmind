export type WorkspaceId = string
export type ProjectId = string
export type LocationRef = `/${string}` | `${string}/${string}`

export interface Workspace {
  id: WorkspaceId
  name: string
  slug: string
  tier: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: ProjectId
  workspaceId: WorkspaceId
  name: string
  description?: string
  rootPath: string
  createdAt: string
}

export interface ScopedRef<TKind extends string> {
  kind: TKind
  workspaceId: WorkspaceId
  projectId?: ProjectId
  id: string
}

export function scopedRef<T extends string>(kind: T, workspaceId: string, id: string, projectId?: string): ScopedRef<T> {
  return { kind, workspaceId, projectId, id }
}

export function formatRef(ref: ScopedRef<string>): string {
  return `${ref.workspaceId}/${ref.projectId ?? "_"}/${ref.kind}/${ref.id}`
}
