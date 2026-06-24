import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * Layout-route voor /rapport-v2: rendert alleen <Outlet/> zodat de kind-routes
 * (index = adres-typer, splitsing/$parcelId, dakkapel/$parcelId) tonen. De
 * adres-typer is verplaatst naar rapport-v2.index.tsx — zonder Outlet hier zou
 * de parent de kinderen overschrijven (TanStack nesting).
 */
export const Route = createFileRoute('/_authenticated/rapport-v2')({
  component: () => <Outlet />,
})
