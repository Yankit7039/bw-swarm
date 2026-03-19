import type { NodeProps, Node } from '@xyflow/react'
import { motion } from 'framer-motion'

export interface StageNodeData {
  id: string
  label: string
  subtitle: string
  stageId: string
  runs: { runId: string; label: string }[]
  totalRuns: number
}

export function StageNode(props: NodeProps<Node<Record<string, unknown>>>) {
  const data = props.data as unknown as StageNodeData
  const count = data.runs.length
  const progress = data.totalRuns > 0 ? (count / data.totalRuns) * 100 : 0

  return (
    <motion.div
      layout
      className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 w-56"
    >
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">{data.label}</div>
          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
            {data.subtitle}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {count}/{data.totalRuns}
        </div>
      </div>

      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
        <motion.div
          className="h-full bg-indigo-500 rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 18 }}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {data.runs.slice(0, 4).map((r) => (
          <span
            key={r.runId}
            className="px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-mono text-slate-600"
          >
            {r.label}
          </span>
        ))}
        {data.runs.length > 4 && (
          <span className="text-[10px] text-slate-400">+{data.runs.length - 4} more</span>
        )}
      </div>
    </motion.div>
  )
}
