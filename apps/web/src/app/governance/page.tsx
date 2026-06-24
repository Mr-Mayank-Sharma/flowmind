"use client"

import { useState } from "react"
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  FileText,
  Clock,
  Search,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Ban,
  Key,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface RBACEntry {
  userId: string
  userName: string
  userEmail: string
  role: "admin" | "developer" | "operator" | "viewer"
  agents: string[]
  pipelines: string[]
  permissions: {
    createAgents: boolean
    editAgents: boolean
    deleteAgents: boolean
    createPipelines: boolean
    editPipelines: boolean
    deletePipelines: boolean
    manageSettings: boolean
    viewAudit: boolean
  }
  lastActive: string
  status: "active" | "suspended" | "invited"
}

interface AuditEntry {
  id: string
  action: string
  resource: string
  userName: string
  userEmail: string
  ip: string
  timestamp: string
  status: "success" | "denied" | "error"
  details: string
}

const rbacData: RBACEntry[] = [
  {
    userId: "u1", userName: "Mayank Sharma", userEmail: "mayank@flowmind.ai", role: "admin",
    agents: ["Research Assistant", "Code Reviewer", "Data Analyst", "DevOps Bot"],
    pipelines: ["Customer Support", "Content Rewriter", "Daily Data Sync"],
    permissions: { createAgents: true, editAgents: true, deleteAgents: true, createPipelines: true, editPipelines: true, deletePipelines: true, manageSettings: true, viewAudit: true },
    lastActive: "just now", status: "active",
  },
  {
    userId: "u2", userName: "Priya Patel", userEmail: "priya@flowmind.ai", role: "developer",
    agents: ["Content Writer", "Data Analyst"],
    pipelines: ["Content Rewriter", "Research Summarizer"],
    permissions: { createAgents: true, editAgents: true, deleteAgents: false, createPipelines: true, editPipelines: true, deletePipelines: false, manageSettings: false, viewAudit: false },
    lastActive: "5 min ago", status: "active",
  },
  {
    userId: "u3", userName: "Alex Chen", userEmail: "alex@flowmind.ai", role: "operator",
    agents: ["Customer Support"],
    pipelines: ["Customer Support"],
    permissions: { createAgents: false, editAgents: true, deleteAgents: false, createPipelines: false, editPipelines: true, deletePipelines: false, manageSettings: false, viewAudit: false },
    lastActive: "1 hour ago", status: "active",
  },
  {
    userId: "u4", userName: "Sarah Kim", userEmail: "sarah@flowmind.ai", role: "viewer",
    agents: [], pipelines: [],
    permissions: { createAgents: false, editAgents: false, deleteAgents: false, createPipelines: false, editPipelines: false, deletePipelines: false, manageSettings: false, viewAudit: true },
    lastActive: "1 day ago", status: "active",
  },
  {
    userId: "u5", userName: "James Wilson", userEmail: "james@client.org", role: "viewer",
    agents: [], pipelines: [],
    permissions: { createAgents: false, editAgents: false, deleteAgents: false, createPipelines: false, editPipelines: false, deletePipelines: false, manageSettings: false, viewAudit: false },
    lastActive: "1 week ago", status: "invited",
  },
  {
    userId: "u6", userName: "Legacy Bot Account", userEmail: "bot-v2@flowmind.ai", role: "operator",
    agents: ["Research Assistant"],
    pipelines: [],
    permissions: { createAgents: false, editAgents: true, deleteAgents: false, createPipelines: false, editPipelines: true, deletePipelines: false, manageSettings: false, viewAudit: false },
    lastActive: "3 days ago", status: "suspended",
  },
]

