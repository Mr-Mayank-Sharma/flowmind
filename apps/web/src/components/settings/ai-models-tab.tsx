"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Plus, ArrowUpDown } from "lucide-react"

const models = [
  "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "claude-3-opus", "claude-3-sonnet",
  "claude-3-haiku", "gemini-1.5-pro", "gemini-1.5-flash", "mistral-large",
  "llama-3-70b", "llama-3-8b", "mixtral-8x22b",
]

const providers = ["OpenAI", "Anthropic", "Google AI", "Mistral AI", "Meta", "Groq", "Together AI", "Fireworks"]

export function AiModelsTab() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Default Model</CardTitle>
          <CardDescription>Select the default AI model for new conversations and pipelines</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Select>
              <SelectTrigger className="w-full"><SelectValue placeholder="gpt-4o" /></SelectTrigger>
              <SelectContent>
                {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Temperature</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  defaultValue="0.7"
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-mono text-muted-foreground w-8 text-right">0.7</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Tokens</label>
              <Input type="number" defaultValue={4096} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider Priority</CardTitle>
          <CardDescription>Drag to reorder fallback providers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {providers.map((p, i) => (
            <div key={p} className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-3">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium flex-1">{p}</span>
              <Badge variant="secondary" className="text-xs">{i === 0 ? "Primary" : i === 1 ? "Fallback" : "Tier " + (i + 1)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost Limits</CardTitle>
          <CardDescription>Set spending caps per provider to control costs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {["OpenAI", "Anthropic", "Google AI"].map(provider => (
            <div key={provider} className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
              <span className="text-sm font-medium">{provider}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Monthly cap:</span>
                <Input
                  type="number"
                  defaultValue={provider === "OpenAI" ? 200 : provider === "Anthropic" ? 150 : 100}
                  className="w-24 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">USD</span>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Add Provider Limit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
