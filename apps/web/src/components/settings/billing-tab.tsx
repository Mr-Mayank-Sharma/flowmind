"use client"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Plus } from "lucide-react"
import { api } from "@/lib/api"
import { useQuery } from "@/hooks/use-query"
import { Skeleton } from "@/components/ui/skeleton"

export function BillingTab() {
  const { data: subscription, loading: subLoading } = useQuery(
    "settings:subscription",
    () => api.settings.getSubscription(),
  )

  const tier = subscription?.tier ?? "FREE"
  const planName = tier === "FREE" ? "Free" : tier === "PRO" ? "Pro" : tier === "TEAM" ? "Team" : "Enterprise"
  const planPrice = tier === "FREE" ? "$0" : tier === "PRO" ? "$19" : tier === "TEAM" ? "$49" : "$99"

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>You are on the {planName} plan</CardDescription>
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
                <Button variant="outline">Downgrade</Button>
                <Button>Upgrade</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
          <CardDescription>{new Date().toLocaleString("default", { month: "long", year: "numeric" })} billing period</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>API Calls</span>
                <span className="text-muted-foreground">0 / unlimited</span>
              </div>
              <Progress value={0} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Storage Used</span>
                <span className="text-muted-foreground">0 / unlimited</span>
              </div>
              <Progress value={0} />
            </div>
          </div>
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
            <Button variant="outline" size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Add Payment Method</Button>
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
