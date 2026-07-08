export interface RevertState {
  snapshotId: string
  sessionId: string
  filePath?: string
  description?: string
  timestamp: number
  fileCount: number
  canRevert: boolean
}

export interface Checkpoint {
  id: string
  sessionId: string
  label: string
  description?: string
  filePaths: string[]
  timestamp: number
  parentId?: string
}
