"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FlowCard } from "@/components/marketplace/flow-card"
import { Search, SlidersHorizontal, TrendingUp, Clock, Star, ChevronRight } from "lucide-react"

const categories = [
  "All",
  "SEO & Content Marketing",
  "Research & Intelligence",
  "Video & Media",
  "Photo & Design",
  "Content Writing",
  "Marketing",
  "Business Ops",
  "Social Media",
]

const sortOptions = [
  { value: "popular", label: "Popular", icon: TrendingUp },
  { value: "newest", label: "Newest", icon: Clock },
  { value: "topRated", label: "Top Rated", icon: Star },
] as const

const mockFlows = [
  { id: "1", icon: "📈", title: "SEO Content Cluster Generator", description: "Generates comprehensive content clusters around target keywords with internal linking suggestions and topical authority mapping.", category: "SEO & Content Marketing", rating: 4.8, downloads: 1243, creator: "FlowMind Labs", price: null },
  { id: "2", icon: "🔍", title: "Competitor Research Intelligence", description: "Deep-dive competitor analysis extracting SEO strategies, content gaps, and backlink opportunities.", category: "Research & Intelligence", rating: 4.6, downloads: 892, creator: "DataWizards", price: 29 },
  { id: "3", icon: "🎬", title: "Auto Video Caption & Clip Pipeline", description: "Transcribes, captions, and clips long-form videos into shareable short-form content.", category: "Video & Media", rating: 4.9, downloads: 2105, creator: "MediaForge", price: null },
  { id: "4", icon: "🎨", title: "AI Image Batch Processor", description: "Batch upscale, style-transfer, and background-remove images using local Stable Diffusion.", category: "Photo & Design", rating: 4.7, downloads: 1567, creator: "PixelCraft", price: 15 },
  { id: "5", icon: "✍️", title: "Long-Form Article Writer", description: "Researches, outlines, and writes 3000+ word articles with citations and fact-checking.", category: "Content Writing", rating: 4.5, downloads: 3456, creator: "ContentLab", price: null },
  { id: "6", icon: "📊", title: "Marketing Funnel Analyzer", description: "Analyzes conversion funnels across channels and suggests optimization strategies.", category: "Marketing", rating: 4.4, downloads: 678, creator: "GrowthStack", price: 49 },
  { id: "7", icon: "📋", title: "Automated Invoice Processor", description: "Extracts, validates, and books invoice data from PDFs and emails into your accounting system.", category: "Business Ops", rating: 4.3, downloads: 456, creator: "BizFlow", price: null },
  { id: "8", icon: "📱", title: "Social Media Content Calendar", description: "Plans, generates, and schedules platform-optimized posts across all major social networks.", category: "Social Media", rating: 4.6, downloads: 987, creator: "SocialPilot", price: 19 },
  { id: "9", icon: "🎯", title: "Keyword Intent Classifier", description: "Classifies search queries by buyer intent (informational, navigational, commercial, transactional).", category: "SEO & Content Marketing", rating: 4.2, downloads: 534, creator: "SearchPro", price: null },
  { id: "10", icon: "🧪", title: "Research Paper Summarizer", description: "Downloads, parses, and summarizes academic papers with extracted methodology and findings.", category: "Research & Intelligence", rating: 4.7, downloads: 1245, creator: "AcademAI", price: null },
  { id: "11", icon: "🎥", title: "Video Script-to-Production Pipeline", description: "Takes a script concept through storyboard, voiceover generation, and final video assembly.", category: "Video & Media", rating: 4.8, downloads: 1876, creator: "StudioFlow", price: 39 },
  { id: "12", icon: "🖼️", title: "E-Commerce Product Photo Enhancer", description: "Enhances product photos with consistent backgrounds, lighting correction, and upscaling.", category: "Photo & Design", rating: 4.5, downloads: 2345, creator: "ShopVisuals", price: null },
  { id: "13", icon: "📝", title: "Blog Post Repurposer", description: "Converts a single blog post into social threads, newsletter, LinkedIn carousel, and podcast script.", category: "Content Writing", rating: 4.4, downloads: 1678, creator: "ContentLab", price: null },
  { id: "14", icon: "📈", title: "Cross-Channel Attribution Model", description: "Builds a marketing attribution model from CRM and ad platform data exports.", category: "Marketing", rating: 4.1, downloads: 345, creator: "Analytix", price: 59 },
  { id: "15", icon: "🔄", title: "Contract Review & Redline Agent", description: "Reviews contracts against playbook rules, flags risks, and suggests markups.", category: "Business Ops", rating: 4.6, downloads: 789, creator: "LegalAI", price: null },
  { id: "16", icon: "📲", title: "Viral Trend Scraper & Post Generator", description: "Scrapes trending topics and generates platform-native posts optimized for virality.", category: "Social Media", rating: 4.3, downloads: 567, creator: "TrendSpotters", price: 9 },
]

export default function MarketplacePage() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [sort, setSort] = useState<"popular" | "newest" | "topRated">("popular")
  const [showSort, setShowSort] = useState(false)

  const filteredFlows = useMemo(() => {
    let result = [...mockFlows]

    if (activeCategory !== "All") {
      result = result.filter(f => f.category === activeCategory)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      )
    }

    switch (sort) {
      case "popular":
        result.sort((a, b) => b.downloads - a.downloads)
        break
      case "newest":
        break
      case "topRated":
        result.sort((a, b) => b.rating - a.rating)
        break
    }

    return result
  }, [search, activeCategory, sort])

  const featuredFlows = useMemo(() =>
    mockFlows.filter(f => f.rating >= 4.7).slice(0, 5),
  [])

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-surface">
        <div className="container px-4 py-12">
          <h1 className="text-3xl font-bold mb-2">Flow Marketplace</h1>
          <p className="text-muted-foreground mb-6">
            Discover and clone pre-built AI workflows for every use case
          </p>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search flows..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSort(!showSort)}
                className="gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {sortOptions.find(s => s.value === sort)?.label}
              </Button>
              {showSort && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border bg-surface shadow-lg z-10">
                  {sortOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        onClick={() => { setSort(option.value as typeof sort); setShowSort(false) }}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors ${sort === option.value ? "text-foreground font-medium" : "text-muted-foreground"}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Featured Flows</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {featuredFlows.map((flow) => (
                <div
                  key={flow.id}
                  className="flex-shrink-0 w-64 rounded-lg border bg-background p-4 hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/marketplace/${flow.id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{flow.icon}</span>
                    <span className="font-semibold text-sm truncate">{flow.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      {flow.rating}
                    </span>
                    <span className="flex items-center gap-1">
                      <ChevronRight className="h-3 w-3" />
                      {flow.downloads}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b bg-surface">
        <div className="container px-4">
          <div className="flex gap-1 overflow-x-auto py-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-md text-sm transition-colors ${
                  activeCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {filteredFlows.length} flow{filteredFlows.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFlows.map((flow) => (
            <FlowCard key={flow.id} {...flow} />
          ))}
        </div>
      </div>
    </div>
  )
}
