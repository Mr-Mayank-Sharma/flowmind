"use client"

import { useState, useCallback, useRef } from "react"
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
  }
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: typeMap[type] || "actionNode",
    position,
    data: {
      label,
      icon: iconMap[type] || "Zap",
      config: { summary: "" },
      status: "idle",
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
  const [showRuns, setShowRuns] = useState(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)

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
      await api.pipeline.update({
        id: pipelineId,
        name: pipelineName,
        graph: { nodes: nodes.map((n) => ({ id: n.id, type: n.type!, label: n.data.label, position: n.position, config: (n.data as any).config ?? {} })), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })) },
      })
      setVersion((v) => v + 1)
    } catch (err) {
      console.error("Save failed:", err)
    } finally {
      setSaving(false)
    }
  }, [pipelineId, pipelineName, nodes, edges])

  const onRun = useCallback(async () => {
    setRunning(true)
    try {
      const result = await api.pipeline.trigger(pipelineId, {})
      setNodes((nds) =>
        nds.map((n) => {
          const output = result.outputs?.find((o) => o.nodeId === n.id)
          return { ...n, data: { ...n.data, status: output?.error ? "error" : "success" } }
        })
      )
    } catch (err) {
      console.error("Run failed:", err)
    } finally {
      setRunning(false)
    }
  }, [pipelineId, setNodes])

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
