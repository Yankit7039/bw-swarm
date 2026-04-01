import { useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Trash2 } from 'lucide-react'
import type { Adapter } from '../../types/adapter'
import type { ConditionStep, LlmAgentStep, McpCallStep, Stage, Step } from './types'
import { isPollLoopStage } from './types'
import { McpCallStepForm } from './steps/McpCallStepForm'
import { LlmAgentStepForm } from './steps/LlmAgentStepForm'
import { ConditionStepForm } from './steps/ConditionStepForm'
import { PollLoopStageForm } from './PollLoopStageForm'

const skipInputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20'

interface StageCardProps {
  stage: Stage
  stageIndex: number
  onChange: (next: Stage) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  adapters: Adapter[]
  knownStateKeys: string[]
  /** When true, stage body starts expanded (e.g. newly added stage). */
  initiallyExpanded?: boolean
}

function emptyMcp(): McpCallStep {
  return { type: 'mcp_call', tool: '', input: {} }
}

function emptyLlm(): LlmAgentStep {
  return { type: 'llm_agent', instruction: '', description: '' }
}

function emptyCondition(): ConditionStep {
  return { type: 'condition', branches: [{ if: 'True', set: {} }] }
}

function shiftExpandedStepsAfterRemove(prev: Set<number>, removedIndex: number): Set<number> {
  const next = new Set<number>()
  for (const i of prev) {
    if (i < removedIndex) next.add(i)
    else if (i > removedIndex) next.add(i - 1)
  }
  return next
}

function swapExpandedStepIndices(prev: Set<number>, j: number, k: number): Set<number> {
  const next = new Set<number>()
  for (const i of prev) {
    if (i === j) next.add(k)
    else if (i === k) next.add(j)
    else next.add(i)
  }
  return next
}

