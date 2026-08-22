"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Plus,
  RefreshCw,
  Copy,
  Check,
  Users,
  GitBranch,
  Book,
  KeyRound,
  ShieldOff,
  Loader2,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/hooks/use-toast"
import { api, type HostGroup, type HostClientInfo } from "@/lib/api"

const roleColor: Record<string, string> = {
  OWNER: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  ADMIN: "text-blue-500 border-blue-500/30 bg-blue-500/10",
  MEMBER: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  VIEWER: "text-muted-foreground border-border bg-muted",
}

export function HostPanel() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<HostGroup[]>([])
  const [clients, setClients] = useState<HostClientInfo[]>([])

  const [groupName, setGroupName] = useState("")
  const [creating, setCreating] = useState(false)

  const [tokenGroupId, setTokenGroupId] = useState("")
  const [tokenName, setTokenName] = useState("")
  const [tokenExpiry, setTokenExpiry] = useState("168")
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)

  const [addEmail, setAddEmail] = useState("")
  const [addRole, setAddRole] = useState("MEMBER")

  const [pubGroupId, setPubGroupId] = useState("")
  const [pubName, setPubName] = useState("")
  const [pubGraph, setPubGraph] = useState('{"nodes":[{"id":"1","type":"manualTrigger","label":"Start","position":{"x":0,"y":0},"config":{}}],"edges":[]}')
  const [publishing, setPublishing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [g, c] = await Promise.all([api.host.listGroups(), api.host.listClients()])
      setGroups(g.groups)
      setClients(c.clients)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load host data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createGroup = async () => {
    if (!groupName.trim()) return
    setCreating(true)
    try {
      const g = await api.host.createGroup({ name: groupName.trim() })
      toastSuccess("Group created", g.name)
      setGroupName("")
      await load()
    } catch (e: any) {
      toastError("Failed to create group", e?.message)
    } finally {
      setCreating(false)
    }
  }

  const createToken = async () => {
    if (!tokenGroupId || !tokenName.trim()) return
    setTokenLoading(true)
    try {
      const res = await api.host.createConnectToken({
        groupId: tokenGroupId,
        clientName: tokenName.trim(),
        expiresInHours: Number(tokenExpiry) || 168,
      })
      setCreatedToken(res.token)
      toastSuccess("Connect token created", "Copy it now — it is shown once")
      await load()
    } catch (e: any) {
      toastError("Failed to create token", e?.message)
    } finally {
      setTokenLoading(false)
    }
  }

  const addMember = async (groupId: string) => {
    if (!addEmail.trim()) return
    try {
      await api.host.addGroupMember({ groupId, email: addEmail.trim(), role: addRole })
      toastSuccess("Member added")
      setAddEmail("")
      await load()
    } catch (e: any) {
      toastError("Failed to add member", e?.message)
    }
  }

  const removeMember = async (groupId: string, userId: string) => {
    try {
      await api.host.removeGroupMember({ groupId, userId })
      toastSuccess("Member removed")
      await load()
    } catch (e: any) {
      toastError("Failed to remove member", e?.message)
    }
  }

  const revokeClient = async (clientId: string) => {
    try {
      await api.host.revokeClient(clientId)
      toastSuccess("Client revoked")
      await load()
    } catch (e: any) {
      toastError("Failed to revoke client", e?.message)
    }
  }

  const copyToken = async () => {
    if (!createdToken) return
    try {
      await navigator.clipboard.writeText(createdToken)
      toastSuccess("Token copied")
    } catch {
      toastError("Copy failed")
    }
  }

  const publishPipeline = async () => {
    if (!pubGroupId || !pubName.trim()) return
    let graph: any
    try {
      graph = JSON.parse(pubGraph)
    } catch {
      toastError("Invalid graph JSON", "Fix the graph before publishing")
      return
    }
    setPublishing(true)
    try {
      const res = await api.host.createPipeline({ groupId: pubGroupId, name: pubName.trim(), graph })
      toastSuccess("Pipeline published", res.name)
      setPubName("")
      await load()
    } catch (e: any) {
      toastError("Failed to publish", e?.message)
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />
  }

  return (
    <div className="space-y-6">
      {createdToken && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Connect token (shown once)
            </CardTitle>
            <CardDescription>
              Share this token with the external client. They enter it on the Client Connect tab together with their email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm break-all">{createdToken}</code>
              <Button variant="outline" size="sm" onClick={copyToken} className="gap-2">
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Create group
            </CardTitle>
            <CardDescription>Groups isolate pipelines, skills, and RAG knowledge between tenants.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Group name (e.g. Acme Corp)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
            />
            <Button size="sm" onClick={createGroup} disabled={creating || !groupName.trim()} className="gap-2">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create group
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Create connect token
            </CardTitle>
            <CardDescription>Scoped to a group; the client uses it once to connect and pull shared resources.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={tokenGroupId}
              onChange={(e) => setTokenGroupId(e.target.value)}
            >
              <option value="">Select group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <Input placeholder="Client name (e.g. branch-office-1)" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={720}
                value={tokenExpiry}
                onChange={(e) => setTokenExpiry(e.target.value)}
                className="w-32"
                title="Expiry in hours"
              />
              <Button size="sm" onClick={createToken} disabled={tokenLoading || !tokenGroupId || !tokenName.trim()} className="gap-2">
                {tokenLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                Generate token
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Publish canonical pipeline
          </CardTitle>
          <CardDescription>Add a group-scoped pipeline (graph JSON in engine format: nodes with type/config, edges with source/target).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={pubGroupId}
              onChange={(e) => setPubGroupId(e.target.value)}
            >
              <option value="">Select group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <Input placeholder="Pipeline name" value={pubName} onChange={(e) => setPubName(e.target.value)} className="flex-1" />
          </div>
          <textarea
            className="h-32 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            value={pubGraph}
            onChange={(e) => setPubGraph(e.target.value)}
            spellCheck={false}
          />
          <Button size="sm" onClick={publishPipeline} disabled={publishing || !pubGroupId || !pubName.trim()} className="gap-2">
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
            Publish
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Groups
            </CardTitle>
            <CardDescription>Group membership determines who can review proposals and manage shared resources.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <EmptyState
              title="No groups yet"
              description="Create a group to start isolating shared pipelines, skills, and knowledge."
            />
          ) : (
            <div className="divide-y divide-border">
              {groups.map((g) => (
                <div key={g.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{g.name}</p>
                          <Badge className={roleColor[g.role] ?? ""}>{g.role}</Badge>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">{g.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{g.memberCount}</span>
                      <span className="flex items-center gap-1"><GitBranch className="h-3.5 w-3.5" />{g.pipelineCount}</span>
                      <span className="flex items-center gap-1"><Book className="h-3.5 w-3.5" />{g.knowledgeCount}</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {g.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                        <div className="text-sm">
                          <span className="text-foreground">{m.name ?? m.email}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{m.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={roleColor[m.role] ?? ""}>{m.role}</Badge>
                          {(g.role === "OWNER" || g.role === "ADMIN") && m.role !== "OWNER" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Remove member"
                              onClick={() => removeMember(g.id, m.id)}
                            >
                              <ShieldOff className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {(g.role === "OWNER" || g.role === "ADMIN") && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="member@email.com"
                          value={addEmail}
                          onChange={(e) => setAddEmail(e.target.value)}
                          className="flex-1"
                        />
                        <select
                          className="w-28 rounded-md border border-border bg-background px-2 py-2 text-sm"
                          value={addRole}
                          onChange={(e) => setAddRole(e.target.value)}
                        >
                          {["MEMBER", "VIEWER", "ADMIN"].map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <Button size="sm" variant="outline" onClick={() => addMember(g.id)} disabled={!addEmail.trim()}>
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-primary" />
            Connected clients
          </CardTitle>
          <CardDescription>Clients that have exchanged a connect token for this organization.</CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <EmptyState
              title="No connected clients"
              description="Generate a connect token above and use it from the Client Connect tab."
            />
          ) : (
            <div className="divide-y divide-border">
              {clients.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{c.id}</p>
                    {c.lastConnectedAt && (
                      <p className="text-xs text-muted-foreground">Last connected: {new Date(c.lastConnectedAt).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        c.status === "ACTIVE"
                          ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                          : c.status === "PENDING"
                            ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                            : "text-red-500 border-red-500/30 bg-red-500/10"
                      }
                    >
                      {c.status}
                    </Badge>
                    {c.status !== "REVOKED" && (
                      <Button variant="outline" size="sm" onClick={() => revokeClient(c.id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh all
        </Button>
      </div>
    </div>
  )
}


