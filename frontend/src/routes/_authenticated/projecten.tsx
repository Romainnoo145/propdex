import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

/**
 * Redirect stub — /projecten is removed from nav in M002-S01.
 * Kept as redirect (not deleted) because ParcelDetailPanel.tsx and other
 * components navigate here and cannot be modified per KNOWLEDGE.md.
 *
 * The search schema is retained (even though the route only redirects) so the
 * portfolio components that still read `useSearch({ from: '/_authenticated/projecten' })`
 * keep a typed search shape instead of resolving to `{}`.
 */
const projectenSearchSchema = z.object({
  gemeente_id: z.string().optional(),
  gemeente_code: z.string().optional(),
  wijk_id: z.string().optional(),
  provincie_code: z.string().optional(),
  portfolio_mode: z.boolean().optional(),
  portfolio_provincie: z.string().optional(),
  portfolio_gemeente: z.string().optional(),
  portfolio_wijk: z.string().optional(),
  portfolio_stage: z
    .enum(['Gesignaleerd', 'Onderzoek', 'Contact', 'Besluit', 'Afgerond'])
    .optional(),
})

export const Route = createFileRoute('/_authenticated/projecten')({
  validateSearch: projectenSearchSchema,
  beforeLoad: () => {
    throw redirect({ to: '/opgeslagen' })
  },
})
