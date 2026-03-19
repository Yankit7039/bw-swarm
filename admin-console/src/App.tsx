import { Routes, Route } from 'react-router-dom'
import { useSSE } from './hooks/useSSE'
import { Dashboard } from './pages/Dashboard'
import { Templates } from './pages/Templates'
import { TemplateBuilder } from './pages/TemplateBuilder'
import { AgentMonitor } from './pages/AgentMonitor'
import { AgentDetail } from './pages/AgentDetail'
import { Logs } from './pages/Logs'
import { Runs } from './pages/Runs'
import { RunDetail } from './pages/RunDetail'
import { TestRuns } from './pages/TestRuns'
import { BulkVisualization } from './pages/BulkVisualization'
import { ExecutionMeshViz } from './pages/execution-mesh/ExecutionMeshViz'

function App() {
  // Initialize SSE connection
  useSSE()

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/templates" element={<Templates />} />
      <Route path="/templates/new" element={<TemplateBuilder />} />
      <Route path="/runs" element={<Runs />} />
      <Route path="/runs/:runId" element={<RunDetail />} />
      <Route path="/test-runs" element={<TestRuns />} />
      <Route path="/bulk-visualization" element={<BulkVisualization />} />
      <Route path="/execution-mesh" element={<ExecutionMeshViz />} />
      <Route path="/agents" element={<AgentMonitor />} />
      <Route path="/agents/:id" element={<AgentDetail />} />
      <Route path="/logs" element={<Logs />} />
    </Routes>
  )
}

export default App
