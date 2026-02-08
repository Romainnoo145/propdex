import { Link, useMatchRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/useAuth'
import { useNavigate } from '@tanstack/react-router'

interface NavItem {
  icon: React.ReactNode
  label: string
  to: string
}

interface SideRailNavProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

/**
 * Side-rail navigation component.
 *
 * Thin left-side icon-based navigation with Dashboard, Kaart, Rapporten, Projecten,
 * Instellingen routes + logout button at bottom.
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

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/auth' })
  }

  const navItems: NavItem[] = [
    {
      icon: <DashboardIcon />,
      label: 'Dashboard',
      to: '/dashboard',
    },
    {
      icon: <MapIcon />,
      label: 'Kaart',
      to: '/map',
    },
    {
      icon: <FolderIcon />,
      label: 'Projecten',
      to: '/projecten',
    },
    {
      icon: <SettingsIcon />,
      label: 'Instellingen',
      to: '/instellingen',
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
              key={item.to}
              to={item.to}
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
            <DocumentIcon />
          </div>
          {/* Hover tooltip */}
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Rapporten
          </span>
        </button>
      </div>

      {/* Bottom section: Logout */}
      <div className="mt-auto">
        <button
          onClick={handleLogout}
          className="group relative flex h-12 w-12 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogoutIcon />
          {/* Hover tooltip */}
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Uitloggen
          </span>
        </button>
      </div>
    </nav>
  )
}

// SVG Icons (24x24, stroke-based)

function DashboardIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}
