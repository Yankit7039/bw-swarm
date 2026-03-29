import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Grid3X3,
  List,
  ArrowRight,
  TrendingUp,
  LayoutTemplate,
  Headphones,
  Database as DatabaseIcon,
  UserPlus,
  Puzzle,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { useTemplates } from '../hooks/useTemplates'

interface TemplateCardProps {
  id: string
  name: string
  description?: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  lastUsed: string
  agentColors: string[]
}

const TemplateCard = ({
  id,
  name,
  description,
  icon,
  iconBg,
  iconColor,
  lastUsed: _lastUsed,
  agentColors: _agentColors,
}: TemplateCardProps) => {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group overflow-hidden flex flex-col">
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-start mb-4">
          <div className={`h-10 w-10 ${iconBg} rounded-lg flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
        </div>
        <h4 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{name}</h4>
        <p className="text-sm text-slate-500 line-clamp-2 mb-6">{description || 'No description available'}</p>
        <div className="mt-auto space-y-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase font-bold tracking-tight">
            {/* <span>Last used: {lastUsed}</span>
            <div className="flex -space-x-2">
              {agentColors.map((color, i) => (
                <div
                  key={i}
                  className={`h-5 w-5 rounded-full ring-2 ring-white ${color}`}
                  title={`Agent ${i + 1}`}
                />
              ))}
            </div> */}
          </div>
          <button
            onClick={() => navigate(`/templates/${id}`)}
            className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg font-bold text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            View Details
          </button>
        </div>
      </div>
    </div>
  )
}

export const Templates = () => {
  const navigate = useNavigate()
  const { data, isLoading } = useTemplates()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState('all')

  const templates = data?.data || []

  // Template configuration for demo cards (fallback if no real data)
  const templateConfigs: Record<string, Partial<TemplateCardProps>> = {
    'stuck-order-adk': {
      icon: <Headphones className="w-5 h-5" />,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      lastUsed: '2h ago',
      agentColors: ['bg-slate-300', 'bg-slate-400', 'bg-slate-500'],
      description: 'Coordinate multiple specialized agents to handle customer tickets across email, chat, and social media.',
    },
    'invoice-extraction': {
      icon: <DatabaseIcon className="w-5 h-5" />,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      lastUsed: 'Yesterday',
      agentColors: ['bg-emerald-300', 'bg-emerald-500'],
      description: 'Automatically parse and extract structured data from PDF invoices and update accounting systems.',
    },
    'onboarding': {
      icon: <UserPlus className="w-5 h-5" />,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      lastUsed: '4 days ago',
      agentColors: ['bg-purple-300', 'bg-purple-500', 'bg-purple-700'],
      description: 'Provision accounts, schedule intro meetings, and send welcome packages via coordinated agents.',
    },
    'research': {
      icon: <TrendingUp className="w-5 h-5" />,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      lastUsed: 'Never',
      agentColors: ['bg-amber-400'],
      description: 'Synthesize news, social trends, and financial reports into actionable daily briefings.',
    },
  }

  const getTemplateConfig = (template: { id: string; name: string }): TemplateCardProps => {
    const config = templateConfigs[template.id] || templateConfigs['research']
    return {
      id: template.id,
      name: template.name,
      description: config.description,
      icon: config.icon || <LayoutTemplate className="w-5 h-5" />,
      iconBg: config.iconBg || 'bg-slate-100',
      iconColor: config.iconColor || 'text-slate-600',
      lastUsed: config.lastUsed || 'Never',
      agentColors: config.agentColors || ['bg-slate-300'],
    }
  }

  return (
    <Layout>
      <div className="w-full px-6 lg:px-10 py-8">
        {/* Content Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Swarm Workflows</h1>
            <p className="text-slate-500 text-base">Browse and deploy pre-configured multi-agent orchestration templates.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md flex items-center transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md flex items-center transition-all ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate('/adapters')}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-50 transition-all"
            >
              <Puzzle className="w-4 h-4" />
              <span>Browse Adapters</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/templates/new')}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Template</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pb-4">
          {['all', 'recent'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-white border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f === 'all' && 'All Templates'}
              {f === 'recent' && 'Recently Used'}
            </button>
          ))}
        </div>

        {/* Template Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <LayoutTemplate className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No templates yet</p>
            <button
              onClick={() => navigate('/templates/new')}
              className="mt-4 text-primary hover:underline font-medium"
            >
              Create your first template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {templates.map((template) => (
              <TemplateCard key={template.id} {...getTemplateConfig(template)} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
