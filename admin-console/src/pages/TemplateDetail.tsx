import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Rocket,
  CheckCircle,
  // AlertCircle,
  // ChevronRight,
  // Activity,
  // Scan,
  // Sparkles,
  // History,
  // Shield,
  // Database,
  // Network,
  // Wrench,
  RefreshCw,
  // Search,
  // MessageSquare,
  Edit3,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { useTemplates } from '../hooks/useTemplates'

// YAML syntax highlighting helper - preserves line structure
function highlightYAML(yaml: string): string {
  return yaml
    .split('\n')
    .map(line => {
      let highlighted = line
        .replace(/#.*$/g, '<span class="text-slate-400 italic">$&</span>')
        .replace(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)(:)/g, '$1<span class="text-violet-600 font-semibold">$2</span><span class="text-slate-600">$3</span>')
        .replace(/: (true|false)/g, ': <span class="text-indigo-600 font-semibold">$1</span>')
        .replace(/: (\d+)/g, ': <span class="text-amber-600">$1</span>')
        .replace(/: ([a-zA-Z_][a-zA-Z0-9_-]*)/g, ': <span class="text-emerald-600">$1</span>')
        .replace(/: "([^"]*)"/g, ': <span class="text-emerald-700">"$1"</span>')
        .replace(/: '([^']*)'/g, ': <span class="text-emerald-700">\'$1\'</span>')
      return `<div class="leading-relaxed h-[1.625rem]">${highlighted || '&nbsp;'}</div>`
    })
    .join('')
}

// Get YAML content from template - use workflow_yaml if available
function getYamlContent(workflowYaml: string | null | undefined, templateId: string, templateName: string): string {
  if (workflowYaml && workflowYaml.trim().length > 0) {
    return workflowYaml
  }

  // Fallback when workflow_yaml is not available
  return `# Template Configuration
# Template ID: ${templateId}
# Name: ${templateName}
# Note: No workflow YAML available

version: '1.0'
template_id: "${templateId}"
name: "${templateName}"`
}

// interface ClusterConfig {
//   id: string
//   name: string
//   icon: React.ReactNode
//   iconBg: string
//   iconColor: string
//   borderColor: string
//   status: string
//   tools: {
//     id: string
//     name: string
//     status: 'running' | 'pending' | 'done' | 'error'
//     timing?: string
//     details?: string
//   }[]
// }

// const CLUSTERS: ClusterConfig[] = [
//   {
//     id: 'diagnosis',
//     name: 'Diagnosis Cluster',
//     icon: <Scan className="w-5 h-5" />,
//     iconBg: 'bg-indigo-100',
//     iconColor: 'text-indigo-600',
//     borderColor: 'border-t-indigo-400',
//     status: '3 Active Agents',
//     tools: [
//       {
//         id: 'log-scanner',
//         name: 'Log Scanner',
//         status: 'running',
//         timing: '0.4s',
//         details: 'Regex parsing active',
//       },
//       {
//         id: 'network-ping',
//         name: 'Network Ping',
//         status: 'pending',
//       },
//       {
//         id: 'provision-check',
//         name: 'Provision Check',
//         status: 'done',
//       },
//     ],
//   },
//   {
//     id: 'healing',
//     name: 'Healing Cluster',
//     icon: <Sparkles className="w-5 h-5" />,
//     iconBg: 'bg-emerald-100',
//     iconColor: 'text-emerald-600',
//     borderColor: 'border-t-emerald-400',
//     status: 'System Ready',
//     tools: [
//       { id: 'auto-sql', name: 'Auto-SQL Fix', status: 'pending' },
//       { id: 'node-restart', name: 'Node Restarter', status: 'pending' },
//       { id: 'cache-warm', name: 'Cache Warmer', status: 'done' },
//     ],
//   },
//   {
//     id: 'alerting',
//     name: 'Alerting Cluster',
//     icon: <AlertCircle className="w-5 h-5" />,
//     iconBg: 'bg-rose-100',
//     iconColor: 'text-rose-600',
//     borderColor: 'border-t-rose-400',
//     status: '2 Notifications Pending',
//     tools: [
//       {
//         id: 'slack-integ',
//         name: 'Slack Integration',
//         status: 'error',
//         details: 'Rate limit nearing 90% capacity',
//       },
//       { id: 'pager-duty', name: 'PagerDuty Bridge', status: 'running' },
//     ],
//   },
//   {
//     id: 'followup',
//     name: 'Follow-up Cluster',
//     icon: <History className="w-5 h-5" />,
//     iconBg: 'bg-violet-100',
//     iconColor: 'text-violet-600',
//     borderColor: 'border-t-violet-400',
//     status: 'Archive Task Active',
//     tools: [
//       {
//         id: 'oms-sync',
//         name: 'OMS Sync',
//         status: 'running',
//         details: '25% complete',
//       },
//       { id: 'tracker-seq', name: 'Tracker Sequence', status: 'pending' },
//     ],
//   },
// ]

