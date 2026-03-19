import { memo, useMemo } from 'react'
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react'

export interface EdgeParticle {
  id: string
  progress: number // 0-1
  color: string
  orderId: string
}

interface AnimatedEdgeData {
  particles: EdgeParticle[]
  isActive: boolean
}

export const AnimatedEdge = memo(function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const particles: EdgeParticle[] = (data as AnimatedEdgeData | undefined)?.particles ?? []
  const isActive = (data as AnimatedEdgeData | undefined)?.isActive ?? false

  // Pre-compute particle positions
  const particlePositions = useMemo(() => {
    // Use linear interpolation for particle positions
    return particles.map((particle) => {
      const x = sourceX + (targetX - sourceX) * particle.progress
      const y = sourceY + (targetY - sourceY) * particle.progress

      return { x, y, color: particle.color, id: particle.id, orderId: particle.orderId }
    })
  }, [particles, sourceX, sourceY, targetX, targetY])

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          strokeWidth: isActive ? 3 : 2,
          stroke: isActive ? '#6366f1' : '#cbd5e1',
          transition: 'stroke 0.3s ease',
        }}
      />
      {/* Particles */}
      {particlePositions.map((pos) => (
        <g key={pos.id}>
          <circle
            cx={pos.x}
            cy={pos.y}
            r={6}
            fill={pos.color}
            filter="url(#particleGlow)"
            className="animate-pulse"
          />
          <circle
            cx={pos.x}
            cy={pos.y}
            r={3}
            fill="white"
          />
        </g>
      ))}
    </>
  )
})
