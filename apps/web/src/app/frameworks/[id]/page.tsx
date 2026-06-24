"use client"

import { useParams } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, LayoutDashboard, Cuboid, Terminal, Settings, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { OverviewPanel } from "@/components/framework/overview-panel"
import { ModelManager } from "@/components/framework/model-manager"
import { LogViewer } from "@/components/framework/log-viewer"
import { ConfigEditor } from "@/components/framework/config-editor"
import { MetricsPanel } from "@/components/framework/metrics-panel"

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "models", label: "Models", icon: Cuboid },
  { id: "logs", label: "Logs", icon: Terminal },
  { id: "config", label: "Config", icon: Settings },
  { id: "metrics", label: "Metrics", icon: BarChart3 },
] as const

type TabId = (typeof tabs)[number]["id"]

export default function FrameworkDetailPage() {
  const params = useParams()
  const frameworkId = params.id as string
  const [activeTab, setActiveTab] = useState<TabId>("overview")

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-4">
          <Link
            href="/frameworks"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Frameworks
          </Link>
          <div className="flex items-center gap-4 border-b border-border/50 -mx-6 px-6 pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-3 text-sm border-b-2 transition-colors -mb-px",
                    activeTab === tab.id
                      ? "border-primary text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {activeTab === "overview" && <OverviewPanel frameworkId={frameworkId} />}
        {activeTab === "models" && <ModelManager frameworkId={frameworkId} />}
        {activeTab === "logs" && <LogViewer frameworkId={frameworkId} />}
        {activeTab === "config" && <ConfigEditor frameworkId={frameworkId} />}
        {activeTab === "metrics" && <MetricsPanel frameworkId={frameworkId} />}
      </div>
    </div>
  )
}
