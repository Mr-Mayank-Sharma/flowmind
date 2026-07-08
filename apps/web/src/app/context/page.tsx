"use client"

import React, { useState } from "react"
import {
  Brain,
  BookOpen,
  Search,
  MessageSquare,
  Layers,
  GitBranch,
  Clock,
  User,
  Tag,
  Database,
  Lightbulb,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { useQuery } from "@/hooks/use-query"

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? "s" : ""} ago`
}

export default function ContextPage() {
  const [memorySearch, setMemorySearch] = useState("")

  const { data: sessions = [], loading: sessionsLoading } = useQuery(
    "context:sessions",
    () => api.context.getSessions(),
  )
  const { data: skills = [], loading: skillsLoading } = useQuery(
    "context:skills",
    () => api.context.getSkills(),
  )
  const { data: memories = [], loading: memoriesLoading } = useQuery(
    "context:memories",
    () => api.context.getMemories(),
  )

  const filteredMemories = memories.filter((m: any) =>
    m.content.toLowerCase().includes(memorySearch.toLowerCase())
  )

  const sessionStatusColors: Record<string, "default" | "secondary" | "outline"> = {
    active: "default",
    idle: "secondary",
    archived: "outline",
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Context Engine</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Session management, skill library, and memory browser
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            <span>{(memories.length + skills.length + sessions.length).toLocaleString()} items</span>
          </div>
        </div>

        <Tabs defaultValue="sessions">
          <TabsList className="mb-6">
            <TabsTrigger value="sessions" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Skill Library
            </TabsTrigger>
            <TabsTrigger value="memory" className="gap-2">
              <Brain className="h-4 w-4" />
              Memory Viewer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions">
            <div className="grid gap-3">
              {sessions.map((session: any) => (
                <Card key={session.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                          session.status === "active" ? "bg-emerald-500/10" :
                          session.status === "idle" ? "bg-muted" : "bg-muted/50"
                        }`}>
                          <MessageSquare className={`h-4 w-4 ${
                            session.status === "active" ? "text-emerald-500" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{session.name}</p>
                          <p className="text-xs text-muted-foreground">{session.agentName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {session.memoryCount}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          {(session.tokens / 1000).toFixed(1)}K
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {relativeTime(session.lastActive)}
                        </span>
                        <Badge variant={sessionStatusColors[session.status]} className="text-[10px] h-5">
                          {session.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="skills">
            <div className="grid gap-3 md:grid-cols-2">
              {skills.map(skill => (
                <Card key={skill.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Lightbulb className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{skill.name}</p>
                            <Badge variant="outline" className="text-[10px] h-4">{skill.category}</Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">v{skill.version}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{skill.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{skill.usageCount} uses</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={skill.enabled ? "default" : "secondary"} className="text-[10px] h-5 shrink-0 ml-3">
                        {skill.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="memory">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search memories..."
                  className="pl-9"
                  value={memorySearch}
                  onChange={e => setMemorySearch(e.target.value)}
                />
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {filteredMemories.map(memory => {
                    const iconColor = memory.type === "episodic" ? "text-blue-500" :
                      memory.type === "semantic" ? "text-emerald-500" : "text-amber-500"
                    const bgColor = memory.type === "episodic" ? "bg-blue-500/10" :
                      memory.type === "semantic" ? "bg-emerald-500/10" : "bg-amber-500/10"
                    return (
                      <div key={memory.id} className="flex items-start gap-3 p-4 hover:bg-accent/30 transition-colors">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${bgColor}`}>
                          {memory.type === "episodic" && <MessageSquare className={`h-4 w-4 ${iconColor}`} />}
                          {memory.type === "semantic" && <BookOpen className={`h-4 w-4 ${iconColor}`} />}
                          {memory.type === "procedural" && <GitBranch className={`h-4 w-4 ${iconColor}`} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{memory.content}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] h-4 capitalize">{memory.type}</Badge>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {memory.agentName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {relativeTime(memory.timestamp)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {(memory.relevance * 100).toFixed(0)}% relevant
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
