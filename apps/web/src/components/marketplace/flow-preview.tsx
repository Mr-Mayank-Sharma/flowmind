"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"

interface FlowNode {
  id: string
  type: string
  label: string
  x: number
  y: number
}

interface FlowEdge {
  from: string
  to: string
}

interface FlowPreviewProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

const nodeColors: Record<string, string> = {
  input: "border-blue-500 bg-blue-500/10",
  llm: "border-purple-500 bg-purple-500/10",
  output: "border-green-500 bg-green-500/10",
  transform: "border-orange-500 bg-orange-500/10",
  condition: "border-yellow-500 bg-yellow-500/10",
  tool: "border-cyan-500 bg-cyan-500/10",
  default: "border-border bg-surface",
}

export function FlowPreview({ nodes, edges }: FlowPreviewProps) {
  const minX = useMemo(() => Math.min(...nodes.map(n => n.x)), [nodes])
  const minY = useMemo(() => Math.min(...nodes.map(n => n.y)), [nodes])
  const maxX = useMemo(() => Math.max(...nodes.map(n => n.x + 160)), [nodes])
  const maxY = useMemo(() => Math.max(...nodes.map(n => n.y + 48)), [nodes])

  const width = maxX - minX + 40
  const height = maxY - minY + 40
  const offsetX = 20 - minX
  const offsetY = 20 - minY

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          style={{ minHeight: 200, maxHeight: 400 }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--color-text-secondary))" />
            </marker>
          </defs>

          {edges.map((edge) => {
            const from = nodes.find(n => n.id === edge.from)
            const to = nodes.find(n => n.id === edge.to)
            if (!from || !to) return null
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x + 160 + offsetX}
                y1={from.y + 24 + offsetY}
                x2={to.x + offsetX}
                y2={to.y + 24 + offsetY}
                stroke="hsl(var(--color-text-secondary))"
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
                className="opacity-50"
              />
            )
          })}

          {nodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x + offsetX}
                y={node.y + offsetY}
                width={160}
                height={48}
                rx={8}
                className={nodeColors[node.type] || nodeColors.default}
                strokeWidth={1}
                stroke="currentColor"
                fill="hsl(var(--color-surface))"
              />
              <text
                x={node.x + 80 + offsetX}
                y={node.y + 24 + offsetY}
                textAnchor="middle"
                dominantBaseline="central"
                fill="hsl(var(--color-text-primary))"
                fontSize={12}
                className="select-none"
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </Card>
  )
}
