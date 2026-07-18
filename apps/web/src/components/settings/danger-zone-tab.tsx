"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { AlertTriangle, Download, Trash2, FileText } from "lucide-react"

export function DangerZoneTab() {
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
            This will generate a ZIP archive containing all your pipelines, flow definitions, 
            conversation history, memory entries, settings, and API key metadata (keys will be masked).
            The export may take a few minutes to prepare.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export My Data
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
                  Deleting your account will permanently remove all pipelines, flows, conversation history, 
                  memory entries, API keys, integrations, and billing information. Your data will be 
                  irrecoverably deleted from all our systems within 30 days.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type your password to confirm</label>
              <Input type="password" placeholder="Enter your password" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Type <span className="font-mono text-destructive">DELETE MY ACCOUNT</span> to confirm
              </label>
              <Input placeholder="DELETE MY ACCOUNT" />
            </div>
          </div>
          <Button variant="destructive" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Permanently Delete My Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
