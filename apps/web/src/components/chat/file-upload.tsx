"use client"

import { useState, useRef, useCallback } from "react"
import { Paperclip, X, FileText, File, Upload, Loader2 } from "lucide-react"
import { cn } from "@flowmind/ui"

export interface UploadedFile {
  name: string
  size: number
  type: string
  url?: string
  file: File
}

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 50 * 1024 * 1024
const ACCEPTED_TYPES = [
  "text/plain", "text/markdown", "text/csv",
  "application/pdf", "application/json",
  "image/png", "image/jpeg", "image/gif", "image/webp",
]

export function FileUpload({ onFilesSelected, disabled }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const newFiles: UploadedFile[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i)
      if (!file || file.size > MAX_FILE_SIZE) continue
      newFiles.push({
        name: file.name,
        size: file.size,
        type: file.type,
        file,
      })
    }
    setSelectedFiles(prev => [...prev, ...newFiles])
    onFilesSelected(newFiles)
  }, [onFilesSelected])

  const removeFile = useCallback((name: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== name))
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        aria-label="Attach file"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      </button>

      {selectedFiles.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm">
          <div className="rounded-lg border border-border bg-surface p-2 shadow-lg space-y-1">
            {selectedFiles.map((f) => (
              <div key={f.name} className="flex items-center gap-2 px-2 py-1.5 rounded bg-background/50 text-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                <button onClick={() => removeFile(f.name)} className="p-0.5 rounded hover:bg-accent">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
