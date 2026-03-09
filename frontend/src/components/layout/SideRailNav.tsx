import { Link, useMatchRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/useAuth'
import { useNavigate } from '@tanstack/react-router'
import { useUnreadCounts } from '@/hooks/useNotifications'
import { NotificationBadge } from '@/components/notifications/NotificationBadge'
import WorkspaceSwitcher from '@/components/layout/WorkspaceSwitcher'
import { Map, FolderOpen, Bell, FileText, Scale, Settings, LogOut } from 'lucide-react'

interface NavItem {
  icon: React.ReactNode
  label: string
  to: string
  search?: Record<string, string>
}

/**
 * Side-rail navigation component.
 *
 * Thin left-side icon-based navigation with Kaart, Resultaten, Projecten primary views
 * plus notification bell, Rapporten page link, settings, and logout at bottom.
 *
 * Design: Industrial Amber (bg-grey-900 solid), fixed position,
 * z-index --z-side-rail (250).
 */
export default function SideRailNav() {
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
      icon: <FolderOpen size={20} />,
      label: 'Projecten',
      to: '/projecten',
    },
  ]

  return (
    <nav
      className="hidden h-full w-16 shrink-0 flex-col items-center justify-between border-r border-grey-800 bg-grey-900 py-4 md:flex"
      style={{ zIndex: 'var(--z-side-rail)' }}
    >
      {/* Top section: Main navigation */}
      <div className="flex flex-col items-center gap-2">
        <WorkspaceSwitcher />

        {/* Divider */}
        <div className="my-1 h-px w-8 bg-grey-800" />

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
                    ? 'bg-grey-800 text-grey-100'
                    : 'text-grey-400 hover:bg-grey-850 hover:text-grey-100'
                }`}
              >
                {item.icon}
              </div>
              {/* Hover tooltip */}
              <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-grey-800 bg-grey-950 px-2 py-1 text-xs text-grey-100 opacity-0 transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* Divider */}
        <div className="my-2 h-px w-8 bg-grey-800" />

        {/* Notification bell */}
        <Link to="/meldingen" search={{ gemeente: undefined }} className="group relative">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
              matchRoute({ to: '/meldingen' })
                ? 'bg-grey-800 text-grey-100'
                : 'text-grey-400 hover:bg-grey-850 hover:text-grey-100'
            }`}
          >
            <Bell size={20} />
            <NotificationBadge count={unreadData?.total_unread ?? 0} />
          </div>
          {/* Hover tooltip */}
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-grey-800 bg-grey-950 px-2 py-1 text-xs text-grey-100 opacity-0 transition-opacity group-hover:opacity-100">
            Meldingen
          </span>
        </Link>

        {/* Rapporten page link */}
        <Link
          to="/rapporten"
          search={{ project_id: undefined, q: undefined }}
          className="group relative"
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
              matchRoute({ to: '/rapporten' })
                ? 'bg-grey-800 text-grey-100'
                : 'text-grey-400 hover:bg-grey-850 hover:text-grey-100'
            }`}
          >
            <FileText size={20} />
          </div>
          {/* Hover tooltip */}
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-grey-800 bg-grey-950 px-2 py-1 text-xs text-grey-100 opacity-0 transition-opacity group-hover:opacity-100">
            Rapporten
          </span>
        </Link>

        {/* Jurisprudentie explorer link */}
        <Link to="/jurisprudentie" className="group relative">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
              matchRoute({ to: '/jurisprudentie' })
                ? 'bg-grey-800 text-grey-100'
                : 'text-grey-400 hover:bg-grey-850 hover:text-grey-100'
            }`}
          >
            <Scale size={20} />
          </div>
          {/* Hover tooltip */}
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-grey-800 bg-grey-950 px-2 py-1 text-xs text-grey-100 opacity-0 transition-opacity group-hover:opacity-100">
            Jurisprudentie
          </span>
        </Link>
      </div>

      {/* Bottom section: Settings + Logout */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <Link to="/instellingen" className="group relative">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
              matchRoute({ to: '/instellingen' })
                ? 'bg-grey-800 text-grey-100'
                : 'text-grey-400 hover:bg-grey-850 hover:text-grey-100'
            }`}
          >
            <Settings size={20} />
          </div>
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-grey-800 bg-grey-950 px-2 py-1 text-xs text-grey-100 opacity-0 transition-opacity group-hover:opacity-100">
            Instellingen
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="group relative flex h-12 w-12 items-center justify-center rounded-lg text-grey-400 transition-colors hover:bg-grey-850 hover:text-grey-100"
        >
          <LogOut size={20} />
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-grey-800 bg-grey-950 px-2 py-1 text-xs text-grey-100 opacity-0 transition-opacity group-hover:opacity-100">
            Uitloggen
          </span>
        </button>
      </div>
    </nav>
  )
}
