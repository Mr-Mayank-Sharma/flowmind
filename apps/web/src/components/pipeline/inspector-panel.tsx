"use client"

import { useState, useEffect, useCallback } from "react"
import { Button, Input, Textarea, ScrollArea, Separator } from "@flowmind/ui"
import { Trash2, X, Settings, Globe, Play, Loader2, Code } from "lucide-react"
import type { Node } from "reactflow"

interface InspectorPanelProps {
  selectedNode: Node | null
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void
  onDeleteNode: (nodeId: string) => void
  onRunNode?: (nodeId: string) => Promise<any>
  onUpdateNodeStatus?: (nodeId: string, status: string) => void
  onClose: () => void
}

const nodeTypeLabels: Record<string, string> = {
  triggerNode: "Trigger",
  aiNode: "AI Node",
  actionNode: "Action",
  flowNode: "Flow Control",
  integrationNode: "Integration",
}

const triggerConfigFields = [
  { key: "cronExpression", label: "Cron Expression", type: "text", placeholder: "*/5 * * * *", description: "Schedule interval" },
  { key: "webhookUrl", label: "Webhook URL", type: "text", placeholder: "/webhook/custom", description: "Endpoint path" },
  { key: "channel", label: "Channel", type: "select", options: ["email", "slack", "discord", "telegram"], description: "Input channel" },
]

const aiConfigFields = [
  { key: "model", label: "Model", type: "select", options: ["gpt-4", "gpt-3.5", "claude-3", "tinyllama", "mistral"], description: "AI model to use" },
  { key: "systemPrompt", label: "System Prompt", type: "textarea", placeholder: "You are a helpful assistant... {{ $json.field }}", description: "System instructions (supports expressions)" },
  { key: "temperature", label: "Temperature", type: "number", placeholder: "0.7", description: "Response creativity (0-2)" },
  { key: "maxTokens", label: "Max Tokens", type: "number", placeholder: "2048", description: "Maximum response length" },
]

const actionConfigFields: Record<string, any[]> = {
  httpRequest: [
    { key: "url", label: "URL", type: "text", placeholder: "https://api.example.com/{{ $json.id }}", description: "Request URL" },
    { key: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "PATCH", "DELETE"], description: "HTTP method" },
    { key: "headers", label: "Headers", type: "textarea", placeholder: '{"Authorization": "Bearer {{ $env.API_KEY }}"}', description: "Request headers" },
    { key: "body", label: "Body", type: "textarea", placeholder: '{"key": "{{ $json.value }}"}', description: "Request body" },
  ],
  databaseQuery: [
    { key: "connectionString", label: "Connection String", type: "text", placeholder: "postgresql://...", description: "Database URL" },
    { key: "query", label: "Query", type: "textarea", placeholder: "SELECT * FROM users WHERE id = {{ $json.id }}", description: "SQL query" },
  ],
  sendEmail: [
    { key: "to", label: "To", type: "text", placeholder: "{{ $json.email }}", description: "Recipient email" },
    { key: "subject", label: "Subject", type: "text", placeholder: "Hello {{ $json.name }}!", description: "Email subject" },
    { key: "body", label: "Body", type: "textarea", placeholder: "Email content here...", description: "Email body" },
  ],
  sendMessage: [
    { key: "channel", label: "Channel", type: "select", options: ["slack", "discord", "telegram", "email"], description: "Message channel" },
    { key: "webhookUrl", label: "Webhook URL", type: "text", placeholder: "https://hooks.slack.com/...", description: "Channel webhook" },
    { key: "message", label: "Message", type: "textarea", placeholder: "Hello, {{ $json.name }}!", description: "Message content" },
  ],
  codeExecute: [
    { key: "language", label: "Language", type: "select", options: ["javascript", "python", "bash", "typescript"], description: "Script language" },
    { key: "code", label: "Code", type: "textarea", placeholder: "return $json.input * 2;", description: "Code to execute" },
  ],
}

