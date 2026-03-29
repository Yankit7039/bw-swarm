import { Routes, Route, Navigate } from 'react-router-dom'
import { useSSE } from './hooks/useSSE'
import { AuthGuard } from './components/AuthGuard'
import { Login } from './pages/Login'
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
import { TemplateDetail } from './pages/TemplateDetail'
import { Adapters } from './pages/Adapters'

function App() {
  // Initialize SSE connection
  useSSE()

  return (
    <Routes>
      {/* Public route - not protected */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/templates" element={<AuthGuard><Templates /></AuthGuard>} />
      <Route path="/adapters" element={<AuthGuard><Adapters /></AuthGuard>} />
      <Route path="/templates/new" element={<AuthGuard><TemplateBuilder /></AuthGuard>} />
      <Route path="/templates/:id" element={<AuthGuard><TemplateDetail /></AuthGuard>} />
      <Route path="/flow" element={<AuthGuard><Navigate to="/runs?view=flow" replace /></AuthGuard>} />
      <Route path="/runs" element={<AuthGuard><Runs /></AuthGuard>} />
      <Route path="/runs/:runId" element={<AuthGuard><RunDetail /></AuthGuard>} />
      <Route path="/test-runs" element={<AuthGuard><TestRuns /></AuthGuard>} />
      <Route path="/bulk-visualization" element={<AuthGuard><BulkVisualization /></AuthGuard>} />
      <Route path="/execution-mesh" element={<AuthGuard><ExecutionMeshViz /></AuthGuard>} />
      <Route path="/agents" element={<AuthGuard><AgentMonitor /></AuthGuard>} />
      <Route path="/agents/:id" element={<AuthGuard><AgentDetail /></AuthGuard>} />
      <Route path="/logs" element={<AuthGuard><Logs /></AuthGuard>} />
    </Routes>
  )
}

export default App
