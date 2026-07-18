"use client"

import { useState, lazy, Suspense } from "react"
import {
  User, Palette, Cpu, HardDrive, Brain, Key, Link, Clock, Bell, Building,
  CreditCard, Shield, AlertTriangle,
} from "lucide-react"

const ProfileTab = lazy(() => import("@/components/settings/profile-tab").then(m => ({ default: m.ProfileTab })))
const AppearanceTab = lazy(() => import("@/components/settings/appearance-tab").then(m => ({ default: m.AppearanceTab })))
const AiModelsTab = lazy(() => import("@/components/settings/ai-models-tab").then(m => ({ default: m.AiModelsTab })))
const LocalModelsTab = lazy(() => import("@/components/settings/local-models-tab").then(m => ({ default: m.LocalModelsTab })))
const MemoryTab = lazy(() => import("@/components/settings/memory-tab").then(m => ({ default: m.MemoryTab })))
const ApiKeysTab = lazy(() => import("@/components/settings/api-keys-tab").then(m => ({ default: m.ApiKeysTab })))
const ConnectionsTab = lazy(() => import("@/components/settings/connections-tab").then(m => ({ default: m.ConnectionsTab })))
const CronJobsTab = lazy(() => import("@/components/settings/cron-jobs-tab").then(m => ({ default: m.CronJobsTab })))
const NotificationsTab = lazy(() => import("@/components/settings/notifications-tab").then(m => ({ default: m.NotificationsTab })))
const OrganizationTab = lazy(() => import("@/components/settings/organization-tab").then(m => ({ default: m.OrganizationTab })))
const BillingTab = lazy(() => import("@/components/settings/billing-tab").then(m => ({ default: m.BillingTab })))
const SecurityTab = lazy(() => import("@/components/settings/security-tab").then(m => ({ default: m.SecurityTab })))
const DangerZoneTab = lazy(() => import("@/components/settings/danger-zone-tab").then(m => ({ default: m.DangerZoneTab })))

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

      <div className="container px-4 py-6 flex flex-col md:flex-row gap-0">
        <aside className="md:w-56 shrink-0 md:sticky md:top-6 md:self-start md:max-h-[calc(100vh-12rem)] md:overflow-y-auto md:scrollbar-thin mb-4 md:mb-0">
          <nav className="flex md:flex-col gap-1 md:pr-4 md:border-r md:border-border overflow-x-auto md:overflow-visible scrollbar-thin md:scrollbar-none pb-2 md:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left whitespace-nowrap ${
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

        <main className="flex-1 md:pl-8 min-w-0">
          <div className="flex items-center gap-3 mb-6">
            <TabIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold capitalize">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>

          <Suspense fallback={null}>
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
          </Suspense>
        </main>
      </div>
    </div>
  )
}