export function StageCard({
  stage,
  stageIndex,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  adapters,
  knownStateKeys,
  initiallyExpanded = false,
}: StageCardProps) {
  const stageNum = stageIndex + 1
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(() => new Set())

  if (isPollLoopStage(stage)) {
    return (
      <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
        <div
          className="flex cursor-pointer select-none items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50 px-5 py-3 hover:bg-indigo-100/60"
          onClick={() => setIsExpanded((v) => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsExpanded((v) => !v)
            }
          }}
          aria-expanded={isExpanded}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-indigo-500 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
              aria-hidden
            />
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-[11px] font-bold text-indigo-800"
              aria-hidden
            >
              {stageNum}
            </span>
            <span className="shrink-0 rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
              poll_loop
            </span>
            <input
              type="text"
              className="min-w-0 flex-1 border-b border-transparent bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-primary"
              placeholder={`Stage ${stageNum} name`}
              value={stage.name ?? ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onChange({ ...stage, name: e.target.value || undefined })}
            />
          </div>
          <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white disabled:opacity-40"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label="Move stage up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white disabled:opacity-40"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label="Move stage down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
              onClick={onRemove}
              aria-label="Remove stage"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {isExpanded && (
          <div className="space-y-4 bg-slate-50/40 px-5 py-4">
            <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">skip_if</label>
              <input
                type="text"
                className={`${skipInputClass} mt-1`}
                value={stage.skip_if ?? ''}
                onChange={(e) => onChange({ ...stage, skip_if: e.target.value || undefined })}
              />
            </div>
            <PollLoopStageForm stage={stage} onChange={onChange} adapters={adapters} />
          </div>
        )}
      </div>
    )
  }

  const std = stage
  const updateStep = (j: number, next: Step) => {
    const steps = [...std.steps]
    steps[j] = next
    onChange({ ...std, steps })
  }

  const addStep = (kind: 'mcp_call' | 'llm_agent' | 'condition') => {
    const step: Step =
      kind === 'mcp_call' ? emptyMcp() : kind === 'llm_agent' ? emptyLlm() : emptyCondition()
    const newIndex = std.steps.length
    onChange({ ...std, steps: [...std.steps, step] })
    setExpandedSteps((prev) => new Set(prev).add(newIndex))
  }

  const removeStep = (j: number) => {
    setExpandedSteps((prev) => shiftExpandedStepsAfterRemove(prev, j))
    onChange({ ...std, steps: std.steps.filter((_, i) => i !== j) })
  }

  const moveStep = (j: number, dir: -1 | 1) => {
    const k = j + dir
    if (k < 0 || k >= std.steps.length) return
    setExpandedSteps((prev) => swapExpandedStepIndices(prev, j, k))
    const steps = [...std.steps]
    ;[steps[j], steps[k]] = [steps[k], steps[j]]
    onChange({ ...std, steps })
  }

  const toggleStep = (j: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(j)) next.delete(j)
      else next.add(j)
      return next
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className="flex flex-wrap cursor-pointer select-none items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 hover:bg-slate-100/80"
        onClick={() => setIsExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsExpanded((v) => !v)
          }
        }}
        aria-expanded={isExpanded}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
            aria-hidden
          />
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600"
            aria-hidden
          >
            {stageNum}
          </span>
          <select
            className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            value={std.type}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const t = e.target.value as 'deterministic' | 'hybrid'
              onChange({ ...std, type: t })
            }}
          >
            <option value="hybrid">hybrid</option>
            <option value="deterministic">deterministic</option>
          </select>
          <input
            type="text"
            className="min-w-0 max-w-md flex-1 border-b border-transparent bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-primary"
            placeholder={`Stage ${stageNum} name`}
            value={std.name ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChange({ ...std, name: e.target.value || undefined })}
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white disabled:opacity-40"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Move stage up"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white disabled:opacity-40"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Move stage down"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
            onClick={onRemove}
            aria-label="Remove stage"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 bg-slate-50/40 px-5 py-4">
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">skip_if</label>
            <input
              type="text"
              className={`${skipInputClass} mt-1`}
              value={std.skip_if ?? ''}
              onChange={(e) => onChange({ ...std, skip_if: e.target.value || undefined })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="self-center text-xs font-semibold text-slate-600">Steps</span>
            <button
              type="button"
              className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
              onClick={() => addStep('mcp_call')}
            >
              + MCP call
            </button>
            <button
              type="button"
              className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              onClick={() => addStep('llm_agent')}
            >
              + LLM agent
            </button>
            <button
              type="button"
              className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
              onClick={() => addStep('condition')}
            >
              + Condition
            </button>
          </div>

          <div className="space-y-3">
            {std.steps.map((step, j) => (
              <div key={j} className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                <div
                  className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 hover:bg-slate-50"
                  onClick={() => toggleStep(j)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleStep(j)
                    }
                  }}
                  aria-expanded={expandedSteps.has(j)}
                >
                  <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${expandedSteps.has(j) ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      step.type === 'mcp_call'
                        ? 'bg-violet-100 text-violet-700'
                        : step.type === 'llm_agent'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {step.type}
                  </span>
                  <input
                    type="text"
                    className="min-w-[6rem] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="step name"
                    value={step.name ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateStep(j, { ...step, name: e.target.value || undefined })}
                  />
                  <div className="ml-auto flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                      onClick={() => moveStep(j, -1)}
                      disabled={j === 0}
                      aria-label="Move step up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                      onClick={() => moveStep(j, 1)}
                      disabled={j === std.steps.length - 1}
                      aria-label="Move step down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => removeStep(j)}
                      aria-label="Remove step"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expandedSteps.has(j) && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    {step.type === 'mcp_call' && (
                      <McpCallStepForm step={step} onChange={(next) => updateStep(j, next)} adapters={adapters} />
                    )}
                    {step.type === 'llm_agent' && (
                      <LlmAgentStepForm
                        step={step}
                        onChange={(next) => updateStep(j, next)}
                        adapters={adapters}
                        knownStateKeys={knownStateKeys}
                      />
                    )}
                    {step.type === 'condition' && (
                      <ConditionStepForm step={step} onChange={(next) => updateStep(j, next)} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
