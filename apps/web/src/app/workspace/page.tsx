"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import {
  Building2,
  Users,
  CreditCard,
  Key,
  BarChart3,
  Settings,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [subscription, setSubscription] = useState<any>(null)
  const [usage, setUsage] = useState<any>(null)
  const [usageMetrics, setUsageMetrics] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("overview")

  const [showNewWorkspace, setShowNewWorkspace] = useState(false)
  const [newWsName, setNewWsName] = useState("")
  const [newWsSlug, setNewWsSlug] = useState("")

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("MEMBER")

  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyProvider, setNewKeyProvider] = useState("flowmind")

  useEffect(() => {
    api.console.listWorkspaces().then(setWorkspaces).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedOrgId) {
      api.console.listMembers(selectedOrgId).then(setMembers).catch(() => {})
    }
    api.console.listApiKeys().then(setApiKeys).catch(() => {})
    api.console.getSubscription().then(setSubscription).catch(() => {})
    api.console.getUsage().then(setUsage).catch(() => {})
    api.console.getUsageMetrics().then(setUsageMetrics).catch(() => {})
  }, [selectedOrgId])

  const createWorkspace = async () => {
    if (!newWsName || !newWsSlug) return
    try {
      await api.console.createWorkspace({ name: newWsName, slug: newWsSlug })
      const list = await api.console.listWorkspaces()
      setWorkspaces(list)
      setShowNewWorkspace(false)
      setNewWsName("")
      setNewWsSlug("")
    } catch {}
  }

  const inviteMember = async () => {
    if (!selectedOrgId || !inviteEmail) return
    try {
      await api.console.inviteMember({ orgId: selectedOrgId, email: inviteEmail, role: inviteRole })
      const list = await api.console.listMembers(selectedOrgId)
      setMembers(list)
      setInviteEmail("")
    } catch {}
  }

  const createKey = async () => {
    if (!newKeyName) return
    try {
      const key = await api.console.createApiKey({ name: newKeyName, provider: newKeyProvider })
      alert(`Save this key: ${key.key ?? "Created"}`)
      const list = await api.console.listApiKeys()
      setApiKeys(list)
      setNewKeyName("")
    } catch {}
  }

  const deleteKey = async (id: string) => {
    try {
      await api.console.deleteApiKey(id)
      const list = await api.console.listApiKeys()
      setApiKeys(list)
    } catch {}
  }

  const currentWs = workspaces.find((w) => w.id === selectedOrgId)

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Cloud Console</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage workspaces, teams, billing, and API keys
              </p>
            </div>
            <Button onClick={() => setShowNewWorkspace(true)} size="sm" className="h-8 text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Workspace
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <button onClick={() => setSelectedOrgId(null)}
              className={cn("px-3 py-1.5 text-xs rounded-md transition-colors",
                !selectedOrgId ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >All Workspaces</button>
            {workspaces.map((w) => (
              <button key={w.id} onClick={() => setSelectedOrgId(w.id)}
                className={cn("px-3 py-1.5 text-xs rounded-md transition-colors",
                  selectedOrgId === w.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >{w.name}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {showNewWorkspace && (
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-sm">Create Workspace</CardTitle></CardHeader>
            <CardContent className="flex items-end gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Name</label>
                <Input placeholder="My Team" value={newWsName} onChange={(e) => setNewWsName(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Slug</label>
                <Input placeholder="my-team" value={newWsSlug} onChange={(e) => setNewWsSlug(e.target.value)} className="h-8 text-xs font-mono" />
              </div>
              <Button onClick={createWorkspace} size="sm" className="h-8 text-xs">Create</Button>
              <Button variant="ghost" onClick={() => setShowNewWorkspace(false)} size="sm" className="h-8 text-xs">Cancel</Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Members</TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5 text-xs"><CreditCard className="h-3.5 w-3.5" /> Billing</TabsTrigger>
            <TabsTrigger value="api-keys" className="gap-1.5 text-xs"><Key className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
            <TabsTrigger value="usage" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Usage</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs"><Settings className="h-3.5 w-3.5" /> Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {selectedOrgId && currentWs ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Workspace</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">{currentWs.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{currentWs.slug}</p>
                    <Badge className="mt-2 text-[10px]">{currentWs.tier}</Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Members</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">{members.length}</p>
                    <p className="text-xs text-muted-foreground">Team members</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Subscription</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold capitalize">{subscription?.status ?? "No subscription"}</p>
                    <p className="text-xs text-muted-foreground">{subscription?.tier ?? "Free tier"}</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workspaces.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="py-8 text-center">
                      <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">No workspaces yet</p>
                      <p className="text-xs text-muted-foreground">Create your first workspace to get started</p>
                    </CardContent>
                  </Card>
                )}
                {workspaces.map((w) => (
                  <Card key={w.id} className="card-hover cursor-pointer" onClick={() => setSelectedOrgId(w.id)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">{w.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground font-mono">{w.slug}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px]">{w.tier}</Badge>
                        <span className="text-[10px] text-muted-foreground">Role: {w.role}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Team Members</CardTitle>
                <CardDescription className="text-xs">Manage who has access to this workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] text-muted-foreground">Email</label>
                    <Input placeholder="colleague@company.com" value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)} className="h-8 text-xs"
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <label className="text-[11px] text-muted-foreground">Role</label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER" className="text-xs">Member</SelectItem>
                        <SelectItem value="ADMIN" className="text-xs">Admin</SelectItem>
                        <SelectItem value="VIEWER" className="text-xs">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={inviteMember} disabled={!selectedOrgId} size="sm" className="h-8 text-xs gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Invite
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  {members.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No members yet</p>
                  )}
                  {members.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{m.user?.name?.[0] ?? m.user?.email?.[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium">{m.user?.name ?? m.user?.email}</p>
                          <p className="text-[10px] text-muted-foreground">{m.user?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] capitalize">{m.role.toLowerCase()}</Badge>
                        <button className="text-muted-foreground hover:text-destructive">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Free</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-bold">$0</p>
                  <p className="text-xs text-muted-foreground">/month</p>
                  <ul className="text-xs space-y-1 mt-3">
                    <li>100 chats/month</li>
                    <li>1 pipeline</li>
                    <li>5 cron jobs</li>
                    <li>1 skill</li>
                  </ul>
                  {subscription?.tier === "FREE" && <Badge className="mt-3">Current</Badge>}
                </CardContent>
              </Card>
              <Card className="ring-1 ring-primary/30">
                <CardHeader><CardTitle className="text-sm">Pro</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-bold">$20</p>
                  <p className="text-xs text-muted-foreground">/month</p>
                  <ul className="text-xs space-y-1 mt-3">
                    <li>Unlimited chats</li>
                    <li>10 pipelines</li>
                    <li>50 cron jobs</li>
                    <li>Unlimited skills</li>
                    <li>Team support</li>
                  </ul>
                  {subscription?.tier === "PRO" ? (
                    <Badge className="mt-3">Current</Badge>
                  ) : (
                    <Button size="sm" className="mt-3 h-7 text-xs w-full"
                      onClick={async () => {
                        const result = await api.console.createCheckoutSession({ tier: "PRO" })
                        if (result.url) window.location.href = result.url
                      }}
                    >Upgrade</Button>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Team</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-bold">$50</p>
                  <p className="text-xs text-muted-foreground">/month</p>
                  <ul className="text-xs space-y-1 mt-3">
                    <li>Everything in Pro</li>
                    <li>Unlimited pipelines</li>
                    <li>100 cron jobs</li>
                    <li>25 team seats</li>
                    <li>Priority support</li>
                  </ul>
                  {subscription?.tier === "TEAM" ? (
                    <Badge className="mt-3">Current</Badge>
                  ) : (
                    <Button size="sm" className="mt-3 h-7 text-xs w-full"
                      onClick={async () => {
                        const result = await api.console.createCheckoutSession({ tier: "TEAM" })
                        if (result.url) window.location.href = result.url
                      }}
                    >Upgrade</Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="api-keys" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Key className="h-4 w-4" /> API Keys</CardTitle>
                <CardDescription className="text-xs">Keys for programmatic access to FlowMind APIs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] text-muted-foreground">Key Name</label>
                    <Input placeholder="Production API Key" value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)} className="h-8 text-xs"
                    />
                  </div>
                  <div className="w-32 space-y-1">
                    <label className="text-[11px] text-muted-foreground">Provider</label>
                    <Select value={newKeyProvider} onValueChange={setNewKeyProvider}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flowmind" className="text-xs">FlowMind</SelectItem>
                        <SelectItem value="openai" className="text-xs">OpenAI</SelectItem>
                        <SelectItem value="anthropic" className="text-xs">Anthropic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={createKey} size="sm" className="h-8 text-xs gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Create
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  {apiKeys.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No API keys created</p>
                  )}
                  {apiKeys.map((k: any) => (
                    <div key={k.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
                      <div className="flex items-center gap-3">
                        <Key className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium">{k.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {k.provider} · fm_{k.lastFour ? `...${k.lastFour}` : "no key"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px]", k.isActive === false ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400")}>
                          {k.isActive === false ? "Inactive" : "Active"}
                        </Badge>
                        <button onClick={() => deleteKey(k.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-[11px] text-muted-foreground">Sessions (this month)</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{usage?.totalSessions ?? 0}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-[11px] text-muted-foreground">Pipelines</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{usage?.pipelines ?? 0}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-[11px] text-muted-foreground">Cron Jobs</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{usage?.cronJobs ?? 0}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-[11px] text-muted-foreground">Daily Avg</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {usage?.dailyUsage ? Math.round(Object.values(usage.dailyUsage).reduce((a: number, b: unknown) => a + (b as number), 0) / Math.max(Object.keys(usage.dailyUsage).length, 1)) : 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {usageMetrics && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Resource Limits</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Chats Used", current: usageMetrics.chatsUsed, limit: usageMetrics.chatLimit },
                    { label: "Storage", current: usageMetrics.storageUsedMb, limit: usageMetrics.storageLimitMb, unit: " MB" },
                    { label: "Pipelines", current: usageMetrics.pipelineCount, limit: usageMetrics.pipelineNodeLimit },
                    { label: "Cron Jobs", current: usageMetrics.cronJobCount, limit: usageMetrics.cronJobLimit },
                    { label: "Skills", current: usageMetrics.skillCount, limit: usageMetrics.skillLimit },
                  ].map((item) => {
                    const pct = item.limit === "unlimited" ? 0 : Math.min(100, Math.round(((item.current as number) / (item.limit as number)) * 100))
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{item.label}</span>
                          <span className="text-muted-foreground">{item.current}{item.unit ?? ""} / {item.limit}{item.unit ?? ""}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-primary")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            {currentWs && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> Workspace Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Workspace Name</label>
                    <Input defaultValue={currentWs.name} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Slug</label>
                    <Input defaultValue={currentWs.slug} className="h-8 text-xs font-mono" />
                  </div>
                  <Button size="sm" className="h-8 text-xs">Save Changes</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
