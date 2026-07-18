"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { cn } from "@flowmind/ui"
import {
  Clock,
  Webhook,
  MessageSquare,
  MousePointerClick,
  Zap,
  FileText,
  Database,
  GitBranch,
  Globe,
  Image,
  Code,
  Mail,
  SplitSquareHorizontal,
  Merge,
  Repeat,
  ArrowRight,
  AlertTriangle,
  Puzzle,
} from "lucide-react"

interface BaseNodeData {
  label: string
  icon?: string
  config?: Record<string, unknown>
  status?: "idle" | "running" | "success" | "error" | "cancelled"
  selected?: boolean
}

const iconMap: Record<string, React.ElementType> = {
  Clock,
  Webhook,
  MessageSquare,
  MousePointerClick,
  Zap,
  FileText,
  Database,
  GitBranch,
  Globe,
  Image,
  Code,
  Mail,
  SplitSquareHorizontal,
  Merge,
  Repeat,
  ArrowRight,
  AlertTriangle,
  Workflow: Zap,
  Puzzle,
}

function StatusDot({ status }: { status?: string }) {
  if (!status || status === "idle") return null
  const colors: Record<string, string> = {
    running: "bg-blue-500 animate-pulse",
    success: "bg-green-500",
    error: "bg-red-500",
    cancelled: "bg-yellow-500",
  }
  return (
    <span
      className={cn(
        "absolute top-1 right-1 h-2 w-2 rounded-full",
        colors[status] || "bg-gray-500"
      )}
    />
  )
}

function NodeHeader({
  label,
  iconName,
  color,
}: {
  label: string
  iconName?: string
  color: string
}) {
  const Icon = iconName ? iconMap[iconName] : null
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-semibold text-white",
        color
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span className="truncate">{label}</span>
    </div>
  )
}

interface NodeConfig {
  color: string
  handleColor: string
  placeholder: string
  handles: Array<{ type: "source" | "target"; position: Position; id?: string }>
}

const NODE_CONFIGS: Record<string, NodeConfig> = {
  triggerNode: {
    color: "bg-emerald-600",
    handleColor: "!bg-emerald-500",
    placeholder: "Configure trigger...",
    handles: [{ type: "source", position: Position.Bottom }],
  },
  aiNode: {
    color: "bg-violet-600",
    handleColor: "!bg-violet-500",
    placeholder: "Configure AI node...",
    handles: [
      { type: "target", position: Position.Top },
      { type: "source", position: Position.Bottom },
    ],
  },
  actionNode: {
    color: "bg-blue-600",
    handleColor: "!bg-blue-500",
    placeholder: "Configure action...",
    handles: [
      { type: "target", position: Position.Top },
      { type: "source", position: Position.Bottom },
    ],
  },
  flowNode: {
    color: "bg-orange-600",
    handleColor: "!bg-orange-500",
    placeholder: "Configure flow...",
    handles: [
      { type: "target", position: Position.Top },
      { type: "source", position: Position.Bottom },
      { type: "source", position: Position.Left, id: "left" },
      { type: "source", position: Position.Right, id: "right" },
    ],
  },
  integrationNode: {
    color: "bg-gray-600",
    handleColor: "!bg-gray-500",
    placeholder: "Configure integration...",
    handles: [
      { type: "target", position: Position.Top },
      { type: "source", position: Position.Bottom },
    ],
  },
  skillNode: {
    color: "bg-pink-600",
    handleColor: "!bg-pink-500",
    placeholder: "Skill node",
    handles: [
      { type: "target", position: Position.Top },
      { type: "source", position: Position.Bottom },
    ],
  },
}

function PipelineNodeComponent({ data, selected }: NodeProps<BaseNodeData>, nodeType: string) {
  const config: NodeConfig = NODE_CONFIGS[nodeType] ?? {
    color: "bg-blue-600",
    handleColor: "!bg-blue-500",
    placeholder: "Configure action...",
    handles: [
      { type: "target", position: Position.Top },
      { type: "source", position: Position.Bottom },
    ],
  }
  const iconName = nodeType === "skillNode" ? "Puzzle" : data.icon

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface shadow-sm transition-shadow min-w-[160px]",
        selected && "ring-2 ring-ring shadow-md"
      )}
    >
      <NodeHeader label={data.label} iconName={iconName} color={config.color} />
      <div className="px-3 py-2 text-[11px] text-muted-foreground">
        {data.config?.summary ? String(data.config.summary) : config.placeholder}
      </div>
      <StatusDot status={data.status} />
      {config.handles.map((h, i) => (
        <Handle
          key={h.id || `${h.type}-${i}`}
          type={h.type}
          position={h.position}
          id={h.id}
          className={cn(config.handleColor, "!border-2 !border-background !w-3 !h-3")}
        />
      ))}
    </div>
  )
}

function makeNode(nodeType: string) {
  const Component = memo((props: NodeProps<BaseNodeData>) => PipelineNodeComponent(props, nodeType))
  Component.displayName = nodeType
  return Component
}

export const TriggerNode = makeNode("triggerNode")
export const AINode = makeNode("aiNode")
export const ActionNode = makeNode("actionNode")
export const FlowNode = makeNode("flowNode")
export const IntegrationNode = makeNode("integrationNode")
export const SkillNode = makeNode("skillNode")

export const nodeTypes = {
  triggerNode: TriggerNode,
  aiNode: AINode,
  actionNode: ActionNode,
  flowNode: FlowNode,
  integrationNode: IntegrationNode,
  skillNode: SkillNode,
}
