"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  User, Palette, Cpu, HardDrive, Brain, Key, Link, Clock, Bell, Building,
  CreditCard, Shield, AlertTriangle, Check, X, Plus, Trash2, RefreshCw,
  Download, Github, Chrome, Slack, BookOpen, Search, Copy, Eye, EyeOff,
  LogOut, Smartphone, Moon, Sun, Monitor, GripVertical,
  FileText, ArrowUpDown, Loader2,
} from "lucide-react"
import { api } from "@/lib/api"
import { useQuery, useMutation } from "@/hooks/use-query"
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"

type TabId =
  | "profile" | "appearance" | "ai-models" | "local-models" | "memory"
  | "api-keys" | "connections" | "cron" | "notifications"
  | "organization" | "billing" | "security" | "danger-zone"

interface TabDef {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const tabs: TabDef[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "ai-models", label: "AI & Models", icon: Cpu },
  { id: "local-models", label: "Local Models", icon: HardDrive },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "connections", label: "Connections", icon: Link },
  { id: "cron", label: "Cron Jobs", icon: Clock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "organization", label: "Organization", icon: Building },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "security", label: "Security", icon: Shield },
  { id: "danger-zone", label: "Danger Zone", icon: AlertTriangle },
]

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

const models = [
  "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "claude-3-opus", "claude-3-sonnet",
  "claude-3-haiku", "gemini-1.5-pro", "gemini-1.5-flash", "mistral-large",
  "llama-3-70b", "llama-3-8b", "mixtral-8x22b",
]

const providers = ["OpenAI", "Anthropic", "Google AI", "Mistral AI", "Meta", "Groq", "Together AI", "Fireworks"]

const fontSizes = ["Small", "Medium", "Large"]
const chatDensities = ["Comfortable", "Compact", "Cozy"]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile")
  const [showApiKey, setShowApiKey] = useState<string | null>(null)
  const [memorySearch, setMemorySearch] = useState("")
  const [skillSearch, setSkillSearch] = useState("")

  const TabIcon = tabs.find(t => t.id === activeTab)?.icon || User

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-surface">
        <div className="container px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account, models, integrations, and preferences
          </p>
        </div>
      </div>

      <div className="container px-4 py-6 flex gap-0">
        <aside className="w-56 shrink-0 sticky top-6 self-start max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-thin">
          <nav className="flex flex-col gap-1 pr-4 border-r border-border h-full">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 pl-8 min-w-0">
          <div className="flex items-center gap-3 mb-6">
            <TabIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold capitalize">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>

          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "appearance" && <AppearanceTab />}
          {activeTab === "ai-models" && <AiModelsTab />}
          {activeTab === "local-models" && <LocalModelsTab />}
          {activeTab === "memory" && (
            <MemoryTab
              memorySearch={memorySearch}
              setMemorySearch={setMemorySearch}
              skillSearch={skillSearch}
              setSkillSearch={setSkillSearch}
            />
          )}
          {activeTab === "api-keys" && (
            <ApiKeysTab showKey={showApiKey} setShowKey={setShowApiKey} />
          )}
          {activeTab === "connections" && <ConnectionsTab />}
          {activeTab === "cron" && <CronJobsTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "organization" && <OrganizationTab />}
          {activeTab === "billing" && <BillingTab />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "danger-zone" && <DangerZoneTab />}
        </main>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">{children}</h3>
}

