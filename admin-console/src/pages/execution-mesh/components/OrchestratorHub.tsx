import { useEffect, useState } from 'react'

interface OrchestratorHubProps {
  isActive: boolean
  currentAction: string
  activeConnections: string[]
}

export function OrchestratorHub({ isActive, currentAction, activeConnections }: OrchestratorHubProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const clusters = [
    { id: 'diagnosis', top: 15 },
    { id: 'healing', top: 38 },
    { id: 'alerting', top: 61 },
    { id: 'followup', top: 84 },
  ]

  return (
    // bg-[radial-gradient(circle_at_center,_#ffffff_0%,_#F8FAFC_100%)]
    <div className="h-full flex flex-col items-center justify-center relative w-full bg-slate-50">
      {/* Background SVG Connections - only animate when active */}
      <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {isActive && (
          <>
            <path d="M 0 500 Q 400 400 800 500" fill="transparent" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="20 10">
              <animate attributeName="stroke-dashoffset" from="30" to="0" dur="1s" repeatCount="indefinite" />
            </path>
            <circle r="3" fill="#4f46e5">
              <animateMotion dur="2s" repeatCount="indefinite" path="M 0 500 Q 400 400 800 500" />
            </circle>
            <path d="M 0 350 Q 400 500 800 350" fill="transparent" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="20 10">
              <animate attributeName="stroke-dashoffset" from="30" to="0" dur="1s" repeatCount="indefinite" />
            </path>
            <circle r="3" fill="#8b5cf6">
              <animateMotion dur="2s" repeatCount="indefinite" path="M 0 350 Q 400 500 800 350" />
            </circle>
          </>
        )}
        {!isActive && (
          <>
            <path d="M 0 500 Q 400 400 800 500" fill="transparent" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M 0 350 Q 400 500 800 350" fill="transparent" stroke="#e2e8f0" strokeWidth="1" />
          </>
        )}
      </svg>

      {/* Animated Connection Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs>
          <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Queue to Hub */}
        <g>
          {/* <line x1="0%" y1="50%" x2="40%" y2="50%" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 4" /> */}
          {isActive && (
            <>
              {/* <line x1="0%" y1="50%" x2="40%" y2="50%" stroke="#4f46e5" strokeWidth="3" strokeDasharray="10 5" filter="url(#lineGlow)">
                <animate attributeName="stroke-dashoffset" from="30" to="0" dur="0.8s" repeatCount="indefinite" />
              </line>
              <circle r="4" fill="#4f46e5" filter="url(#lineGlow)">
                <animateMotion dur="1.5s" repeatCount="indefinite" path="M 0,50 L 40,50" />
              </circle> */}
            </>
          )}
        </g>

        {/* Hub to Clusters */}
        {clusters.map((cluster) => {
          const isConnected = activeConnections.includes(cluster.id)
          return (
            <g key={cluster.id}>
              {/* <line x1="60%" y1="50%" x2="100%" y2={`${cluster.top}%`} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" style={{ opacity: isConnected ? 0.3 : 0.5 }} /> */}
              {isConnected && (
                <>
                  {/* <line x1="60%" y1="50%" x2="100%" y2={`${cluster.top}%`} stroke="#4f46e5" strokeWidth="2" strokeDasharray="8 4" filter="url(#lineGlow)">
                    <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.6s" repeatCount="indefinite" />
                  </line>
                  <circle r="3" fill="#4f46e5" filter="url(#lineGlow)">
                    <animateMotion dur="1s" repeatCount="indefinite" path={`M 60,50 L 100,${cluster.top}`} />
                  </circle> */}
                </>
              )}
            </g>
          )
        })}
      </svg>

      {/* BrainPod / Central Hub */}
      <div className="relative w-96 h-96 flex items-center justify-center z-10">
        {/* Glowing Rings - only animate when active */}
        <div className={`absolute inset-0 border ${isActive ? 'border-indigo-500/10' : 'border-slate-200/20'} rounded-full`} style={isActive ? { animation: 'spin 20s linear infinite' } : undefined} />
        <div className={`absolute inset-8 border ${isActive ? 'border-violet-500/10' : 'border-slate-200/15'} rounded-full`} style={isActive ? { animationDirection: 'reverse', animationDuration: '25s', animation: 'spin 25s linear infinite reverse' } : undefined} />
        <div className={`absolute inset-16 border ${isActive ? 'border-indigo-500/5' : 'border-slate-200/10'} rounded-full`} style={isActive ? { animation: 'spin 35s linear infinite' } : undefined} />

        {/* Central Core */}
        <div className={`relative w-40 h-40 bg-white/80 backdrop-blur-md rounded-full flex flex-col items-center justify-center shadow-xl border z-20 transition-all duration-500 ${isActive ? 'border-indigo-500/20 pulse-glow' : 'border-slate-200'}`}>
          {/* {isActive ? (
            <Activity className="w-16 h-16 text-indigo-500" />
          ) : ( */}
            <img src="/favicon.svg" alt="" className="w-20 h-20 opacity-80" />
          {/* )} */}

          {/* Status below hub */}
          <div className="absolute -bottom-20 flex flex-col items-center gap-1 w-64 text-center">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-indigo-600">
              {isActive ? 'Orchestrator' : 'Ready'}
            </span>
            <div className="flex items-center gap-2 bg-white/60 px-4 py-2 rounded-full border border-slate-200/40 shadow-sm">
              {isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              <span className="font-mono text-sm text-slate-700">
                {isActive ? (
                  <>
                    <span className="text-emerald-600 font-bold">{currentAction}</span>
                  </>
                ) : (
                  currentAction
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Stats Floating - Bottom Left */}
      {/* <div className="absolute bottom-12 left-12 grid grid-cols-2 gap-4 z-20">
        <div className="bg-white/70 backdrop-blur-md p-4 rounded-xl border border-slate-200/60 shadow-sm w-40">
          <div className="text-[10px] uppercase text-slate-500 mb-1 font-bold tracking-wider">Active Orders</div>
          <div className="text-3xl font-bold text-indigo-600">{activeConnections.length > 0 ? '1' : '0'}</div>
        </div>
        <div className="bg-white/70 backdrop-blur-md p-4 rounded-xl border border-slate-200/60 shadow-sm w-40">
          <div className="text-[10px] uppercase text-slate-500 mb-1 font-bold tracking-wider">Phase</div>
          <div className="text-3xl font-bold text-violet-600">
            {activeConnections.length > 0
              ? activeConnections[0].charAt(0).toUpperCase() + activeConnections[0].slice(1)
              : 'Idle'}
          </div>
        </div>
      </div> */}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .neural-orbit {
          animation: spin 20s linear infinite;
        }
        .pulse-glow {
          animation: pulse-border 3s ease-in-out infinite;
        }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(79, 70, 229, 0.1); }
          50% { border-color: rgba(79, 70, 229, 0.3); }
        }
      `}</style>
    </div>
  )
}
