"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
  SelectionMode,
  BackgroundVariant,
} from "reactflow"
import type { DragEvent } from "react"
import "reactflow/dist/style.css"
import { nodeTypes as customNodeTypes } from "./custom-nodes"
import { NodePalette } from "./node-palette"
import { InspectorPanel } from "./inspector-panel"
import { PipelineToolbar } from "./pipeline-toolbar"
import { RunsPanel } from "./runs-panel"
import { cn } from "@flowmind/ui"
import { api } from "../../lib/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

function getToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)flowmind_token=([^;]*)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

interface PipelineCanvasProps {
  pipelineId: string
  initialName?: string
  initialNodes?: Node[]
  initialEdges?: Edge[]
}

const defaultNode = (
  type: string,
  position: { x: number; y: number },
  label: string
): Node => {
  const typeMap: Record<string, string> = {
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
  const iconMap: Record<string, string> = {
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
  const isSkill = type.startsWith("skill.")
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: isSkill ? "skillNode" : typeMap[type] || "actionNode",
    position,
    data: {
      label,
      icon: isSkill ? "Puzzle" : iconMap[type] || "Zap",
      config: { summary: "" },
      status: "idle",
      engineType: type,
    },
  }
}

function CanvasInner({
  pipelineId,
  initialName = "Untitled Pipeline",
  initialNodes = [],
  initialEdges = [],
}: PipelineCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [pipelineName, setPipelineName] = useState(initialName)
  const [version, setVersion] = useState(1)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [showRuns, setShowRuns] = useState(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (pipelineId === "new") return
    api.pipeline.getById(pipelineId).then((data) => {
      if (data?.graph) {
        const g = typeof data.graph === "string" ? JSON.parse(data.graph) : data.graph
        if (g.nodes) {
          setNodes(g.nodes.map((n: any) => {
            const engineType = n.engineType ?? n.type
            const typeMapRev: Record<string, string> = {
              cronTrigger: "triggerNode", webhookTrigger: "triggerNode", channelTrigger: "triggerNode", manualTrigger: "triggerNode",
              aiAgent: "aiNode", contentWriter: "aiNode", dataExtractor: "aiNode", classifier: "aiNode",
              summarizer: "aiNode", webResearcher: "aiNode", imageGenerator: "aiNode",
              httpRequest: "actionNode", databaseQuery: "actionNode", sendEmail: "actionNode",
              sendMessage: "actionNode", codeExecute: "actionNode",
              condition: "flowNode", switch: "flowNode", parallelFork: "flowNode",
              merge: "flowNode", loop: "flowNode", wait: "flowNode",
            }
            const visualType = typeMapRev[engineType] || n.type || "actionNode"
            const iconMapRev: Record<string, string> = {
              cronTrigger: "Clock", webhookTrigger: "Webhook", channelTrigger: "MessageSquare", manualTrigger: "MousePointerClick",
              aiAgent: "Zap", contentWriter: "FileText", dataExtractor: "Database", classifier: "GitBranch",
              summarizer: "FileText", webResearcher: "Globe", imageGenerator: "Image",
              httpRequest: "Globe", databaseQuery: "Database", sendEmail: "Mail", sendMessage: "MessageSquare",
              codeExecute: "Code", condition: "GitBranch", switch: "SplitSquareHorizontal",
              parallelFork: "ArrowRight", merge: "Merge", loop: "Repeat", wait: "Clock",
            }
            return {
              id: n.id,
              type: visualType,
              position: n.position ?? { x: 0, y: 0 },
              data: {
                label: n.label ?? "Node",
                icon: n.data?.icon ?? iconMapRev[engineType] ?? "Zap",
                config: n.config ?? n.data?.config ?? {},
                status: "idle",
                engineType,
              },
            }
          }))
        }
        if (g.edges) setEdges(g.edges)
      }
      if (data?.name) setPipelineName(data.name)
      if (data?.version) setVersion(data.version)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId])

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return
      setEdges((eds) => addEdge({
        ...params,
        id: `edge-${Date.now()}`,
        type: "smoothstep",
        animated: true,
        style: { stroke: "hsl(var(--color-border))", strokeWidth: 2 },
      } as Edge, eds))
    },
    [setEdges]
  )

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const type = event.dataTransfer.getData("application/reactflow-type")
      const label = event.dataTransfer.getData("application/reactflow-label")
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return
      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
      const newNode = defaultNode(type, position, label)
      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance, setNodes]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const onUpdateNode = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data } : n))
      )
    },
    [setNodes]
  )

  const onDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setSelectedNode(null)
    },
    [setNodes, setEdges]
  )

  const onSave = useCallback(async () => {
    setSaving(true)
    try {
      const nd = (n: Node) => {
        const d = n.data as any
        return { id: n.id, type: n.type!, label: d.label, position: n.position, config: d.config ?? {}, engineType: d.engineType ?? null }
      }
      const graph = { nodes: nodes.map(nd), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })) }
      if (pipelineId === "new") {
        const created = await api.pipeline.create({ name: pipelineName, graph })
        router.replace(`/pipelines/${created.id}`)
      } else {
        await api.pipeline.update({ id: pipelineId, name: pipelineName, graph })
        setVersion((v) => v + 1)
      }
    } catch (err) {
      console.error("Save failed:", err)
    } finally {
      setSaving(false)
    }
  }, [pipelineId, pipelineName, nodes, edges, router])

  const onRun = useCallback(async () => {
    await onSave()
    if (pipelineId === "new") return
    setRunning(true)
    setCurrentRunId(null)
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "idle", lastOutput: undefined } })))
    let eventSource: EventSource | null = null
    try {
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, status: "running" } }))
      )
      const result = await api.pipeline.trigger(pipelineId, {})
      const runId = result.runId
      setCurrentRunId(runId)

      if (result.status === "CANCELLED") {
        setNodes((nds) =>
          nds.map((n) => ({ ...n, data: { ...n.data, status: "cancelled" as string } }))
        )
        return
      }

      const token = getToken()
      const url = `${API_URL}/api/pipeline/stream/${runId}${token ? `?token=${encodeURIComponent(token)}` : ""}`
      eventSource = new EventSource(url)

      eventSource.onmessage = (ev) => {
        if (ev.data === "[DONE]") {
          eventSource?.close()
          return
        }
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === "node") {
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id !== msg.nodeId) return n
                return {
                  ...n,
                  data: {
                    ...n.data,
                    status: msg.error ? "error" : msg.durationMs ? "success" : "running",
                    lastOutput: msg.output && Object.keys(msg.output).length > 0 ? msg.output : n.data.lastOutput,
                  },
                }
              })
            )
          } else if (msg.type === "done") {
            setNodes((nds) =>
              nds.map((n) => ({ ...n, data: { ...n.data, status: msg.status === "SUCCESS" ? "success" : "error" } }))
            )
          } else if (msg.type === "error") {
            setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "error" } })))
          }
        } catch { /* ignore parse errors */ }
      }

      eventSource.onerror = () => {
        eventSource?.close()
      }
    } catch (err) {
      eventSource?.close()
      console.error("Run failed:", err)
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "error" } })))
    } finally {
      setRunning(false)
      setCurrentRunId(null)
    }
  }, [pipelineId, onSave, setNodes])

  const onCancel = useCallback(async () => {
    if (!currentRunId) return
    try {
      await api.pipeline.cancelRun(currentRunId)
    } catch (err) {
      console.error("Cancel failed:", err)
    }
    setRunning(false)
    setCurrentRunId(null)
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: "cancelled" as string } }))
    )
  }, [currentRunId, setNodes])

  const onRunNode = useCallback(async (nodeId: string) => {
    try {
      const result = await api.pipeline.executeNode(pipelineId, nodeId, {})
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, lastOutput: result, status: result?.error ? "error" : "success" as string } } : n
        )
      )
      return result
    } catch (err) {
      console.error("Node execute failed:", err)
    }
  }, [pipelineId, setNodes])

  const onUpdateNodeStatus = useCallback((nodeId: string, status: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status } } : n))
    )
  }, [setNodes])

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <PipelineToolbar
        pipelineId={pipelineId}
        pipelineName={pipelineName}
        onNameChange={setPipelineName}
        onSave={onSave}
        onRun={onRun}
        onCancel={onCancel}
        saving={saving}
        running={running}
        onToggleRuns={() => setShowRuns(!showRuns)}
        showRuns={showRuns}
        version={version}
      />
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <div
          ref={reactFlowWrapper}
          className="flex-1 relative"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={customNodeTypes as unknown as NodeTypes}
                        fitView
            selectionMode={SelectionMode.Partial}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: true,
              style: { stroke: "hsl(var(--color-border))", strokeWidth: 2 },
            }}
            proOptions={{ hideAttribution: true, account: "paid-pro" }}
            className="react-flow-dark"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="hsl(var(--color-border) / 0.3)"
            />
            <Controls
              showInteractive={false}
              className="!border !border-border !rounded-lg !bg-surface !shadow-sm"
            />
            <MiniMap
              nodeColor={(n) => {
                const colors: Record<string, string> = {
                  triggerNode: "hsl(var(--color-success))",
                  aiNode: "hsl(var(--color-ai-badge))",
                  actionNode: "hsl(var(--color-primary))",
                  flowNode: "hsl(var(--color-warning))",
                  integrationNode: "hsl(var(--color-text-secondary))",
                }
                return (n.type && colors[n.type]) || "hsl(var(--color-border))"
              }}
              maskColor="hsl(var(--color-background) / 0.8)"
              className="!border !border-border !rounded-lg !shadow-sm"
              style={{ background: "hsl(var(--color-surface))" }}
            />
          </ReactFlow>
        </div>
        {showRuns ? (
          <RunsPanel
            pipelineId={pipelineId}
            onClose={() => setShowRuns(false)}
          />
        ) : (
          <InspectorPanel
            selectedNode={selectedNode}
            onUpdateNode={onUpdateNode}
            onDeleteNode={onDeleteNode}
            onRunNode={onRunNode}
            onUpdateNodeStatus={onUpdateNodeStatus}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  )
}

export function PipelineCanvas(props: PipelineCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
