import { useNavigate, useSearch } from '@tanstack/react-router'

interface PortfolioBreadcrumbProps {
  /** Resolved display name for the selected province */
  provincieName?: string
  /** Resolved display name for the selected gemeente */
  gemeenteName?: string
  /** Resolved display name for the selected wijk */
  wijkName?: string
}

/**
 * Clickable breadcrumb for portfolio drill-down navigation.
 *
 * Level 1 (province grid): No breadcrumb shown
 * Level 2 (gemeente list): "Projecten › [ProvincieName]"
 * Level 3 (wijk list): "Projecten › [ProvincieName] › [GemeenteName]"
 * Level 4 (parcel list): "Projecten › [ProvincieName] › [GemeenteName] › [WijkName]"
 *
 * Each segment clears deeper portfolio_* params when clicked.
 */
export function PortfolioBreadcrumb({
  provincieName,
  gemeenteName,
  wijkName,
}: PortfolioBreadcrumbProps) {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/projecten' })

  // Level 1 — no breadcrumb at province grid
  if (!search.portfolio_provincie) return null

  const goToRoot = () =>
    navigate({
      to: '/projecten',
      search: {
        portfolio_mode: true,
        portfolio_provincie: undefined,
        portfolio_gemeente: undefined,
        portfolio_wijk: undefined,
      },
    })

  const goToProvincie = () =>
    navigate({
      to: '/projecten',
      search: {
        portfolio_mode: true,
        portfolio_provincie: search.portfolio_provincie,
        portfolio_gemeente: undefined,
        portfolio_wijk: undefined,
      },
    })

  const goToGemeente = () =>
    navigate({
      to: '/projecten',
      search: {
        portfolio_mode: true,
        portfolio_provincie: search.portfolio_provincie,
        portfolio_gemeente: search.portfolio_gemeente,
        portfolio_wijk: undefined,
      },
    })

  const chevron = <span className="text-neutral-400 select-none">{'\u203a'}</span>

  return (
    <nav className="flex items-center gap-2 text-sm mb-4" aria-label="Portfolio navigatie">
      <button
        onClick={goToRoot}
        className="text-neutral-600 hover:text-aura-ink hover:underline underline-offset-2 transition-colors"
      >
        Projecten
      </button>

      {chevron}

      {search.portfolio_gemeente ? (
        <>
          <button
            onClick={goToProvincie}
            className="text-neutral-600 hover:text-aura-ink hover:underline underline-offset-2 transition-colors"
          >
            {provincieName ?? search.portfolio_provincie}
          </button>
          {chevron}
          {search.portfolio_wijk ? (
            <>
              <button
                onClick={goToGemeente}
                className="text-neutral-600 hover:text-aura-ink hover:underline underline-offset-2 transition-colors"
              >
                {gemeenteName ?? search.portfolio_gemeente}
              </button>
              {chevron}
              <span className="font-medium text-aura-ink">
                {wijkName ?? search.portfolio_wijk}
              </span>
            </>
          ) : (
            <span className="font-medium text-aura-ink">
              {gemeenteName ?? search.portfolio_gemeente}
            </span>
          )}
        </>
      ) : (
        <span className="font-medium text-aura-ink">
          {provincieName ?? search.portfolio_provincie}
        </span>
      )}
    </nav>
  )
}
