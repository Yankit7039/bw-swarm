import { useState } from 'react'
import type { Adapter } from '../../types/adapter'
import type { Stage, StandardStage } from './types'
import { StageCard } from './StageCard'

interface StageListProps {
  stages: Stage[]
  onChange: (stages: Stage[]) => void
  adapters: Adapter[]
  knownStateKeys: string[]
}

function emptyStandard(): StandardStage {
  return { type: 'hybrid', steps: [] }
}

export function StageList({ stages, onChange, adapters, knownStateKeys }: StageListProps) {
  const [justAddedIndex, setJustAddedIndex] = useState<number | null>(null)

  const moveStage = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= stages.length) return
    const next = [...stages]
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange(next)
  }

  const updateStage = (index: number, stage: Stage) => {
    const next = [...stages]
    next[index] = stage
    onChange(next)
  }

  const removeStage = (index: number) => {
    onChange(stages.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Stages</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            onClick={() => {
              setJustAddedIndex(stages.length)
              onChange([...stages, emptyStandard()])
            }}
          >
            + Standard stage
          </button>
          <button
            type="button"
            className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-800 shadow-sm transition hover:bg-indigo-100"
            onClick={() => {
              setJustAddedIndex(stages.length)
              onChange([
                ...stages,
                {
                  type: 'poll_loop',
                  interval_seconds: 10,
                  max_iterations: 3,
                  exit_if: '',
                  poll_steps: [],
                  escalation_ladder: [],
                },
              ])
            }}
          >
            + Poll loop stage
          </button>
        </div>
      </div>

      {stages.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
          No stages yet. Add a standard or poll loop stage.
        </p>
      )}

      {stages.map((st, i) => (
        <StageCard
          key={i}
          stage={st}
          stageIndex={i}
          onChange={(next) => updateStage(i, next)}
          onRemove={() => removeStage(i)}
          onMoveUp={() => moveStage(i, -1)}
          onMoveDown={() => moveStage(i, 1)}
          canMoveUp={i > 0}
          canMoveDown={i < stages.length - 1}
          adapters={adapters}
          knownStateKeys={knownStateKeys}
          initiallyExpanded={i === justAddedIndex}
        />
      ))}
    </div>
  )
}
