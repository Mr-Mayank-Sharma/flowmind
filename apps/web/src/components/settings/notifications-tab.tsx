"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import { useQuery, useMutation } from "@/hooks/use-query"
import { Skeleton } from "@/components/ui/skeleton"

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">{children}</h3>
}

export function NotificationsTab() {
  const { data: notifications = [], loading, refetch } = useQuery(
    "settings:notifications",
    () => api.settings.getNotifications(),
  )

  const { mutate: toggleRead } = useMutation(
    ({ id, read }: { id: string; read: boolean }) => api.settings.updateNotification({ id, read }),
    { onSuccess: refetch },
  )

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose how and when you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <SectionTitle>Channels</SectionTitle>
            <div className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Send notifications to your email</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground">Browser and mobile push alerts</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <SectionTitle>Recent Notifications</SectionTitle>
            {loading ? (
              <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
            ) : notifications.map((n: any) => (
              <div key={n.id} className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body ?? n.type} &middot; {new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <Switch checked={n.read} onCheckedChange={(checked) => toggleRead({ id: n.id, read: checked })} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
