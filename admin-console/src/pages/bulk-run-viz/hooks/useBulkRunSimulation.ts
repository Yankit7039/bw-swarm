import { useState, useCallback, useRef, useEffect } from 'react'
import type { BulkRunSession } from '../../../types/bulkRunSession'
import type { EdgeParticle } from '../components/AnimatedEdge'

export interface WorkflowStep {
  id: string
  name: string
  type: 'start' | 'agent' | 'tool' | 'llm' | 'end'
}

export interface RunProgress {
  runId: string
  orderId: string
  currentStepId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number // 0-100
}

export interface NodeState {
  status: 'pending' | 'running' | 'completed' | 'failed'
  count: number
  totalRuns: number
}

export interface SimulationSnapshot {
  phase: 'idle' | 'running' | 'complete'
  nodes: Record<string, NodeState>
  edgeParticles: Record<string, EdgeParticle[]>
  activeEdgeIds: Set<string>
  runsProgress: Record<string, RunProgress>
  totalTriggered: number
  totalCompleted: number
  currentTime: number
}

interface UseBulkRunSimulationOptions {
  session: BulkRunSession | null
  workflowSteps: WorkflowStep[]
}

const SIMULATION_TICK_MS = 100
const STEP_DURATION_MS = 2000 // Time to travel between steps

export function useBulkRunSimulation({
  session,
  workflowSteps,
}: UseBulkRunSimulationOptions) {
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>({
    phase: 'idle',
    nodes: {},
    edgeParticles: {},
    activeEdgeIds: new Set(),
    runsProgress: {},
    totalTriggered: 0,
    totalCompleted: 0,
    currentTime: 0,
  })

  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  // Initialize node states
  const initializeNodes = useCallback((): Record<string, NodeState> => {
    const nodes: Record<string, NodeState> = {}
    workflowSteps.forEach((step) => {
      nodes[step.id] = {
        status: 'pending',
        count: 0,
        totalRuns: session?.config.batch_size || 0,
      }
    })
    return nodes
  }, [workflowSteps, session?.config.batch_size])

  // Start the simulation
  const startSimulation = useCallback(() => {
    if (!session) return

    setIsRunning(true)
    startTimeRef.current = Date.now()

    const nodes = initializeNodes()
    setSnapshot({
      phase: 'running',
      nodes,
      edgeParticles: {},
      activeEdgeIds: new Set(),
      runsProgress: {},
      totalTriggered: 0,
      totalCompleted: 0,
      currentTime: 0,
    })

    // Start the simulation tick
    intervalRef.current = window.setInterval(() => {
      const currentTime = Date.now() - startTimeRef.current

      setSnapshot((prev) => {
        const newSnapshot = { ...prev }
        newSnapshot.currentTime = currentTime

        // Calculate which runs should have been triggered by now
        const intervalMs = session.config.interval_ms
        const maxTriggered = Math.min(
          Math.floor(currentTime / intervalMs) + 1,
          session.config.batch_size
        )

        // Update total triggered
        newSnapshot.totalTriggered = maxTriggered

        // Initialize progress for newly triggered runs
        for (let i = 0; i < maxTriggered; i++) {
          const run = session.runs[i]
          if (!run) continue

          if (!newSnapshot.runsProgress[run.order_id]) {
            newSnapshot.runsProgress[run.order_id] = {
              runId: run.run_id || '',
              orderId: run.order_id,
              currentStepId: workflowSteps[0]?.id || 'start',
              status: 'running',
              progress: 0,
            }
            // Mark start node as running
            if (newSnapshot.nodes[workflowSteps[0]?.id]) {
              newSnapshot.nodes[workflowSteps[0].id].status = 'running'
            }
          }
        }

        // Update run progress through workflow steps
        Object.values(newSnapshot.runsProgress).forEach((runProgress) => {
          const runIndex = session.runs.findIndex((r) => r.order_id === runProgress.orderId)
          if (runIndex === -1) return

          const run = session.runs[runIndex]
          const triggerTime = runIndex * intervalMs
          const runElapsed = currentTime - triggerTime

          // Determine current step based on elapsed time
          const stepIndex = Math.floor(runElapsed / STEP_DURATION_MS)
          const stepProgress = (runElapsed % STEP_DURATION_MS) / STEP_DURATION_MS

          if (stepIndex < workflowSteps.length) {
            const prevStepId = runProgress.currentStepId
            const newStepId = workflowSteps[stepIndex]?.id || workflowSteps[workflowSteps.length - 1]?.id

            // Update node counts when transitioning between steps
            if (prevStepId !== newStepId && prevStepId) {
              if (newSnapshot.nodes[prevStepId]) {
                newSnapshot.nodes[prevStepId].count = Math.max(
                  0,
                  newSnapshot.nodes[prevStepId].count - 1
                )
              }
            }

            if (newSnapshot.nodes[newStepId]) {
              newSnapshot.nodes[newStepId].count = (newSnapshot.nodes[newStepId].count || 0) + 1
              newSnapshot.nodes[newStepId].status = 'running'
            }

            runProgress.currentStepId = newStepId
            runProgress.progress = stepProgress
          } else {
            // Run has completed workflow
            runProgress.status = run.status === 'success' ? 'completed' : run.status === 'failed' ? 'failed' : 'pending'
            runProgress.progress = 100
          }
        })

        // Update edge particles
        newSnapshot.edgeParticles = {}
        newSnapshot.activeEdgeIds = new Set()

        Object.values(newSnapshot.runsProgress).forEach((runProgress) => {
          if (runProgress.status !== 'running') return

          const currentStepIndex = workflowSteps.findIndex((s) => s.id === runProgress.currentStepId)
          if (currentStepIndex === -1 || currentStepIndex >= workflowSteps.length - 1) return

          const nextStepId = workflowSteps[currentStepIndex + 1]?.id
          if (!nextStepId) return

          const edgeId = `e-${runProgress.currentStepId}-${nextStepId}`
          newSnapshot.activeEdgeIds.add(edgeId)

          if (!newSnapshot.edgeParticles[edgeId]) {
            newSnapshot.edgeParticles[edgeId] = []
          }

          newSnapshot.edgeParticles[edgeId].push({
            id: runProgress.orderId,
            progress: runProgress.progress,
            color: '#6366f1', // Always blue for running particles
            orderId: runProgress.orderId,
          })
        })

        // Update total completed
        newSnapshot.totalCompleted = session.runs.filter(
          (r) => r.status === 'success' || r.status === 'failed'
        ).length

        // Check if all runs are completed
        if (newSnapshot.totalCompleted >= session.config.batch_size) {
          newSnapshot.phase = 'complete'
          // Mark all nodes as completed
          Object.keys(newSnapshot.nodes).forEach((nodeId) => {
            newSnapshot.nodes[nodeId].status = 'completed'
          })
        }

        return newSnapshot
      })
    }, SIMULATION_TICK_MS)
  }, [session, workflowSteps, initializeNodes])

  // Stop the simulation
  const stopSimulation = useCallback(() => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Reset the simulation
  const resetSimulation = useCallback(() => {
    stopSimulation()
    setSnapshot({
      phase: 'idle',
      nodes: initializeNodes(),
      edgeParticles: {},
      activeEdgeIds: new Set(),
      runsProgress: {},
      totalTriggered: 0,
      totalCompleted: 0,
      currentTime: 0,
    })
  }, [stopSimulation, initializeNodes])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    snapshot,
    isRunning,
    startSimulation,
    stopSimulation,
    resetSimulation,
  }
}
