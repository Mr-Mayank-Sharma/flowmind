"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FlowPreview } from "@/components/marketplace/flow-preview"
import { Star, Download, Copy, ExternalLink, MessageSquare, User, BarChart3, Search, Video, Palette } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"

const flowIconMap: Record<string, React.ReactNode> = {
  "1": <BarChart3 className="h-8 w-8 text-blue-500" />,
  "2": <Search className="h-8 w-8 text-purple-500" />,
  "3": <Video className="h-8 w-8 text-pink-500" />,
  "4": <Palette className="h-8 w-8 text-orange-500" />,
}

export default function FlowDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [flow, setFlow] = useState<any>(null)
  const [related, setRelated] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.id) return
    const id = params.id as string
    Promise.all([
      api.marketplace.getById(id),
      api.marketplace.list({ category: undefined, limit: 5 }),
    ]).then(([flowData, listData]) => {
      setFlow(flowData)
      setRelated((listData.flows || []).filter((f: any) => f.id !== id).slice(0, 4))
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

  const graph = flow.pipeline?.graph || { nodes: [], edges: [] }
  const rating = flow.ratingAvg ?? flow.rating ?? 0
  const reviews = flow.reviews || []

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
                <span className="text-4xl">{flowIconMap[flow.id]}</span>
                <div>
                  <h1 className="text-2xl font-bold mb-1">{flow.title}</h1>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {flow.creator || "Unknown"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                      {typeof rating === "number" ? rating.toFixed(1) : rating}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      {flow.downloads || 0} downloads
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{flow.category}</Badge>
                    {(flow.tags || []).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {flow.price === null || flow.price === undefined ? (
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

            {graph.nodes.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3">Flow Preview</h2>
                <FlowPreview nodes={graph.nodes} edges={graph.edges} />
              </div>
            )}

            <Button className="w-full gap-2" onClick={async () => {
              try {
                const result = await api.marketplace.clone(flow.id)
                router.push(`/pipelines/${result.id}`)
              } catch {}
            }}>
              <Copy className="h-4 w-4" /> Clone This Flow
            </Button>
          </div>

          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Clone Flow</h3>
              <div className="space-y-3">
                <Button className="w-full gap-2" onClick={async () => {
                  try {
                    const result = await api.marketplace.clone(flow.id)
                    router.push(`/pipelines/${result.id}`)
                  } catch {}
                }}>
                  <Copy className="h-4 w-4" /> Clone to My Flows
                </Button>
                <Button variant="outline" className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" /> View Raw JSON
                </Button>
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
                        <span className="text-sm font-medium">{review.reviewer?.name || review.user || "Anonymous"}</span>
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < (review.stars ?? review.rating ?? 0) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`}
                            />
                          ))}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.body || review.text}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold mb-4">Related Flows</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((rel: any) => (
                <Link key={rel.id} href={`/marketplace/${rel.id}`}>
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{flowIconMap[rel.id]}</span>
                      <h3 className="font-semibold text-sm truncate">{rel.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{rel.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        {rel.ratingAvg ?? rel.rating ?? 0}
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
