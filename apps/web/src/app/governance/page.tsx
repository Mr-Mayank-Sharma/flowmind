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
  Ban,
  Key,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { useQuery } from "@/hooks/use-query"

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

  const { data: orgMembers = [], loading: membersLoading } = useQuery(
    "governance:members",
    () => api.settings.getOrgMembers(),
  )
  const { data: auditLog = [], loading: auditLoading } = useQuery(
    "governance:audit",
    () => api.settings.getAuditLog(),
  )

  const filteredAudit = auditLog
    .filter((e: any) =>
      (e.action || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
      (e.resource || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
      (e.userName || e.user?.name || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
      (e.details || "").toLowerCase().includes(auditSearch.toLowerCase())
    )

  const filteredRBAC = orgMembers.filter((u: any) =>
    (u.user?.name || "").toLowerCase().includes(rbacSearch.toLowerCase()) ||
    (u.user?.email || "").toLowerCase().includes(rbacSearch.toLowerCase()) ||
    (u.role || "").toLowerCase().includes(rbacSearch.toLowerCase())
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
              {orgMembers.length} users
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
                    {filteredRBAC.map((member: any) => (
                      <tr key={member.id || member.userId} className="hover:bg-accent/30 transition-colors">
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-sm">{member.user?.name || member.userName}</p>
                            <p className="text-xs text-muted-foreground">{member.user?.email || member.userEmail}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={roleColors[member.role]} className="text-[10px] capitalize">
                            {member.role === "viewer" ? (
                              <Eye className="h-3 w-3 mr-1" />
                            ) : member.role === "admin" ? (
                              <ShieldAlert className="h-3 w-3 mr-1" />
                            ) : (
                              <ShieldCheck className="h-3 w-3 mr-1" />
                            )}
                            {member.role}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {member.agents?.length > 0 ? member.agents.slice(0, 2).map((a: string) => (
                              <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                            )) : <span className="text-xs text-muted-foreground">—</span>}
                            {member.agents?.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{member.agents.length - 2}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {member.pipelines?.length > 0 ? member.pipelines.slice(0, 2).map((p: string) => (
                              <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                            )) : <span className="text-xs text-muted-foreground">—</span>}
                            {member.pipelines?.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{member.pipelines.length - 2}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {member.permissions ? Object.entries(member.permissions).map(([key, val]) => (
                              <div key={key} className="group relative">
                                {val ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                                )}
                                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] bg-popover px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  {String(key).replace(/([A-Z])/g, ' $1').trim()}: {val ? "Allowed" : "Denied"}
                                </span>
                              </div>
                            )) : <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={statusColors[member.status || "active"]} className="text-[10px] h-5 gap-1">
                            {member.status === "active" ? <CheckCircle2 className="h-3 w-3" /> : member.status === "suspended" ? <Ban className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                            {member.status || "active"}
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
                    {(filteredAudit as any[]).map((entry: any) => (
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