const auditLog: AuditEntry[] = [
  { id: "a1", action: "agent.create", resource: "Research Assistant", userName: "Mayank Sharma", userEmail: "mayank@flowmind.ai", ip: "192.168.1.42", timestamp: "2025-06-24 14:32:18", status: "success", details: "Created new agent with role: Researcher" },
  { id: "a2", action: "pipeline.execute", resource: "Customer Support", userName: "Mayank Sharma", userEmail: "mayank@flowmind.ai", ip: "192.168.1.42", timestamp: "2025-06-24 14:30:05", status: "success", details: "Pipeline execution started - 8 nodes" },
  { id: "a3", action: "agent.update", resource: "Code Reviewer", userName: "Priya Patel", userEmail: "priya@flowmind.ai", ip: "10.0.0.54", timestamp: "2025-06-24 14:25:44", status: "success", details: "Updated model from gpt-4 to gpt-4o" },
  { id: "a4", action: "settings.access", resource: "API Keys", userName: "Alex Chen", userEmail: "alex@flowmind.ai", ip: "10.0.0.101", timestamp: "2025-06-24 13:12:30", status: "denied", details: "Unauthorized access attempt to API key settings (insufficient permissions)" },
  { id: "a5", action: "agent.delete", resource: "Legacy Bot", userName: "Mayank Sharma", userEmail: "mayank@flowmind.ai", ip: "192.168.1.42", timestamp: "2025-06-24 12:00:00", status: "success", details: "Deleted agent with id: a-old-3" },
  { id: "a6", action: "pipeline.create", resource: "Daily Data Sync", userName: "Priya Patel", userEmail: "priya@flowmind.ai", ip: "10.0.0.54", timestamp: "2025-06-24 11:45:22", status: "success", details: "Created pipeline with 12 nodes" },
  { id: "a7", action: "agent.execute", resource: "Data Analyst", userName: "Sarah Kim", userEmail: "sarah@flowmind.ai", ip: "172.16.0.88", timestamp: "2025-06-24 10:30:15", status: "success", details: "Agent query completed in 4.2s" },
  { id: "a8", action: "settings.access", resource: "Security Settings", userName: "James Wilson", userEmail: "james@client.org", ip: "203.0.113.42", timestamp: "2025-06-23 22:15:00", status: "denied", details: "Unauthorized access attempt to security settings" },
  { id: "a9", action: "agent.create", resource: "Customer Support", userName: "Mayank Sharma", userEmail: "mayank@flowmind.ai", ip: "192.168.1.42", timestamp: "2025-06-23 16:00:30", status: "error", details: "Failed to create agent: quota exceeded" },
  { id: "a10", action: "auth.login", resource: "User Session", userName: "Mayank Sharma", userEmail: "mayank@flowmind.ai", ip: "192.168.1.42", timestamp: "2025-06-24 08:00:00", status: "success", details: "Login from trusted device" },
  { id: "a11", action: "auth.login", resource: "User Session", userName: "Legacy Bot Account", userEmail: "bot-v2@flowmind.ai", ip: "45.33.32.156", timestamp: "2025-06-23 19:30:00", status: "denied", details: "Login from unrecognized IP address" },
  { id: "a12", action: "pipeline.delete", resource: "Old Pipeline v1", userName: "Mayank Sharma", userEmail: "mayank@flowmind.ai", ip: "192.168.1.42", timestamp: "2025-06-23 14:00:00", status: "success", details: "Deleted archived pipeline" },
]

const roleColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  developer: "default",
  operator: "secondary",
  viewer: "outline",
}

const statusIcons: Record<string, typeof CheckCircle2> = {
  active: CheckCircle2,
  suspended: Ban,
  invited: Clock,
}

const statusColors: Record<string, "default" | "destructive" | "secondary"> = {
  active: "default",
  suspended: "destructive",
  invited: "secondary",
}

const auditStatusColors: Record<string, "default" | "destructive" | "secondary"> = {
  success: "default",
  denied: "destructive",
  error: "secondary",
}

