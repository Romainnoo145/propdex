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
    <div className="flex h-screen w-screen overflow-hidden bg-[#1a1c1e] p-5">
      <div className="flex w-full h-full overflow-hidden rounded-[18px] shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        {/* LEFT · dark pitch panel */}
        <div
          className="relative flex-[1.1] flex flex-col justify-between overflow-hidden bg-[#0E1111] text-white px-16 py-14"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <div
            className="absolute w-[460px] h-[460px] rounded-full pointer-events-none"
            style={{ background: 'rgba(249,168,38,0.08)', filter: 'blur(120px)', top: '-100px', left: '-80px' }}
          />
          {/* Brand, mid, legal go here in later tasks */}
        </div>

        {/* RIGHT · form panel */}
        <div className="flex-1 flex items-center justify-center bg-aura-canvas px-12">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white border border-[#EAEFEF] p-10 shadow-[0_12px_40px_rgba(14,17,17,0.08)] flex flex-col gap-[18px]">
            <div>
              <h2
                className="text-[26px] font-black tracking-tight text-[#0E1111] leading-tight mb-1.5"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Welkom terug.
              </h2>
              <p className="text-[13px] text-[#6b7680] leading-snug">
                Log in met je e-mailadres om verder te gaan.
              </p>
            </div>
            <AuthTabs
              onLogin={login}
              onRegister={register}
              onLoginSuccess={handleSuccess}
              onRegisterSuccess={handleSuccess}
            />
          </div>
        </div>
      </div>

      {/* Demo pill — stays here for now, removed in Task 3 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
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
  )
}
