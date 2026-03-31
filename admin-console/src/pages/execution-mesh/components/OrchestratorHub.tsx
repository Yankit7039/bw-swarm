type OrchestratorPhase = 'diagnosis' | 'healing' | 'alerting' | 'followup' | 'idle'

interface OrchestratorHubProps {
  isActive: boolean
  currentAction: string
  targetClusterId?: string
  /** Order id currently being routed (from API-backed mesh focus). */
  meshOrderId?: string | null
}

function resolvePhase(targetClusterId: string | undefined, isActive: boolean): OrchestratorPhase {
  if (!isActive) return 'idle'
  if (targetClusterId === 'diagnosis') return 'diagnosis'
  if (targetClusterId === 'healing') return 'healing'
  if (targetClusterId === 'alerting') return 'alerting'
  if (targetClusterId === 'followup') return 'followup'
  return 'idle'
}

const phasePresentation: Record<
  OrchestratorPhase,
  {
    label: string
    dot: string
    text: string
    ring: string
    accent: string
    conicGradient: string
  }
> = {
  diagnosis: {
    label: 'Diagnosis',
    dot: 'bg-indigo-500',
    text: 'text-indigo-700',
    ring: 'border-indigo-200/80',
    accent: 'from-indigo-400/30 to-violet-400/20',
    conicGradient:
      'conic-gradient(from 0deg, rgba(79, 70, 229, 0.42), rgba(139, 92, 246, 0.28), transparent 62%)',
  },
  healing: {
    label: 'Healing',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    ring: 'border-emerald-200/80',
    accent: 'from-emerald-400/30 to-teal-400/15',
    conicGradient:
      'conic-gradient(from 0deg, rgba(16, 185, 129, 0.4), rgba(45, 212, 191, 0.22), transparent 62%)',
  },
  alerting: {
    label: 'Alerting',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    ring: 'border-rose-200/80',
    accent: 'from-rose-400/30 to-amber-400/15',
    conicGradient:
      'conic-gradient(from 0deg, rgba(244, 63, 94, 0.45), rgba(251, 191, 36, 0.2), transparent 62%)',
  },
  followup: {
    label: 'Follow-up',
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    ring: 'border-violet-200/80',
    accent: 'from-violet-400/30 to-fuchsia-400/15',
    conicGradient:
      'conic-gradient(from 0deg, rgba(124, 58, 237, 0.4), rgba(217, 70, 239, 0.22), transparent 62%)',
  },
  idle: {
    label: 'Idle',
    dot: 'bg-slate-400',
    text: 'text-slate-600',
    ring: 'border-slate-200',
    accent: 'from-slate-200/40 to-slate-100/20',
    conicGradient: 'conic-gradient(from 0deg, rgba(148, 163, 184, 0.2), transparent 55%)',
  },
}

export function OrchestratorHub({
  isActive,
  currentAction,
  targetClusterId,
  meshOrderId,
}: OrchestratorHubProps) {
  const phase = resolvePhase(targetClusterId, isActive)
  const pres = phasePresentation[phase]

  return (
    <div className="relative flex h-full min-h-[280px] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100/90 px-4 py-8">
      {/* Soft grid — “system” feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative flex flex-col items-center">
        <div
          data-mesh-hub="core"
          className={`relative flex h-[min(200px,28vw)] w-[min(200px,28vw)] min-h-[140px] min-w-[140px] items-center justify-center rounded-full border-2 bg-white/95 shadow-lg backdrop-blur-sm transition-all duration-500 ${
            isActive ? `${pres.ring} shadow-indigo-500/15` : 'border-slate-200/90 shadow-slate-200/40'
          } ${isActive ? 'mesh-hub-breathe' : ''}`}
        >
          {isActive && (
            <>
              {/* Conic sweep — reads as continuous processing */}
              <div
                className={`pointer-events-none absolute -inset-3 rounded-full bg-gradient-to-br ${pres.accent} opacity-80 mesh-hub-spin`}
                style={{ animationDuration: '2.8s' }}
              />
              <div
                className="pointer-events-none absolute -inset-1 rounded-full opacity-70"
                style={{
                  background: pres.conicGradient,
                  animation: 'mesh-orbit 2.2s linear infinite',
                }}
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-full bg-white/75"
                style={{ animation: 'mesh-pulse-ring 2.4s ease-in-out infinite' }}
              />
              <div
                className="pointer-events-none absolute -inset-[14px] rounded-full border-2 border-dashed border-indigo-300/35"
                style={{ animation: 'mesh-orbit 12s linear infinite reverse' }}
              />
              <div
                className="pointer-events-none absolute -inset-[26px] rounded-full border border-violet-300/20"
                style={{ animation: 'mesh-orbit 20s linear infinite' }}
              />
            </>
          )}

          <div
            className={`relative z-10 flex h-[min(112px,18vw)] w-[min(112px,18vw)] min-h-[88px] min-w-[88px] items-center justify-center rounded-full border bg-gradient-to-br from-white to-slate-50 shadow-inner transition-transform duration-300 ${
              isActive ? 'border-indigo-100 shadow-indigo-500/10' : 'border-slate-100'
            }`}
          >
            <img src="/favicon.svg" alt="" className={`h-[42%] w-[42%] ${isActive ? 'opacity-95 mesh-hub-icon-pulse' : 'opacity-80'}`} />
          </div>
        </div>

        {/* Activity bars — “workload” */}
        {isActive && (
          <div className="mt-5 flex h-5 items-end justify-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="mesh-proc-bar w-1 rounded-full bg-indigo-500/80"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        )}

        <div className="mt-5 flex max-w-sm flex-col items-center gap-2 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Orchestrator</span>
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${
              isActive ? 'border-slate-200/80 bg-white/95' : 'border-slate-200/60 bg-slate-50'
            }`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${pres.dot} ${isActive ? 'animate-pulse' : ''}`} />
            <span className={pres.text}>{isActive ? pres.label : currentAction}</span>
          </div>
          {isActive && meshOrderId && (
            <p className="font-mono text-[11px] text-slate-500">
              Processing <span className="font-semibold text-slate-700">{meshOrderId}</span>
            </p>
          )}
          {isActive && (
            <p className="text-[11px] leading-snug text-slate-500">
              Routing workload to <span className="font-medium text-slate-700">{pres.label}</span> cluster
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes mesh-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes mesh-hub-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .mesh-hub-spin {
          animation: mesh-hub-spin 2.8s linear infinite;
        }
        @keyframes mesh-pulse-ring {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.02); }
        }
        @keyframes mesh-hub-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        .mesh-hub-breathe {
          animation: mesh-hub-breathe 2.8s ease-in-out infinite;
        }
        @keyframes mesh-hub-icon-pulse {
          0%, 100% { opacity: 0.88; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.08); }
        }
        .mesh-hub-icon-pulse {
          animation: mesh-hub-icon-pulse 1.8s ease-in-out infinite;
        }
        @keyframes mesh-proc-bar {
          0%, 100% { height: 22%; opacity: 0.45; }
          50% { height: 100%; opacity: 1; }
        }
        .mesh-proc-bar {
          height: 35%;
          animation: mesh-proc-bar 0.75s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
