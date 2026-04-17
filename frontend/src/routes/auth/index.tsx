import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import { AuthTabs } from '@/components/auth/AuthTabs'
import { useAuth } from '@/lib/auth/useAuth'

interface AuthSearch {
  redirect?: string
}

const DEMO_EMAIL = 'demo@klarifai.nl'
const DEMO_PASSWORD = 'Propdexdemo456!'

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
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)

  const handleSuccess = () => {
    navigate({ to: search.redirect || '/map' })
  }

  const handleDemoLogin = async () => {
    setDemoError(null)
    setDemoLoading(true)
    try {
      await login(DEMO_EMAIL, DEMO_PASSWORD)
      handleSuccess()
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : 'Demo login mislukt')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-aura-canvas px-4">
      <div className="w-full max-w-[420px]">
        {/* Logo + name */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <img
            src="/images/propdex-logo.svg"
            alt="Propdex"
            className="h-16 w-16 rounded-[16px]"
          />
          <h1
            className="text-[28px] font-black tracking-tight text-[#0E1111]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Propdex
          </h1>
        </div>

        {/* Card */}
        <div className="rounded-[24px] bg-white border border-[#EAEFEF] p-6 shadow-lg">
          <AuthTabs
            onLogin={login}
            onRegister={register}
            onLoginSuccess={handleSuccess}
            onRegisterSuccess={handleSuccess}
          />
        </div>

        {/* Demo login */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading}
            className="inline-flex items-center gap-2 rounded-full border border-[#EAEFEF] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#0E1111] hover:bg-[#F2F6F3] disabled:opacity-50 transition-colors"
          >
            <Sparkles size={14} className="text-[#F9A826]" />
            {demoLoading ? 'Bezig met inloggen…' : 'Probeer de demo'}
          </button>
          {demoError && (
            <p role="alert" className="text-[12px] text-red-500">
              {demoError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
