"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { AlertTriangle, Download, Trash2, FileText, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

export function DangerZoneTab() {
  const [exporting, setExporting] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmText, setConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await api.settings.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `flowmind-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Data exported", variant: "success" })
    } catch {
      toast({ title: "Export failed", variant: "error" })
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    if (confirmText !== "DELETE MY ACCOUNT" || !password) return
    setDeleting(true)
    try {
      await api.settings.deleteAccount({ password })
      toast({ title: "Account deleted", variant: "success" })
      setTimeout(() => { window.location.href = "/login" }, 1500)
    } catch (e: any) {
      toast({ title: e?.message || "Delete failed", variant: "error" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions that affect your entire account</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>Download all your data including pipelines, settings, and memory</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will export all your pipelines, flow definitions, conversation history, memory entries, and settings.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Exporting..." : "Export My Data"}
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-3.5 w-3.5" />
              Export Audit Log
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>Permanently delete your account and all associated data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">This action cannot be undone</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Deleting your account will permanently remove all pipelines, conversation history, 
                  memory entries, API keys, and integrations.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type your password to confirm</label>
              <Input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Type <span className="font-mono text-destructive">DELETE MY ACCOUNT</span> to confirm
              </label>
              <Input placeholder="DELETE MY ACCOUNT" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
          </div>
          <Button variant="destructive" className="gap-2" onClick={handleDelete} disabled={deleting || confirmText !== "DELETE MY ACCOUNT" || !password}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? "Deleting..." : "Permanently Delete My Account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
