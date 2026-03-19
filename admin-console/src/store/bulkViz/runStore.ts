import { create } from 'zustand'

export type RunStageId = string

export interface RunEvent {
  runId: string
  stageId: RunStageId
  at: number // ms since run start
}

export interface RunState {
  runId: string
  label: string
  currentStageId: RunStageId
  nextEventIndex: number
  events: RunEvent[]
  startedAt: number
}

interface RunStoreState {
  queue: RunState[]
  running: Record<string, RunState>
  isReplaying: boolean
  replayStartedAt: number | null

  enqueueRuns: (runs: { runId: string; label: string; events: RunEvent[] }[]) => void
  startReplay: () => void
  dequeueNext: () => void
  advanceRun: (runId: string, stageId: RunStageId) => void
}

export const useRunStore = create<RunStoreState>((set, get) => ({
  queue: [],
  running: {},
  isReplaying: false,
  replayStartedAt: null,

  enqueueRuns: (runs) =>
    set((state) => ({
      queue: [
        ...state.queue,
        ...runs.map((r) => ({
          ...r,
          currentStageId: 'queue',
          nextEventIndex: 0,
          startedAt: 0,
        })),
      ],
    })),

  startReplay: () =>
    set({
      isReplaying: true,
      replayStartedAt: performance.now(),
    }),

  dequeueNext: () => {
    const { queue, running } = get()
    if (!queue.length) return
    const [next, ...rest] = queue
    const now = performance.now()
    set({
      queue: rest,
      running: {
        ...running,
        [next.runId]: {
          ...next,
          currentStageId: next.events[0]?.stageId ?? 'queue',
          nextEventIndex: 1,
          startedAt: now,
        },
      },
    })
  },

  advanceRun: (runId, stageId) =>
    set((state) => {
      const existing = state.running[runId]
      if (!existing) return state
      return {
        ...state,
        running: {
          ...state.running,
          [runId]: {
            ...existing,
            currentStageId: stageId,
          },
        },
      }
    }),
}))

export const STEP_INTERVAL_MS = 800

export function buildEventsForStages(runId: string, stages: RunStageId[]): RunEvent[] {
  return stages.map((stageId, idx) => ({
    runId,
    stageId,
    at: idx * STEP_INTERVAL_MS,
  }))
}

