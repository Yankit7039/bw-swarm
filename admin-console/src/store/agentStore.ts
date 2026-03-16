import { create } from 'zustand'
import type { AgentSummary, StepDetail } from '../types/agent'

interface AgentState {
  id: string
  template_name: string
  status: string
  current_step?: string
  triggered_by: string
  started_at: string
  duration_ms?: number
  steps: Record<string, StepDetail>
}

interface AgentStore {
  agents: Record<string, AgentState>
  setAgents: (agents: AgentSummary[]) => void
  addAgent: (agent: AgentSummary) => void
  updateAgent: (id: string, patch: Partial<AgentState>) => void
  updateStep: (agentId: string, stepId: string, patch: Partial<StepDetail>) => void
  setSteps: (agentId: string, steps: StepDetail[]) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: {},

  setAgents: (agents) =>
    set((state) => {
      const newAgents: Record<string, AgentState> = {}
      agents.forEach((agent) => {
        newAgents[agent.id] = {
          ...agent,
          steps: state.agents[agent.id]?.steps || {},
        }
      })
      return { agents: newAgents }
    }),

  addAgent: (agent) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agent.id]: { ...agent, steps: {} },
      },
    })),

  updateAgent: (id, patch) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: {
          ...state.agents[id],
          ...patch,
        },
      },
    })),

  updateStep: (agentId, stepId, patch) =>
    set((state) => {
      const agent = state.agents[agentId]
      if (!agent) return state

      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            steps: {
              ...agent.steps,
              [stepId]: {
                ...agent.steps[stepId],
                ...patch,
              },
            },
          },
        },
      }
    }),

  setSteps: (agentId, steps) =>
    set((state) => {
      const agent = state.agents[agentId]
      if (!agent) return state

      const stepsMap: Record<string, StepDetail> = {}
      steps.forEach((step) => {
        stepsMap[step.step_id] = step
      })

      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            steps: stepsMap,
          },
        },
      }
    }),
}))
