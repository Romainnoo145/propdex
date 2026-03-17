import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Redirect stub — /rapporten is removed from nav in M002-S01.
 * Kept as redirect (not deleted) because ParcelDetailPanel.tsx
 * navigates here and cannot be modified per KNOWLEDGE.md.
 */
export const Route = createFileRoute('/_authenticated/rapporten')({
  beforeLoad: () => {
    throw redirect({ to: '/opgeslagen' })
  },
})
