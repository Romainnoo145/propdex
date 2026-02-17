import { Link, useMatchRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/useAuth'
import { useNavigate } from '@tanstack/react-router'
import { useUnreadCounts } from '@/hooks/useNotifications'
import { NotificationBadge } from '@/components/notifications/NotificationBadge'
import { Map, ListOrdered, FolderOpen, Bell, FileText, Settings, LogOut } from 'lucide-react'

interface NavItem {
  icon: React.ReactNode
  label: string
  to: string
  search?: Record<string, string>
}

interface SideRailNavProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

/**
 * Side-rail navigation component.
 *
 * Thin left-side icon-based navigation with Kaart, Resultaten, Projecten primary views
 * plus notification bell, Rapporten toggle, settings, and logout at bottom.
 *
 * Design: Glassmorphism (bg-black/30 backdrop-blur-xl), fixed position,
 * z-index --z-side-rail (250).
 */
export default function SideRailNav({
  sidebarOpen,
  onToggleSidebar,
}: SideRailNavProps) {
  const matchRoute = useMatchRoute()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { data: unreadData } = useUnreadCounts()

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/auth' })
  }

  const navItems: NavItem[] = [
    {
      icon: <Map size={20} />,
      label: 'Kaart',
      to: '/map',
    },
    {
      icon: <ListOrdered size={20} />,
      label: 'Resultaten',
      to: '/map',
      search: { panel: 'results' },
    },
    {
      icon: <FolderOpen size={20} />,
      label: 'Projecten',
      to: '/projecten',
    },
  ]

  return (
    <nav
      className="hidden h-full w-16 shrink-0 flex-col items-center justify-between border-r border-white/10 bg-black/30 py-4 backdrop-blur-xl md:flex"
      style={{ zIndex: 'var(--z-side-rail)' }}
    >
      {/* Top section: Main navigation */}
      <div className="flex flex-col items-center gap-2">
        {navItems.map((item) => {
          const isActive = matchRoute({ to: item.to })
          return (
            <Link
              key={item.to + item.label}
              to={item.to}
              search={item.search}
              className="group relative"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
              </div>
              {/* Hover tooltip */}
              <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* Divider */}
        <div className="my-2 h-px w-8 bg-white/10" />

        {/* Notification bell */}
        <Link to="/projecten" className="group relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white">
            <Bell size={20} />
            <NotificationBadge count={unreadData?.total_unread ?? 0} />
          </div>
          {/* Hover tooltip */}
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Meldingen
          </span>
        </Link>

        {/* Rapporten toggle button */}
        <button
          onClick={onToggleSidebar}
          className="group relative"
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
              sidebarOpen
                ? 'bg-white/15 text-white'
                : 'text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            <FileText size={20} />
          </div>
          {/* Hover tooltip */}
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Rapporten
          </span>
        </button>
      </div>

      {/* Bottom section: Settings + Logout */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <Link to="/instellingen" className="group relative">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
              matchRoute({ to: '/instellingen' })
                ? 'bg-white/15 text-white'
                : 'text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Settings size={20} />
          </div>
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Instellingen
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="group relative flex h-12 w-12 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={20} />
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Uitloggen
          </span>
        </button>
      </div>
    </nav>
  )
}
