import { useNavigate, useSearch } from '@tanstack/react-router'
import { motion } from 'framer-motion'

interface PortfolioModeToggleProps {
  isPortfolioMode: boolean
}

const OPTIONS = [
  { label: 'Werkruimte', value: false },
  { label: 'Portfolio', value: true },
] as const

/**
 * Pill toggle to switch between Werkruimte (workspace) and Portfolio mode.
 *
 * Uses portfolio_mode URL search param. When switching modes, clears the
 * conflicting params from the other mode to avoid stale navigation state.
 */
export function PortfolioModeToggle({ isPortfolioMode }: PortfolioModeToggleProps) {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/projecten' })

  const switchTo = (portfolio: boolean) => {
    if (portfolio === isPortfolioMode) return

    if (portfolio) {
      // Switch to portfolio — clear workspace params
      navigate({
        to: '/projecten',
        search: {
          portfolio_mode: true,
          portfolio_provincie: undefined,
          portfolio_gemeente: undefined,
          portfolio_wijk: undefined,
          gemeente_id: undefined,
          gemeente_code: undefined,
          wijk_id: undefined,
        },
      })
    } else {
      // Switch to workspace — clear portfolio params, restore previous provincie_code
      navigate({
        to: '/projecten',
        search: {
          provincie_code: search.provincie_code,
          portfolio_mode: undefined,
          portfolio_provincie: undefined,
          portfolio_gemeente: undefined,
          portfolio_wijk: undefined,
        },
      })
    }
  }

  return (
    <div
      className="inline-flex items-center rounded-full bg-[#F2F6F3] p-1 gap-0.5"
      role="tablist"
      aria-label="Weergave modus"
    >
      {OPTIONS.map((option) => {
        const isActive = option.value === isPortfolioMode
        return (
          <button
            key={String(option.value)}
            role="tab"
            aria-selected={isActive}
            onClick={() => switchTo(option.value)}
            className="relative rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aura-amber"
          >
            {isActive && (
              <motion.span
                layoutId="portfolio-mode"
                className="absolute inset-0 rounded-full bg-aura-obsidian"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className={`relative z-10 ${isActive ? 'text-white' : 'text-neutral-600'}`}>
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
