"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Shield, Smartphone, LogOut, Key, Plus, Trash2, Copy, Loader2,
} from "lucide-react"
import { api } from "@/lib/api"
import { useQuery, useMutation } from "@/hooks/use-query"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

export function SecurityTab() {
  const { data: apiTokens = [], loading: tokensLoading, refetch: refetchTokens } = useQuery(
    "settings:apiTokens",
    () => api.settings.getApiTokens(),
  )
  const { data: sessions = [], loading: sessionsLoading, refetch: refetchSessions } = useQuery(
    "settings:sessions",
    () => api.settings.getSessions(),
  )
  const { data: mfaStatus, refetch: refetchMfa } = useQuery(
    "settings:mfaStatus",
    () => api.auth.getMfaStatus(),
  )

  const { mutate: createToken } = useMutation(
    (name: string) => api.settings.createApiToken({ name }),
    { onSuccess: refetchTokens },
  )

  const { mutate: deleteToken } = useMutation(
    (id: string) => api.settings.deleteApiToken(id),
    { onSuccess: refetchTokens },
  )

  const toast = useToast()
  const [tokenName, setTokenName] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null)
  const [mfaSetup, setMfaSetup] = useState<any>(null)
  const [mfaCode, setMfaCode] = useState("")
  const [mfaBusy, setMfaBusy] = useState(false)

  const handleCreate = async () => {
    if (!tokenName) return
    const result = await createToken(tokenName)
    if (result) {
      setNewTokenValue((result as any).token)
      setTokenName("")
    }
  }

  const handleMfaToggle = async (enabled: boolean) => {
    if (enabled) {
      setMfaBusy(true)
      try {
        const setup = await api.auth.setupMfa()
        setMfaSetup(setup)
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to start MFA setup")
      } finally {
        setMfaBusy(false)
      }
    } else {
      setMfaBusy(true)
      try {
        await api.auth.disableMfa()
        refetchMfa()
        toast.success("MFA disabled")
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to disable MFA")
      } finally {
        setMfaBusy(false)
      }
    }
  }

  const confirmMfaSetup = async () => {
    setMfaBusy(true)
    try {
      const ok = await api.auth.confirmMfa(mfaCode)
      if (ok) {
        setMfaSetup(null)
        setMfaCode("")
        refetchMfa()
        toast.success("MFA enabled")
      } else {
        toast.error("Invalid verification code")
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to verify code")
    } finally {
      setMfaBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Your active login sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(sessions as any[]).map((session: any) => (
            <div key={session.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{session.title || "Session"}</p>
                  <Badge variant="default" className="text-xs">{session._count?.messages || 0} msgs</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Last active: {new Date(session.updatedAt).toLocaleString()}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive" onClick={async () => {
                try {
                  await api.chat.deleteSession(session.id)
                  refetchSessions()
                  toast.success("Session revoked")
                } catch (e: any) {
                  toast.error(e?.message ?? "Failed to revoke session")
                }
              }}>
                <LogOut className="h-3 w-3" />
                Revoke
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Multi-Factor Authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Authenticator App (TOTP)</p>
                <p className="text-xs text-muted-foreground">Use Google Authenticator, Authy, or similar</p>
              </div>
            </div>
            <Switch checked={mfaStatus?.enabled ?? false} onCheckedChange={handleMfaToggle} disabled={mfaBusy} />
          </div>
          {mfaSetup && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/[0.02] p-4">
              <p className="text-sm font-medium">Scan the QR code with your authenticator app</p>
              <div className="flex flex-wrap items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mfaSetup.qrCodeUrl} alt="MFA QR code" className="h-40 w-40 rounded border bg-white" />
                <div className="flex-1 space-y-2 min-w-0">
                  <p className="text-xs text-muted-foreground">Or enter this secret manually:</p>
                  <code className="block text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">{mfaSetup.secret}</code>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Verification code</label>
                  <Input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="6-digit code" className="h-8 text-sm font-mono" />
                </div>
                <Button size="sm" className="h-8 text-xs" onClick={confirmMfaSetup} disabled={mfaBusy || mfaCode.length < 6}>
                  {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Verify & Enable
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setMfaSetup(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Tokens</CardTitle>
              <CardDescription>Generate tokens for programmatic access</CardDescription>
            </div>
            <Button size="sm" className="gap-2" onClick={() => setShowCreate(!showCreate)}><Plus className="h-3.5 w-3.5" />Generate Token</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showCreate && (
            <div className="rounded-lg border border-primary/30 bg-primary/[0.02] p-4 space-y-3">
              {newTokenValue ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-emerald-400">Token created! Copy it now — it won&apos;t be shown again.</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">{newTokenValue}</code>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(newTokenValue); setNewTokenValue(null); setShowCreate(false) }}>
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="Token name" className="h-8 text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 text-xs" onClick={handleCreate} disabled={!tokenName}>Generate</Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </div>
                </>
              )}
            </div>
          )}
          {tokensLoading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : apiTokens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No API tokens yet</p>
          ) : apiTokens.map((t: any) => (
            <div key={t.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <Key className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground font-mono">••••{t.lastFour}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {new Date(t.createdAt).toLocaleDateString()} &middot; Last used {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : "Never"}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteToken(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
