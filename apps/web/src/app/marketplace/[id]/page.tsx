"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FlowPreview } from "@/components/marketplace/flow-preview"
import { Star, Download, Copy, ExternalLink, MessageSquare, User, Puzzle, Box, Bot, Plug, Package, MessageSquare as PromptIcon } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"

const typeIconMap = {
  PIPELINE: { icon: <Box className="h-8 w-8 text-blue-500" />, label: "Pipeline" },
  SKILL: { icon: <Puzzle className="h-8 w-8 text-pink-500" />, label: "Skill" },
  WORKFLOW: { icon: <Package className="h-8 w-8 text-green-500" />, label: "Workflow" },
  PROMPT_PACK: { icon: <PromptIcon className="h-8 w-8 text-purple-500" />, label: "Prompt Pack" },
  AGENT_TEMPLATE: { icon: <Bot className="h-8 w-8 text-cyan-500" />, label: "Agent Template" },
  MCP_INTEGRATION: { icon: <Plug className="h-8 w-8 text-orange-500" />, label: "MCP Integration" },
  PLUGIN: { icon: <Package className="h-8 w-8 text-indigo-500" />, label: "Plugin" },
} as const satisfies Record<string, { icon: React.ReactNode; label: string }>

export default function ListingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [listing, setListing] = useState<any>(null)
  const [related, setRelated] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showRawJson, setShowRawJson] = useState(false)

  useEffect(() => {
    if (!params.id) return
    const id = params.id as string
    Promise.all([
      api.marketplace.getById(id),
      api.marketplace.list({ limit: 5 }),
    ]).then(([itemData, listData]) => {
      setListing(itemData)
      setRelated((listData.listings || []).filter((f: any) => f.id !== id).slice(0, 4))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Item Not Found</h1>
          <p className="text-muted-foreground mb-4">The item you are looking for does not exist.</p>
          <Link href="/marketplace">
            <Button variant="outline">Back to Marketplace</Button>
          </Link>
        </div>
      </div>
    )
  }

  const typeInfo = typeIconMap[listing.type as keyof typeof typeIconMap] ?? typeIconMap.PIPELINE
  const rating = listing.ratingAvg ?? listing.rating ?? 0
  const reviews = listing.reviews || []

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
                <span>{typeInfo.icon}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold">{listing.title}</h1>
                    <Badge variant="outline" className="text-xs">{typeInfo.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {listing.owner?.name || "Unknown"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                      {typeof rating === "number" ? rating.toFixed(1) : rating}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      {listing.downloads || 0} downloads
                    </span>
                    <span>v{listing.version}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {listing.category && <Badge variant="secondary">{listing.category}</Badge>}
                    {(listing.tags || []).slice(0, 6).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Card className="p-6">
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{listing.description}</p>
            </Card>

            {listing.type === "PIPELINE" && listing.pipeline?.graph && (
              <div>
                <h2 className="font-semibold mb-3">Flow Preview</h2>
                <FlowPreview nodes={listing.pipeline.graph.nodes} edges={listing.pipeline.graph.edges} />
              </div>
            )}

            {listing.manifest && (
              <Card className="p-6">
                <h2 className="font-semibold mb-2">Manifest</h2>
                <pre className="text-xs text-muted-foreground overflow-x-auto max-h-96">
                  {JSON.stringify(listing.manifest, null, 2)}
                </pre>
              </Card>
            )}

            <Button className="w-full gap-2" onClick={async () => {
              try {
                await api.marketplace.clone(listing.id)
                router.push("/marketplace")
              } catch {}
            }}>
              <Copy className="h-4 w-4" /> Clone This Item
            </Button>
          </div>

          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Copy className="h-4 w-4" /> Clone Item
              </h3>
              <div className="space-y-3">
                <Button className="w-full gap-2" onClick={async () => {
                  try {
                    await api.marketplace.clone(listing.id)
                    router.push("/marketplace")
                  } catch {}
                }}>
                  <Copy className="h-4 w-4" /> Clone to My Items
                </Button>
                {listing.manifest && (
                  <>
                    <Button variant="outline" className="w-full gap-2" onClick={() => setShowRawJson((v) => !v)}>
                      <ExternalLink className="h-4 w-4" /> {showRawJson ? "Hide Raw JSON" : "View Raw JSON"}
                    </Button>
                    {showRawJson && (
                      <pre className="mt-3 text-xs text-muted-foreground overflow-x-auto max-h-96 rounded-md bg-muted/50 border border-border p-3">
                        {JSON.stringify(listing.manifest, null, 2)}
                      </pre>
                    )}
                  </>
                )}
              </div>
            </Card>

            {reviews.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Reviews ({reviews.length})
                </h3>
                <div className="space-y-4">
                  {reviews.map((review: any) => (
                    <div key={review.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{review.reviewer?.name || "Anonymous"}</span>
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < (review.stars ?? 0) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`}
                            />
                          ))}
                        </span>
                      </div>
                      {review.body && <p className="text-sm text-muted-foreground">{review.body}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold mb-4">Related Items</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((rel: any) => (
                <Link key={rel.id} href={`/marketplace/${rel.id}`}>
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{(typeIconMap[rel.type as keyof typeof typeIconMap]?.icon)}</span>
                      <h3 className="font-semibold text-sm truncate">{rel.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{rel.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        {rel.ratingAvg ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {rel.downloads ?? 0}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
