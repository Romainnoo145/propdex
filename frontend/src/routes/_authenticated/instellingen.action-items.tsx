/**
 * /instellingen/action-items — DEPRECATED redirect route (M049/S06).
 *
 * The legacy ActionItems page (formerly under /documentatie?tab=acties) is
 * fully deprecated. All ActionItem content lives as the 'view_action_item'
 * action-button on /instellingen/data-bronnen rows.
 *
 * This route exists ONLY to satisfy MIG-02 (ROADMAP success criterion #2):
 *   `/instellingen/action-items` MUST redirect to /instellingen/data-bronnen.
 *
 * Chain: /instellingen/action-items
 *      → /instellingen/data-bronnen           (this redirect)
 *      → /instellingen/data-bronnen/{first-gemeente-code}
 *                                              (handled by instellingen.data-bronnen.index.tsx)
 *
 * AUTH NOTE: Unlike sibling `instellingen.beleid-beheer.tsx` (which gates on
 * `context.auth.user?.is_superuser` before mounting its component), this route
 * intentionally does NOT gate on superuser. Rationale:
 *   1. The route never mounts a component — beforeLoad throws unconditionally.
 *   2. Auth is enforced at every step of the redirect chain:
 *      - The `_authenticated` parent route gates unauthenticated users
 *      - `/instellingen/data-bronnen` (and its `$gemeenteCode` child) handles
 *        its own superuser gating; non-superusers land there and get the
 *        appropriate 403/redirect from THAT route's beforeLoad
 *   3. A redirect-only route adding ITS OWN superuser gate would create a
 *      double-gate (this route + target) — net behavior identical, but with
 *      a redundant redirect hop for non-superusers (→ /instellingen instead
 *      of allowing target route to decide). We let the target route own auth.
 *
 * Equivalent of HTTP 301 in SPA-context: client-side redirect via TanStack
 * Router's `redirect()` thrown in `beforeLoad` (route never mounts a component).
 * External users hitting bookmarks land on the live data-bronnen hub.
 */
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/instellingen/action-items',
)({
  beforeLoad: () => {
    throw redirect({
      to: '/instellingen/data-bronnen',
    })
  },
  // Component intentionally absent — route never mounts because beforeLoad
  // throws unconditionally.
})
