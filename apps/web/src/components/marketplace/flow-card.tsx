"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, Download, ExternalLink, Copy } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

interface FlowCardProps {
  id: string
  icon: ReactNode
  title: string
  description: string
  category: string
  rating: number
  downloads: number
  creator: string
  price: number | null
}

const categoryColors: Record<string, string> = {
  "SEO & Content Marketing": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Research & Intelligence": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Video & Media": "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "Photo & Design": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Content Writing": "bg-green-500/10 text-green-400 border-green-500/20",
  "Marketing": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Business Ops": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "Social Media": "bg-rose-500/10 text-rose-400 border-rose-500/20",
}

export function FlowCard({ id, icon, title, description, category, rating, downloads, creator, price }: FlowCardProps) {
  return (
    <Link href={`/marketplace/${id}`}>
      <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer">
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">{icon}</span>
            {price === null ? (
              <Badge variant="secondary" className="text-xs">Free</Badge>
            ) : (
              <Badge className="text-xs">${price}</Badge>
            )}
          </div>

          <h3 className="font-semibold mb-1 truncate">{title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 h-10">
            {description}
          </p>

          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${categoryColors[category] || "bg-accent text-accent-foreground"}`}>
              {category}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {downloads}
            </span>
            <span className="truncate ml-auto">{creator}</span>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface/90 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="outline" className="gap-1">
            <Copy className="h-3 w-3" /> Clone
          </Button>
          <Button size="sm" variant="default" className="gap-1">
            <ExternalLink className="h-3 w-3" /> View
          </Button>
        </div>
      </Card>
    </Link>
  )
}
