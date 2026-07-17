"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@flowmind/ui"
import { Store, Download, Star, Tag, Search, ArrowLeft, Puzzle } from "lucide-react"
import { CardSkeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"

type Tab = "workflows" | "skills"

export default function MarketplacePage() {
  const [tab, setTab] = useState<Tab>("workflows")
  const [flows, setFlows] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (tab === "workflows") {
      setLoaded(false)
      Promise.all([
        api.pipeline.listMarketplace(selectedCategory ?? undefined),
        api.pipeline.marketplaceCategories(),
      ]).then(([flowsData, catsData]) => {
        setFlows(flowsData ?? [])
        setCategories(catsData ?? [])
        setLoaded(true)
      }).catch(() => setLoaded(true))
    } else {
      setLoaded(false)
      api.skills.list(selectedCategory ? { tag: selectedCategory } : undefined)
        .then((data) => {
          setSkills(data ?? [])
          setLoaded(true)
        })
        .catch(() => setLoaded(true))
    }
  }, [tab, selectedCategory])

  const handleClone = async (id: string) => {
    try {
      const result = await api.pipeline.cloneFromMarketplace(id)
      window.location.href = `/pipelines/${result.id}`
    } catch (err) {
      console.error("Clone failed:", err)
    }
  }

  const handleInstallSkill = async (skillId: string) => {
    try {
      await api.skills.install(skillId)
    } catch (err) {
      console.error("Install failed:", err)
    }
  }

  const filteredFlows = searchQuery
    ? flows.filter((f) =>
        f.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.tags?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : flows

  const filteredSkills = searchQuery
    ? skills.filter((s) =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tags?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : skills

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
              Discover and clone community-built workflow templates and skills
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex gap-1 p-1 bg-surface rounded-lg border">
            <button
              onClick={() => { setTab("workflows"); setSelectedCategory(null); setSearchQuery("") }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "workflows" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Workflows
            </button>
            <button
              onClick={() => { setTab("skills"); setSelectedCategory(null); setSearchQuery("") }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "skills" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <span className="flex items-center gap-1.5">
                <Puzzle className="h-3.5 w-3.5" />
                Skills
              </span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tab === "workflows" ? "Search templates..." : "Search skills..."}
              className="w-full h-10 pl-9 pr-4 rounded-lg border bg-surface text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {tab === "workflows" && (
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${!selectedCategory ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-accent"}`}
              >
                All
              </button>
              {categories.length > 0
                ? categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${selectedCategory === cat.name ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-accent"}`}
                  >
                    {cat.name}
                  </button>
                ))
                : [...new Set(flows.map((f: any) => f.category).filter(Boolean))].map((cat: string) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${selectedCategory === cat ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-accent"}`}
                  >
                    {cat}
                  </button>
                ))
              }
            </div>
          )}
        </div>

        {!loaded ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : tab === "workflows" ? (
          filteredFlows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-1">No templates found</p>
              <p className="text-sm">Try a different category or search term</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredFlows.map((flow) => (
                <Card key={flow.id} className="group hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {flow.title}
                          {flow.isVerified && (
                            <Badge variant="default" className="text-[9px] px-1 py-0">Verified</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-2">
                          {flow.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {flow.tags?.slice(0, 3).map((tag: string) => (
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
                          {flow.downloads}
                        </span>
                        {flow.ratingAvg > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            {flow.ratingAvg.toFixed(1)}
                          </span>
                        )}
                        {flow._count?.reviews > 0 && (
                          <span>({flow._count.reviews})</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => handleClone(flow.id)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Clone
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          filteredSkills.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Puzzle className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-1">No skills found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredSkills.map((skill) => (
                <Card key={skill.id} className="group hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Puzzle className="h-4 w-4 text-pink-500" />
                          {skill.name}
                          <Badge variant="outline" className="text-[9px] px-1 py-0">v{skill.version}</Badge>
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-2">
                          {skill.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {skill.tags?.slice(0, 3).map((tag: string) => (
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
                          {skill.downloads}
                        </span>
                        {skill.ratingAvg > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            {skill.ratingAvg.toFixed(1)}
                          </span>
                        )}
                        <span className="text-muted-foreground">by {skill.author}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => handleInstallSkill(skill.id)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Install
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  )
}
