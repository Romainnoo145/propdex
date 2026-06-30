import { Link, useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowLeft, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { LIFECYCLE_PHASES, type LifecyclePhaseKey } from '@/lib/lifecycle/phases'
import { phaseLinkTarget } from './phaseLinkTarget'

interface Props {
  /** Currently-active phase. If undefined, no phase pill renders. */
  activePhaseKey?: LifecyclePhaseKey
  /** Parcel context for phase-route links. If undefined, phases render disabled. */
  parcelId?: string
}

export default function LifecycleSideRailNav({ activePhaseKey, parcelId }: Props) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/auth' })
  }

  return (
    <nav
      aria-label="Lifecycle-navigatie"
      className="fixed left-0 top-0 bottom-0 w-[130px] flex flex-col items-center justify-between py-10 z-[100]"
    >
      {/* Top: Logo → exit workspace, back to /opgeslagen list.
          On hover the logo cross-fades into an obsidian circle with an amber
          back-arrow — a clear "go back" affordance instead of a bare ring. */}
      <div className="w-full flex justify-center">
        <Link
          to="/opgeslagen"
          search={{ stage: undefined }}
          aria-label="Terug naar opgeslagen lijst"
          className="group relative flex h-16 w-16 items-center justify-center rounded-full overflow-hidden"
        >
          <img
            src="/images/propdex-logo.svg"
            alt="Propdex"
            className="h-16 w-16 transition-opacity duration-200 group-hover:opacity-0"
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-aura-obsidian">
              <ArrowLeft size={22} strokeWidth={2} className="text-aura-amber" />
            </span>
          </span>
          <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Terug naar opgeslagen
          </span>
        </Link>
      </div>

      {/* Middle: Lifecycle phase icons */}
      <div className="flex flex-col items-center gap-4">
        {LIFECYCLE_PHASES.map((phase) => {
          const Icon = phase.icon
          const isActive = activePhaseKey === phase.key

          const iconClass = isActive
            ? 'text-aura-amber drop-shadow-sm'
            : phase.enabled
              ? 'text-slate-500 group-hover:text-aura-ink'
              : 'text-slate-300'

          const buttonInner = (
            <div className="relative flex h-12 w-12 items-center justify-center">
              {isActive && (
                <motion.div
                  layoutId="lifecycle-sidebar-active"
                  className="absolute inset-0 rounded-full bg-aura-obsidian shadow-[0_0_20px_rgba(14,17,17,0.3)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 transition-colors duration-300 ${iconClass}`}>
                <Icon size={22} strokeWidth={1.5} />
              </span>
            </div>
          )

          const tooltip = (
            <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              {phase.label}
            </span>
          )

          if (phase.enabled && parcelId) {
            return (
              <div key={phase.key} className="w-full flex justify-center">
                <Link
                  {...phaseLinkTarget(phase.key, parcelId)}
                  aria-label={phase.label}
                  className="group relative flex justify-center"
                >
                  {buttonInner}
                  {tooltip}
                </Link>
              </div>
            )
          }

          return (
            <div key={phase.key} className="w-full flex justify-center">
              <button
                disabled
                aria-label={phase.label}
                aria-disabled="true"
                className="group relative flex justify-center cursor-not-allowed opacity-60"
              >
                {buttonInner}
                {tooltip}
              </button>
            </div>
          )
        })}
      </div>

      {/* Bottom: Uitloggen only */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-full flex justify-center">
          <button
            onClick={handleLogout}
            aria-label="Uitloggen"
            className="group relative flex justify-center"
          >
            <div className="relative flex h-12 w-12 items-center justify-center">
              <span className="text-slate-500 transition-colors duration-300 group-hover:text-aura-ink">
                <LogOut size={22} strokeWidth={1.5} />
              </span>
            </div>
            <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Uitloggen
            </span>
          </button>
        </div>
      </div>
    </nav>
  )
}
