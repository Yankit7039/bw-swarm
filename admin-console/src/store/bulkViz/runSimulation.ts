import { useEffect } from 'react'
import { useRunStore, STEP_INTERVAL_MS } from './runStore'

const DEQUEUE_INTERVAL_MS = 2500

export function useRunSimulation() {
  const { queue, isReplaying, startReplay, dequeueNext, advanceRun } = useRunStore()

  useEffect(() => {
    if (!isReplaying && queue.length > 0) {
      startReplay()
    }
  }, [isReplaying, queue.length, startReplay])

  useEffect(() => {
    if (!isReplaying) return
    const id = window.setInterval(() => {
      dequeueNext()
    }, DEQUEUE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [isReplaying, dequeueNext])

  useEffect(() => {
    if (!isReplaying) return
    const id = window.setInterval(() => {
      const now = performance.now()
      const state = useRunStore.getState()

      Object.values(state.running).forEach((run) => {
        const nextEvent = run.events[run.nextEventIndex]
        if (!nextEvent) return

        const elapsed = now - run.startedAt
        if (elapsed >= nextEvent.at) {
          advanceRun(run.runId, nextEvent.stageId)
          useRunStore.setState((s) => ({
            running: {
              ...s.running,
              [run.runId]: {
                ...s.running[run.runId],
                nextEventIndex: run.nextEventIndex + 1,
              },
            },
          }))
        }
      })
    }, STEP_INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [isReplaying, advanceRun])
}

