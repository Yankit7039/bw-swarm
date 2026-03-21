import { Bell, HelpCircle, LogOut, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface TopBarProps {
  onOpenMobileSidebar?: () => void
}

export const TopBar = ({ onOpenMobileSidebar }: TopBarProps) => {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('admin-console-auth')
    localStorage.removeItem('admin-console-user')
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 h-16 flex items-center justify-between bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
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
