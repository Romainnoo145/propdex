import type { ReactNode } from 'react'
import { WorkspaceMetricCard } from './WijkView'
import { BackArrowIcon, MapPinLineIcon, BellStatIcon } from './ProjectIcons'

// ---------------------------------------------------------------------------
// ProjectWorkspaceHeader
// ---------------------------------------------------------------------------

export function ProjectWorkspaceHeader({
  title,
  subtitle,
  metrics,
  onBack,
  backLabel = 'Terug',
  actionLabel,
  onAction,
  extraActions,
}: {
  title: string
  subtitle?: string
  metrics: Array<{
    label: string
    value: number
    icon: ReactNode
    highlight?: boolean
  }>
  onBack?: () => void
  backLabel?: string
  actionLabel: string
  onAction?: () => void
  extraActions?: ReactNode
}) {
  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-5 py-5 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute -right-20 -top-16 h-52 w-52 rounded-full bg-aura-amber/10 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-36 w-36 rounded-full bg-neutral-50 blur-3xl" />
      <div className="relative">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {onBack && (
              <button
                onClick={onBack}
                className="mb-3 flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-700"
              >
                <BackArrowIcon />
                {backLabel}
              </button>
            )}
            <h1 className="text-2xl font-semibold text-aura-ink sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {extraActions}
            <button
              onClick={onAction}
              disabled={!onAction}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/[0.1] bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-aura-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MapPinLineIcon />
              {actionLabel}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metrics.map((metric) => (
            <WorkspaceMetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              icon={metric.icon}
              highlight={metric.highlight}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MonitoringToggleAction
// ---------------------------------------------------------------------------

export function MonitoringToggleAction({
  enabled,
  pending,
  onClick,
}: {
  enabled: boolean
  pending: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        enabled
          ? 'border-aura-amber/35 bg-aura-amber/12 text-aura-amber hover:bg-aura-amber/18'
          : 'border-neutral-200/[0.1] bg-neutral-50 text-neutral-700 hover:bg-neutral-50 hover:text-aura-ink'
      }`}
    >
      <BellStatIcon />
      {pending ? 'Opslaan...' : enabled ? 'Meldingen aan' : 'Meldingen ontvangen'}
    </button>
  )
}
