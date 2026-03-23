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
    <div className="flex min-h-screen">
      {/* ── Left: auth form ─────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-aura-canvas px-8">
        <div className="w-full max-w-md space-y-8">
          {/* Branding */}
          <div className="flex flex-col items-center gap-4">
            <img
              src="/images/propdex-logo.svg"
              alt="Propdex"
              className="h-20 w-20 rounded-[20px]"
            />
            <div className="text-center">
              <h1
                className="text-[32px] font-black tracking-tight text-[#0E1111]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Propdex
              </h1>
              <p className="mt-1 text-[13px] font-medium text-neutral-400">
                Property Intelligence Platform
              </p>
            </div>
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
              className="inline-flex items-center gap-2 rounded-full bg-[#0E1111] px-5 py-2.5 text-[12px] font-bold text-white transition-all hover:bg-[#1a1c1e] hover:shadow-lg"
            >
              <span className="h-2 w-2 rounded-full bg-[#F9A826] animate-pulse" />
              Demo login as info@klarifai.nl
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: hero panel ──────────────────────────── */}
      <div
        className="hidden lg:flex flex-1 flex-col items-center justify-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0E1111 0%, #1a2332 50%, #0E1111 100%)',
        }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Amber glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(249,168,38,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-8 px-12 text-center max-w-lg">
          <img
            src="/images/propdex-logo.svg"
            alt=""
            className="h-32 w-32 rounded-[28px] shadow-2xl"
          />

          <div>
            <h2
              className="text-[28px] font-black tracking-tight text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Vastgoed-intelligence
              <br />
              <span className="text-[#F9A826]">op een nieuwe manier</span>
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-white/40">
              Vergunningen · Jurisprudentie · Raadsinformatie · Erfgoed · Subsidies
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-8 mt-4">
            <div className="text-center">
              <span className="block text-[28px] font-black tabular-nums text-white">345+</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Gemeenten</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <span className="block text-[28px] font-black tabular-nums text-[#F9A826]">21</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Databronnen</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <span className="block text-[28px] font-black tabular-nums text-white">100%</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Open data</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
