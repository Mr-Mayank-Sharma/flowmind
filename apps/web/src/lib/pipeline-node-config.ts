export const NODE_TYPE_MAP: Record<string, string> = {
  cronTrigger: "triggerNode",
  webhookTrigger: "triggerNode",
  channelTrigger: "triggerNode",
  manualTrigger: "triggerNode",
  aiAgent: "aiNode",
  contentWriter: "aiNode",
  dataExtractor: "aiNode",
  classifier: "aiNode",
  summarizer: "aiNode",
  webResearcher: "aiNode",
  imageGenerator: "aiNode",
  httpRequest: "actionNode",
  databaseQuery: "actionNode",
  sendEmail: "actionNode",
  sendMessage: "actionNode",
  codeExecute: "actionNode",
  condition: "flowNode",
  switch: "flowNode",
  parallelFork: "flowNode",
  merge: "flowNode",
  loop: "flowNode",
  wait: "flowNode",
  openhumanMessage: "actionNode",
}

export const NODE_ICON_MAP: Record<string, string> = {
  cronTrigger: "Clock",
  webhookTrigger: "Webhook",
  channelTrigger: "MessageSquare",
  manualTrigger: "MousePointerClick",
  aiAgent: "Zap",
  contentWriter: "FileText",
  dataExtractor: "Database",
  classifier: "GitBranch",
  summarizer: "FileText",
  webResearcher: "Globe",
  imageGenerator: "Image",
  httpRequest: "Globe",
  databaseQuery: "Database",
  sendEmail: "Mail",
  sendMessage: "MessageSquare",
  codeExecute: "Code",
  condition: "GitBranch",
  switch: "SplitSquareHorizontal",
  parallelFork: "ArrowRight",
  merge: "Merge",
  loop: "Repeat",
  wait: "Clock",
  openhumanMessage: "MessageSquare",
}

export function getVisualType(engineType: string): string {
  return NODE_TYPE_MAP[engineType] || "actionNode"
}

export function getIconName(engineType: string): string {
  return NODE_ICON_MAP[engineType] || "Zap"
}
