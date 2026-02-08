import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import SideRailNav from '@/components/layout/SideRailNav'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/auth',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <div className="flex h-screen">
      <SideRailNav />
      <main className="flex-1 relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
