"use client"

import { useState } from "react"
import { Link2, ServerCog } from "lucide-react"
import { cn } from "@/lib/utils"
import { HostPanel } from "@/components/host/host-panel"
import { ProposalsPanel } from "@/components/host/proposals-panel"
import { ClientPanel } from "@/components/host/client-panel"

type Tab = "host" | "proposals" | "client"

const tabs: { id: Tab; label: string; icon: typeof Link2 }[] = [
  { id: "host", label: "Groups & Clients", icon: ServerCog },
  { id: "proposals", label: "Proposals", icon: Link2 },
  { id: "client", label: "Client Connect", icon: Link2 },
]

export default function HostConnectPage() {
  const [tab, setTab] = useState<Tab>("host")

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-5">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Host Connect</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Host enterprise mode: shared Ollama model, canonical pipelines/skills/RAG, and propose → review → merge flows.
          </p>
        </div>
        <div className="flex gap-1 px-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2",
                tab === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-6 py-6">
        {tab === "host" && <HostPanel />}
        {tab === "proposals" && <ProposalsPanel />}
        {tab === "client" && <ClientPanel />}
      </div>
    </div>
  )
}
