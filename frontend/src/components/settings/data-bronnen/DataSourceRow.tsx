/**
 * DataSourceRow — M049/S03
 *
 * Pure-Glass card row for one data-source slot. Composes:
 *   [label + source_type badge]  [StatusPill]  [last_checked relative]  [actions]
 *
 * Action handling:
 *   - refresh action wired to useRefreshDataSource mutation
 *   - other actions (upload / view_versions / configure_credential) are placeholders
 *     for S04/S05; rendered as disabled buttons with tooltip when not enabled
 *
 * Aura tokens locked in 03-CONTEXT.md §5.
 * Tooltip: CSS group/group-hover pattern (project convention, no Radix).
 */
import { History, Loader2, RefreshCw, Settings2, Upload } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatRelativeNL } from '@/lib/utils/datetime'
import { useRefreshDataSource } from '@/lib/queries/data-sources-admin'
import type {
  Action,
  ActionType,
  DataSourceRow as DataSourceRowDTO,
  SourceType,
} from '@/lib/types/data-sources-admin'
import { StatusPill } from './StatusPill'

interface Props {
  gemeenteCode: string
  row: DataSourceRowDTO
}

const SOURCE_TYPE_BADGE: Record<SourceType, { className: string; label: string }> = {
  A: { className: 'bg-[#D1E2D8]/40 text-[#0E1111]', label: 'Beleid' },
  B: { className: 'bg-slate-100 text-slate-700', label: 'API' },
  C: { className: 'bg-[#F9A826]/15 text-[#F9A826]', label: 'Integratie' },
}

const ACTION_ICON: Record<ActionType, typeof Upload> = {
  upload: Upload,
  refresh: RefreshCw,
  view_versions: History,
  configure_credential: Settings2,
}

export function DataSourceRow({ gemeenteCode, row }: Props) {
  const refreshMutation = useRefreshDataSource()
  const isRefreshing =
    refreshMutation.isPending &&
    refreshMutation.variables?.sourceKey === row.source_key &&
    refreshMutation.variables?.gemeenteCode === gemeenteCode

  const badge = SOURCE_TYPE_BADGE[row.source_type]

  return (
    <div
      className="bg-white/60 backdrop-blur-[24px] border border-white/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4"
      data-source-key={row.source_key}
    >
      {/* Column 1: label + type badge */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-semibold text-[#0E1111] truncate">
          {row.label_nl}
        </span>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
          data-source-type={row.source_type}
        >
          {badge.label}
        </span>
      </div>

      {/* Column 2: status pill */}
      <StatusPill status={row.status} errorMessage={row.error_message} />

      {/* Column 3: last_checked relative */}
      <span className="text-[11px] text-slate-500">
        {row.last_checked ? formatRelativeNL(row.last_checked) : 'Nog niet gecheckt'}
      </span>

      {/* Column 4: actions (ml-auto pushes right on md+) */}
      <div className="flex items-center gap-1 md:ml-auto">
        {row.available_actions.map((action) => (
          <ActionButton
            key={action.action}
            action={action}
            gemeenteCode={gemeenteCode}
            sourceKey={row.source_key}
            sourceLabel={row.label_nl}
            isRefreshing={isRefreshing && action.action === 'refresh'}
            onRefresh={() =>
              refreshMutation.mutate({
                gemeenteCode,
                sourceKey: row.source_key,
                sourceLabel: row.label_nl,
              })
            }
          />
        ))}
      </div>
    </div>
  )
}

interface ActionButtonProps {
  action: Action
  gemeenteCode: string
  sourceKey: string
  sourceLabel: string
  isRefreshing: boolean
  onRefresh: () => void
}

function ActionButton({
  action,
  isRefreshing,
  onRefresh,
}: ActionButtonProps) {
  const Icon =
    isRefreshing && action.action === 'refresh' ? Loader2 : ACTION_ICON[action.action]
  const isDisabled = !action.enabled || isRefreshing
  const baseClass =
    'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors'
  const enabledClass = 'bg-[#0E1111] text-white hover:opacity-90'
  const disabledClass = 'bg-slate-100 text-slate-400 cursor-not-allowed'

  // Upload is a deep-link to /instellingen/beleid-beheer per 03-CONTEXT.md §12
  if (action.action === 'upload' && action.enabled) {
    return (
      <Link
        to="/instellingen/beleid-beheer"
        className={`${baseClass} ${enabledClass}`}
        data-action={action.action}
        data-enabled="true"
      >
        <Icon size={14} strokeWidth={2} />
        <span>{action.label_nl}</span>
      </Link>
    )
  }

  const btn = (
    <button
      type="button"
      disabled={isDisabled}
      onClick={action.action === 'refresh' && action.enabled ? onRefresh : undefined}
      className={`${baseClass} ${isDisabled ? disabledClass : enabledClass}`}
      data-action={action.action}
      data-enabled={action.enabled ? 'true' : 'false'}
    >
      <Icon
        size={14}
        strokeWidth={2}
        className={isRefreshing ? 'animate-spin' : ''}
      />
      <span>{action.label_nl}</span>
    </button>
  )

  if (!action.enabled && action.reason_disabled) {
    return (
      <Tooltip content={action.reason_disabled} side="top">
        {btn}
      </Tooltip>
    )
  }

  return btn
}
