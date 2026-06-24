"use client"

import { useState } from "react"
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
  LogOut, Smartphone, Globe, Moon, Sun, Monitor, GripVertical, ChevronRight,
  Zap, FileText, Star, Circle, ArrowUpDown, Wallet,
} from "lucide-react"

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

const mockSkills = [
  { id: "s1", name: "Web Research", description: "Search and extract information from websites", enabled: true, category: "Data" },
  { id: "s2", name: "Code Interpreter", description: "Execute Python code and return results", enabled: true, category: "Development" },
  { id: "s3", name: "Image Generation", description: "Generate images using Stable Diffusion", enabled: false, category: "Creative" },
  { id: "s4", name: "Document Parser", description: "Parse PDF, DOCX, and other document formats", enabled: true, category: "Data" },
  { id: "s5", name: "Webhook Sender", description: "Send HTTP requests to external services", enabled: true, category: "Integration" },
  { id: "s6", name: "Memory Retrieval", description: "Query long-term memory stores", enabled: false, category: "System" },
  { id: "s7", name: "Sentiment Analysis", description: "Analyze text sentiment and emotion", enabled: true, category: "NLP" },
  { id: "s8", name: "Translation", description: "Translate text between languages", enabled: false, category: "NLP" },
]

const mockMemoryEntries = [
  { id: "m1", type: "Conversation", preview: "User discussed project requirements for the AI pipeline builder...", date: "2026-06-22", size: "2.4 KB" },
  { id: "m2", type: "Document", preview: "Extracted key insights from the research paper on transformer architectures...", date: "2026-06-21", size: "15.8 KB" },
  { id: "m3", type: "Preference", preview: "User prefers concise responses with bullet points for technical topics...", date: "2026-06-20", size: "0.8 KB" },
  { id: "m4", type: "Conversation", preview: "Debugged Python script for data pipeline ETL process...", date: "2026-06-19", size: "4.2 KB" },
  { id: "m5", type: "Code Snippet", preview: "Saved React hook for real-time WebSocket connections...", date: "2026-06-18", size: "1.6 KB" },
  { id: "m6", type: "Fact", preview: "User's preferred tech stack: Next.js, Tailwind, tRPC, PostgreSQL...", date: "2026-06-17", size: "0.5 KB" },
]

const mockApiKeys = [
  { id: "ak1", name: "OpenAI Production", provider: "OpenAI", key: "sk-...aB3x", created: "2026-01-15", lastUsed: "2026-06-23", status: "active" as const },
  { id: "ak2", name: "Anthropic Dev", provider: "Anthropic", key: "sk-ant-...9fK2", created: "2026-03-20", lastUsed: "2026-06-22", status: "active" as const },
  { id: "ak3", name: "Google AI", provider: "Google AI", key: "AIza...qR7m", created: "2026-04-01", lastUsed: "2026-06-21", status: "active" as const },
  { id: "ak4", name: "Mistral Staging", provider: "Mistral AI", key: "ms-...3pQx", created: "2026-05-10", lastUsed: "2026-06-15", status: "expired" as const },
  { id: "ak5", name: "OpenAI Legacy", provider: "OpenAI", key: "sk-...zL9f", created: "2025-11-01", lastUsed: "2026-04-30", status: "revoked" as const },
]

const mockConnections = [
  { id: "c1", name: "GitHub", icon: Github, connected: true, email: "user@github.com", scope: "repo, workflow, gist" },
  { id: "c2", name: "Google", icon: Chrome, connected: true, email: "user@gmail.com", scope: "drive, docs, sheets" },
  { id: "c3", name: "Slack", icon: Slack, connected: false, email: null, scope: null },
  { id: "c4", name: "Notion", icon: BookOpen, connected: false, email: null, scope: null },
]

