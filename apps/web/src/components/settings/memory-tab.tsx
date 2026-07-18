"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Trash2, Search } from "lucide-react"
import { api } from "@/lib/api"
import { useQuery, useMutation } from "@/hooks/use-query"
import { Skeleton } from "@/components/ui/skeleton"

export function MemoryTab({
  memorySearch, setMemorySearch, skillSearch, setSkillSearch,
}: {
  memorySearch: string
  setMemorySearch: (v: string) => void
  skillSearch: string
  setSkillSearch: (v: string) => void
}) {
  const { data: toolsList = [], refetch: refetchTools } = useQuery(
    "settings:tools",
    () => api.tools.list(),
  )

  const { mutate: toggleTool } = useMutation(
    (id: string) => api.tools.toggle(id),
    { onSuccess: refetchTools },
  )

  const { data: memories = [], loading: memoriesLoading, refetch: refetchMemories } = useQuery(
    "settings:memories",
    () => api.settings.getMemories(),
  )

  const { mutate: deleteMemory } = useMutation(
    (id: string) => api.settings.deleteMemory(id),
    { onSuccess: refetchMemories },
  )

  const filteredSkills = toolsList.filter((s: any) =>
    s.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
    s.description.toLowerCase().includes(skillSearch.toLowerCase())
  )
  const filteredMemory = memories.filter((e: any) =>
    (e.content ?? e.summary ?? "").toLowerCase().includes(memorySearch.toLowerCase()) ||
    e.type.toLowerCase().includes(memorySearch.toLowerCase())
  )

  const typeColors: Record<string, string> = {
    Conversation: "bg-blue-500",
    Document: "bg-amber-500",
    Preference: "bg-purple-500",
    "Code Snippet": "bg-emerald-500",
    Fact: "bg-rose-500",
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Skill Library</CardTitle>
          <CardDescription>Enable or disable agent capabilities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search skills..."
              value={skillSearch}
              onChange={e => setSkillSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="space-y-2">
            {filteredSkills.map((skill: any) => (
              <div key={skill.id} className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{skill.name}</p>
                    <Badge variant="outline" className="text-xs">{skill.category ?? "General"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{skill.description}</p>
                </div>
                <Switch checked={skill.isActive} onCheckedChange={() => toggleTool(skill.id)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memory Manager</CardTitle>
          <CardDescription>Search and manage stored memories</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search memories..."
              value={memorySearch}
              onChange={e => setMemorySearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{filteredMemory.length} entries</span>
            <span>Total: ~{memories.length} entries</span>
          </div>
          <div className="divide-y divide-border">
            {memoriesLoading ? (
              <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
            ) : filteredMemory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No memories found</p>
            ) : filteredMemory.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-3 py-3">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${typeColors[entry.type] ?? "bg-blue-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{entry.type}</p>
                    <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.content ?? entry.summary ?? ""}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteMemory(entry.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
