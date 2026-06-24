"use client"

import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToastStore, type ToastVariant } from "@/hooks/use-toast"

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
}

const styles: Record<ToastVariant, string> = {
  success: "border-green-500/30 bg-green-500/5",
  error: "border-red-500/30 bg-red-500/5",
  info: "border-blue-500/30 bg-blue-500/5",
  warning: "border-yellow-500/30 bg-yellow-500/5",
}

function ToastItem({ id, title, description, variant }: { id: string; title: string; description?: string; variant: ToastVariant }) {
  const dismissToast = useToastStore((s) => s.dismissToast)

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2",
        styles[variant]
      )}
    >
      <div className="mt-0.5 shrink-0">{icons[variant]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <button onClick={() => dismissToast(id)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  )
}
