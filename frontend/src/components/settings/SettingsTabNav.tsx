import { Link, useMatchRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

/**
 * Tab navigation for settings pages
 *
 * Shows two tabs:
 * - Account → /instellingen
 * - Score profiel → /instellingen/score
 *
 * Active tab: bg-aura-obsidian text-white rounded-full pill
 * Inactive: text-aura-ink hover:bg-[#F2F6F3]
 */
export function SettingsTabNav() {
  const matchRoute = useMatchRoute()

  const isScoreActive = !!matchRoute({ to: '/instellingen/score' })
  const isAccountActive = !isScoreActive

  return (
    <nav className="flex gap-1 rounded-full bg-neutral-100 p-1 w-fit">
      <Link
        to="/instellingen"
        className={cn(
          'px-5 py-2 rounded-full text-sm font-medium transition-colors',
          isAccountActive
            ? 'bg-aura-obsidian text-white'
            : 'text-aura-ink hover:bg-[#F2F6F3]',
        )}
      >
        Account
      </Link>
      <Link
        to="/instellingen/score"
        className={cn(
          'px-5 py-2 rounded-full text-sm font-medium transition-colors',
          isScoreActive
            ? 'bg-aura-obsidian text-white'
            : 'text-aura-ink hover:bg-[#F2F6F3]',
        )}
      >
        Score profiel
      </Link>
    </nav>
  )
}
