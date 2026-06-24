"use client"

import { useState } from "react"
import { Bell, CheckCheck, X, Info, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "warning" | "success" | "error"
  time: string
  read: boolean
}

const mockNotifications: Notification[] = [
  { id: "1", title: "Pipeline completed", message: "Customer Support Agent pipeline finished successfully.", type: "success", time: "2 min ago", read: false },
  { id: "2", title: "Agent deployed", message: "Sales Assistant v2.1 deployed to production.", type: "info", time: "15 min ago", read: false },
  { id: "3", title: "High latency detected", message: "LLM response time exceeded 5s threshold.", type: "warning", time: "1 hour ago", read: false },
  { id: "4", title: "API key expiring", message: "OpenAI API key expires in 7 days.", type: "error", time: "3 hours ago", read: true },
  { id: "5", title: "Storage alert", message: "Context store at 82% capacity.", type: "warning", time: "5 hours ago", read: true },
]

const iconMap = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: X,
}

const colorMap = {
  info: "text-blue-500 bg-blue-500/10",
  warning: "text-amber-500 bg-amber-500/10",
  success: "text-emerald-500 bg-emerald-500/10",
  error: "text-red-500 bg-red-500/10",
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState(mockNotifications)
  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-border bg-surface shadow-dropdown animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Bell className="h-8 w-8" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const Icon = iconMap[notif.type]
                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        "flex gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-accent/50 transition-colors cursor-pointer",
                        !notif.read && "bg-primary/[0.02]"
                      )}
                    >
                      <div className={cn("mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0", colorMap[notif.type])}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-sm truncate", !notif.read && "font-medium")}>{notif.title}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{notif.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      </div>
                      {!notif.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                    </div>
                  )
                })
              )}
            </div>
            <div className="border-t border-border px-4 py-2">
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center">
                <ExternalLink className="h-3 w-3" />
                View all notifications
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