const mockCronJobs = [
  { id: "cr1", name: "Daily Report Generation", pipeline: "Research Summarizer", schedule: "0 8 * * 1-5", nextRun: "2026-06-25 08:00", lastRun: "2026-06-24 08:00", status: "active" as const },
  { id: "cr2", name: "Weekly Competitor Scan", pipeline: "Competitor Research", schedule: "0 6 * * 1", nextRun: "2026-06-30 06:00", lastRun: "2026-06-23 06:00", status: "active" as const },
  { id: "cr3", name: "Social Media Posting", pipeline: "Social Media Scheduler", schedule: "*/30 9-18 * * 1-5", nextRun: "2026-06-24 09:30", lastRun: "2026-06-24 09:00", status: "active" as const },
  { id: "cr4", name: "Data Sync - Nightly", pipeline: "CRM Sync Pipeline", schedule: "0 2 * * *", nextRun: "2026-06-25 02:00", lastRun: "2026-06-24 02:00", status: "paused" as const },
  { id: "cr5", name: "Model Retraining Trigger", pipeline: "Fine-tune Pipeline", schedule: "0 3 */2 * *", nextRun: "2026-06-26 03:00", lastRun: null, status: "active" as const },
] as { id: string; name: string; pipeline: string; schedule: string; nextRun: string; lastRun: string | null; status: "active" | "paused" }[]

const notificationEvents = [
  { id: "pipeline-complete", label: "Pipeline Complete", description: "When a pipeline finishes execution" },
  { id: "pipeline-failed", label: "Pipeline Failed", description: "When a pipeline encounters an error" },
  { id: "model-downloaded", label: "Model Downloaded", description: "When a model finishes downloading" },
  { id: "low-credits", label: "Low Credits", description: "When API credit balance is low" },
  { id: "invite-received", label: "Invite Received", description: "When you are invited to an organization" },
  { id: "member-joined", label: "Member Joined", description: "When a new member joins your organization" },
  { id: "cron-failed", label: "Cron Job Failed", description: "When a scheduled job fails to execute" },
  { id: "security-alert", label: "Security Alert", description: "Suspicious login or security events" },
]

const mockOrgMembers = [
  { id: "u1", name: "Alex Chen", email: "alex@flowmind.ai", role: "Admin" as const, avatar: "AC", joined: "2025-09-01" },
  { id: "u2", name: "Sarah Johnson", email: "sarah@flowmind.ai", role: "Admin" as const, avatar: "SJ", joined: "2025-09-01" },
  { id: "u3", name: "Marcus Lee", email: "marcus@flowmind.ai", role: "Editor" as const, avatar: "ML", joined: "2025-10-15" },
  { id: "u4", name: "Priya Patel", email: "priya@flowmind.ai", role: "Viewer" as const, avatar: "PP", joined: "2026-01-20" },
  { id: "u5", name: "Tom Wilson", email: "tom@flowmind.ai", role: "Editor" as const, avatar: "TW", joined: "2026-03-10" },
]

const mockAuditLog = [
  { id: "a1", action: "Pipeline 'Research Summarizer' deployed", user: "Alex Chen", date: "2026-06-24 09:15", type: "pipeline" as const },
  { id: "a2", action: "API key 'OpenAI Production' rotated", user: "Sarah Johnson", date: "2026-06-24 08:30", type: "security" as const },
  { id: "a3", action: "Member 'Tom Wilson' invited", user: "Alex Chen", date: "2026-06-23 14:00", type: "org" as const },
  { id: "a4", action: "Plan upgraded to Team", user: "Alex Chen", date: "2026-06-22 11:45", type: "billing" as const },
  { id: "a5", action: "Model 'llama-3-70b' downloaded", user: "System", date: "2026-06-22 10:20", type: "system" as const },
  { id: "a6", action: "Cron job 'Daily Report' paused", user: "Priya Patel", date: "2026-06-21 16:00", type: "pipeline" as const },
]

