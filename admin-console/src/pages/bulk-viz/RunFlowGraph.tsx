import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { StageNode } from './StageNode'
import { useRunStore } from '../../store/bulkViz/runStore'
import { useRunSimulation } from '../../store/bulkViz/runSimulation'
import { RunDotsLayer } from './RunDotsLayer'

const nodeTypes: Record<string, React.FC<any>> = {
  stage: StageNode as React.FC<any>,
}

const STAGES = ['queue', 'ingestion', 'orchestrator', 'completed', 'failed'] as const

export function RunFlowGraph() {
  const { queue, running } = useRunStore()
  useRunSimulation()

  const totalRuns = queue.length + Object.keys(running).length

  const nodes: Node[] = useMemo(() => {
    const spacing = 260
    const baseY = 150

    return STAGES.map((stageId, idx) => {
      const runsInStage =
        stageId === 'queue'
          ? queue.map((r) => ({ runId: r.runId, label: r.label }))
          : Object.values(running)
              .filter((r) => r.currentStageId === stageId)
              .map((r) => ({ runId: r.runId, label: r.label }))

      const labelMap: Record<string, string> = {
        queue: 'Queue',
        ingestion: 'Ingestion',
        orchestrator: 'Orchestrator',
        completed: 'Completed',
        failed: 'Failed',
      }

      const subtitleMap: Record<string, string> = {
        queue: 'WAITING',
        ingestion: 'FIRST STEP',
        orchestrator: 'ROUTING',
        completed: 'SUCCESS',
        failed: 'ERROR',
      }

      return {
        id: stageId,
        type: 'stage',
        position: { x: idx * spacing, y: baseY },
        data: {
          id: stageId,
          label: labelMap[stageId] ?? stageId,
          subtitle: subtitleMap[stageId] ?? '',
          stageId,
          runs: runsInStage,
          totalRuns,
        },
      }
    })
  }, [queue, running, totalRuns])

  const edges: Edge[] = useMemo(
    () => [
      { id: 'e-queue-ingestion', source: 'queue', target: 'ingestion', type: 'smoothstep' },
      { id: 'e-ingestion-orchestrator', source: 'ingestion', target: 'orchestrator', type: 'smoothstep' },
      { id: 'e-orchestrator-completed', source: 'orchestrator', target: 'completed', type: 'smoothstep' },
      { id: 'e-orchestrator-failed', source: 'orchestrator', target: 'failed', type: 'smoothstep' },
    ],
    [],
  )

  return (
    <div className="relative h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={0.8}
          color="rgba(99,102,241,0.04)"
        />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap position="bottom-right" />
        <RunDotsLayer stageOrder={STAGES as unknown as string[]} />
      </ReactFlow>
    </div>
  )
}