const flowConfigFields = [
  { key: "condition", label: "Condition Expression", type: "text", placeholder: "$json.value > 10", description: "JavaScript condition" },
  { key: "trueLabel", label: "True Branch Label", type: "text", placeholder: "Yes", description: "Label for true path" },
  { key: "falseLabel", label: "False Branch Label", type: "text", placeholder: "No", description: "Label for false path" },
]

const nodeTypeConfigMap: Record<string, any[]> = {
  triggerNode: triggerConfigFields,
  aiNode: aiConfigFields,
  flowNode: flowConfigFields,
}

function getConfigFields(nodeType: string | undefined, nodeLabel: string): any[] {
  if (!nodeType) return []
  const base = nodeTypeConfigMap[nodeType]
  if (base) return base
  if (nodeType === "actionNode") {
    const labelKey = nodeLabel.toLowerCase().replace(/\s+/g, "")
    const actionKey = Object.keys(actionConfigFields).find(k => labelKey.includes(k))
    return actionConfigFields[actionKey || "httpRequest"]! || actionConfigFields.httpRequest
  }
  return []
}

export function InspectorPanel({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  onRunNode,
  onUpdateNodeStatus,
  onClose,
}: InspectorPanelProps) {
  const [label, setLabel] = useState("")
  const [description, setDescription] = useState("")
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState(false)
  const [testOutput, setTestOutput] = useState<any>(null)
  const [showExpressionHelp, setShowExpressionHelp] = useState(false)

  useEffect(() => {
    if (selectedNode) {
      setLabel((selectedNode.data?.label as string) || "")
      setDescription((selectedNode.data?.config as Record<string, unknown>)?.description as string || "")
      setConfigValues((selectedNode.data?.config as Record<string, unknown>)?.values as Record<string, string> || {})
      setTestOutput((selectedNode.data as any)?.lastOutput ?? null)
    }
  }, [selectedNode])

  const handleLabelChange = useCallback(
    (value: string) => {
      setLabel(value)
      if (selectedNode) {
        onUpdateNode(selectedNode.id, { ...selectedNode.data, label: value })
      }
    },
    [selectedNode, onUpdateNode]
  )

  const handleConfigChange = useCallback(
    (key: string, value: string) => {
      const updated = { ...configValues, [key]: value }
      setConfigValues(updated)
      if (selectedNode) {
        onUpdateNode(selectedNode.id, {
          ...selectedNode.data,
          config: { ...(selectedNode.data?.config as Record<string, unknown> || {}), values: updated, description },
        })
      }
    },
    [selectedNode, onUpdateNode, configValues, description]
  )

  const handleDelete = useCallback(() => {
    if (selectedNode) {
      onDeleteNode(selectedNode.id)
    }
  }, [selectedNode, onDeleteNode])

  const handleTestNode = useCallback(async () => {
    if (!selectedNode || !onRunNode) return
    setTesting(true)
    setTestOutput(null)
    if (onUpdateNodeStatus) onUpdateNodeStatus(selectedNode.id, "running")
    try {
      const result = await onRunNode(selectedNode.id)
      setTestOutput(result)
      if (onUpdateNodeStatus && !result?.error) onUpdateNodeStatus(selectedNode.id, "success")
      if (onUpdateNodeStatus && result?.error) onUpdateNodeStatus(selectedNode.id, "error")
    } catch (err) {
      setTestOutput({ error: String(err) })
      if (onUpdateNodeStatus) onUpdateNodeStatus(selectedNode.id, "error")
    } finally {
      setTesting(false)
    }
  }, [selectedNode, onRunNode, onUpdateNodeStatus])

  const configFields = getConfigFields(selectedNode?.type, label)

  if (!selectedNode) {
    return (
      <div className="w-72 h-full bg-surface border-l border flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 h-10 border-b shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Inspector
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            Select a node to inspect
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 h-full bg-surface border-l border flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 h-10 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Settings className="h-3.5 w-3.5" />
          Inspector
        </span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-accent rounded-md transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Type
            </p>
            <p className="text-xs text-foreground">
              {selectedNode.type ? (nodeTypeLabels[selectedNode.type] || selectedNode.type) : "Unknown"}
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Label
            </label>
            <Input
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="h-8 text-xs"
              placeholder="Node label"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Notes
            </label>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (selectedNode) {
                  onUpdateNode(selectedNode.id, {
                    ...selectedNode.data,
                    config: { ...(selectedNode.data?.config as Record<string, unknown> || {}), description: e.target.value, values: configValues },
                  })
                }
              }}
              className="min-h-[50px] text-xs"
              placeholder="Optional notes about this node"
            />
          </div>

          <Separator />

          {/* Test Node Button */}
          {onRunNode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestNode}
              disabled={testing}
              className="w-full gap-1.5 text-xs h-8"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {testing ? "Testing..." : "Test Node"}
            </Button>
          )}

          {/* Test Output */}
          {testOutput && (
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Code className="h-3 w-3" />
                Last Output
              </p>
              <pre className="rounded-md border bg-background p-2 text-[10px] font-mono text-foreground max-h-40 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(testOutput, null, 2)}
              </pre>
            </div>
          )}

          <Separator />

          {configFields.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Settings className="h-3 w-3" />
                Configuration
                <button
                  onClick={() => setShowExpressionHelp(!showExpressionHelp)}
                  className="ml-auto text-primary hover:underline"
                >
                  <Code className="h-3 w-3" />
                </button>
              </p>

              {showExpressionHelp && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-[10px] space-y-1">
                  <p className="font-medium text-foreground">Expression Reference</p>
                  <p><code className="text-primary">{`{{ $json.field }}`}</code> — Access pipeline data</p>
                  <p><code className="text-primary">{`{{ $node.nodeId.output }}`}</code> — Another node&apos;s output</p>
                  <p><code className="text-primary">{`{{ $env.VAR }}`}</code> — Environment variable</p>
                  <p><code className="text-primary">{`{{ $now }}`}</code> — Current timestamp</p>
                  <p><code className="text-primary">{`{{ $run.id }}`}</code> — Run metadata</p>
                </div>
              )}

              {configFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-[11px] font-medium text-foreground">
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
                    <Textarea
                      value={configValues[field.key] || ""}
                      onChange={(e) => handleConfigChange(field.key, e.target.value)}
                      className="min-h-[60px] text-xs font-mono"
                      placeholder={field.placeholder}
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={configValues[field.key] || (field.options?.[0] || "")}
                      onChange={(e) => handleConfigChange(field.key, e.target.value)}
                      className="h-8 text-xs w-full rounded-md border border-input bg-surface px-2 text-foreground"
                    >
                      {field.options?.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === "number" ? (
                    <Input
                      type="number"
                      value={configValues[field.key] || ""}
                      onChange={(e) => handleConfigChange(field.key, e.target.value)}
                      className="h-8 text-xs"
                      placeholder={field.placeholder}
                      step="0.1"
                    />
                  ) : (
                    <Input
                      value={configValues[field.key] || ""}
                      onChange={(e) => handleConfigChange(field.key, e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder={field.placeholder}
                    />
                  )}
                  {field.description && (
                    <p className="text-[10px] text-muted-foreground">{field.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {configFields.length === 0 && (
            <div className="rounded-md border border-dashed p-3">
              <p className="text-[10px] text-muted-foreground text-center">
                No configuration fields for this node type
              </p>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Globe className="h-3 w-3" />
              Data Flow
            </p>
            <div className="rounded-md border p-2 text-[10px] text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Input:</span> Data from previous nodes</p>
              <p><span className="font-medium text-foreground">Output:</span> <code className="text-primary">$json</code> object with results</p>
              <p className="text-[9px]">Use expressions like <code className="text-primary">{`{{ $json.field }}`}</code></p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="w-full gap-1.5 text-xs h-8"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Node
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
