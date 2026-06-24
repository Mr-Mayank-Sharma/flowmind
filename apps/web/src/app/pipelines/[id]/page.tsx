"use client"

import { useParams } from "next/navigation"
import { PipelineCanvas } from "@/components/pipeline/pipeline-canvas"

export default function PipelineEditorPage() {
  const params = useParams()
  const pipelineId = (params.id as string) || "new"

  return (
    <div className="h-[calc(100vh-0px)] overflow-hidden">
      <PipelineCanvas pipelineId={pipelineId} />
    </div>
  )
}