const mockInvoices = [
  { id: "inv-001", date: "Jun 1, 2026", amount: "$49.00", status: "paid" as const, period: "June 2026" },
  { id: "inv-002", date: "May 1, 2026", amount: "$49.00", status: "paid" as const, period: "May 2026" },
  { id: "inv-003", date: "Apr 1, 2026", amount: "$49.00", status: "paid" as const, period: "April 2026" },
  { id: "inv-004", date: "Mar 1, 2026", amount: "$19.00", status: "paid" as const, period: "March 2026" },
  { id: "inv-005", date: "Feb 1, 2026", amount: "$19.00", status: "paid" as const, period: "February 2026" },
]

const mockSessions = [
  { id: "s1", device: "MacBook Pro 16\"", browser: "Chrome 125", ip: "203.0.113.42", lastActive: "Now", current: true },
  { id: "s2", device: "iPhone 15 Pro", browser: "Safari 18", ip: "203.0.113.42", lastActive: "2 hours ago", current: false },
  { id: "s3", device: "Windows Desktop", browser: "Firefox 127", ip: "198.51.100.73", lastActive: "3 days ago", current: false },
  { id: "s4", device: "Linux Server", browser: "curl/8.4", ip: "192.0.2.100", lastActive: "1 week ago", current: false },
]

const mockApiTokens = [
  { id: "t1", name: "CI/CD Token", token: "fm_cicd_...a1b2", created: "2026-04-10", expires: "2027-04-10", lastUsed: "2026-06-23", scopes: ["pipelines:read", "pipelines:write"] },
  { id: "t2", name: "Webhook Integration", token: "fm_webhook_...x3y4", created: "2026-05-01", expires: "2027-05-01", lastUsed: "2026-06-20", scopes: ["cron:read", "cron:write"] },
  { id: "t3", name: "Monitoring Bot", token: "fm_mon_...z5w6", created: "2026-02-15", expires: "2027-02-15", lastUsed: "2026-06-24", scopes: ["pipelines:read", "system:metrics"] },
]

