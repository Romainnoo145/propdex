/**
 * /instellingen/data-bronnen — pathless layout (M049/S03)
 *
 * Layout-only: superuser gate + Outlet for index/detail children.
 * Index logic (auto-redirect to first gemeente) lives in `.index.tsx`.
 * Detail view lives in `.$gemeenteCode.tsx`.
 */
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/instellingen/data-bronnen',
)({
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.is_superuser) {
      throw redirect({ to: '/instellingen' })
    }
  },
  component: () => <Outlet />,
})
