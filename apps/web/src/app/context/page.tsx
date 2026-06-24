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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Session {
  id: string
  name: string
  agentName: string
  tokens: number
  memoryCount: number
  lastActive: string
  status: "active" | "idle" | "archived"
}

interface Skill {
  id: string
  name: string
  description: string
  category: string
  version: string
  enabled: boolean
  usageCount: number
}

interface MemoryEntry {
  id: string
  type: "episodic" | "semantic" | "procedural"
  content: string
  agentName: string
  timestamp: string
  relevance: number
}

const sessions: Session[] = [
  { id: "s1", name: "Code Review Session", agentName: "Code Reviewer", tokens: 45230, memoryCount: 12, lastActive: "2 min ago", status: "active" },
  { id: "s2", name: "Research Deep Dive", agentName: "Research Assistant", tokens: 128450, memoryCount: 34, lastActive: "15 min ago", status: "active" },
  { id: "s3", name: "Content Planning", agentName: "Content Writer", tokens: 18200, memoryCount: 8, lastActive: "1 hour ago", status: "idle" },
  { id: "s4", name: "Data Pipeline Debug", agentName: "DevOps Bot", tokens: 67200, memoryCount: 19, lastActive: "3 hours ago", status: "idle" },
  { id: "s5", name: "Customer Ticket #4521", agentName: "Customer Support", tokens: 8900, memoryCount: 5, lastActive: "1 day ago", status: "archived" },
  { id: "s6", name: "Market Analysis Q1", agentName: "Data Analyst", tokens: 234000, memoryCount: 42, lastActive: "2 days ago", status: "archived" },
]

const skills: Skill[] = [
  { id: "sk1", name: "Web Search", description: "Search and extract information from the web", category: "Utility", version: "2.1.0", enabled: true, usageCount: 145 },
  { id: "sk2", name: "Code Analysis", description: "Analyze and review source code", category: "Development", version: "1.4.2", enabled: true, usageCount: 89 },
  { id: "sk3", name: "Data Visualization", description: "Create charts and visual representations", category: "Analytics", version: "1.0.5", enabled: true, usageCount: 67 },
  { id: "sk4", name: "Sentiment Analysis", description: "Analyze text sentiment and emotion", category: "NLP", version: "2.0.1", enabled: true, usageCount: 34 },
  { id: "sk5", name: "Summarization", description: "Summarize long documents and articles", category: "NLP", version: "1.3.0", enabled: true, usageCount: 203 },
  { id: "sk6", name: "Translation", description: "Translate content between languages", category: "NLP", version: "1.1.0", enabled: false, usageCount: 12 },
  { id: "sk7", name: "Document Parsing", description: "Parse and extract data from documents", category: "Utility", version: "2.2.0", enabled: true, usageCount: 78 },
  { id: "sk8", name: "SQL Query Builder", description: "Generate and optimize SQL queries", category: "Development", version: "1.0.3", enabled: false, usageCount: 45 },
]

const memories: MemoryEntry[] = [
  { id: "m1", type: "episodic", content: "User requested code review for PR #142 with focus on security vulnerabilities", agentName: "Code Reviewer", timestamp: "2 min ago", relevance: 0.95 },
  { id: "m2", type: "semantic", content: "The project uses Next.js 14 with App Router and server components", agentName: "Research Assistant", timestamp: "15 min ago", relevance: 0.88 },
  { id: "m3", type: "procedural", content: "When reviewing code: check imports, validate types, run linter, verify tests", agentName: "Code Reviewer", timestamp: "1 hour ago", relevance: 0.76 },
  { id: "m4", type: "episodic", content: "User prefers detailed explanations with code examples in responses", agentName: "Content Writer", timestamp: "3 hours ago", relevance: 0.82 },
  { id: "m5", type: "semantic", content: "API keys should never be logged or exposed in debug output", agentName: "DevOps Bot", timestamp: "1 day ago", relevance: 0.91 },
  { id: "m6", type: "procedural", content: "Database connection retry logic: max 3 attempts, exponential backoff", agentName: "DevOps Bot", timestamp: "2 days ago", relevance: 0.69 },
  { id: "m7", type: "episodic", content: "Customer reported issue with login timeout on mobile devices", agentName: "Customer Support", timestamp: "3 days ago", relevance: 0.73 },
  { id: "m8", type: "semantic", content: "Market analysis shows 23% growth in AI agent adoption Q1 2025", agentName: "Data Analyst", timestamp: "4 days ago", relevance: 0.65 },
]

// memory type icon config removed - rendered inline below

export default function ContextPage() {
  const [activeSessions, setActiveSessions] = useState(sessions)
  const [memorySearch, setMemorySearch] = useState("")

  const filteredMemories = memories.filter(m =>
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
            <span>{(memories.length + skills.length + activeSessions.length).toLocaleString()} items</span>
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
              {activeSessions.map(session => (
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
                          {session.lastActive}
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
                              {memory.timestamp}
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
