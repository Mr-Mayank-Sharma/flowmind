"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Building2, CreditCard } from "lucide-react"
import { api } from "@/lib/api"
import { useQuery } from "@/hooks/use-query"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

export function BillingTab() {
  const { data: subscription, loading: subLoading } = useQuery(
    "settings:subscription",
    () => api.settings.getSubscription(),
  )
  const { data: usage, loading: usageLoading } = useQuery(
    "settings:usage",
    () => api.billing.getUsage(),
  )
  const [orgSub, setOrgSub] = useState<any>(null)
  const [orgLoaded, setOrgLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.settings.getOrg().then((org: any) => {
      if (org?.id) {
        api.billing.getOrgSubscription(org.id).then(setOrgSub).finally(() => setOrgLoaded(true))
      } else {
        setOrgLoaded(true)
      }
    }).catch(() => setOrgLoaded(true))
  }, [])

  const tier = orgSub?.tier && orgSub.tier !== "FREE" ? orgSub.tier : subscription?.tier ?? "FREE"
  const planName = tier === "FREE" ? "Free" : tier === "PRO" ? "Pro" : tier === "TEAM" ? "Team" : "Enterprise"
  const planPrice = tier === "FREE" ? "$0" : tier === "PRO" ? "$19" : tier === "TEAM" ? "$49" : "$99"

  const getProgress = (used: number, limit: number | string) => {
    if (limit === "unlimited" || limit === 0) return 0
    return Math.min(Math.round((used / (limit as number)) * 100), 100)
  }

  const checkout = async (targetTier: string) => {
    setBusy(true)
    try {
      const res = await api.billing.createCheckout({ tier: targetTier, orgId: orgSub?.id })
      if (res.url) {
        window.location.href = res.url
      } else {
        toast.success("Plan updated")
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed")
    } finally {
      setBusy(false)
    }
  }

  const openPortal = async () => {
    setBusy(true)
    try {
      const res = await api.billing.createPortalSession()
      if (res.url) window.location.href = res.url
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to open billing portal")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            {orgSub?.tier && orgSub.tier !== "FREE"
              ? `Your organization is on the ${orgSub.tier} plan`
              : `You are on the ${planName} plan`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {subLoading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : (
            <>
              <div className="rounded-lg border bg-surface p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-lg font-bold">{planName} Plan</p>
                    <p className="text-sm text-muted-foreground">{planPrice} / month</p>
                  </div>
                  <Badge>Current</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{subscription?.status ?? "active"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Period end</p>
                    <p className="font-medium">{subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cancel at period</p>
                    <p className="font-medium">{subscription?.cancelAtPeriodEnd ? "Yes" : "No"}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" disabled={busy || tier === "FREE"} onClick={() => checkout(tier === "TEAM" ? "PRO" : "FREE")}>Downgrade</Button>
                <Button disabled={busy} onClick={() => checkout(tier === "FREE" ? "PRO" : tier === "PRO" ? "TEAM" : "ENTERPRISE")}>Upgrade</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {orgSub && orgSub.tier !== "FREE" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organization Plan
            </CardTitle>
            <CardDescription>Org tier: {orgSub.tier} &middot; {orgSub.membersUsed}/{orgSub.memberLimit} seats used</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Seats</span>
                <span className="text-muted-foreground">{orgSub.membersUsed} / {orgSub.memberLimit}</span>
              </div>
              <Progress value={getProgress(orgSub.membersUsed, orgSub.memberLimit)} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
          <CardDescription>{new Date().toLocaleString("default", { month: "long", year: "numeric" })} billing period</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usageLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-full" /></div>
              ))}
            </div>
          ) : usage ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Chats</span>
                  <span className="text-muted-foreground">{usage.chatsUsed} / {usage.chatLimit}</span>
                </div>
                <Progress value={getProgress(usage.chatsUsed, usage.chatLimit)} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Storage</span>
                  <span className="text-muted-foreground">{usage.storageUsedMb}MB / {usage.storageLimitMb}MB</span>
                </div>
                <Progress value={getProgress(usage.storageUsedMb, usage.storageLimitMb)} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Pipelines</span>
                  <span className="text-muted-foreground">{usage.pipelineCount} / {usage.pipelineNodeLimit}</span>
                </div>
                <Progress value={getProgress(usage.pipelineCount, usage.pipelineNodeLimit)} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>MCP Connections</span>
                  <span className="text-muted-foreground">{usage.mcpConnectionCount} / {usage.mcpConnectionLimit}</span>
                </div>
                <Progress value={getProgress(usage.mcpConnectionCount, usage.mcpConnectionLimit)} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Usage data unavailable</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>Manage your payment details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center py-4">No payment method on file</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={openPortal} disabled={busy}><CreditCard className="h-3.5 w-3.5" />Add Payment Method</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>View and download past invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground text-center py-4">No invoices yet</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
