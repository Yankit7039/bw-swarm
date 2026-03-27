import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import {
  FLOW_NODE_PALETTE_SIZE,
  NODE_PREFIX,
  type ActiveRunDot,
  type PipelineNodeData,
} from '../utils/buildGraphFromYaml'

export type { ActiveRunDot } from '../utils/buildGraphFromYaml'

export const PipelineNode = memo(function PipelineNode(props: NodeProps) {
  const data = props.data as PipelineNodeData
  const isSynth = data.kind === 'synthetic'
  const runs = data.activeRuns ?? []

  const isStart = isSynth && data.label === 'Start'
  const isCompleted = isSynth && props.id === NODE_PREFIX.completed
  const isMainStage = !isSynth

  const fillClass = `flow-node--fill-${(data.fillIndex ?? 0) % FLOW_NODE_PALETTE_SIZE}`

  return (
    <div
      className={clsx(
        'flow-pipeline-node',
        isSynth && 'flow-pipeline-node--synthetic',
        fillClass
      )}
    >
      {isMainStage && (
        <>
          <Handle type="target" position={Position.Left} id="left" className="flow-handle flow-handle-left" />
          <Handle type="source" position={Position.Right} id="right" className="flow-handle flow-handle-right" />
        </>
      )}

      {isStart && (
        <Handle type="source" position={Position.Right} id="right" className="flow-handle flow-handle-right" />
      )}

      {isCompleted && (
        <Handle type="target" position={Position.Left} id="left" className="flow-handle flow-handle-left" />
      )}

      <div className="flow-pipeline-node__border" />
      <div className="flow-pipeline-node__inner">
        <div className="flow-pipeline-node__head">
          <span className="flow-pipeline-node__title">{data.label}</span>
          {!isSynth && (
            <span className="flow-pipeline-node__badge">{data.stageType ?? '—'}</span>
          )}
        </div>
        <div
          className={clsx('flow-pipeline-node__dots', isSynth && 'flow-pipeline-node__dots--synthetic')}
          aria-label="Active runs"
        >
          {runs.length === 0 ? (
            <span className="flow-pipeline-node__dots-placeholder">—</span>
          ) : (
            runs.map((r: ActiveRunDot) => (
              <div key={r.runId} className="flow-run-dot-wrap">
                <div
                  className={clsx(
                    'flow-run-dot',
                    r.status === 'completed'
                      ? 'flow-run-dot--completed'
                      : r.status === 'running'
                        ? 'flow-run-dot--running'
                        : 'flow-run-dot--followup'
                  )}
                />
                <span className="flow-run-dot-label">{r.orderId}</span>
              </div>
            ))
          )}
        </div>
        {data.logTicker?.text ? (
          <div
            className={clsx(
              'flow-pipeline-node__ticker',
              data.logTicker.dimmed && 'flow-pipeline-node__ticker--dimmed',
              data.logTicker.tone === 'error' && 'flow-pipeline-node__ticker--error',
              data.logTicker.tone === 'success' && 'flow-pipeline-node__ticker--success',
            )}
            key={data.logTicker.animKey}
          >
            <div className="flow-pipeline-node__ticker-inner">{data.logTicker.text}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
})
