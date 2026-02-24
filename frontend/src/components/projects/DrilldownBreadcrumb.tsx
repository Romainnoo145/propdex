import { useNavigate, useSearch } from '@tanstack/react-router'

interface DrilldownBreadcrumbProps {
  gemeenteName?: string
  wijkName?: string
}

/**
 * Breadcrumb for project drill-down navigation.
 *
 * Reads gemeente_id / wijk_id from URL search params and renders
 * clickable path segments: Projecten / GemeenteName / WijkName.
 * Returns null at the top level (gemeente grid) — the page h1 suffices.
 */
export function DrilldownBreadcrumb({
  gemeenteName,
  wijkName,
}: DrilldownBreadcrumbProps) {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/projecten' })

  // Top level — no breadcrumb needed
  if (!search.gemeente_id) return null

  return (
    <nav className="flex items-center gap-2 text-sm mb-4">
      <button
        onClick={() => navigate({ to: '/projecten', search: {} })}
        className="text-grey-400 hover:text-grey-100 hover:underline underline-offset-2 transition-colors"
      >
        Projecten
      </button>

      <span className="text-grey-700">{'\u203a'}</span>

      {search.wijk_id && gemeenteName ? (
        <>
          <button
            onClick={() =>
              navigate({
                to: '/projecten',
                search: { gemeente_id: search.gemeente_id },
              })
            }
            className="text-grey-400 hover:text-grey-100 hover:underline underline-offset-2 transition-colors"
          >
            {gemeenteName}
          </button>
          <span className="text-grey-700">{'\u203a'}</span>
          <span className="font-medium text-grey-100">{wijkName}</span>
        </>
      ) : (
        <span className="font-medium text-grey-100">{gemeenteName}</span>
      )}
    </nav>
  )
}
