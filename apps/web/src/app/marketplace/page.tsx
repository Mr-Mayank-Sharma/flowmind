"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@flowmind/ui"
import { Store, Download, Star, Tag, Search, ArrowLeft, Puzzle, Box, MessageSquare, Bot, Plug, Package } from "lucide-react"
import { CardSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { MarketplaceItemType } from "@/lib/api/marketplace"

const ITEM_TABS: { type: MarketplaceItemType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: "PIPELINE", label: "Pipelines", icon: <Box className="h-3.5 w-3.5" />, color: "text-blue-500" },
  { type: "SKILL", label: "Skills", icon: <Puzzle className="h-3.5 w-3.5" />, color: "text-pink-500" },
  { type: "WORKFLOW", label: "Workflows", icon: <Package className="h-3.5 w-3.5" />, color: "text-green-500" },
  { type: "PROMPT_PACK", label: "Prompt Packs", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-purple-500" },
  { type: "AGENT_TEMPLATE", label: "Agent Templates", icon: <Bot className="h-3.5 w-3.5" />, color: "text-cyan-500" },
  { type: "MCP_INTEGRATION", label: "MCP Integrations", icon: <Plug className="h-3.5 w-3.5" />, color: "text-orange-500" },
  { type: "PLUGIN", label: "Plugins", icon: <Package className="h-3.5 w-3.5" />, color: "text-indigo-500" },
]

export default function MarketplacePage() {
  const [tab, setTab] = useState<MarketplaceItemType>("PIPELINE")
  const [listings, setListings] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    setLoaded(false)
    setError(null)
    try {
      const result = await api.marketplace.list({
        type: tab,
        category: selectedCategory ?? undefined,
        search: searchQuery || undefined,
      })
      const cats = [...new Set((result.listings ?? []).map((l: any) => l.category).filter(Boolean))]
      setListings(result.listings ?? [])
      setCategories(cats as string[])
    } catch (err: any) {
      console.error("Failed to load marketplace data:", err)
      setError(err?.message || "Failed to load marketplace data")
    } finally {
      setLoaded(true)
    }
  }, [tab, selectedCategory, searchQuery])

  useEffect(() => {
    const t = setTimeout(() => {
      loadData()
    }, searchQuery ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadData, searchQuery])

  const handleClone = async (id: string) => {
    try {
      await api.marketplace.clone(id)
      toast({ title: "Item cloned to your workspace", variant: "success" })
    } catch (err) {
      console.error("Clone failed:", err)
      toast({ title: "Clone failed", variant: "error" })
    }
  }

  const currentTab = ITEM_TABS.find((t) => t.type === tab)

  return (
    <div className="min-h-screen bg-background">
      <main className="container px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/pipelines" className="p-1 hover:bg-accent rounded-md transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Store className="h-6 w-6" />
              Marketplace
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Discover and install community-built items for your workspace
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex gap-1 p-1 bg-surface rounded-lg border shrink-0 overflow-x-auto">
            {ITEM_TABS.map((item) => (
              <button
                key={item.type}
                onClick={() => { setTab(item.type); setSelectedCategory(null); setSearchQuery("") }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                  tab === item.type ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={tab === item.type ? "" : item.color}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${currentTab?.label.toLowerCase() ?? "items"}...`}
              className="w-full h-10 pl-9 pr-4 rounded-lg border bg-surface text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${!selectedCategory ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-accent"}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${selectedCategory === cat ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-accent"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {!loaded ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : listings.length === 0 ? (
          <EmptyState
            icon={Store}
            title={`No ${currentTab?.label.toLowerCase() ?? "items"} found`}
            description="Try a different category or search term"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((item) => (
              <Link key={item.id} href={`/marketplace/${item.id}`}>
                <Card className="group hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {item.title}
                          {item.isVerified && (
                            <Badge variant="default" className="text-[9px] px-1 py-0">Verified</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-2">
                          {item.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {item.tags?.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {item.downloads}
                        </span>
                        {item.ratingAvg > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            {item.ratingAvg.toFixed(1)}
                          </span>
                        )}
                        {item.owner?.name && (
                          <span className="truncate max-w-[100px]">by {item.owner.name}</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={(e) => { e.preventDefault(); handleClone(item.id) }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Clone
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
