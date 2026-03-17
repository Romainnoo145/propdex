import { Link, useMatchRoute } from '@tanstack/react-router'
import { Map, Bookmark, Scale } from 'lucide-react'

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
      className="fixed inset-x-0 bottom-0 flex border-t border-neutral-200 bg-aura-glass-white/60 md:hidden"
      style={{ zIndex: 'var(--z-bottom-nav)' }}
    >
      <Link
        to="/map"
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
          matchRoute({ to: '/map' }) ? 'text-aura-amber' : 'text-neutral-600'
        }`}
      >
        <Map size={20} />
        <span className="text-xs">Kaart</span>
      </Link>

      <Link
        to="/opgeslagen"
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
          matchRoute({ to: '/opgeslagen' }) ? 'text-aura-amber' : 'text-neutral-600'
        }`}
      >
        <Bookmark size={20} />
        <span className="text-xs">Opgeslagen</span>
      </Link>

      <Link
        to="/jurisprudentie"
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
          matchRoute({ to: '/jurisprudentie' }) ? 'text-aura-amber' : 'text-neutral-600'
        }`}
      >
        <Scale size={20} />
        <span className="text-xs">Jurisprudentie</span>
      </Link>
    </nav>
  )
}
