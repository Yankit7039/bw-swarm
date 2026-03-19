import { Search, Bell, HelpCircle, Menu, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface TopBarProps {
  onMenuClick?: () => void
}

export const TopBar = ({ onMenuClick }: TopBarProps) => {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('admin-console-auth')
    localStorage.removeItem('admin-console-user')
    navigate('/login')
  }

  return (
    <header className="h-16 flex items-center justify-between bg-white border-b border-slate-200 px-6 shrink-0">
      {/* Left side - Mobile menu & Search */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden text-slate-600 hover:text-slate-900 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="hidden sm:block">
          <div className="flex w-64 items-center rounded-lg bg-slate-100 border border-slate-200 h-9">
            <div className="text-slate-400 pl-3 flex items-center">
              <Search className="w-4 h-4" />
            </div>
            <input
              className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-500 outline-none"
              placeholder="Search resources..."
              type="text"
            />
          </div>
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg relative transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 size-2 bg-rose-500 border-2 border-white rounded-full" />
        </button>
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>
        <button 
          onClick={handleLogout}
          className="p-2 text-slate-500 hover:bg-slate-100 hover:text-rose-600 rounded-lg transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
        {/* <div className="h-6 w-px bg-slate-200 mx-1" /> */}
        {/* <div className="flex items-center gap-3 pl-2">
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">V2.4.0</span>
        </div> */}
      </div>
    </header>
  )
}