/* CLUSTERS and ClusterCard are kept for future use in the execution mesh view
const CLUSTERS: ClusterConfig[] = [...]
function ClusterCard({ cluster }: { cluster: ClusterConfig }) { ... }
*/

// const TOOL_ICONS: Record<string, React.ReactNode> = {
//   'log-scanner': <Search className="w-3.5 h-3.5" />,
//   'network-ping': <Activity className="w-3.5 h-3.5" />,
//   'provision-check': <Shield className="w-3.5 h-3.5" />,
//   'auto-sql': <Database className="w-3.5 h-3.5" />,
//   'node-restart': <RefreshCw className="w-3.5 h-3.5" />,
//   'cache-warm': <Network className="w-3.5 h-3.5" />,
//   'slack-integ': <MessageSquare className="w-3.5 h-3.5" />,
//   'pager-duty': <AlertCircle className="w-3.5 h-3.5" />,
//   'oms-sync': <Database className="w-3.5 h-3.5" />,
//   'tracker-seq': <History className="w-3.5 h-3.5" />,
// }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// function ClusterCard({ cluster }: { cluster: ClusterConfig }) {
//   return (
//     <div
//       className={`bg-white/70 backdrop-blur-sm rounded-2xl p-5 border-t-2 ${cluster.borderColor} shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}
//     >
      {/* Background glow effect */}
      {/* <div
        className={`absolute -right-8 -top-8 w-24 h-24 rounded-full blur-3xl opacity-20 transition-opacity ${
          cluster.id === 'diagnosis'
            ? 'bg-indigo-400 group-hover:opacity-40'
            : cluster.id === 'healing'
              ? 'bg-emerald-400 group-hover:opacity-40'
              : cluster.id === 'alerting'
                ? 'bg-rose-400 group-hover:opacity-40'
                : 'bg-violet-400 group-hover:opacity-40'
        }`}
      /> */}

      {/* Header */}
      {/* <div className="flex items-center gap-3 mb-4 relative z-10">
        <div
          className={`w-10 h-10 rounded-lg ${cluster.iconBg} flex items-center justify-center ${cluster.iconColor} ring-1 ring-opacity-20 ${cluster.iconBg.replace('bg-', 'ring-')}`}
        >
          {cluster.icon}
        </div>
        <div>
          <h3 className="font-bold text-sm text-slate-800">{cluster.name}</h3>
          <p className="text-[10px] text-slate-500 font-medium">{cluster.status}</p>
        </div>
      </div> */}

      {/* Tools List */}
      {/* <div className="space-y-2 relative z-10">
        {cluster.tools.map((tool) => (
          <div
            key={tool.id}
            className={`p-3 rounded-xl border transition-all ${
              tool.status === 'running'
                ? 'bg-white border-slate-200/60'
                : tool.status === 'error'
                  ? 'bg-rose-50/50 border-rose-200/40'
                  : 'bg-white/40 border-transparent hover:bg-white hover:border-slate-200/40'
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`text-slate-500 ${
                    tool.status === 'running' ? 'animate-pulse' : ''
                  }`}
                >
                  {TOOL_ICONS[tool.id] || <Wrench className="w-3.5 h-3.5" />}
                </span>
                <span className="text-xs font-semibold text-slate-700">{tool.name}</span>
              </div>
              {tool.timing && (
                <span className="text-[10px] font-mono text-indigo-600 font-bold">{tool.timing}</span>
              )}
              {tool.status === 'pending' && (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </div> */}

            {/* Status indicators */}
            {/* {tool.status === 'running' && (
              <div className="space-y-1.5 pl-5 border-l-2 border-indigo-200">
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span>Initializing...</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_5px_#4f46e5]" />
                  <span>{tool.details || 'Processing active'}</span>
                </div>
              </div>
            )}

            {tool.status === 'error' && (
              <div className="mt-2 text-[10px] text-rose-600 leading-relaxed">{tool.details}</div>
            )}

            {tool.status === 'done' && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium">
                <CheckCircle className="w-3 h-3" />
                <span>Completed</span>
              </div>
            )}

            {tool.status === 'running' && tool.details?.includes('%') && (
              <div className="mt-2">
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      cluster.id === 'diagnosis'
                        ? 'bg-indigo-500'
                        : cluster.id === 'healing'
                          ? 'bg-emerald-500'
                          : cluster.id === 'alerting'
                            ? 'bg-rose-500'
                            : 'bg-violet-500'
                    }`}
                    style={{ width: tool.details }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
} */}

