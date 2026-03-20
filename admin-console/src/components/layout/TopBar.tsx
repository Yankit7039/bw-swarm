import { Search, Bell, HelpCircle, Menu, X, ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface TopBarProps {
  onToggleSidebar: () => void
  /** Large screens: sidebar is collapsed to icon rail */
  sidebarCollapsed?: boolean
  /** Small screens: mobile drawer is open */
  mobileMenuOpen?: boolean
}

export const TopBar = ({
  onToggleSidebar,
  sidebarCollapsed = false,
  mobileMenuOpen = false,
}: TopBarProps) => {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('admin-console-auth')
    localStorage.removeItem('admin-console-user')
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 h-16 flex items-center justify-between bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close sidebar' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {/* Mobile: menu / close */}
          <span className="lg:hidden">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </span>
          {/* Desktop: collapse / expand */}
          <span className="hidden lg:inline-flex">
            {sidebarCollapsed ? (
              <ChevronsRight className="w-6 h-6" />
            ) : (
              <ChevronsLeft className="w-6 h-6" />
            )}
          </span>
        </button>
        <div className="hidden sm:block min-w-0">
          <div className="flex w-52 sm:w-64 items-center rounded-lg bg-slate-100 border border-slate-200 h-9">
            <div className="text-slate-400 pl-3 flex items-center shrink-0">
              <Search className="w-4 h-4" />
            </div>
            <input
              className="w-full min-w-0 bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-500 outline-none"
              placeholder="Search resources..."
              type="text"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <button
          type="button"
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg relative transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 size-2 bg-rose-500 border-2 border-white rounded-full" />
        </button>
        <button
          type="button"
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors hidden sm:inline-flex"
          aria-label="Help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 text-slate-500 hover:bg-slate-100 hover:text-rose-600 rounded-lg transition-colors"
          title="Logout"
          aria-label="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
