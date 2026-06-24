"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FlowPreview } from "@/components/marketplace/flow-preview"
import { Star, Download, Copy, ExternalLink, MessageSquare, User } from "lucide-react"
import Link from "next/link"

const mockFlows = [
  { id: "1", icon: "📈", title: "SEO Content Cluster Generator", description: "Generates comprehensive content clusters around target keywords with internal linking suggestions and topical authority mapping. Uses local LLMs to research, outline, and write pillar pages and cluster articles with entity optimization.", category: "SEO & Content Marketing", tags: ["seo", "content", "clusters", "keywords"], rating: 4.8, downloads: 1243, creator: "FlowMind Labs", price: null, nodes: [
    { id: "kw-input", type: "input", label: "Keyword Input", x: 0, y: 0 },
    { id: "research", type: "llm", label: "Topic Research", x: 200, y: 0 },
    { id: "cluster", type: "transform", label: "Cluster Builder", x: 400, y: 0 },
    { id: "outline", type: "llm", label: "Outline Generator", x: 600, y: 0 },
    { id: "writer", type: "llm", label: "Content Writer", x: 800, y: 0 },
    { id: "output", type: "output", label: "Export", x: 1000, y: 0 },
  ], edges: [
    { from: "kw-input", to: "research" },
    { from: "research", to: "cluster" },
    { from: "cluster", to: "outline" },
    { from: "outline", to: "writer" },
    { from: "writer", to: "output" },
  ], reviews: [
    { id: "r1", user: "SEOpro42", rating: 5, text: "Incredible time saver. Generates thorough clusters that actually rank." },
    { id: "r2", user: "ContentMgr", rating: 4, text: "Great output quality. Occasionally needs manual tweaking of outlines." },
    { id: "r3", user: "AgencyLife", rating: 5, text: "Used this for 5 client projects. Everyone loved the results." },
  ] },
  { id: "2", icon: "🔍", title: "Competitor Research Intelligence", description: "Deep-dive competitor analysis extracting SEO strategies, content gaps, and backlink opportunities.", category: "Research & Intelligence", tags: ["research", "competitors", "seo", "analysis"], rating: 4.6, downloads: 892, creator: "DataWizards", price: 29, nodes: [
    { id: "url-input", type: "input", label: "Competitor URLs", x: 0, y: 0 },
    { id: "scraper", type: "tool", label: "Content Scraper", x: 200, y: 0 },
    { id: "analyzer", type: "llm", label: "Strategy Analyzer", x: 400, y: 0 },
    { id: "gaps", type: "transform", label: "Gap Finder", x: 600, y: 0 },
    { id: "report", type: "output", label: "Report Output", x: 800, y: 0 },
  ], edges: [
    { from: "url-input", to: "scraper" },
    { from: "scraper", to: "analyzer" },
    { from: "analyzer", to: "gaps" },
    { from: "gaps", to: "report" },
  ], reviews: [
    { id: "r1", user: "MarketAnalyst", rating: 5, text: "Found gaps I never would have spotted manually." },
    { id: "r2", user: "StartupCEO", rating: 4, text: "Solid analysis. Backlink data could be more detailed." },
  ] },
  { id: "3", icon: "🎬", title: "Auto Video Caption & Clip Pipeline", description: "Transcribes, captions, and clips long-form videos into shareable short-form content.", category: "Video & Media", tags: ["video", "caption", "transcription", "clips"], rating: 4.9, downloads: 2105, creator: "MediaForge", price: null, nodes: [
    { id: "video-input", type: "input", label: "Video Upload", x: 0, y: 0 },
    { id: "transcribe", type: "llm", label: "Transcriber", x: 200, y: 0 },
    { id: "clipper", type: "transform", label: "Smart Clipper", x: 400, y: 0 },
    { id: "caption", type: "tool", label: "Caption Renderer", x: 600, y: 0 },
    { id: "output", type: "output", label: "Export Clips", x: 800, y: 0 },
  ], edges: [
    { from: "video-input", to: "transcribe" },
    { from: "transcribe", to: "clipper" },
    { from: "clipper", to: "caption" },
    { from: "caption", to: "output" },
  ], reviews: [
    { id: "r1", user: "ContentCreator", rating: 5, text: "This saves me hours every week. The clipping is surprisingly accurate." },
    { id: "r2", user: "SocialMediaMgr", rating: 5, text: "Perfect for repurposing long YouTube videos into TikTok/Reels." },
  ] },
  { id: "4", icon: "🎨", title: "AI Image Batch Processor", description: "Batch upscale, style-transfer, and background-remove images using local Stable Diffusion.", category: "Photo & Design", tags: ["images", "batch", "upscale", "sd"], rating: 4.7, downloads: 1567, creator: "PixelCraft", price: 15, nodes: [
    { id: "images-input", type: "input", label: "Image Batch", x: 0, y: 0 },
    { id: "upscaler", type: "tool", label: "AI Upscaler", x: 200, y: 0 },
    { id: "bg-remove", type: "tool", label: "BG Removal", x: 200, y: 60 },
    { id: "style-transfer", type: "tool", label: "Style Transfer", x: 200, y: 120 },
    { id: "output", type: "output", label: "Processed Output", x: 400, y: 60 },
  ], edges: [
    { from: "images-input", to: "upscaler" },
    { from: "images-input", to: "bg-remove" },
    { from: "images-input", to: "style-transfer" },
    { from: "upscaler", to: "output" },
    { from: "bg-remove", to: "output" },
    { from: "style-transfer", to: "output" },
  ], reviews: [
    { id: "r1", user: "EcomStoreOwner", rating: 5, text: "Processing 1000s of product photos is finally painless." },
    { id: "r2", user: "PhotoEditor", rating: 4, text: "Great results. Would love more style transfer models." },
  ] },
]

