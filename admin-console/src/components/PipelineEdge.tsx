import { memo, useLayoutEffect, useRef, useState } from 'react'
import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react'
import clsx from 'clsx'
import type { ActiveRunDot } from '../utils/buildGraphFromYaml'

export type PipelineEdgeDot = ActiveRunDot & { t: number }

export type PipelineEdgeData = {
  dots?: PipelineEdgeDot[]
}

function DotsOnPath({ pathD, dots }: { pathD: string; dots: PipelineEdgeDot[] }) {
  const pathRef = useRef<SVGPathElement>(null)
  const [layout, setLayout] = useState<Array<{ dot: PipelineEdgeDot; x: number; y: number }>>([])

  useLayoutEffect(() => {
    if (dots.length === 0) {
      setLayout([])
      return
    }
    const el = pathRef.current
    if (!el) return
    const len = el.getTotalLength()
    if (len <= 0) {
      setLayout([])
      return
    }
    setLayout(
      dots.map((dot) => {
        const dist = Math.min(Math.max(0, dot.t * len), len - 0.0001)
        const pt = el.getPointAtLength(dist)
        return { dot, x: pt.x, y: pt.y }
      })
    )
  }, [pathD, dots])

  if (dots.length === 0) return null

  return (
    <>
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="none"
        strokeWidth={0}
        className="flow-edge-measure-path"
        aria-hidden
      />
      {layout.map(({ dot, x, y }) => (
        <g key={dot.runId} transform={`translate(${x}, ${y})`} className="flow-edge-run-dot-g" pointerEvents="none">
          <circle
            r={5}
            className={clsx(
              'flow-edge-run-dot-circle',
              dot.status === 'completed'
                ? 'flow-edge-run-dot-circle--completed'
                : dot.status === 'running'
                  ? 'flow-edge-run-dot-circle--running'
                  : 'flow-edge-run-dot-circle--followup'
            )}
          />
          <text y={16} textAnchor="middle" className="flow-edge-run-dot-svg-label">
            {dot.orderId.length > 10 ? `${dot.orderId.slice(0, 10)}…` : dot.orderId}
          </text>
        </g>
      ))}
    </>
  )
}

export const PipelineEdge = memo(function PipelineEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const dots = ((data as PipelineEdgeData | undefined)?.dots ?? []) as PipelineEdgeDot[]

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <DotsOnPath pathD={path} dots={dots} />
    </>
  )
})
