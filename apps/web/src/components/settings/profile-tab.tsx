"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Trash2, Eye, EyeOff, Loader2,
} from "lucide-react"
import { api } from "@/lib/api"
import { useQuery } from "@/hooks/use-query"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"

const timezones = [
  "UTC-12:00", "UTC-11:00", "UTC-10:00", "UTC-09:00", "UTC-08:00 (PST)",
  "UTC-07:00 (MST)", "UTC-06:00 (CST)", "UTC-05:00 (EST)", "UTC-04:00",
  "UTC-03:00", "UTC-02:00", "UTC-01:00", "UTC+00:00 (GMT)", "UTC+01:00 (CET)",
  "UTC+02:00", "UTC+03:00", "UTC+04:00", "UTC+05:00", "UTC+05:30 (IST)",
  "UTC+06:00", "UTC+07:00", "UTC+08:00 (CST)", "UTC+09:00 (JST)", "UTC+10:00",
  "UTC+11:00", "UTC+12:00",
]

const languages = [
  "English", "Spanish", "French", "German", "Chinese (Simplified)",
  "Chinese (Traditional)", "Japanese", "Korean", "Portuguese", "Russian",
  "Arabic", "Hindi",
]

export function ProfileTab() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const { data: user, loading, error, refetch } = useQuery(
    "settings:profile",
    () => api.settings.getProfile(),
  )

  const [name, setName] = useState("")
  const [timezone, setTimezone] = useState("UTC")
  const [language, setLanguage] = useState("en")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

  const [deletePassword, setDeletePassword] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name ?? "")
      setTimezone(user.timezone ?? "UTC")
      setLanguage(user.language ?? "en")
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.settings.updateProfile({ name, timezone, language })
      refetch()
      toast.success("Profile updated")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }
    setChangingPassword(true)
    try {
      await api.auth.changePassword({ currentPassword, newPassword })
      toast.success("Password updated")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update password")
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await api.settings.deleteAccount({ password: deletePassword })
      toast.success("Account deleted")
      setTimeout(() => { window.location.href = "/login" }, 1500)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete account")
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="space-y-6 py-4"><Skeleton className="h-6 w-48" /><div className="rounded-xl border bg-surface p-6 space-y-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /></div><div className="rounded-xl border bg-surface p-6 space-y-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /></div></div>
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your profile details and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
              {(user?.name ?? "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{user?.name ?? "User"}</p>
              <p className="text-sm text-muted-foreground capitalize">{user?.tier?.toLowerCase() ?? "Free"} plan</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto gap-2" disabled title="Avatar upload is not available">
              <Eye className="h-3.5 w-3.5" />
              Change Avatar
            </Button>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input defaultValue={user?.email ?? ""} type="email" disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Timezone</label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                <SelectContent>
                  {timezones.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                <SelectContent>
                  {languages.map(lang => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Use a strong password that you don&apos;t use elsewhere</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Password</label>
            <div className="relative">
              <Input type={showCurrent ? "text" : "password"} placeholder="Enter current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <div className="relative">
                <Input type={showNew ? "text" : "password"} placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm Password</label>
              <div className="relative">
                <Input type={showConfirm ? "text" : "password"} placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <Button variant="outline" onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}>
              {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>Permanently delete your account and all associated data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All your pipelines, flows, settings, and personal data will be permanently removed.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Enter your password to confirm</label>
            <Input type="password" placeholder="Enter your password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
          </div>
          <Button variant="destructive" className="gap-2" onClick={() => setConfirmDelete(true)} disabled={!deletePassword}>
            <Trash2 className="h-4 w-4" />
            Delete My Account
          </Button>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete account?"
        description="This action cannot be undone. All your pipelines, flows, settings, and personal data will be permanently removed."
        confirmLabel="Delete Account"
        destructive
        busy={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
