import { ReactNode, useCallback, useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useMediaQuery } from '../../hooks/useMediaQuery'

interface LayoutProps {
  children: ReactNode
}

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed'

export const Layout = ({ children }: LayoutProps) => {
  const isLg = useMediaQuery('(min-width: 1024px)')

  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const setCollapsedPersist = useCallback((collapsed: boolean) => {
    setDesktopCollapsed(collapsed)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
  }, [])

  const toggleSidebar = useCallback(() => {
    if (isLg) {
      setCollapsedPersist(!desktopCollapsed)
    } else {
      setMobileOpen((o) => !o)
    }
  }, [isLg, desktopCollapsed, setCollapsedPersist])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  // When resizing to desktop, close mobile drawer
  useEffect(() => {
    if (isLg) setMobileOpen(false)
  }, [isLg])

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <Sidebar
        desktopCollapsed={desktopCollapsed}
        mobileOpen={mobileOpen}
        isLargeScreen={isLg}
        onCloseMobile={closeMobile}
      />

      {/* Mobile overlay */}
      {!isLg && mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/50"
          onClick={closeMobile}
        />
      )}

      <div
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-y-auto transition-[padding] duration-200 ease-out ${
          isLg ? (desktopCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64') : ''
        }`}
      >
        <TopBar
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={isLg && desktopCollapsed}
          mobileMenuOpen={!isLg && mobileOpen}
        />
        <main className="flex-1 bg-slate-50">{children}</main>
      </div>
    </div>
  )
}
