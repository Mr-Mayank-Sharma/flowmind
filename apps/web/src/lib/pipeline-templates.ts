import type { Node, Edge } from "reactflow"

export interface PipelineTemplate {
  id: string
  name: string
  description: string
  icon: string
  nodes: Node[]
  edges: Edge[]
}

export const pipelineTemplates: PipelineTemplate[] = [
  {
    id: "blank",
    name: "Blank Pipeline",
    description: "Start from scratch with an empty canvas",
    icon: "FileText",
    nodes: [],
    edges: [],
  },
  {
    id: "seo-optimization",
    name: "SEO Optimization",
    description: "Fetch URL, analyze SEO, generate optimizations",
    icon: "Search",
    nodes: [
      {
        id: "trigger-1",
        type: "triggerNode",
        position: { x: 0, y: 0 },
        data: { label: "Webhook Trigger", icon: "Webhook", config: { summary: "Receives URL to analyze" } },
      },
      {
        id: "http-1",
        type: "actionNode",
        position: { x: 0, y: 150 },
        data: { label: "Fetch URL", icon: "Globe", config: { summary: "HTTP GET to fetch page content" } },
      },
      {
        id: "ai-1",
        type: "aiNode",
        position: { x: 0, y: 300 },
        data: { label: "Analyze SEO", icon: "Search", config: { summary: "AI analysis of SEO metrics" } },
      },
      {
        id: "ai-2",
        type: "aiNode",
        position: { x: 0, y: 450 },
        data: { label: "Generate Optimizations", icon: "Zap", config: { summary: "Generate SEO recommendations" } },
      },
      {
        id: "action-1",
        type: "actionNode",
        position: { x: 0, y: 600 },
        data: { label: "Format Report", icon: "FileText", config: { summary: "Format as structured report" } },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "http-1", animated: true },
      { id: "e2", source: "http-1", target: "ai-1" },
      { id: "e3", source: "ai-1", target: "ai-2" },
      { id: "e4", source: "ai-2", target: "action-1" },
    ],
  },
  {
    id: "email-triage",
    name: "Email Triage",
    description: "Cron-triggered email classification and digest",
    icon: "Mail",
    nodes: [
      {
        id: "trigger-1",
        type: "triggerNode",
        position: { x: 0, y: 0 },
        data: { label: "Cron Trigger", icon: "Clock", config: { summary: "Every day at 7:00 AM" } },
      },
      {
        id: "http-1",
        type: "actionNode",
        position: { x: 0, y: 150 },
        data: { label: "Fetch Emails", icon: "Mail", config: { summary: "Fetch unread emails from inbox" } },
      },
      {
        id: "ai-1",
        type: "aiNode",
        position: { x: 0, y: 300 },
        data: { label: "Classify Emails", icon: "GitBranch", config: { summary: "Classify as urgent/newsletter/personal" } },
      },
      {
        id: "flow-1",
        type: "flowNode",
        position: { x: 0, y: 450 },
        data: { label: "Route by Urgency", icon: "SplitSquareHorizontal", config: { summary: "Branch by email urgency level" } },
      },
      {
        id: "ai-2",
        type: "aiNode",
        position: { x: -125, y: 600 },
        data: { label: "Compose Digest", icon: "FileText", config: { summary: "Generate email digest summary" } },
      },
      {
        id: "action-1",
        type: "actionNode",
        position: { x: 125, y: 600 },
        data: { label: "Send to Slack", icon: "MessageSquare", config: { summary: "Post urgent alerts to Slack" } },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "http-1", animated: true },
      { id: "e2", source: "http-1", target: "ai-1" },
      { id: "e3", source: "ai-1", target: "flow-1" },
      { id: "e4", source: "flow-1", target: "ai-2", label: "newsletter" },
      { id: "e5", source: "flow-1", target: "action-1", label: "urgent" },
    ],
  },
  {
    id: "ai-code-review",
    name: "AI Code Review",
    description: "Parallel quality and security review on PRs",
    icon: "Code",
    nodes: [
      {
        id: "trigger-1",
        type: "triggerNode",
        position: { x: 0, y: 0 },
        data: { label: "GitHub Webhook", icon: "Webhook", config: { summary: "Triggers on pull request" } },
      },
      {
        id: "http-1",
        type: "actionNode",
        position: { x: 0, y: 150 },
        data: { label: "Fetch Diff", icon: "Code", config: { summary: "GET PR diff from GitHub API" } },
      },
      {
        id: "flow-1",
        type: "flowNode",
        position: { x: 0, y: 300 },
        data: { label: "Parallel Review", icon: "ArrowRight", config: { summary: "Fork into parallel reviews" } },
      },
      {
        id: "ai-1",
        type: "aiNode",
        position: { x: -125, y: 450 },
        data: { label: "Quality Review", icon: "Zap", config: { summary: "AI code quality analysis" } },
      },
      {
        id: "ai-2",
        type: "aiNode",
        position: { x: 125, y: 450 },
        data: { label: "Security Review", icon: "AlertTriangle", config: { summary: "AI security vulnerability scan" } },
      },
      {
        id: "flow-2",
        type: "flowNode",
        position: { x: 0, y: 600 },
        data: { label: "Merge Results", icon: "Merge", config: { summary: "Combine review findings" } },
      },
      {
        id: "action-1",
        type: "actionNode",
        position: { x: 0, y: 750 },
        data: { label: "Post PR Comment", icon: "MessageSquare", config: { summary: "Comment review on PR" } },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "http-1", animated: true },
      { id: "e2", source: "http-1", target: "flow-1" },
      { id: "e3", source: "flow-1", target: "ai-1" },
      { id: "e4", source: "flow-1", target: "ai-2" },
      { id: "e5", source: "ai-1", target: "flow-2" },
      { id: "e6", source: "ai-2", target: "flow-2" },
      { id: "e7", source: "flow-2", target: "action-1" },
    ],
  },
  {
    id: "content-generation",
    name: "Content Generation",
    description: "Research, draft, and optimize content with AI",
    icon: "FileText",
    nodes: [
      {
        id: "trigger-1",
        type: "triggerNode",
        position: { x: 0, y: 0 },
        data: { label: "Manual Trigger", icon: "MousePointerClick", config: { summary: "Start with a topic" } },
      },
      {
        id: "ai-1",
        type: "aiNode",
        position: { x: 0, y: 150 },
        data: { label: "Web Research", icon: "Globe", config: { summary: "Research topic online" } },
      },
      {
        id: "ai-2",
        type: "aiNode",
        position: { x: 0, y: 300 },
        data: { label: "Write Draft", icon: "FileText", config: { summary: "Generate content draft" } },
      },
      {
        id: "ai-3",
        type: "aiNode",
        position: { x: 0, y: 450 },
        data: { label: "SEO Optimize", icon: "Search", config: { summary: "Optimize for search engines" } },
      },
      {
        id: "action-1",
        type: "actionNode",
        position: { x: 0, y: 600 },
        data: { label: "Format Output", icon: "FileText", config: { summary: "Format final content" } },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "ai-1", animated: true },
      { id: "e2", source: "ai-1", target: "ai-2" },
      { id: "e3", source: "ai-2", target: "ai-3" },
      { id: "e4", source: "ai-3", target: "action-1" },
    ],
  },
  {
    id: "data-extraction",
    name: "Data Extraction",
    description: "Fetch URLs and extract structured data with AI",
    icon: "Database",
    nodes: [
      {
        id: "trigger-1",
        type: "triggerNode",
        position: { x: 0, y: 0 },
        data: { label: "Manual Trigger", icon: "MousePointerClick", config: { summary: "Start with URL input" } },
      },
      {
        id: "http-1",
        type: "actionNode",
        position: { x: 0, y: 150 },
        data: { label: "Fetch URL", icon: "Globe", config: { summary: "HTTP GET target URL" } },
      },
      {
        id: "ai-1",
        type: "aiNode",
        position: { x: 0, y: 300 },
        data: { label: "Extract Data", icon: "Database", config: { summary: "AI extraction of structured data" } },
      },
      {
        id: "action-2",
        type: "actionNode",
        position: { x: 0, y: 450 },
        data: { label: "Format Output", icon: "FileText", config: { summary: "Format as JSON/CSV" } },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "http-1", animated: true },
      { id: "e2", source: "http-1", target: "ai-1" },
      { id: "e3", source: "ai-1", target: "action-2" },
    ],
  },
]
