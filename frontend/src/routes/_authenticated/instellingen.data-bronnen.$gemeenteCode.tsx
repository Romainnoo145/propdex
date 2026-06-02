/**
 * /instellingen/data-bronnen/$gemeenteCode — legacy redirect (scope-consolidation).
 *
 * The gemeente detail page moved to the generalized $entityType/$entityCode
 * route. This route now redirects GM#### URLs there, preserving bookmarks.
 * The ^GM\d{4}$ parseParams guard keeps bad codes 404-ing (no redirect loop).
 */
import { createFileRoute, redirect } from '@tanstack/react-router'

const GEMEENTE_CODE_RE = /^GM\d{4}$/

export const Route = createFileRoute(
  '/_authenticated/instellingen/data-bronnen/$gemeenteCode',
)({
  parseParams: (params) => {
    if (!GEMEENTE_CODE_RE.test(params.gemeenteCode)) {
      throw new Error(`Invalid gemeente code: ${params.gemeenteCode}`)
    }
    return { gemeenteCode: params.gemeenteCode }
  },
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/instellingen/data-bronnen/$entityType/$entityCode',
      params: { entityType: 'gemeente', entityCode: params.gemeenteCode },
    })
  },
})
