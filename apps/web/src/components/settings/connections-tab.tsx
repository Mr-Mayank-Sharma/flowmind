"use client"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { X, Link, Github, Chrome, Slack, BookOpen } from "lucide-react"
import { api } from "@/lib/api"
import { useQuery, useMutation } from "@/hooks/use-query"
import { Skeleton } from "@/components/ui/skeleton"

export function ConnectionsTab() {
  const { data: connections = [], loading, refetch } = useQuery(
    "settings:connections",
    () => api.settings.getConnections(),
  )

  const { mutate: deleteConnection } = useMutation(
    (id: string) => api.settings.deleteConnection(id),
    { onSuccess: refetch },
  )

  const providerIcons: Record<string, React.ElementType> = {
    github: Github, google: Chrome, slack: Slack, notion: BookOpen,
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>OAuth Connections</CardTitle>
          <CardDescription>Connect your accounts to enable integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : connections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No connected accounts yet</p>
          ) : connections.map((conn: any) => {
            const provider = conn.provider.toLowerCase()
            const Icon = providerIcons[provider] ?? Link
            return (
              <div key={conn.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-4">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium capitalize">{conn.provider}</p>
                  <p className="text-xs text-muted-foreground">Scope: {conn.scope ?? "Full access"}</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => deleteConnection(conn.id)}>
                  <X className="h-3.5 w-3.5" />
                  Revoke
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
