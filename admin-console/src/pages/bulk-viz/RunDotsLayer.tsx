import { useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { motion } from 'framer-motion'
import { useRunStore } from '../../store/bulkViz/runStore'

interface Props {
  stageOrder: string[]
}

export function RunDotsLayer({ stageOrder }: Props) {
  const { running } = useRunStore()
  const rf = useReactFlow()

  const dots = useMemo(() => {
    return Object.values(running)
      .map((run) => {
        const idx = stageOrder.indexOf(run.currentStageId)
        const nextIdx = Math.min(idx + 1, stageOrder.length - 1)
        const currNode = rf.getNode(run.currentStageId)
        const nextNode = rf.getNode(stageOrder[nextIdx])

        const from = currNode?.position
        const to = nextNode?.position
        if (!from || !to) return null

        return {
          runId: run.runId,
          from: { x: from.x + 112, y: from.y + 40 },
          to: { x: to.x + 112, y: to.y + 40 },
        }
      })
      .filter(Boolean) as { runId: string; from: { x: number; y: number }; to: { x: number; y: number } }[]
  }, [running, rf, stageOrder])

  if (!dots.length) return null

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible">
      <defs>
        <filter id="bulkVizParticleGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {dots.map((d) => (
        <motion.circle
          key={d.runId}
          initial={{ cx: d.from.x, cy: d.from.y }}
          animate={{ cx: d.to.x, cy: d.to.y }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          r={6}
          fill="#6366f1"
          style={{ filter: 'url(#bulkVizParticleGlow)' }}
        />
      ))}
    </svg>
  )
}

