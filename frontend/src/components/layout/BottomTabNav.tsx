import { Link, useMatchRoute } from '@tanstack/react-router'
import { Map, FolderOpen, FileText } from 'lucide-react'

interface NavItem {
  icon: React.ReactNode
  label: string
  to: string
}

/**
 * Bottom tab bar navigation for mobile viewports.
 *
 * Provides mobile-first navigation as a replacement for SideRailNav on small screens.
 * Rendered fixed at the bottom of the viewport, hidden at md+ breakpoint.
 * z-index matches SideRailNav (--z-bottom-nav: 250) since they never coexist.
 *
 * Touch targets: 56px height — exceeds 44px MOB-03 requirement.
 */
export default function BottomTabNav() {
  const matchRoute = useMatchRoute()

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
    {
      icon: <FileText size={20} />,
      label: 'Rapporten',
      to: '/rapporten',
    },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 flex md:hidden border-t border-grey-800 bg-grey-900"
      style={{ zIndex: 'var(--z-bottom-nav)' }}
    >
      {navItems.map((item) => {
        const isActive = matchRoute({ to: item.to })
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-1 flex-col items-center justify-center min-h-[56px] gap-0.5 transition-colors ${
              isActive ? 'text-amber-accent' : 'text-grey-400'
            }`}
          >
            {item.icon}
            <span className="text-xs">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
