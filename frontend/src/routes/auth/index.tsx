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
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/map' })
    }
  },
  component: AuthPage,
})

function AuthPage() {
  const { login, register } = useAuth()
  const search = Route.useSearch()
  const navigate = useNavigate()

  const handleSuccess = () => {
    navigate({ to: search.redirect || '/map' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-aura-canvas">
      {/* Obsidian container */}
      <div className="w-full max-w-lg rounded-[32px] bg-[#0E1111] p-8 shadow-2xl">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <img
            src="/images/propdex-logo.svg"
            alt="Propdex"
            className="h-16 w-16 rounded-[16px]"
          />
          <h1
            className="text-[24px] font-black tracking-tight text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Propdex
          </h1>
        </div>

        {/* Auth card */}
        <AuthTabs
          onLogin={login}
          onRegister={register}
          onLoginSuccess={handleSuccess}
          onRegisterSuccess={handleSuccess}
        />
      </div>
    </div>
  )
}
