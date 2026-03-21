import { useState } from 'react'
// import { useNavigate } from 'react-router-dom'
import {
  // CheckCircle,
  Activity,
  Hexagon,
  XCircle,
  SlidersHorizontal,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { useAgents } from '../hooks/useAgents'
import { useAgentStore } from '../store/agentStore'
import { useTemplates } from '../hooks/useTemplates'
import { useQuery } from '@tanstack/react-query'
import { runsApi } from '../api/runs'
// import type { Run } from '../types/common'

type TimeRange = '1day' | '1week' | '1month'

const TIME_RANGE_OPTIONS: { id: TimeRange; label: string; hours: number }[] = [
  { id: '1day', label: 'Last 1 day', hours: 24 },
  { id: '1week', label: 'Last 1 week', hours: 24 * 7 },
  { id: '1month', label: 'Last 1 month', hours: 24 * 30 },
]

const StatCard = ({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string
  value: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
}) => {
  return (
    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start">
        <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">{label}</p>
        <div className={`p-2 rounded-lg ${iconBg} ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-slate-900 text-3xl font-bold leading-tight">{value}</p>
    </div>
  )
}

// const ActivityCard = ({
//   run,
//   onRetry,
// }: {
//   run: Run
//   onRetry?: () => void
// }) => {
//   const status = run.status as 'running' | 'completed' | 'failed' | 'pending'
  
//   const statusConfig = {
//     running: {
//       badge: 'bg-primary/10 text-primary',
//       badgeText: 'Running',
//       barColor: 'bg-primary',
//       progress: 65,
//     },
//     completed: {
//       badge: 'bg-emerald-100 text-emerald-600',
//       badgeText: 'Completed',
//       barColor: 'bg-emerald-500',
//       progress: 100,
//     },
//     failed: {
//       badge: 'bg-rose-100 text-rose-600',
//       badgeText: 'Failed',
//       barColor: 'bg-rose-500',
//       progress: 20,
//     },
//     pending: {
//       badge: 'bg-slate-100 text-slate-500',
//       badgeText: 'Queued',
//       barColor: 'bg-slate-300',
//       progress: 0,
//     },
//   }

//   const config = statusConfig[status] || statusConfig.pending
  
//   const formatTimeAgo = (timestamp?: string | null) => {
//     if (!timestamp) return 'Never'
//     const date = new Date(timestamp)
//     const now = new Date()
//     const diffMs = now.getTime() - date.getTime()
//     const diffMins = Math.floor(diffMs / 60000)
//     if (diffMins < 1) return 'Just now'
//     if (diffMins < 60) return `${diffMins} mins ago`
//     const diffHours = Math.floor(diffMins / 60)
//     if (diffHours < 24) return `${diffHours}h ago`
//     return date.toLocaleDateString()
//   }

//   const getDetailText = () => {
//     if (status === 'completed') return run.result ? 'Completed successfully' : 'Completed'
//     if (status === 'failed') return run.error_message || 'Error occurred'
//     if (status === 'running') return 'Processing...'
//     return 'Waiting in queue'
//   }

//   return (
//     <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col gap-3">
//       <div className="flex justify-between items-start">
//         <div className="flex flex-col">
//           <p className="text-sm font-bold text-slate-900">{run.template_id}</p>
//           <p className="text-[11px] font-medium text-slate-500">
//             {formatTimeAgo(run.created_at)} • Run #{run.run_id.slice(0, 4).toUpperCase()}
//           </p>
//         </div>
//         <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${config.badge}`}>
//           {config.badgeText}
//         </span>
//       </div>
//       <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
//         <div className={`${config.barColor} h-full rounded-full transition-all`} style={{ width: `${config.progress}%` }} />
//       </div>
//       <div className="flex justify-between items-center">
//         <span className={`text-[10px] font-medium ${status === 'failed' ? 'text-rose-500' : 'text-slate-400'}`}>
//           {getDetailText()}
//         </span>
//         {status === 'completed' ? (
//           <CheckCircle className="w-4 h-4 text-emerald-500" />
//         ) : status === 'failed' && onRetry ? (
//           <button onClick={onRetry} className="text-primary text-[10px] font-bold underline">
//             Retry Run
//           </button>
//         ) : (
//           <span className="text-[10px] text-slate-500 font-bold uppercase">{config.progress}%</span>
//         )}
//       </div>
//     </div>
//   )
// }

export const Dashboard = () => {
  // const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState<TimeRange>('1day')
  
  // Fetch agents (for future use - agent monitoring)
  useAgents({ limit: 10 })
  useAgentStore((state) => Object.values(state.agents).slice(0, 10))
  
  // Fetch templates
  const { data: templatesData } = useTemplates(100, 0)
  
  // Fetch recent runs
  const { data: runsData } = useQuery({
    queryKey: ['runs-dashboard'],
    queryFn: () => runsApi.list({ limit: 500 }),
    refetchInterval: 5000,
  })

  const runs = runsData?.data || []
  const templates = templatesData?.data || []

  // Calculate dynamic stats based on selected time range
  const now = new Date()
  const selectedHours = TIME_RANGE_OPTIONS.find(o => o.id === timeRange)?.hours || 24
  const rangeStart = new Date(now.getTime() - selectedHours * 60 * 60 * 1000)
  
  // Filter runs within selected time range
  const runsInRange = runs.filter(r => {
    if (!r.created_at) return false
    return new Date(r.created_at) >= rangeStart
  })
  
  // Total executions in range
  const totalExecutions = runsInRange.length
  
  // Failed executions in range
  const failedExecutions = runsInRange.filter(r => r.status === 'failed').length
  
  // Generate chart data based on time range
  const generateChartData = () => {
    const data: number[] = []
    const now = new Date()
    const hours = TIME_RANGE_OPTIONS.find(o => o.id === timeRange)?.hours || 24
    const bucketCount = timeRange === '1day' ? 12 : timeRange === '1week' ? 14 : 15
    const hoursPerBucket = hours / bucketCount
    
    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketStart = new Date(now.getTime() - (i + 1) * hoursPerBucket * 60 * 60 * 1000)
      const bucketEnd = new Date(now.getTime() - i * hoursPerBucket * 60 * 60 * 1000)
      
      const count = runs.filter(r => {
        if (!r.created_at) return false
        const runDate = new Date(r.created_at)
        return runDate >= bucketStart && runDate < bucketEnd
      }).length
      
      data.push(count)
    }
    
    return data
  }
  
  const chartData = generateChartData()
  const maxValue = Math.max(...chartData, 1)

  // Top templates by run count
  const templateRunCounts = runs.reduce((acc, run) => {
    acc[run.template_id] = (acc[run.template_id] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const topTemplates = Object.entries(templateRunCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({
      id,
      name: templates.find(t => t.id === id)?.name || id,
      runs: count,
      latency: `${(Math.random() * 4 + 0.5).toFixed(1)}s`, // Mock latency
      healthy: count > 10, // Mock health check
    }))

  // Recent runs for activity feed
  // const recentRuns = runs.slice(0, 4)

  return (
    <Layout>
      <div className="p-6 lg:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Hero & Time Range Filter */}
          <div className="flex flex-wrap justify-between items-end gap-4 mb-10">
            <div className="flex flex-col gap-1">
              <h1 className="text-slate-900 text-3xl font-extrabold leading-tight tracking-tight">Dashboard Overview</h1>
              <p className="text-slate-500 text-base">Real-time performance and agent swarm activity monitoring</p>
            </div>
            {/* Time Range Filter */}
            <div className="relative">
              <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="pl-9 pr-8 py-2.5 rounded-xl text-sm font-semibold bg-white text-slate-700 shadow-sm border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
              >
                {TIME_RANGE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats & Chart Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
            {/* Left: Stat Cards */}
            <div className="space-y-5">
              <StatCard
                label="Total Executions"
                value={totalExecutions.toLocaleString()}
                icon={Activity}
                iconBg="bg-primary/10"
                iconColor="text-primary"
              />
              <StatCard
                label="Failed Executions"
                value={failedExecutions.toLocaleString()}
                icon={XCircle}
                iconBg="bg-rose-100"
                iconColor="text-rose-600"
              />
            </div>

            {/* Right: Run Volume Chart */}
            <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-slate-900 text-lg font-bold">Run Volume</h3>
                  <p className="text-sm text-slate-500">Swarm node throughput</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#6d3bd7] mt-1"></span>
                  <span className="text-slate-500 text-xs font-medium">Active Cluster</span>
                </div>
              </div>
              <div className="h-56 w-full relative group">
                {chartData.every(d => d === 0) ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Activity className="w-12 h-12 mb-4" />
                    <p className="text-lg font-medium">No data yet</p>
                    <p className="text-sm">Run data will appear here as workflows execute</p>
                  </div>
                ) : (
                  <>
                    {/* Bar Chart */}
                    <div className="absolute inset-x-0 bottom-6 top-0 flex items-end justify-between gap-2">
                      {chartData.map((value, index) => {
                        const height = value === 0 ? 5 : Math.max(15, (value / maxValue) * 100)
                        return (
                          <div
                            key={index}
                            className="flex-1 rounded-t transition-all hover:opacity-80"
                            style={{
                              height: `${height}%`,
                              backgroundColor: '#6d3bd7',
                              opacity: value === 0 ? 0.1 : 0.3 + (height / 200),
                            }}
                            title={`${value} runs`}
                          />
                        )
                      })}
                    </div>
                    {/* X-Axis Labels */}
                    <div className="absolute bottom-0 w-full flex justify-between text-[10px] font-mono text-slate-400 uppercase tracking-tighter">
                      <span>{timeRange === '1day' ? '-23h' : timeRange === '1week' ? '-6d' : '-30d'}</span>
                      <span>{timeRange === '1day' ? '-18h' : timeRange === '1week' ? '-4d' : '-20d'}</span>
                      <span>{timeRange === '1day' ? '-12h' : timeRange === '1week' ? '-2d' : '-10d'}</span>
                      <span>{timeRange === '1day' ? '-6h' : timeRange === '1week' ? '-1d' : '-5d'}</span>
                      <span className="text-[#6d3bd7] font-bold">Now</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Top Templates Table */}
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-slate-900 font-bold">Top Templates</h3>
              {/* <button className="text-primary text-xs font-bold hover:underline">View Analytics</button> */}
            </div>
            <div className="overflow-x-auto">
              {topTemplates.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">No runs yet. Trigger your first run to see template statistics.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold">
                    <tr>
                      <th className="px-6 py-3.5">Template Name</th>
                      <th className="px-6 py-3.5 text-center">Runs</th>
                      <th className="px-6 py-3.5 text-center">Avg Latency</th>
                      <th className="px-6 py-3.5 text-right">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topTemplates.map((template) => (
                      <tr key={template.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold">{template.name}</td>
                        <td className="px-6 py-4 text-sm text-center">{template.runs}</td>
                        <td className="px-6 py-4 text-sm text-center">{template.latency}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`size-2 rounded-full ${template.healthy ? 'bg-emerald-500' : 'bg-amber-500'} inline-block`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 
            LIVE ACTIVITY FEED - COMMENTED FOR FUTURE USE
            <div className="flex flex-col gap-5">
              ...
            </div>
          */}

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Hexagon className="w-4 h-4 text-primary" />
              <p className="text-slate-500 text-xs font-medium">© 2026 Swarm Admin Console. Enterprise Edition.</p>
            </div>
            <div className="flex gap-6">
              <a className="text-slate-400 hover:text-primary text-xs font-bold transition-colors" href="#">Privacy Policy</a>
              <a className="text-slate-400 hover:text-primary text-xs font-bold transition-colors" href="#">Documentation</a>
              <a className="text-slate-400 hover:text-primary text-xs font-bold transition-colors" href="#">API Keys</a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
