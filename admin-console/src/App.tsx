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
      <Route path="/agents" element={<AgentMonitor />} />
      <Route path="/agents/:id" element={<AgentDetail />} />
      <Route path="/logs" element={<Logs />} />
    </Routes>
  )
}

export default App
