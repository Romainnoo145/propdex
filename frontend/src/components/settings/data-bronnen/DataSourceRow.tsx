/**
 * DataSourceRow — M049/S03
 *
 * Minimal list-row for one data-source slot:
 *   [status icon] [label]   [last_checked]                [ghost icon actions]
 *
 * Status differentiation lives in the leading icon — direct scanability
 * across 20+ rows. StatusPill dropped (icon carries semantic).
 *
 * Type A "missing" hides the refresh button (only upload is meaningful).
 *
 * Aura tokens locked in 03-CONTEXT.md §5.
 * Tooltip: CSS group/group-hover pattern (project convention, no Radix).
 */
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  MinusCircle,
  RefreshCw,
  Settings2,
  Upload,
} from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatRelativeNL } from '@/lib/utils/datetime'
import { useRefreshDataSource } from '@/lib/queries/data-sources-admin'
import type {
  Action,
  ActionType,
  DataSourceRow as DataSourceRowDTO,
  SourceStatus,
} from '@/lib/types/data-sources-admin'

interface Props {
  gemeenteCode: string
  row: DataSourceRowDTO
  onUpload?: (sourceKey: string) => void        // called when Upload button clicked
  onViewVersions?: (sourceKey: string) => void  // called when Bekijk versies clicked
  onConfigureCredential?: (sourceKey: string) => void // M049/S05: Type-C credential modal
}

const ACTION_ICON: Record<ActionType, typeof Upload> = {
  upload: Upload,
  refresh: RefreshCw,
  view_versions: History,
  configure_credential: Settings2,
}

const STATUS_ICON: Record<
  SourceStatus,
  { Icon: typeof AlertTriangle; className: string; label: string }
> = {
  missing: {
    Icon: AlertTriangle,
    className: 'text-[#F9A826]',
    label: 'Ontbreekt',
  },
  broken: {
    Icon: AlertCircle,
    className: 'text-red-500',
    label: 'Foutmelding',
  },
  live: {
    Icon: CheckCircle2,
    className: 'text-[#22C55E]',
    label: 'Live',
  },
  not_applicable: {
    Icon: MinusCircle,
    className: 'text-slate-400',
    label: 'Niet van toepassing',
  },
}

export function DataSourceRow({
  gemeenteCode,
  row,
  onUpload,
  onViewVersions,
  onConfigureCredential,
}: Props) {
  const refreshMutation = useRefreshDataSource()
  const isRefreshing =
    refreshMutation.isPending &&
    refreshMutation.variables?.sourceKey === row.source_key &&
    refreshMutation.variables?.gemeenteCode === gemeenteCode

  const status = STATUS_ICON[row.status]
  const StatusIcon = status.Icon

  // Type A "missing" → only upload action is meaningful; hide refresh
  const actions =
    row.source_type === 'A' && row.status === 'missing'
      ? row.available_actions.filter((a) => a.action !== 'refresh')
      : row.available_actions

  return (
    <div
      className="group flex items-center gap-3 py-3 border-b border-slate-200/60 last:border-b-0"
      data-source-key={row.source_key}
      data-status={row.status}
    >
      {row.status === 'broken' && row.error_message ? (
        <Tooltip content={row.error_message} side="top">
          <StatusIcon
            size={18}
            strokeWidth={2}
            className={`shrink-0 ${status.className}`}
            aria-label={status.label}
          />
        </Tooltip>
      ) : (
        <StatusIcon
          size={18}
          strokeWidth={2}
          className={`shrink-0 ${status.className}`}
          aria-label={status.label}
        />
      )}

      <span className="text-[13px] font-medium text-[#0E1111] truncate flex-1 min-w-0">
        {row.label_nl}
      </span>

      {row.last_checked && (
        <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
          {formatRelativeNL(row.last_checked)}
        </span>
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        {actions.map((action) => (
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
            onUpload={onUpload}
            onViewVersions={onViewVersions}
            onConfigureCredential={onConfigureCredential}
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
  onUpload?: (sourceKey: string) => void
  onViewVersions?: (sourceKey: string) => void
  onConfigureCredential?: (sourceKey: string) => void
}

function ActionButton({
  action,
  sourceKey,
  isRefreshing,
  onRefresh,
  onUpload,
  onViewVersions,
  onConfigureCredential,
}: ActionButtonProps) {
  const Icon =
    isRefreshing && action.action === 'refresh' ? Loader2 : ACTION_ICON[action.action]
  const isDisabled = !action.enabled || isRefreshing
  const baseClass =
    'inline-flex items-center justify-center size-8 rounded-full transition-colors'
  const enabledClass = 'text-slate-500 hover:text-[#0E1111] hover:bg-slate-100'
  const disabledClass = 'text-slate-300 cursor-not-allowed'

  if (action.action === 'upload' && action.enabled) {
    return (
      <button
        type="button"
        onClick={() => onUpload?.(sourceKey)}
        className={`${baseClass} ${enabledClass}`}
        aria-label={action.label_nl}
        title={action.label_nl}
        data-action={action.action}
        data-enabled="true"
      >
        <Icon size={15} strokeWidth={1.75} />
      </button>
    )
  }

  if (action.action === 'view_versions' && action.enabled) {
    return (
      <button
        type="button"
        onClick={() => onViewVersions?.(sourceKey)}
        className={`${baseClass} ${enabledClass}`}
        aria-label={action.label_nl}
        title={action.label_nl}
        data-action={action.action}
        data-enabled="true"
      >
        <Icon size={15} strokeWidth={1.75} />
      </button>
    )
  }

  if (action.action === 'configure_credential' && action.enabled) {
    return (
      <button
        type="button"
        onClick={() => onConfigureCredential?.(sourceKey)}
        className={`${baseClass} ${enabledClass}`}
        aria-label={action.label_nl}
        title={action.label_nl}
        data-action={action.action}
        data-enabled="true"
      >
        <Icon size={15} strokeWidth={1.75} />
      </button>
    )
  }

  const btn = (
    <button
      type="button"
      disabled={isDisabled}
      onClick={action.action === 'refresh' && action.enabled ? onRefresh : undefined}
      className={`${baseClass} ${isDisabled ? disabledClass : enabledClass}`}
      aria-label={action.label_nl}
      title={action.label_nl}
      data-action={action.action}
      data-enabled={action.enabled ? 'true' : 'false'}
    >
      <Icon
        size={15}
        strokeWidth={1.75}
        className={isRefreshing ? 'animate-spin' : ''}
      />
    </button>
  )

  // Only show custom tooltip when disabled (to explain WHY)
  if (!action.enabled && action.reason_disabled) {
    return (
      <Tooltip content={action.reason_disabled} side="top">
        {btn}
      </Tooltip>
    )
  }

  return btn
}