const mockInstalledModels = [
  { id: "lm1", name: "mistral", size: "4.2 GB", status: "loaded" as const, quant: "Q4_K_M", ram: "4.8 GB" },
  { id: "lm2", name: "llama3", size: "6.7 GB", status: "loaded" as const, quant: "Q5_K_M", ram: "7.2 GB" },
  { id: "lm3", name: "codellama", size: "6.7 GB", status: "loaded" as const, quant: "Q4_K_M", ram: "7.0 GB" },
  { id: "lm4", name: "mixtral", size: "26 GB", status: "unloaded" as const, quant: "Q4_K_M", ram: "27 GB" },
  { id: "lm5", name: "phi-3-mini", size: "2.3 GB", status: "loaded" as const, quant: "Q4_K_M", ram: "2.8 GB" },
  { id: "lm6", name: "nomic-embed-text", size: "274 MB", status: "unloaded" as const, quant: "F16", ram: "512 MB" },
]

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
              JD
            </div>
            <div>
              <p className="font-medium">John Doe</p>
              <p className="text-sm text-muted-foreground">Free plan</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Change Avatar
            </Button>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">First Name</label>
              <Input defaultValue="John" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Last Name</label>
              <Input defaultValue="Doe" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input defaultValue="john.doe@flowmind.ai" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Timezone</label>
              <Select>
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
              <Select>
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
            <Button>Save Changes</Button>
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
            <Button variant="outline">Update Password</Button>
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
          <Button variant="destructive" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Delete My Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function AppearanceTab() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark")
  const [fontSize, setFontSize] = useState("Medium")
  const [density, setDensity] = useState("Comfortable")

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
                onClick={() => setTheme(value)}
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
                onClick={() => setFontSize(size)}
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
          <div className={`rounded-lg border bg-surface p-4 ${
            fontSize === "Small" ? "text-xs" : fontSize === "Medium" ? "text-sm" : "text-base"
          }`}>
            <p className="font-medium mb-1">Preview</p>
            <p className="text-muted-foreground">
              This is how text will appear throughout the application. Adjust to your preference.
            </p>
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
                onClick={() => setDensity(d)}
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
          <div className={`rounded-lg border bg-surface space-y-2 ${
            density === "Compact" ? "p-2" : density === "Comfortable" ? "p-4" : "p-3"
          }`}>
            <div className={`flex items-start gap-3 ${
              density === "Compact" ? "mb-1" : density === "Comfortable" ? "mb-3" : "mb-2"
            }`}>
              <div className="h-6 w-6 rounded-full bg-primary/20 shrink-0 flex items-center justify-center text-xs font-medium text-primary">
                AI
              </div>
              <div className="flex-1">
                <p className={`font-medium ${density === "Compact" ? "text-xs" : "text-sm"}`}>Assistant</p>
                <p className={`text-muted-foreground ${density === "Compact" ? "text-xs" : "text-sm"}`}>
                  Here is a preview of how messages will appear with the selected density setting.
                </p>
              </div>
            </div>
            <div className={`flex items-start gap-3 ${
              density === "Compact" ? "" : density === "Comfortable" ? "mb-3" : "mb-2"
            }`}>
              <div className="h-6 w-6 rounded-full bg-secondary/20 shrink-0 flex items-center justify-center text-xs font-medium text-secondary">
                Y
              </div>
              <div className="flex-1">
                <p className={`font-medium ${density === "Compact" ? "text-xs" : "text-sm"}`}>You</p>
                <p className={`text-muted-foreground ${density === "Compact" ? "text-xs" : "text-sm"}`}>
                  This looks great! I prefer the {density.toLowerCase()} view.
                </p>
              </div>
            </div>
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
              <p className="text-xs text-muted-foreground">http://localhost:11434 &middot; v0.3.12 &middot; 3 active models</p>
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
            <Button size="sm" className="gap-2"><RefreshCw className="h-3.5 w-3.5" />Reconnect</Button>
            <Button variant="outline" size="sm">Test Connection</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Installed Models</CardTitle>
          <CardDescription>Manage locally installed models</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockInstalledModels.map(model => (
            <div key={model.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                model.status === "loaded" ? "bg-green-500" : "bg-muted-foreground"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{model.name}</p>
                <p className="text-xs text-muted-foreground">{model.size} &middot; {model.quant} &middot; ~{model.ram} RAM</p>
              </div>
              <Badge variant={model.status === "loaded" ? "default" : "secondary"} className="text-xs shrink-0">
                {model.status === "loaded" ? "Loaded" : "Unloaded"}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Pull Model</Button>
            <Button variant="outline" size="sm" className="gap-2"><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
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
  const filteredSkills = mockSkills.filter(s =>
    s.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
    s.description.toLowerCase().includes(skillSearch.toLowerCase())
  )
  const filteredMemory = mockMemoryEntries.filter(e =>
    e.preview.toLowerCase().includes(memorySearch.toLowerCase()) ||
    e.type.toLowerCase().includes(memorySearch.toLowerCase())
  )

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
            {filteredSkills.map(skill => (
              <div key={skill.id} className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{skill.name}</p>
                    <Badge variant="outline" className="text-xs">{skill.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{skill.description}</p>
                </div>
                <Switch checked={skill.enabled} />
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
            <span>Total: ~29.3 KB</span>
          </div>
          <div className="divide-y divide-border">
            {filteredMemory.map(entry => (
              <div key={entry.id} className="flex items-start gap-3 py-3">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                  entry.type === "Conversation" ? "bg-blue-500" :
                  entry.type === "Document" ? "bg-amber-500" :
                  entry.type === "Preference" ? "bg-purple-500" :
                  entry.type === "Code Snippet" ? "bg-emerald-500" : "bg-rose-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{entry.type}</p>
                    <span className="text-xs text-muted-foreground">{entry.date}</span>
                    <span className="text-xs text-muted-foreground">{entry.size}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.preview}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0">
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
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage API keys for external providers</CardDescription>
            </div>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Add Key</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockApiKeys.map(ak => (
            <div key={ak.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{ak.name}</p>
                  <Badge variant={ak.status === "active" ? "default" : ak.status === "expired" ? "secondary" : "outline"}>
                    {ak.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{ak.provider}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs text-muted-foreground font-mono">
                      {showKey === ak.id ? ak.key : ak.key.slice(0, 8) + "••••••••"}
                    </code>
                    <button onClick={() => setShowKey(showKey === ak.id ? null : ak.id)} className="text-muted-foreground hover:text-foreground">
                      {showKey === ak.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Created {ak.created} &middot; Last used {ak.lastUsed}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"><RefreshCw className="h-3 w-3" />Rotate</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>OAuth Connections</CardTitle>
          <CardDescription>Connect your accounts to enable integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mockConnections.map(conn => {
            const Icon = conn.icon
            return (
              <div key={conn.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-4">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{conn.name}</p>
                  {conn.connected ? (
                    <p className="text-xs text-muted-foreground">Connected as {conn.email} &middot; Scope: {conn.scope}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not connected</p>
                  )}
                </div>
                {conn.connected ? (
                  <Button variant="outline" size="sm" className="shrink-0 gap-2">
                    <X className="h-3.5 w-3.5" />
                    Revoke
                  </Button>
                ) : (
                  <Button size="sm" className="shrink-0 gap-2">
                    <Plus className="h-3.5 w-3.5" />
                    Authorize
                  </Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function CronJobsTab() {
  const [cronList, setCronList] = useState(mockCronJobs)

  const toggleCron = (id: string) => {
    setCronList(prev => prev.map(j => j.id === id ? { ...j, status: j.status === "active" ? "paused" as const : "active" as const } : j))
  }

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
          {cronList.map(job => (
            <div key={job.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                job.status === "active" ? "bg-green-500" : "bg-amber-500"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{job.name}</p>
                  <Badge variant={job.status === "active" ? "default" : "secondary"} className="text-xs">
                    {job.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pipeline: {job.pipeline} &middot; Schedule: <code className="text-xs bg-muted px-1 py-0.5 rounded">{job.schedule}</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Next run: {job.nextRun} &middot; Last run: {job.lastRun ?? "Never"}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => toggleCron(job.id)}>
                  {job.status === "active" ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  {job.status === "active" ? "Pause" : "Resume"}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"><Clock className="h-3 w-3" />Edit</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
                <p className="text-xs text-muted-foreground">Send notifications to john.doe@flowmind.ai</p>
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
            <div className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium">Slack Notifications</p>
                <p className="text-xs text-muted-foreground">Post to #flowmind-alerts channel</p>
              </div>
              <Switch />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <SectionTitle>Events</SectionTitle>
            {notificationEvents.map(event => (
              <div key={event.id} className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{event.label}</p>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                </div>
                <Switch defaultChecked={["pipeline-failed", "security-alert", "low-credits"].includes(event.id)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function OrganizationTab() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Organization Profile</CardTitle>
          <CardDescription>Manage your organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              FM
            </div>
            <div className="flex-1">
              <p className="font-medium">FlowMind AI</p>
              <p className="text-sm text-muted-foreground">flowmind.ai &middot; Created Sep 2025</p>
            </div>
            <Button variant="outline" size="sm">Edit Logo</Button>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization Name</label>
              <Input defaultValue="FlowMind AI" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Website</label>
              <Input defaultValue="https://flowmind.ai" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input defaultValue="Next-generation AI Workflow Orchestration Platform" />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>{mockOrgMembers.length} members in your organization</CardDescription>
            </div>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Invite</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockOrgMembers.map(member => (
            <div key={member.id} className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-3">
              <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-xs font-medium shrink-0">
                {member.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
              <Badge variant={member.role === "Admin" ? "default" : member.role === "Editor" ? "secondary" : "outline"}>
                {member.role}
              </Badge>
              <p className="text-xs text-muted-foreground hidden lg:block">Joined {member.joined}</p>
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
          <div className="space-y-0">
            {mockAuditLog.map((entry, i) => (
              <div key={entry.id} className="flex gap-3 pb-4 relative">
                {i < mockAuditLog.length - 1 && (
                  <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
                )}
                <div className={`mt-1.5 h-3.5 w-3.5 rounded-full border-2 shrink-0 ${
                  entry.type === "pipeline" ? "border-blue-500 bg-blue-500/20" :
                  entry.type === "security" ? "border-red-500 bg-red-500/20" :
                  entry.type === "org" ? "border-purple-500 bg-purple-500/20" :
                  entry.type === "billing" ? "border-amber-500 bg-amber-500/20" :
                  "border-green-500 bg-green-500/20"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{entry.action}</p>
                  <p className="text-xs text-muted-foreground">{entry.user} &middot; {entry.date}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BillingTab() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>You are on the Team plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-surface p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-lg font-bold">Team Plan</p>
                <p className="text-sm text-muted-foreground">$49 / month &middot; Annual billing</p>
              </div>
              <Badge>Current</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Pipeline runs</p>
                <p className="font-medium">12,450 / 25,000</p>
              </div>
              <div>
                <p className="text-muted-foreground">Team members</p>
                <p className="font-medium">5 / 15</p>
              </div>
              <div>
                <p className="text-muted-foreground">Storage</p>
                <p className="font-medium">8.2 GB / 50 GB</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">Downgrade to Starter ($19/mo)</Button>
            <Button>Upgrade to Enterprise ($99/mo)</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
          <CardDescription>June 2026 billing period</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>API Calls</span>
                <span className="text-muted-foreground">142,500 / 200,000</span>
              </div>
              <Progress value={71} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Model Training Hours</span>
                <span className="text-muted-foreground">24 / 50 hours</span>
              </div>
              <Progress value={48} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Storage Used</span>
                <span className="text-muted-foreground">8.2 / 50 GB</span>
              </div>
              <Progress value={16} />
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
            <div className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Visa ending in 4242</p>
                <p className="text-xs text-muted-foreground">Expires 12/2028</p>
              </div>
              <Badge variant="secondary">Default</Badge>
              <Button variant="ghost" size="sm" className="h-8 text-xs">Update</Button>
            </div>
            <Button variant="outline" size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Add Payment Method</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>View and download past invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {mockInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border bg-surface px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">{inv.period}</p>
                  <p className="text-xs text-muted-foreground">{inv.date} &middot; {inv.amount}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={inv.status === "paid" ? "secondary" : "default"} className="text-xs">{inv.status}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SecurityTab() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Manage your active login sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockSessions.map(session => (
            <div key={session.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{session.device}</p>
                  {session.current && <Badge variant="default" className="text-xs">Current</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{session.browser} &middot; {session.ip} &middot; {session.lastActive}</p>
              </div>
              {!session.current && (
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive">
                  <LogOut className="h-3 w-3" />
                  Revoke
                </Button>
              )}
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
          <div className="rounded-lg border bg-surface p-4">
            <p className="text-sm font-medium mb-2">Setup Instructions</p>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Install an authenticator app on your device</li>
              <li>Scan the QR code or enter the setup key manually</li>
              <li>Enter the 6-digit code from the app to verify</li>
            </ol>
            <div className="mt-4 p-4 rounded-lg bg-accent/50 border border-border">
              <div className="flex items-center justify-center mb-2">
                <div className="h-24 w-24 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-xs">
                  QR Code
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground font-mono">JBSWY3DPEHPK3PXP</p>
            </div>
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
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Generate Token</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockApiTokens.map(t => (
            <div key={t.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <Key className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{t.token}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {t.created} &middot; Expires {t.expires} &middot; Last used {t.lastUsed}
                </p>
                <div className="flex gap-1 mt-1">
                  {t.scopes.map(s => (
                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 text-xs">Edit</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
