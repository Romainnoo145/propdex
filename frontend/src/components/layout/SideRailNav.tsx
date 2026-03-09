import { Link, useMatchRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/useAuth'
import { useNavigate } from '@tanstack/react-router'
import { useUnreadCounts } from '@/hooks/useNotifications'
import { NotificationBadge } from '@/components/notifications/NotificationBadge'
import { Map, FolderOpen, Bell, FileText, Scale, Settings, LogOut } from 'lucide-react'

interface NavItem {
  icon: React.ReactNode
  label: string
  to: string
  search?: Record<string, string>
}

/**
 * Floating glass side-rail navigation component.
 *
 * Fixed-position glass panel floating 16px from all edges with rounded-[40px].
 * Contains logo monogram at top, functional icons in middle, settings+logout at bottom.
 *
 * Design: Aura glass (bg-aura-glass-white/60 + backdrop-blur-xl), fixed position,
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
      className="fixed left-4 top-4 bottom-4 hidden w-20 flex-col items-center justify-between rounded-[40px] border border-white/40 bg-aura-glass-white/60 py-6 shadow-glass backdrop-blur-xl pointer-events-auto md:flex aura-float"
      style={{ zIndex: 'var(--z-side-rail)' }}
    >
      {/* Top section: Monogram + Navigation */}
      <div className="flex flex-col items-center gap-2">
        {/* Propdex monogram */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-obsidian text-white font-display text-lg font-bold">
          P
        </div>

        {/* Divider */}
        <div className="my-1 h-px w-8 bg-white/20" />

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
                className={`aura-hover-glow flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-250 hover:scale-105 ${
                  isActive
                    ? 'bg-aura-amber/20 text-aura-amber'
                    : 'text-neutral-600 hover:bg-aura-glass-white/40 hover:text-aura-ink'
                }`}
              >
                {item.icon}
              </div>
              {/* Hover tooltip */}
              <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/40 bg-aura-glass-white/60 backdrop-blur-md px-2 py-1 text-xs text-aura-ink opacity-0 transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* Divider */}
        <div className="my-2 h-px w-8 bg-white/20" />

        {/* Notification bell */}
        <Link to="/meldingen" search={{ gemeente: undefined }} className="group relative">
          <div
            className={`aura-hover-glow flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-250 hover:scale-105 ${
              matchRoute({ to: '/meldingen' })
                ? 'bg-aura-amber/20 text-aura-amber'
                : 'text-neutral-600 hover:bg-aura-glass-white/40 hover:text-aura-ink'
            }`}
          >
            <Bell size={20} />
            <NotificationBadge count={unreadData?.total_unread ?? 0} />
          </div>
          {/* Hover tooltip */}
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/40 bg-aura-glass-white/60 backdrop-blur-md px-2 py-1 text-xs text-aura-ink opacity-0 transition-opacity group-hover:opacity-100">
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
            className={`aura-hover-glow flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-250 hover:scale-105 ${
              matchRoute({ to: '/rapporten' })
                ? 'bg-aura-amber/20 text-aura-amber'
                : 'text-neutral-600 hover:bg-aura-glass-white/40 hover:text-aura-ink'
            }`}
          >
            <FileText size={20} />
          </div>
          {/* Hover tooltip */}
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/40 bg-aura-glass-white/60 backdrop-blur-md px-2 py-1 text-xs text-aura-ink opacity-0 transition-opacity group-hover:opacity-100">
            Rapporten
          </span>
        </Link>

        {/* Jurisprudentie explorer link */}
        <Link to="/jurisprudentie" search={{ gemeente: undefined, vergunningstype: undefined, uitkomst: undefined, rechtsgrond: undefined, rechtbank_niveau: undefined, periode: undefined, view: undefined }} className="group relative">
          <div
            className={`aura-hover-glow flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-250 hover:scale-105 ${
              matchRoute({ to: '/jurisprudentie' })
                ? 'bg-aura-amber/20 text-aura-amber'
                : 'text-neutral-600 hover:bg-aura-glass-white/40 hover:text-aura-ink'
            }`}
          >
            <Scale size={20} />
          </div>
          {/* Hover tooltip */}
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/40 bg-aura-glass-white/60 backdrop-blur-md px-2 py-1 text-xs text-aura-ink opacity-0 transition-opacity group-hover:opacity-100">
            Jurisprudentie
          </span>
        </Link>
      </div>

      {/* Bottom section: Settings + Logout */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <Link to="/instellingen" className="group relative">
          <div
            className={`aura-hover-glow flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-250 hover:scale-105 ${
              matchRoute({ to: '/instellingen' })
                ? 'bg-aura-amber/20 text-aura-amber'
                : 'text-neutral-600 hover:bg-aura-glass-white/40 hover:text-aura-ink'
            }`}
          >
            <Settings size={20} />
          </div>
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/40 bg-aura-glass-white/60 backdrop-blur-md px-2 py-1 text-xs text-aura-ink opacity-0 transition-opacity group-hover:opacity-100">
            Instellingen
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="group relative aura-hover-glow flex h-12 w-12 items-center justify-center rounded-lg text-neutral-600 transition-all duration-250 hover:scale-105 hover:bg-aura-glass-white/40 hover:text-aura-ink"
        >
          <LogOut size={20} />
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/40 bg-aura-glass-white/60 backdrop-blur-md px-2 py-1 text-xs text-aura-ink opacity-0 transition-opacity group-hover:opacity-100">
            Uitloggen
          </span>
        </button>
      </div>
    </nav>
  )
}
