import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/useAuth'

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
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/auth' })
  }

  return (
    <>
      <Outlet />
      {/* Temporary logout button — will move to sidebar in Phase 16/17 */}
      <button
        onClick={handleLogout}
        className="fixed bottom-4 right-4 rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur-md hover:bg-black/70"
        style={{ zIndex: 'var(--z-map-controls)' }}
      >
        Logout
      </button>
    </>
  )
}
