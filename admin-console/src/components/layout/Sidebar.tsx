import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Layers, Database, Zap, PanelLeft, X } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/templates', icon: Layers, label: 'Swarms' },
  { to: '/runs', icon: Database, label: 'Observe' },
  { to: '/test-runs', icon: Zap, label: 'Test Runs' },
  // { to: '/execution-mesh', icon: Network, label: 'Execution Mesh' },
]

interface SidebarProps {
  desktopCollapsed: boolean
  mobileOpen: boolean
  isLargeScreen: boolean
  onCloseMobile: () => void
  onToggleSidebar: () => void
}

export const Sidebar = ({
  desktopCollapsed,
  mobileOpen,
  isLargeScreen,
  onCloseMobile,
  onToggleSidebar,
}: SidebarProps) => {
  const location = useLocation()

  const collapsed = isLargeScreen && desktopCollapsed

  const asideBase =
    'fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-200 ease-out'

  const widthClass = isLargeScreen
    ? collapsed
      ? 'w-[72px]'
      : 'w-64'
    : 'w-64 max-w-[85vw]'

  const mobileTransform = !isLargeScreen
    ? mobileOpen
      ? 'translate-x-0'
      : '-translate-x-full'
    : 'translate-x-0'

  return (
    <aside className={`${asideBase} ${widthClass} ${mobileTransform}`}>
      {/* Edge Toggle Button - always visible on the right edge */}
      {isLargeScreen && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className="absolute -right-10 top-5 z-50 hidden lg:flex items-center justify-center w-8 h-18 border-slate-200 rounded-r-md hover:bg-slate-50 hover:border-slate-300 transition-all"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <PanelLeft className={`w-6 h-6 text-slate-500 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      )}

      {/* Mobile: header close button */}
      {!isLargeScreen && mobileOpen && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className="absolute -right-12 top-4 z-50 flex items-center justify-center w-8 h-8 bg-white/90 rounded-full shadow-md hover:bg-white transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      )}

      {/* Logo */}
      <div
        className={`flex items-center border-b border-slate-100 shrink-0 ${
          collapsed ? 'justify-center px-2 py-4' : 'gap-3 px-6 py-5'
        }`}
      >
        <img
          src="/favicon.svg"
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-lg shrink-0"
        />
        {!collapsed && (
          <h1 className="text-slate-900 text-xl font-bold tracking-tight truncate">Swarm</h1>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-6 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-4'}`}>
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(item.to))

          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              onClick={() => {
                if (!isLargeScreen) onCloseMobile()
              }}
              className={`flex items-center rounded-lg font-semibold transition-colors ${
                collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User Profile */}
      <div className={`p-4 border-t border-slate-100 shrink-0 ${collapsed ? 'px-2' : ''}`}>
        <div
          className={`flex items-center py-3 ${collapsed ? 'justify-center flex-col gap-2 px-0' : 'gap-3 px-2'}`}
        >
          <div className="size-8 bg-slate-200 rounded-full shrink-0" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">Admin User</p>
              <p className="text-[11px] text-slate-500 truncate">admin@swarm.ai</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
