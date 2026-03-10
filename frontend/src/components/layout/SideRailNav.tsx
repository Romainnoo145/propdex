import { Link, useMatchRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
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
  badge?: React.ReactNode
}

const podGlass = 'bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm'

export default function SideRailNav() {
  const matchRoute = useMatchRoute()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { data: unreadData } = useUnreadCounts()

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/auth' })
  }

  const mainItems: NavItem[] = [
    { icon: <Map size={22} strokeWidth={1.5} />, label: 'Kaart', to: '/map' },
    { icon: <FolderOpen size={22} strokeWidth={1.5} />, label: 'Projecten', to: '/projecten' },
    {
      icon: <Bell size={22} strokeWidth={1.5} />,
      label: 'Meldingen',
      to: '/meldingen',
      search: { gemeente: undefined } as Record<string, string>,
      badge: <NotificationBadge count={unreadData?.total_unread ?? 0} />,
    },
    {
      icon: <FileText size={22} strokeWidth={1.5} />,
      label: 'Rapporten',
      to: '/rapporten',
      search: { project_id: undefined, q: undefined } as Record<string, string>,
    },
    {
      icon: <Scale size={22} strokeWidth={1.5} />,
      label: 'Jurisprudentie',
      to: '/jurisprudentie',
      search: { gemeente: undefined, vergunningstype: undefined, uitkomst: undefined, rechtsgrond: undefined, rechtbank_niveau: undefined, periode: undefined, view: undefined } as Record<string, string>,
    },
  ]

  const renderNavLink = (item: NavItem) => {
    const isActive = matchRoute({ to: item.to })
    return (
      <Link
        key={item.to + item.label}
        to={item.to}
        search={item.search}
        className="group relative flex justify-center"
      >
        <div className="relative flex h-12 w-12 items-center justify-center">
          {isActive && (
            <motion.div
              layoutId="sidebar-active-pod"
              className="absolute inset-0 rounded-full bg-aura-amber shadow-[0_8px_20px_rgba(249,168,38,0.4)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <span className={`relative z-10 transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-aura-ink'}`}>
            {item.icon}
            {item.badge}
          </span>
          {!isActive && (
            <span className="absolute inset-0 rounded-full bg-white/0 transition-all duration-300 group-hover:bg-white/20" />
          )}
        </div>
        <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
          {item.label}
        </span>
      </Link>
    )
  }

  return (
    /* Invisible positioning container — NO background, NO border */
    <div className="h-full w-16 flex flex-col justify-between items-center py-2">

      {/* Top Pod: Logo — floating glass circle */}
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${podGlass}`}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-obsidian text-white font-display text-lg font-bold">
          P
        </div>
      </div>

      {/* Middle Pod: Navigation — floating glass capsule */}
      <nav className={`flex flex-col items-center py-4 gap-4 w-16 rounded-[32px] ${podGlass}`}>
        {mainItems.map(renderNavLink)}
      </nav>

      {/* Bottom Pod: System — floating glass capsule */}
      <div className={`flex flex-col items-center py-4 gap-4 w-16 rounded-[32px] ${podGlass}`}>
        <Link to="/instellingen" className="group relative flex justify-center">
          <div className="relative flex h-12 w-12 items-center justify-center">
            {matchRoute({ to: '/instellingen' }) && (
              <motion.div
                layoutId="sidebar-active-pod"
                className="absolute inset-0 rounded-full bg-aura-amber shadow-[0_8px_20px_rgba(249,168,38,0.4)]"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className={`relative z-10 transition-colors duration-300 ${matchRoute({ to: '/instellingen' }) ? 'text-white' : 'text-slate-400 group-hover:text-aura-ink'}`}>
              <Settings size={22} strokeWidth={1.5} />
            </span>
            {!matchRoute({ to: '/instellingen' }) && (
              <span className="absolute inset-0 rounded-full bg-white/0 transition-all duration-300 group-hover:bg-white/20" />
            )}
          </div>
          <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Instellingen
          </span>
        </Link>
        <button onClick={handleLogout} className="group relative flex justify-center">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <span className="relative z-10 text-slate-400 transition-colors duration-300 group-hover:text-aura-ink">
              <LogOut size={22} strokeWidth={1.5} />
            </span>
            <span className="absolute inset-0 rounded-full bg-white/0 transition-all duration-300 group-hover:bg-white/20" />
          </div>
          <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Uitloggen
          </span>
        </button>
      </div>
    </div>
  )
}
