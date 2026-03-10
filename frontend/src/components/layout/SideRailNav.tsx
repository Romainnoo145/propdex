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

  const renderNavButton = (item: NavItem) => {
    const isActive = matchRoute({ to: item.to })
    return (
      <div key={item.to + item.label} className="w-full flex justify-center">
        <Link to={item.to} search={item.search} className="group relative flex justify-center">
          <div className="relative flex h-12 w-12 items-center justify-center">
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-full bg-aura-amber shadow-[0_0_20px_rgba(249,168,38,0.4)]"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className={`relative z-10 transition-colors duration-300 ${isActive ? 'text-white drop-shadow-sm' : 'text-slate-500 group-hover:text-aura-ink'}`}>
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
      </div>
    )
  }

  const isSettingsActive = matchRoute({ to: '/instellingen' })

  return (
    /* Ghost container — TRANSPARENT, absolute center axis at 110px */
    <div className="fixed left-0 top-0 bottom-0 w-[110px] flex flex-col items-center justify-between py-10 z-[100]">

      {/* Top: Logo — centered in the 110px column */}
      <div className="w-full flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-aura-obsidian shadow-lg">
          <span className="text-white font-display text-xl font-bold">P</span>
        </div>
      </div>

      {/* Middle: Nav pod — invisible container, buttons centered on axis */}
      <nav className="w-[68px] bg-white/40 backdrop-blur-3xl rounded-[34px] border border-white/30 ring-1 ring-inset ring-white/30 py-4 flex flex-col items-center gap-4">
        {mainItems.map(renderNavButton)}
      </nav>

      {/* Bottom: System pod — same invisible centering */}
      <div className="w-[68px] bg-white/40 backdrop-blur-3xl rounded-[34px] border border-white/30 ring-1 ring-inset ring-white/30 py-4 flex flex-col items-center gap-4">
        <div className="w-full flex justify-center">
          <Link to="/instellingen" className="group relative flex justify-center">
            <div className="relative flex h-12 w-12 items-center justify-center">
              {isSettingsActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-full bg-aura-amber shadow-[0_0_20px_rgba(249,168,38,0.4)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 transition-colors duration-300 ${isSettingsActive ? 'text-white drop-shadow-sm' : 'text-slate-500 group-hover:text-aura-ink'}`}>
                <Settings size={22} strokeWidth={1.5} />
              </span>
              {!isSettingsActive && (
                <span className="absolute inset-0 rounded-full bg-white/0 transition-all duration-300 group-hover:bg-white/20" />
              )}
            </div>
            <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Instellingen
            </span>
          </Link>
        </div>
        <div className="w-full flex justify-center">
          <button onClick={handleLogout} className="group relative flex justify-center">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <span className="text-slate-500 transition-colors duration-300 group-hover:text-aura-ink">
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
    </div>
  )
}
