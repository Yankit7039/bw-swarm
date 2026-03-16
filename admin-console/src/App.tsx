import { Routes, Route } from 'react-router-dom'
import { useSSE } from './hooks/useSSE'
import { Layout } from './components/layout/Layout'
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
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/templates/new" element={<TemplateBuilder />} />
        <Route path="/agents" element={<AgentMonitor />} />
        <Route path="/agents/:id" element={<AgentDetail />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/runs/:runId" element={<RunDetail />} />
        <Route path="/logs" element={<Logs />} />
      </Routes>
    </Layout>
  )
}

export default App