export default function GovernancePage() {
  const [auditSearch, setAuditSearch] = useState("")
  const [rbacSearch, setRbacSearch] = useState("")
  const [sortField, setSortField] = useState<string>("timestamp")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const filteredAudit = auditLog
    .filter(e =>
      e.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      e.resource.toLowerCase().includes(auditSearch.toLowerCase()) ||
      e.userName.toLowerCase().includes(auditSearch.toLowerCase()) ||
      e.details.toLowerCase().includes(auditSearch.toLowerCase())
    )

  const filteredRBAC = rbacData.filter(u =>
    u.userName.toLowerCase().includes(rbacSearch.toLowerCase()) ||
    u.userEmail.toLowerCase().includes(rbacSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(rbacSearch.toLowerCase())
  )

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const SortHeader = ({ field, children }: { field: string, children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  )

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Governance</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Role-based access control, audit logging, and permissions
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {rbacData.length} users
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {auditLog.length} events
            </span>
          </div>
        </div>

        <Tabs defaultValue="rbac">
          <TabsList className="mb-6">
            <TabsTrigger value="rbac" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              RBAC Matrix
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="h-4 w-4" />
              Audit Log
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Key className="h-4 w-4" />
              Permissions Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rbac">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, email, or role..."
                  className="pl-9"
                  value={rbacSearch}
                  onChange={e => setRbacSearch(e.target.value)}
                />
              </div>
            </div>

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">User</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Role</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Agents</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Pipelines</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Permissions</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRBAC.map(user => (
                      <tr key={user.userId} className="hover:bg-accent/30 transition-colors">
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-sm">{user.userName}</p>
                            <p className="text-xs text-muted-foreground">{user.userEmail}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={roleColors[user.role]} className="text-[10px] capitalize">
                            {user.role === "viewer" ? (
                              <Eye className="h-3 w-3 mr-1" />
                            ) : user.role === "admin" ? (
                              <ShieldAlert className="h-3 w-3 mr-1" />
                            ) : (
                              <ShieldCheck className="h-3 w-3 mr-1" />
                            )}
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {user.agents.length > 0 ? user.agents.slice(0, 2).map(a => (
                              <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                            )) : <span className="text-xs text-muted-foreground">—</span>}
                            {user.agents.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{user.agents.length - 2}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {user.pipelines.length > 0 ? user.pipelines.slice(0, 2).map(p => (
                              <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                            )) : <span className="text-xs text-muted-foreground">—</span>}
                            {user.pipelines.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{user.pipelines.length - 2}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {Object.entries(user.permissions).map(([key, val]) => (
                              <div key={key} className="group relative">
                                {val ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                                )}
                                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] bg-popover px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}: {val ? "Allowed" : "Denied"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={statusColors[user.status]} className="text-[10px] h-5 gap-1">
                            {user.status === "active" ? <CheckCircle2 className="h-3 w-3" /> : user.status === "suspended" ? <Ban className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {user.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search audit log..."
                  className="pl-9"
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                />
              </div>
            </div>

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3">
                        <SortHeader field="timestamp">
                          <Clock className="h-3 w-3 mr-1" />
                          Time
                        </SortHeader>
                      </th>
                      <th className="text-left p-3">
                        <SortHeader field="action">Action</SortHeader>
                      </th>
                      <th className="text-left p-3">
                        <SortHeader field="resource">Resource</SortHeader>
                      </th>
                      <th className="text-left p-3">
                        <SortHeader field="userName">User</SortHeader>
                      </th>
                      <th className="text-left p-3">Details</th>
                      <th className="text-left p-3">
                        <SortHeader field="status">Status</SortHeader>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAudit.map(entry => (
                      <tr key={entry.id} className="hover:bg-accent/30 transition-colors">
                        <td className="p-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{entry.timestamp}</td>
                        <td className="p-3">
                          <code className="text-xs font-mono text-primary">{entry.action}</code>
                        </td>
                        <td className="p-3 text-xs">{entry.resource}</td>
                        <td className="p-3">
                          <div>
                            <p className="text-xs">{entry.userName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{entry.ip}</p>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{entry.details}</td>
                        <td className="p-3">
                          <Badge variant={auditStatusColors[entry.status]} className="text-[10px] h-5 capitalize">
                            {entry.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Permission Roles</CardTitle>
                <CardDescription className="text-xs">
                  Define granular permissions for each role level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">Permission</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">
                          <Badge variant="destructive" className="text-[10px]">Admin</Badge>
                        </th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">
                          <Badge variant="default" className="text-[10px]">Developer</Badge>
                        </th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px]">Operator</Badge>
                        </th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">Viewer</Badge>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        { name: "Create Agents", perms: { admin: true, developer: true, operator: false, viewer: false } },
                        { name: "Edit Agents", perms: { admin: true, developer: true, operator: true, viewer: false } },
                        { name: "Delete Agents", perms: { admin: true, developer: false, operator: false, viewer: false } },
                        { name: "Create Pipelines", perms: { admin: true, developer: true, operator: false, viewer: false } },
                        { name: "Edit Pipelines", perms: { admin: true, developer: true, operator: true, viewer: false } },
                        { name: "Delete Pipelines", perms: { admin: true, developer: false, operator: false, viewer: false } },
                        { name: "Manage Settings", perms: { admin: true, developer: false, operator: false, viewer: false } },
                        { name: "View Audit Log", perms: { admin: true, developer: false, operator: false, viewer: true } },
                        { name: "API Key Access", perms: { admin: true, developer: true, operator: false, viewer: false } },
                        { name: "Invite Users", perms: { admin: true, developer: false, operator: false, viewer: false } },
                      ].map(perm => (
                        <tr key={perm.name} className="hover:bg-accent/30 transition-colors">
                          <td className="p-2 text-xs font-medium">{perm.name}</td>
                          {(["admin", "developer", "operator", "viewer"] as const).map(role => (
                            <td key={role} className="p-2 text-center">
                              {perm.perms[role] ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground opacity-30 mx-auto" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
