import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Redirect stub — /projecten is removed from nav in M002-S01.
 * Kept as redirect (not deleted) because ParcelDetailPanel.tsx and other
 * components navigate here and cannot be modified per KNOWLEDGE.md.
 */
export const Route = createFileRoute('/_authenticated/projecten')({
  beforeLoad: () => {
    throw redirect({ to: '/opgeslagen' })
  },
})
