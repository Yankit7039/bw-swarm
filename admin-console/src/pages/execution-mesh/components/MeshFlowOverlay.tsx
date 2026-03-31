import type { MeshFlowPaths } from '../hooks/useMeshFlowGeometry'

type MeshFlowOverlayProps = {
  paths: MeshFlowPaths
  orchestratorActive: boolean
  activeClusterId: string | null
  /** When false (e.g. all runs finished), paths stay static and no packets animate. */
  flowActive: boolean
  /** Shown on moving packets — use focused run id (e.g. truncated run_id). */
  flowTokenLabel?: string
}

const CLUSTER_STROKE: Record<string, string> = {
  diagnosis: '#4f46e5',
  healing: '#059669',
  alerting: '#e11d48',
  followup: '#7c3aed',
}

const CLUSTER_GLOW: Record<string, string> = {
  diagnosis: '#a5b4fc',
  healing: '#6ee7b7',
  alerting: '#fda4af',
  followup: '#c4b5fd',
}

/** Moving chip + trailing dots along a path (SMIL animateMotion). */
function FlowAlongPath({
  pathD,
  label,
  durSec,
  begin = '0s',
  fillPrimary,
  fillBg = '#ffffff',
  opacity = 1,
}: {
  pathD: string
  label: string
  durSec: number
  begin?: string
  fillPrimary: string
  fillBg?: string
  opacity?: number
}) {
  const short = label.length > 10 ? `${label.slice(0, 9)}…` : label
  const w = Math.min(56, Math.max(36, 6 + short.length * 6.2))
  const beginNum = Number.parseFloat(String(begin).replace('s', '')) || 0
  return (
    <g opacity={opacity}>
      <circle r="2.5" fill={fillPrimary} opacity="0.85">
        <animateMotion dur={`${durSec}s`} repeatCount="indefinite" path={pathD} begin={begin} rotate="auto" />
      </circle>
      <circle r="2" fill={fillPrimary} opacity="0.45">
        <animateMotion
          dur={`${durSec}s`}
          repeatCount="indefinite"
          path={pathD}
          begin={`${beginNum + durSec * 0.35}s`}
          rotate="auto"
        />
      </circle>
      <g>
        <animateMotion dur={`${durSec}s`} repeatCount="indefinite" path={pathD} begin={begin} rotate="auto" />
        <rect
          x={-w / 2}
          y={-11}
          width={w}
          height={22}
          rx={7}
          fill={fillBg}
          stroke={fillPrimary}
          strokeWidth={1.75}
          opacity={0.96}
        />
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill={fillPrimary}
          fontFamily='ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
          style={{ userSelect: 'none' }}
        >
          {short}
        </text>
      </g>
    </g>
  )
}

/** Renders above column content (pointer-events-none) so paths are actually visible. */
export function MeshFlowOverlay({
  paths,
  // orchestratorActive,
  activeClusterId,
  flowActive,
  flowTokenLabel = '',
}: MeshFlowOverlayProps) {
  const { width, height, queueToHub, hubToCluster } = paths
  if (width <= 0 || height <= 0) return null

  const strokeActive = CLUSTER_STROKE[activeClusterId || ''] ?? '#4f46e5'
  const glowActive = CLUSTER_GLOW[activeClusterId || ''] ?? '#a5b4fc'
  const token = flowTokenLabel.trim()
  const showIngestMotion = flowActive && !!queueToHub && token.length > 0
  const ingestDur = 2.15
  const hubDur = 1.85

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[30] h-full w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="meshFlowInStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="meshFlowOutStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor={strokeActive} />
        </linearGradient>
        <filter id="meshFlowSoftGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {queueToHub && (
        <g filter="url(#meshFlowSoftGlow)">
          <path
            d={queueToHub}
            fill="none"
            stroke="rgba(15, 23, 42, 0.12)"
            strokeWidth={flowActive ? 10 : 6}
            strokeLinecap="round"
          />
          <path
            d={queueToHub}
            fill="none"
            stroke="url(#meshFlowInStroke)"
            strokeWidth={flowActive ? 3.2 : 2}
            strokeLinecap="round"
            strokeDasharray={flowActive ? '14 10' : '6 8'}
            className={flowActive ? 'mesh-dash-animate' : ''}
            opacity={flowActive ? 1 : 0.45}
          />
          {showIngestMotion && (
            <>
              <FlowAlongPath pathD={queueToHub} label={token} durSec={ingestDur} begin="0s" fillPrimary="#4f46e5" />
              <FlowAlongPath
                pathD={queueToHub}
                label={token}
                durSec={ingestDur}
                begin={`${ingestDur * 0.5}s`}
                fillPrimary="#6366f1"
                fillBg="#eef2ff"
                opacity={0.92}
              />
            </>
          )}
          {flowActive && queueToHub && (
            <>
              <circle r="4" fill="#c7d2fe" stroke="#4f46e5" strokeWidth="1.5" opacity="0.9">
                <animateMotion dur={`${ingestDur * 0.65}s`} repeatCount="indefinite" path={queueToHub} rotate="auto" />
              </circle>
            </>
          )}
        </g>
      )}

      {hubToCluster && flowActive && (
        <g filter="url(#meshFlowSoftGlow)">
          <path
            d={hubToCluster.d}
            fill="none"
            stroke="rgba(15, 23, 42, 0.1)"
            strokeWidth={10}
            strokeLinecap="round"
          />
          <path
            d={hubToCluster.d}
            fill="none"
            stroke="url(#meshFlowOutStroke)"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeDasharray="16 9"
            className="mesh-dash-animate"
          />
          <circle r="4" fill={glowActive} stroke={strokeActive} strokeWidth="2" opacity="0.95">
            <animateMotion dur={`${hubDur}s`} repeatCount="indefinite" path={hubToCluster.d} rotate="auto" />
          </circle>
          <circle r="2.5" fill="#ffffff" stroke={strokeActive} strokeWidth="1.5" opacity="0.95">
            <animateMotion dur={`${hubDur}s`} repeatCount="indefinite" path={hubToCluster.d} begin={`${hubDur * 0.5}s`} rotate="auto" />
          </circle>
          {token && (
            <FlowAlongPath
              pathD={hubToCluster.d}
              label={token}
              durSec={hubDur * 1.05}
              begin={`${hubDur * 0.25}s`}
              fillPrimary={strokeActive}
              fillBg="#ffffff"
              opacity={0.95}
            />
          )}
        </g>
      )}

      <style>{`
        @keyframes mesh-dash-shift {
          to {
            stroke-dashoffset: -40;
          }
        }
        .mesh-dash-animate {
          animation: mesh-dash-shift 1.15s linear infinite;
        }
      `}</style>
    </svg>
  )
}
