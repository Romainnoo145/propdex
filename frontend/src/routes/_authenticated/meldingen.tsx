import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Redirect stub — /meldingen moved to gemeente modal in M002-S03.
 * Meldingen feed is now accessible via GemeenteContextPanel → Meldingen card.
 */
export const Route = createFileRoute('/_authenticated/meldingen')({
  beforeLoad: () => {
    throw redirect({ to: '/map' })
  },
})
