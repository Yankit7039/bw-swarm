import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Layers,
  Database,
  Zap,
  Hexagon,
  // LogOut,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/templates', icon: Layers, label: 'Templates' },
  { to: '/runs', icon: Database, label: 'Runs' },
  { to: '/test-runs', icon: Zap, label: 'Test Runs' },
  // { to: '/settings', icon: Settings, label: 'Settings' },
]

export const Sidebar = () => {
  const location = useLocation()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
        <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
          <Hexagon className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-slate-900 text-xl font-bold tracking-tight">Swarm</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== '/' && location.pathname.startsWith(item.to))
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="size-8 bg-slate-200 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">Admin User</p>
            <p className="text-[11px] text-slate-500 truncate">admin@swarm.ai</p>
          </div>
          {/* <button className="text-slate-400 hover:text-slate-600 transition-colors">
            <LogOut className="w-4 h-4" />
          </button> */}
        </div>
      </div>
    </aside>
  )
}
