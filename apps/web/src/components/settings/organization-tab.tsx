"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Plus } from "lucide-react"
import { api } from "@/lib/api"
import { useQuery, useMutation } from "@/hooks/use-query"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"

function AuditLogSection() {
  const { data: auditLog = [], loading } = useQuery(
    "settings:auditLog",
    () => api.settings.getAuditLog(),
  )

  if (loading) return <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
  if (auditLog.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No audit log entries yet</p>

  return (
    <div className="space-y-0">
      {auditLog.map((entry: any, i: number) => (
        <div key={entry.id} className="flex gap-3 pb-4 relative">
          {i < auditLog.length - 1 && (
            <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
          )}
          <div className={`mt-1.5 h-3.5 w-3.5 rounded-full border-2 shrink-0 ${
            entry.action?.includes("deploy") || entry.action?.includes("pipeline") ? "border-blue-500 bg-blue-500/20" :
            entry.type === "security" || entry.action?.includes("key") ? "border-red-500 bg-red-500/20" :
            entry.action?.includes("invite") || entry.action?.includes("Member") ? "border-purple-500 bg-purple-500/20" :
            entry.action?.includes("plan") || entry.action?.includes("billing") ? "border-amber-500 bg-amber-500/20" :
            entry.action?.includes("model") ? "border-green-500 bg-green-500/20" :
            "border-green-500 bg-green-500/20"
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{entry.action}</p>
            <p className="text-xs text-muted-foreground">{entry.details ?? entry.resource} &middot; {new Date(entry.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function OrganizationTab() {
  const { data: org, loading: orgLoading, error: orgError, refetch: refetchOrg } = useQuery(
    "settings:org",
    () => api.settings.getOrg(),
  )
  const { data: members = [], loading: membersLoading } = useQuery(
    "settings:orgMembers",
    () => api.settings.getOrgMembers(),
  )
  const { mutate: updateOrg } = useMutation(
    (input: { name?: string; slug?: string }) => api.settings.updateOrg(input),
    { onSuccess: refetchOrg },
  )
  const [orgName, setOrgName] = useState("")
  const [orgSlug, setOrgSlug] = useState("")

  useEffect(() => {
    if (org) {
      setOrgName(org.name ?? "")
      setOrgSlug(org.slug ?? "")
    }
  }, [org])

  if (orgLoading) {
    return <div className="space-y-6 py-4"><Skeleton className="h-6 w-48" /><div className="rounded-xl border bg-surface p-6 space-y-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /></div><div className="rounded-xl border bg-surface p-6 space-y-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /></div></div>
  }

  if (orgError) {
    return <ErrorState message={orgError.message} onRetry={refetchOrg} />
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Organization Profile</CardTitle>
          <CardDescription>Manage your organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {org ? (
            <>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                  {(org.name ?? "O").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{org.name}</p>
                  <p className="text-sm text-muted-foreground">{org.slug} &middot; Created {new Date(org.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Organization Name</label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Slug</label>
                  <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} />
                </div>
              </div>
              <Button onClick={() => updateOrg({ name: orgName, slug: orgSlug })}>Save Changes</Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No organization. Create one to collaborate with your team.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>{members.length} members in your organization</CardDescription>
            </div>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Invite</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {membersLoading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No members yet</p>
          ) : members.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-3">
              <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-xs font-medium shrink-0">
                {(m.user?.name ?? "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{m.user?.name ?? "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{m.user?.email}</p>
              </div>
              <Badge variant={m.role === "OWNER" || m.role === "ADMIN" ? "default" : m.role === "EDITOR" ? "secondary" : "outline"}>
                {m.role}
              </Badge>
              <p className="text-xs text-muted-foreground hidden lg:block">{new Date(m.user?.createdAt ?? Date.now()).toLocaleDateString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>Track important changes across your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogSection />
        </CardContent>
      </Card>
    </div>
  )
}
