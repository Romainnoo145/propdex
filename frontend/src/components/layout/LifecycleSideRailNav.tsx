import { Link, useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { LIFECYCLE_PHASES, type LifecyclePhaseKey } from '@/lib/lifecycle/phases'

interface Props {
  /** Currently-active phase. If undefined, no phase pill renders. */
  activePhaseKey?: LifecyclePhaseKey
}

export default function LifecycleSideRailNav({ activePhaseKey }: Props) {
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
      {/* Top: Logo */}
      <div className="w-full flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full overflow-hidden">
          <img
            src="/images/propdex-logo.svg"
            alt="Propdex"
            className="h-16 w-16"
          />
        </div>
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

          if (phase.enabled) {
            return (
              <div key={phase.key} className="w-full flex justify-center">
                <Link
                  to="/opgeslagen"
                  search={{ stage: undefined }}
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
