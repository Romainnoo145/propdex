import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { AuthTabs } from '@/components/auth/AuthTabs'
import { useAuth } from '@/lib/auth/useAuth'

interface AuthSearch {
  redirect?: string
}

export const Route = createFileRoute('/auth/')({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: (search.redirect as string) || undefined,
  }),
  beforeLoad: ({ context }) => {
    // Already authenticated? Redirect to map
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/map' })
    }
  },
  component: AuthPage,
})

function AuthPage() {
  const { login, register, loginAsDemo } = useAuth()
  const search = Route.useSearch()
  const navigate = useNavigate()

  const handleSuccess = () => {
    navigate({ to: search.redirect || '/map' })
  }

  const handleDemo = () => {
    loginAsDemo()
    handleSuccess()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grey-950">
      <div className="w-full max-w-md space-y-6">
        {/* Propdex branding */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-grey-100">Propdex</h1>
          <p className="mt-2 text-sm text-grey-400">
            Property Intelligence Platform
          </p>
        </div>

        {/* Auth tabs */}
        <AuthTabs
          onLogin={login}
          onRegister={register}
          onLoginSuccess={handleSuccess}
          onRegisterSuccess={handleSuccess}
        />

        {/* Demo login */}
        <div className="text-center">
          <button
            onClick={handleDemo}
            className="text-sm text-grey-400 underline hover:text-grey-100"
          >
            Demo login as info@klarifai.nl
          </button>
        </div>
      </div>
    </div>
  )
}