function ProfileTab() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data: user, loading, error, refetch } = useQuery(
    "settings:profile",
    () => api.settings.getProfile(),
  )

  const [name, setName] = useState("")
  const [timezone, setTimezone] = useState("UTC")
  const [language, setLanguage] = useState("en")

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
    } catch {} finally {
      setSaving(false)
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
            <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = "image/*"
              input.onchange = () => alert("Avatar upload requires server-side implementation")
              input.click()
            }}>
              <RefreshCw className="h-3.5 w-3.5" />
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
              <Input type={showCurrent ? "text" : "password"} placeholder="Enter current password" />
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
                <Input type={showNew ? "text" : "password"} placeholder="New password" />
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
                <Input type={showConfirm ? "text" : "password"} placeholder="Confirm new password" />
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
            <Button variant="outline" onClick={() => alert("Password change requires current password verification. This feature requires server-side implementation.")}>Update Password</Button>
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
          <Button variant="destructive" className="gap-2" onClick={() => {
            if (window.confirm("Are you sure you want to permanently delete your account? This cannot be undone.")) {
              alert("Account deletion request submitted. This feature requires server-side implementation.")
            }
          }}>
            <Trash2 className="h-4 w-4" />
            Delete My Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function AppearanceTab() {
  const { data: user } = useQuery("settings:profile", () => api.settings.getProfile())
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark")
  const [fontSize, setFontSize] = useState("Medium")
  const [density, setDensity] = useState("Comfortable")

  useEffect(() => {
    if (user) {
      if (user.theme) setTheme(user.theme)
      if (user.fontSize) setFontSize(user.fontSize)
      if (user.chatDensity) setDensity(user.chatDensity)
    }
  }, [user])

  const saveAppearance = useCallback(() => {
    api.settings.updateAppearance({ theme, fontSize, chatDensity: density })
  }, [theme, fontSize, density])

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Choose your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "light" as const, icon: Sun, label: "Light" },
              { value: "dark" as const, icon: Moon, label: "Dark" },
              { value: "system" as const, icon: Monitor, label: "System" },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => { setTheme(value); setTimeout(saveAppearance, 0) }}
                className={`flex flex-col items-center gap-3 rounded-lg border p-6 transition-colors ${
                  theme === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Icon className={`h-8 w-8 ${theme === value ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${theme === value ? "text-primary" : ""}`}>{label}</span>
                {theme === value && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Font Size</CardTitle>
          <CardDescription>Adjust the text size across the application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {fontSizes.map(size => (
              <button
                key={size}
                onClick={() => { setFontSize(size); setTimeout(saveAppearance, 0) }}
                className={`flex-1 rounded-lg border p-4 text-center transition-colors ${
                  fontSize === size
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <span className={`block font-semibold ${
                  size === "Small" ? "text-xs" : size === "Medium" ? "text-sm" : "text-base"
                }`}>Aa</span>
                <span className="text-xs text-muted-foreground mt-1 block">{size}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chat Density</CardTitle>
          <CardDescription>Control spacing in chat conversations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {chatDensities.map(d => (
              <button
                key={d}
                onClick={() => { setDensity(d); setTimeout(saveAppearance, 0) }}
                className={`flex-1 rounded-lg border p-4 text-center transition-colors ${
                  density === d
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <GripVertical className={`h-5 w-5 mx-auto mb-1 ${
                  density === d ? "text-primary" : "text-muted-foreground"
                }`} />
                <span className={`text-xs font-medium ${density === d ? "text-primary" : ""}`}>{d}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AiModelsTab() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Default Model</CardTitle>
          <CardDescription>Select the default AI model for new conversations and pipelines</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Select>
              <SelectTrigger className="w-full"><SelectValue placeholder="gpt-4o" /></SelectTrigger>
              <SelectContent>
                {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Temperature</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  defaultValue="0.7"
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-mono text-muted-foreground w-8 text-right">0.7</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Tokens</label>
              <Input type="number" defaultValue={4096} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider Priority</CardTitle>
          <CardDescription>Drag to reorder fallback providers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {providers.map((p, i) => (
            <div key={p} className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-3">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium flex-1">{p}</span>
              <Badge variant="secondary" className="text-xs">{i === 0 ? "Primary" : i === 1 ? "Fallback" : "Tier " + (i + 1)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost Limits</CardTitle>
          <CardDescription>Set spending caps per provider to control costs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {["OpenAI", "Anthropic", "Google AI"].map(provider => (
            <div key={provider} className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
              <span className="text-sm font-medium">{provider}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Monthly cap:</span>
                <Input
                  type="number"
                  defaultValue={provider === "OpenAI" ? 200 : provider === "Anthropic" ? 150 : 100}
                  className="w-24 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">USD</span>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Add Provider Limit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function LocalModelsTab() {
  const [pulling, setPulling] = useState(false)

  const { data: modelsList = [], loading: modelsLoading, error: modelsError, refetch: refetchModels } = useQuery(
    "settings:models",
    () => api.models.list(),
  )

  const handlePullModel = async () => {
    const name = prompt("Enter model name to pull (e.g. llama3:8b):")
    if (!name) return
    setPulling(true)
    try {
      await api.models.pullModel(name)
      refetchModels()
      alert(`Model "${name}" pulled successfully`)
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    } finally {
      setPulling(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      const health = await api.models.getRuntimeHealth()
      alert(health.online ? "Connection OK" : "Runtime offline")
    } catch (e: any) {
      alert(`Connection failed: ${e.message}`)
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Ollama Connection</CardTitle>
          <CardDescription>Connect to your local Ollama instance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-lg border bg-surface">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium">Connected to Ollama</p>
              <p className="text-xs text-muted-foreground">http://localhost:11434</p>
            </div>
            <Badge variant="secondary">Online</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Host</label>
              <Input defaultValue="http://localhost:11434" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Timeout (seconds)</label>
              <Input type="number" defaultValue={60} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-2" onClick={handleTestConnection}><RefreshCw className="h-3.5 w-3.5" />Reconnect</Button>
            <Button variant="outline" size="sm" onClick={handleTestConnection}>Test Connection</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Installed Models</CardTitle>
          <CardDescription>Manage locally installed models</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {modelsLoading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : modelsError ? (
            <ErrorState message={modelsError.message} onRetry={refetchModels} />
          ) : modelsList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No models installed. Pull a model to get started.</p>
          ) : modelsList.map((model: any) => (
            <div key={model.id ?? model.name} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${model.status === "loaded" ? "bg-green-500" : "bg-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{model.name}</p>
                <p className="text-xs text-muted-foreground">{model.size ?? "Unknown"}</p>
              </div>
              <Badge variant={model.status === "loaded" ? "default" : "secondary"} className="text-xs shrink-0">
                {model.status === "loaded" ? "Loaded" : "Unloaded"}
              </Badge>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="gap-2" onClick={handlePullModel} disabled={pulling}>
              <Plus className="h-3.5 w-3.5" />{pulling ? "Pulling..." : "Pull Model"}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={refetchModels}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cloud Fallback</CardTitle>
          <CardDescription>When a model is not available locally, fall back to cloud providers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Cloud Fallback</p>
              <p className="text-xs text-muted-foreground">Route to cloud when local model is unavailable</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="space-y-2">
            <label className="text-sm font-medium">Fallback Provider</label>
            <Select>
              <SelectTrigger><SelectValue placeholder="OpenAI" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google AI</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MemoryTab({
  memorySearch, setMemorySearch, skillSearch, setSkillSearch,
}: {
  memorySearch: string
  setMemorySearch: (v: string) => void
  skillSearch: string
  setSkillSearch: (v: string) => void
}) {
  const { data: toolsList = [], refetch: refetchTools } = useQuery(
    "settings:tools",
    () => api.tools.list(),
  )

  const { mutate: toggleTool } = useMutation(
    (id: string) => api.tools.toggle(id),
    { onSuccess: refetchTools },
  )

  const { data: memories = [], loading: memoriesLoading, refetch: refetchMemories } = useQuery(
    "settings:memories",
    () => api.settings.getMemories(),
  )

  const { mutate: deleteMemory } = useMutation(
    (id: string) => api.settings.deleteMemory(id),
    { onSuccess: refetchMemories },
  )

  const filteredSkills = toolsList.filter((s: any) =>
    s.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
    s.description.toLowerCase().includes(skillSearch.toLowerCase())
  )
  const filteredMemory = memories.filter((e: any) =>
    (e.content ?? e.summary ?? "").toLowerCase().includes(memorySearch.toLowerCase()) ||
    e.type.toLowerCase().includes(memorySearch.toLowerCase())
  )

  const typeColors: Record<string, string> = {
    Conversation: "bg-blue-500",
    Document: "bg-amber-500",
    Preference: "bg-purple-500",
    "Code Snippet": "bg-emerald-500",
    Fact: "bg-rose-500",
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Skill Library</CardTitle>
          <CardDescription>Enable or disable agent capabilities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search skills..."
              value={skillSearch}
              onChange={e => setSkillSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="space-y-2">
            {filteredSkills.map((skill: any) => (
              <div key={skill.id} className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{skill.name}</p>
                    <Badge variant="outline" className="text-xs">{skill.category ?? "General"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{skill.description}</p>
                </div>
                <Switch checked={skill.isActive} onCheckedChange={() => toggleTool(skill.id)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memory Manager</CardTitle>
          <CardDescription>Search and manage stored memories</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search memories..."
              value={memorySearch}
              onChange={e => setMemorySearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{filteredMemory.length} entries</span>
            <span>Total: ~{memories.length} entries</span>
          </div>
          <div className="divide-y divide-border">
            {memoriesLoading ? (
              <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
            ) : filteredMemory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No memories found</p>
            ) : filteredMemory.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-3 py-3">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${typeColors[entry.type] ?? "bg-blue-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{entry.type}</p>
                    <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.content ?? entry.summary ?? ""}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteMemory(entry.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ApiKeysTab({ showKey, setShowKey }: { showKey: string | null; setShowKey: (v: string | null) => void }) {
  const [showNewKeyForm, setShowNewKeyForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyProvider, setNewKeyProvider] = useState("OpenAI")
  const [newKeyValue, setNewKeyValue] = useState("")

  const { data: apiKeys = [], loading, error: keysError, refetch } = useQuery(
    "settings:apiKeys",
    () => api.settings.getApiKeys(),
  )

  const { mutate: createKey } = useMutation(
    (input: { name: string; provider: string; key: string }) => api.settings.createApiKey(input),
    { onSuccess: () => { setShowNewKeyForm(false); setNewKeyName(""); setNewKeyValue(""); refetch() } },
  )

  const { mutate: deleteKey } = useMutation(
    (id: string) => api.settings.deleteApiKey(id),
    { onSuccess: refetch },
  )

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage API keys for external providers</CardDescription>
            </div>
            <Button size="sm" className="gap-2" onClick={() => setShowNewKeyForm(!showNewKeyForm)}><Plus className="h-3.5 w-3.5" />Add Key</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showNewKeyForm && (
            <div className="rounded-lg border border-primary/30 bg-primary/[0.02] p-4 space-y-3">
              <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name" className="h-8 text-sm" />
              <select value={newKeyProvider} onChange={(e) => setNewKeyProvider(e.target.value)} className="h-8 text-sm w-full rounded-md border border-input bg-surface px-3">
                {providers.map(p => <option key={p}>{p}</option>)}
              </select>
              <Input value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} placeholder="API key" className="h-8 text-sm font-mono" />
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={() => createKey({ name: newKeyName, provider: newKeyProvider, key: newKeyValue })} disabled={!newKeyName || !newKeyValue}>Save</Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowNewKeyForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : keysError ? (
            <ErrorState message={keysError.message} onRetry={refetch} />
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No API keys yet</p>
          ) : apiKeys.map((ak: any) => (
            <div key={ak.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{ak.name}</p>
                  <Badge variant={ak.isActive ? "default" : "secondary"}>
                    {ak.isActive ? "active" : "inactive"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{ak.provider}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs text-muted-foreground font-mono">
                      {showKey === ak.id ? ak.keyHash?.slice(0, 16) + "..." : "••••" + ak.lastFour}
                    </code>
                    <button onClick={() => setShowKey(showKey === ak.id ? null : ak.id)} className="text-muted-foreground hover:text-foreground">
                      {showKey === ak.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Created {new Date(ak.createdAt).toLocaleDateString()} &middot; Last used {ak.lastUsedAt ? new Date(ak.lastUsedAt).toLocaleDateString() : "Never"}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteKey(ak.id)}>
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

function ConnectionsTab() {
  const { data: connections = [], loading, refetch } = useQuery(
    "settings:connections",
    () => api.settings.getConnections(),
  )

  const { mutate: deleteConnection } = useMutation(
    (id: string) => api.settings.deleteConnection(id),
    { onSuccess: refetch },
  )

  const providerIcons: Record<string, React.ElementType> = {
    github: Github, google: Chrome, slack: Slack, notion: BookOpen,
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>OAuth Connections</CardTitle>
          <CardDescription>Connect your accounts to enable integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : connections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No connected accounts yet</p>
          ) : connections.map((conn: any) => {
            const provider = conn.provider.toLowerCase()
            const Icon = providerIcons[provider] ?? Link
            return (
              <div key={conn.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-4">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium capitalize">{conn.provider}</p>
                  <p className="text-xs text-muted-foreground">Scope: {conn.scope ?? "Full access"}</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => deleteConnection(conn.id)}>
                  <X className="h-3.5 w-3.5" />
                  Revoke
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function CronJobsTab() {
  const { data: cronList = [], loading, refetch } = useQuery(
    "settings:cron",
    () => api.jobs.list(),
  )

  const { mutate: toggleJob } = useMutation(
    (id: string) => api.jobs.toggle(id),
    { onSuccess: refetch },
  )

  const { mutate: deleteJob } = useMutation(
    (id: string) => api.jobs.delete(id),
    { onSuccess: refetch },
  )

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Jobs</CardTitle>
              <CardDescription>Automate pipeline execution on a schedule</CardDescription>
            </div>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Create Job</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : cronList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No scheduled jobs yet</p>
          ) : cronList.map((job: any) => (
            <div key={job.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                job.isActive ? "bg-green-500" : "bg-amber-500"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{job.name}</p>
                  <Badge variant={job.isActive ? "default" : "secondary"} className="text-xs">
                    {job.isActive ? "active" : "paused"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Schedule: <code className="text-xs bg-muted px-1 py-0.5 rounded">{job.expression}</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Last run: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "Never"} &middot; {job.runCount ?? 0} runs
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => toggleJob(job.id)}>
                  {job.isActive ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  {job.isActive ? "Pause" : "Resume"}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"><Clock className="h-3 w-3" />Edit</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteJob(job.id)}>
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

function NotificationsTab() {
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

function OrganizationTab() {
  const { data: org, loading: orgLoading, error: orgError, refetch: refetchOrg } = useQuery(
    "settings:org",
    () => api.settings.getOrg(),
  )
  const { data: members = [], loading: membersLoading } = useQuery(
    "settings:orgMembers",
    () => api.settings.getOrgMembers(),
  )
  const { mutate: updateOrg } = useMutation(
    (input: { name?: string; slug?: string }) => api.settings.updateOrg(input),
    { onSuccess: refetchOrg },
  )
  const [orgName, setOrgName] = useState("")
  const [orgSlug, setOrgSlug] = useState("")

  useEffect(() => {
    if (org) {
      setOrgName(org.name ?? "")
      setOrgSlug(org.slug ?? "")
    }
  }, [org])

  if (orgLoading) {
    return <div className="space-y-6 py-4"><Skeleton className="h-6 w-48" /><div className="rounded-xl border bg-surface p-6 space-y-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /></div><div className="rounded-xl border bg-surface p-6 space-y-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /></div></div>
  }

  if (orgError) {
    return <ErrorState message={orgError.message} onRetry={refetchOrg} />
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Organization Profile</CardTitle>
          <CardDescription>Manage your organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {org ? (
            <>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                  {(org.name ?? "O").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{org.name}</p>
                  <p className="text-sm text-muted-foreground">{org.slug} &middot; Created {new Date(org.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Organization Name</label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Slug</label>
                  <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} />
                </div>
              </div>
              <Button onClick={() => updateOrg({ name: orgName, slug: orgSlug })}>Save Changes</Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No organization. Create one to collaborate with your team.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>{members.length} members in your organization</CardDescription>
            </div>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Invite</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {membersLoading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No members yet</p>
          ) : members.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-3">
              <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-xs font-medium shrink-0">
                {(m.user?.name ?? "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{m.user?.name ?? "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{m.user?.email}</p>
              </div>
              <Badge variant={m.role === "OWNER" || m.role === "ADMIN" ? "default" : m.role === "EDITOR" ? "secondary" : "outline"}>
                {m.role}
              </Badge>
              <p className="text-xs text-muted-foreground hidden lg:block">{new Date(m.user?.createdAt ?? Date.now()).toLocaleDateString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>Track important changes across your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogSection />
        </CardContent>
      </Card>
    </div>
  )
}

function AuditLogSection() {
  const { data: auditLog = [], loading } = useQuery(
    "settings:auditLog",
    () => api.settings.getAuditLog(),
  )

  if (loading) return <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
  if (auditLog.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No audit log entries yet</p>

  return (
    <div className="space-y-0">
      {auditLog.map((entry: any, i: number) => (
        <div key={entry.id} className="flex gap-3 pb-4 relative">
          {i < auditLog.length - 1 && (
            <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
          )}
          <div className={`mt-1.5 h-3.5 w-3.5 rounded-full border-2 shrink-0 ${
            entry.action?.includes("deploy") || entry.action?.includes("pipeline") ? "border-blue-500 bg-blue-500/20" :
            entry.type === "security" || entry.action?.includes("key") ? "border-red-500 bg-red-500/20" :
            entry.action?.includes("invite") || entry.action?.includes("Member") ? "border-purple-500 bg-purple-500/20" :
            entry.action?.includes("plan") || entry.action?.includes("billing") ? "border-amber-500 bg-amber-500/20" :
            entry.action?.includes("model") ? "border-green-500 bg-green-500/20" :
            "border-green-500 bg-green-500/20"
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{entry.action}</p>
            <p className="text-xs text-muted-foreground">{entry.details ?? entry.resource} &middot; {new Date(entry.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function BillingTab() {
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

function SecurityTab() {
  const { data: apiTokens = [], loading: tokensLoading, refetch: refetchTokens } = useQuery(
    "settings:apiTokens",
    () => api.settings.getApiTokens(),
  )
  const { data: sessions = [], loading: sessionsLoading } = useQuery(
    "settings:sessions",
    () => api.settings.getSessions(),
  )

  const { mutate: createToken } = useMutation(
    (name: string) => api.settings.createApiToken({ name }),
    { onSuccess: refetchTokens },
  )

  const { mutate: deleteToken } = useMutation(
    (id: string) => api.settings.deleteApiToken(id),
    { onSuccess: refetchTokens },
  )

  const [tokenName, setTokenName] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!tokenName) return
    const result = await createToken(tokenName)
    if (result) {
      setNewTokenValue((result as any).token)
      setTokenName("")
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
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive">
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
            <Switch defaultChecked />
          </div>
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

function DangerZoneTab() {
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
