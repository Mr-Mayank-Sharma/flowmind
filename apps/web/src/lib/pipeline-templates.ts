import type { Node, Edge } from "reactflow"

export interface PipelineTemplateNode extends Node {
  engineType?: string
}

export interface PipelineTemplate {
  id: string
  name: string
  description: string
  icon: string
  nodes: PipelineTemplateNode[]
  edges: Edge[]
}

type EngineType =
  | "manualTrigger" | "cronTrigger" | "webhookTrigger" | "channelTrigger" | "pollingTrigger"
  | "aiAgent" | "contentWriter" | "dataExtractor" | "classifier" | "summarizer" | "webResearcher" | "imageGenerator"
  | "ragRetrieve"
  | "httpRequest" | "databaseQuery" | "sendEmail" | "sendMessage" | "codeExecute"
  | "condition" | "switch" | "parallelFork" | "merge" | "loop" | "wait"
  | "humanApproval"

const node = (
  id: string,
  type: string,
  engineType: EngineType,
  label: string,
  icon: string,
  config: Record<string, unknown>,
  x: number,
  y: number,
): PipelineTemplateNode => ({
  id,
  type,
  position: { x, y },
  data: { label, icon, config: { ...config, summary: "" } },
  engineType,
})

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
      node("trigger-1", "triggerNode", "webhookTrigger", "Webhook Trigger", "Webhook", { webhookUrl: "/webhook/seo" }, 0, 0),
      node("http-1", "actionNode", "httpRequest", "Fetch URL", "Globe", { method: "GET", url: "{{$json.url}}" }, 0, 150),
      node("ai-1", "aiNode", "aiAgent", "Analyze SEO", "Search", { prompt: "Analyze the SEO of this page and list issues: {{$json}}" }, 0, 300),
      node("ai-2", "aiNode", "aiAgent", "Generate Optimizations", "Zap", { prompt: "Generate concrete SEO recommendations from: {{$json}}" }, 0, 450),
      node("action-1", "actionNode", "contentWriter", "Format Report", "FileText", { prompt: "Format the recommendations as a structured markdown report: {{$json}}" }, 0, 600),
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
      node("trigger-1", "triggerNode", "cronTrigger", "Cron Trigger", "Clock", { cronExpression: "0 7 * * *" }, 0, 0),
      node("http-1", "actionNode", "httpRequest", "Fetch Emails", "Mail", { method: "GET", url: "{{$json.endpoint}}" }, 0, 150),
      node("ai-1", "aiNode", "classifier", "Classify Emails", "GitBranch", { prompt: "Classify each email as urgent, newsletter, or personal: {{$json}}" }, 0, 300),
      node("flow-1", "flowNode", "condition", "Route by Urgency", "SplitSquareHorizontal", { condition: "$json.category === 'urgent'" }, 0, 450),
      node("ai-2", "aiNode", "contentWriter", "Compose Digest", "FileText", { prompt: "Write a summary digest of these emails: {{$json}}" }, -125, 600),
      node("action-1", "actionNode", "sendMessage", "Send to Slack", "MessageSquare", { channel: "#alerts", message: "{{$json.digest}}" }, 125, 600),
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "http-1", animated: true },
      { id: "e2", source: "http-1", target: "ai-1" },
      { id: "e3", source: "ai-1", target: "flow-1" },
      { id: "e4", source: "flow-1", target: "ai-2", label: "no" },
      { id: "e5", source: "flow-1", target: "action-1", label: "yes" },
    ],
  },
  {
    id: "ai-code-review",
    name: "AI Code Review",
    description: "Parallel quality and security review on PRs",
    icon: "Code",
    nodes: [
      node("trigger-1", "triggerNode", "webhookTrigger", "GitHub Webhook", "Webhook", { webhookUrl: "/webhook/github" }, 0, 0),
      node("http-1", "actionNode", "httpRequest", "Fetch Diff", "Code", { method: "GET", url: "{{$json.diff_url}}" }, 0, 150),
      node("flow-1", "flowNode", "parallelFork", "Parallel Review", "ArrowRight", { branches: 2 }, 0, 300),
      node("ai-1", "aiNode", "aiAgent", "Quality Review", "Zap", { prompt: "Review this code diff for quality issues: {{$json}}" }, -125, 450),
      node("ai-2", "aiNode", "aiAgent", "Security Review", "AlertTriangle", { prompt: "Review this code diff for security vulnerabilities: {{$json}}" }, 125, 450),
      node("flow-2", "flowNode", "merge", "Merge Results", "Merge", {}, 0, 600),
      node("action-1", "actionNode", "sendMessage", "Post PR Comment", "MessageSquare", { channel: "{{$json.channel}}", message: "{{$json.review}}" }, 0, 750),
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
      node("trigger-1", "triggerNode", "manualTrigger", "Manual Trigger", "MousePointerClick", {}, 0, 0),
      node("ai-1", "aiNode", "webResearcher", "Web Research", "Globe", { prompt: "Research this topic: {{$json.topic}}" }, 0, 150),
      node("ai-2", "aiNode", "contentWriter", "Write Draft", "FileText", { prompt: "Write a draft article based on: {{$json}}" }, 0, 300),
      node("ai-3", "aiNode", "aiAgent", "SEO Optimize", "Search", { prompt: "Optimize this draft for SEO: {{$json}}" }, 0, 450),
      node("action-1", "actionNode", "contentWriter", "Format Output", "FileText", { prompt: "Format the final content: {{$json}}" }, 0, 600),
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
      node("trigger-1", "triggerNode", "manualTrigger", "Manual Trigger", "MousePointerClick", {}, 0, 0),
      node("http-1", "actionNode", "httpRequest", "Fetch URL", "Globe", { method: "GET", url: "{{$json.url}}" }, 0, 150),
      node("ai-1", "aiNode", "dataExtractor", "Extract Data", "Database", { prompt: "Extract structured data (JSON) from: {{$json}}" }, 0, 300),
      node("action-2", "actionNode", "contentWriter", "Format Output", "FileText", { prompt: "Format the extracted data as JSON/CSV: {{$json}}" }, 0, 450),
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "http-1", animated: true },
      { id: "e2", source: "http-1", target: "ai-1" },
      { id: "e3", source: "ai-1", target: "action-2" },
    ],
  },
]