const mockFlowsMap = new Map(mockFlows.map(f => [f.id, f]))

export default function FlowDetailPage() {
  const params = useParams()
  const flow = mockFlowsMap.get(params.id as string)

  if (!flow) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Flow Not Found</h1>
          <p className="text-muted-foreground mb-4">The flow you are looking for does not exist.</p>
          <Link href="/marketplace">
            <Button variant="outline">Back to Marketplace</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-surface">
        <div className="container px-4 py-4">
          <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to Marketplace
          </Link>
        </div>
      </div>

      <div className="container px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <span className="text-4xl">{flow.icon}</span>
                <div>
                  <h1 className="text-2xl font-bold mb-1">{flow.title}</h1>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {flow.creator}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                      {flow.rating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      {flow.downloads} downloads
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{flow.category}</Badge>
                    {flow.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {flow.price === null ? (
                  <Badge variant="secondary" className="text-sm px-4 py-1">Free</Badge>
                ) : (
                  <Badge className="text-sm px-4 py-1">${flow.price}</Badge>
                )}
              </div>
            </div>

            <Card className="p-6">
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{flow.description}</p>
            </Card>

            <div>
              <h2 className="font-semibold mb-3">Flow Preview</h2>
              <FlowPreview nodes={flow.nodes} edges={flow.edges} />
            </div>

            <Button className="w-full gap-2">
              <Copy className="h-4 w-4" /> Clone This Flow
            </Button>
          </div>

          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Clone Flow</h3>
              <div className="space-y-3">
                <Button className="w-full gap-2">
                  <Copy className="h-4 w-4" /> Clone to My Flows
                </Button>
                <Button variant="outline" className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" /> View Raw JSON
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Reviews ({flow.reviews.length})
              </h3>
              <div className="space-y-4">
                {flow.reviews.map((review) => (
                  <div key={review.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{review.user}</span>
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < review.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`}
                          />
                        ))}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{review.text}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4">Related Flows</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockFlows.filter(f => f.id !== flow.id && f.category === flow.category).slice(0, 4).map((related) => (
              <Link key={related.id} href={`/marketplace/${related.id}`}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{related.icon}</span>
                    <h3 className="font-semibold text-sm truncate">{related.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{related.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      {related.rating}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {related.downloads}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