export function TemplateDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: templatesData } = useTemplates()
  const [isValidating, setIsValidating] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')

  const template = templatesData?.data?.find((t) => t.id === id)

  const yamlContent = useMemo(
    () => getYamlContent(template?.workflow_yaml, id || '', template?.name || 'Unnamed Template'),
    [template?.workflow_yaml, id, template?.name]
  )
  const highlightedYAML = highlightYAML(yamlContent)

  const handleValidate = () => {
    setIsValidating(true)
    setTimeout(() => {
      setIsValidating(false)
      setValidationStatus('valid')
    }, 1500)
  }

  const handleDeploy = () => {
    setIsDeploying(true)
    setTimeout(() => {
      setIsDeploying(false)
      navigate('/test-runs')
    }, 2000)
  }

  // Line numbers for YAML editor
  const lineCount = yamlContent.split('\n').length
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1)

  if (!template) {
    return (
      <Layout>
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-slate-500">Template not found</p>
            <Link to="/templates" className="mt-4 text-primary hover:underline inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Templates
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <style>{`
        .yaml-editor::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .yaml-editor::-webkit-scrollbar-track {
          background: transparent;
        }
        .yaml-editor::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.2);
          border-radius: 3px;
        }
        .yaml-editor::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.4);
        }
      `}</style>

      <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50 overflow-hidden">
        {/* Sub Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {/* <Link
              to="/templates"
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link> */}
            <div>
              <h1 className="text-lg font-bold text-slate-900">{template.name}</h1>
              <p className="text-xs text-slate-500">Template Configuration</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {validationStatus === 'valid' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-semibold">
                <CheckCircle className="w-4 h-4" />
                Valid YAML
              </div>
            )}
            <button
              onClick={() => navigate(`/templates/new?edit=${id}`)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary border border-primary/20 hover:bg-primary/5 rounded-lg transition disabled:opacity-50"
            >
              {isValidating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {isValidating ? 'Validating...' : 'Validate YAML'}
            </button>
            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-lg shadow-primary/20 transition disabled:opacity-50"
            >
              {isDeploying ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              {isDeploying ? 'Deploying...' : 'Deploy Template'}
            </button>
          </div>
        </header>

        {/* Main Split Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: YAML Editor */}
          <section className="w-full flex flex-col bg-white border-r border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-primary font-mono text-sm">📄</span>
                <span className="font-semibold text-sm text-slate-700">{template.id}.yaml</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono">v2.4</span>
              </div>
            </div>

            <div className="flex-1 flex overflow-auto yaml-editor">
              {/* Line Numbers */}
              <div className="py-6 px-3 text-right text-slate-300 font-mono text-sm select-none border-r border-slate-100 bg-slate-50/50">
                {lineNumbers.map((n) => (
                  <div key={n} className="leading-relaxed h-[1.625rem]">
                    {n}
                  </div>
                ))}
              </div>

              {/* YAML Content */}
              <div className="flex-1 py-6 px-4 font-mono text-sm">
                <div
                  dangerouslySetInnerHTML={{ __html: highlightedYAML }}
                  className="text-slate-700"
                />
              </div>
            </div>
          </section>

          {/* Right: Execution Mesh Sidebar */}
          {/* <aside className="w-1/2 bg-slate-50/80 p-6 overflow-y-auto yaml-editor">
            <div className="flex justify-between items-center mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">
                  Execution Mesh
                </span>
                <h2 className="text-xl font-bold text-slate-900">Swarm Nodes</h2>
              </div>
              <button className="p-2 text-slate-400 hover:text-primary transition">
                <span className="sr-only">Settings</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-5">
              {CLUSTERS.map((cluster) => (
                <ClusterCard key={cluster.id} cluster={cluster} />
              ))}
            </div>
          </aside> */}
        </div>
      </div>
    </Layout>
  )
}
