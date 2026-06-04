import { createFileRoute, Outlet } from '@tanstack/react-router'

// Thin layout: renders ONLY <Outlet/> so both the index (Onderzoek workspace)
// and the $phase children (e.g. Contact) render. The actual Onderzoek view
// lives in opgeslagen.perceel.$parcelId.index.tsx.
export const Route = createFileRoute('/_authenticated/opgeslagen/perceel/$parcelId')({
  component: () => <Outlet />,
})
