import { Link, useMatchRoute } from '@tanstack/react-router'
import { Map, FolderOpen, FileText } from 'lucide-react'

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

  return (
    <nav
      className="fixed inset-x-0 bottom-0 flex border-t border-grey-800 bg-grey-900 md:hidden"
      style={{ zIndex: 'var(--z-bottom-nav)' }}
    >
      <Link
        to="/map"
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
          matchRoute({ to: '/map' }) ? 'text-amber-accent' : 'text-grey-400'
        }`}
      >
        <Map size={20} />
        <span className="text-xs">Kaart</span>
      </Link>

      <Link
        to="/projecten"
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
          matchRoute({ to: '/projecten' }) ? 'text-amber-accent' : 'text-grey-400'
        }`}
      >
        <FolderOpen size={20} />
        <span className="text-xs">Projecten</span>
      </Link>

      <Link
        to="/rapporten"
        search={{ project_id: undefined, q: undefined }}
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
          matchRoute({ to: '/rapporten' }) ? 'text-amber-accent' : 'text-grey-400'
        }`}
      >
        <FileText size={20} />
        <span className="text-xs">Rapporten</span>
      </Link>
    </nav>
  )
}
