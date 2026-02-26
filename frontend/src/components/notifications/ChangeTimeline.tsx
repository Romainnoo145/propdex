/**
 * Change timeline component for displaying project change history.
 *
 * Variants:
 * - timeline: classic expandable feed (default)
 * - inbox: master-detail inbox layout used in gemeente detail
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useProjectChanges } from '@/hooks/useNotifications'
import { useReadTracking } from '@/hooks/useReadTracking'
import type { ChangeRecord } from '@/lib/types/monitoring'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { extractHuisnummer, formatPostcode } from '@/lib/utils/address'
import { formatDate, formatRelativeTime } from '@/lib/utils/date'

interface ChangeTimelineProps {
  projectId: string
  unreadCount?: number
  variant?: 'timeline' | 'inbox'
}

export default function ChangeTimeline({
  projectId,
  variant = 'timeline',
}: ChangeTimelineProps) {
  const { data, isLoading, error, refetch } = useProjectChanges(
    projectId,
    true
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const navigate = useNavigate()

  const {
    readIds,
    handleToggle,
    handleGenerateReport,
    handleGenerateReportByAddress,
    generatingId,
  } = useReadTracking({ readChangeIds: data?.read_change_ids })

  const changes = data?.changes ?? []

  const groupedChanges = useMemo(
    () =>
      changes.reduce<Record<string, ChangeRecord[]>>((acc, change) => {
        const dateKey = change.change_date.split('T')[0]
        if (!dateKey) return acc
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(change)
        return acc
      }, {}),
    [changes]
  )

  const sortedDates = useMemo(
    () => Object.keys(groupedChanges).sort().reverse(),
    [groupedChanges]
  )

  useEffect(() => {
    if (variant !== 'inbox') return
    if (changes.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    if (!selectedId || !changes.some((change) => change.id === selectedId)) {
      setSelectedId(changes[0]!.id)
    }
  }, [variant, changes, selectedId])

  const selectedChange = useMemo(
    () => changes.find((change) => change.id === selectedId) ?? null,
    [changes, selectedId]
  )

  if (isLoading) {
    return (
      <div className="px-5 py-4 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-5 py-4">
        <ErrorState
          message="Fout bij laden wijzigingen"
          actions={[{ label: 'Opnieuw proberen', onClick: () => refetch() }]}
          className="py-6"
        />
      </div>
    )
  }

  if (changes.length === 0) {
    return (
      <div className="px-5 py-4">
        <EmptyState
          title="Geen wijzigingen gedetecteerd"
          description="Wanneer er bestemmingsplan- of vergunningswijzigingen zijn, verschijnen ze hier."
          className="py-6"
        />
      </div>
    )
  }

  if (variant === 'inbox') {
    return (
      <div className="bg-grey-900/50 px-3 pb-3 pt-4 sm:px-4 sm:pb-4 sm:pt-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.65fr)]">
          <div className="overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-900">
            <div className="max-h-[560px] overflow-y-auto p-3">
              <div className="space-y-5">
                {sortedDates.map((dateKey) => {
                  const dateChanges = groupedChanges[dateKey]!
                  return (
                    <div key={dateKey}>
                      <div className="mb-2 flex items-center gap-2">
                        <div className="h-px flex-1 bg-overlay/[0.08]" />
                        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-grey-500">
                          {formatTimelineDateLabel(dateKey).toUpperCase()}
                        </h2>
                        <div className="h-px flex-1 bg-overlay/[0.08]" />
                      </div>

                      <div className="space-y-1.5">
                        {dateChanges.map((change) => (
                          <ChangeInboxItem
                            key={change.id}
                            change={change}
                            isActive={selectedId === change.id}
                            isRead={readIds.has(change.id)}
                            onClick={() => handleToggle(change.id, null, setSelectedId)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <ChangeDetailPanel
            change={selectedChange}
            onNavigate={navigate}
            onGenerateReport={handleGenerateReport}
            onGenerateReportByAddress={handleGenerateReportByAddress}
            generatingId={generatingId}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-grey-800 bg-grey-900/50">
      {sortedDates.map((dateKey) => {
        const dateChanges = groupedChanges[dateKey]!
        if (dateChanges.length === 0) return null

        return (
          <div key={dateKey} className="border-b border-grey-800 last:border-b-0">
            <div className="px-5 py-2 text-xs font-medium text-grey-400">
              {formatDate(dateKey)}
            </div>

            {dateChanges.map((change) => {
              const matchedParcels = Array.isArray(change.matched_parcels)
                ? change.matched_parcels
                : []
              const matchedReports = Array.isArray(change.matched_reports)
                ? change.matched_reports
                : []
              const isExpanded = expandedId === change.id
              const Icon =
                change.change_type === 'permit' ? PermitIcon : ZoningIcon
              const pc = matchedParcels.length
              const rc = matchedReports.length
              const hasMatches = pc > 0 || rc > 0
              const primaryParcelId =
                change.matched_parcel_id ??
                matchedParcels[0]?.parcel_id ??
                null

              return (
                <div
                  key={change.id}
                  className="border-t border-grey-800/50 first:border-t-0"
                >
                  <button
                    onClick={() => handleToggle(change.id, expandedId, setExpandedId)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-grey-800/70"
                  >
                    <div className="relative">
                      <Icon />
                      {!readIds.has(change.id) && (
                        <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-grey-900 bg-amber-accent" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-grey-300">
                        {change.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-grey-600">
                          {formatRelativeTime(change.change_date)}
                        </span>
                        {change.category_label && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              /verleend|vastgesteld/i.test(change.category_label)
                                ? 'bg-amber-accent/15 text-amber-accent'
                                : 'bg-grey-800 text-grey-300'
                            }`}
                          >
                            {change.category_label}
                          </span>
                        )}
                        {hasMatches && (
                          <div className="flex gap-1.5">
                            {pc > 0 && (
                              <span className="inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
                                {pc} {pc === 1 ? 'perceel' : 'percelen'}
                              </span>
                            )}
                            {rc > 0 && (
                              <span className="inline-flex items-center rounded-full bg-amber-accent/10 px-2 py-0.5 text-[11px] font-medium text-amber-accent">
                                {rc} {rc === 1 ? 'rapport' : 'rapporten'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronIcon
                      className={`h-4 w-4 shrink-0 text-grey-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {isExpanded && (() => {
                    const hasParcels = matchedParcels.length > 0
                    const hasReports = matchedReports.length > 0
                    const hn =
                      change.huisnummer_hint ??
                      (change.address ? extractHuisnummer(change.address) : null)
                    const canNav = change.postcode && hn
                    const canViewOnMap = Boolean(primaryParcelId || canNav)
                    const addressGenerateKey =
                      canNav
                        ? `addr:${change.postcode!.replace(/\s/g, '').toUpperCase()}:${hn!}`
                        : null
                    const canGenerate = Boolean(primaryParcelId || canNav)
                    const isGeneratingAddress =
                      !!addressGenerateKey && generatingId === addressGenerateKey
                    const isGeneratingParcel =
                      !!primaryParcelId && generatingId === primaryParcelId

                    return (
                      <div className="border-t border-grey-800/50 bg-grey-900 px-5 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            {change.address && (
                              <p className="text-xs text-grey-400">{change.address}</p>
                            )}

                            {hasParcels && (
                              <div className="space-y-1">
                                {matchedParcels.map((m) => (
                                  <button
                                    key={m.parcel_id}
                                    onClick={() =>
                                      navigate({
                                        to: '/map',
                                        search: {
                                          parcel_id: m.parcel_id,
                                          ...(m.address
                                            ? { fallback_address: m.address }
                                            : change.address
                                              ? { fallback_address: change.address }
                                              : {}),
                                          _t: Date.now(),
                                        },
                                      })
                                    }
                                    className="flex items-center gap-1.5 text-sm text-info hover:text-info/80 hover:underline"
                                  >
                                    <ParcelLinkIcon />
                                    {m.address
                                      ? `Bekijk perceel — ${m.address}`
                                      : 'Bekijk op kaart'}
                                  </button>
                                ))}
                              </div>
                            )}

                            {hasReports && (
                              <div className="space-y-1">
                                {matchedReports.map((m) => (
                                  <button
                                    key={m.report_id}
                                    onClick={() =>
                                      navigate({
                                        to: '/rapport/$id',
                                        params: { id: m.report_id },
                                      })
                                    }
                                    className="flex items-center gap-1.5 text-sm text-amber-accent hover:text-amber-accent-hover hover:underline"
                                  >
                                    <ReportLinkIcon />
                                    Bekijk rapport — {m.report_name}
                                  </button>
                                ))}
                              </div>
                            )}

                            {change.source_url && (
                              <a
                                href={change.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-info hover:underline"
                              >
                                Bekijk officiële publicatie
                                <ExternalLinkIcon />
                              </a>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-col gap-2">
                            <button
                              onClick={() => {
                                if (!canViewOnMap) return
                                if (primaryParcelId) {
                                  navigate({
                                    to: '/map',
                                    search: {
                                      parcel_id: primaryParcelId,
                                      ...(matchedParcels[0]?.address
                                        ? { fallback_address: matchedParcels[0].address }
                                        : change.address
                                          ? { fallback_address: change.address }
                                          : {}),
                                      _t: Date.now(),
                                    },
                                  })
                                  return
                                }
                                navigate({
                                  to: '/map',
                                  search: {
                                    postcode: formatPostcode(change.postcode!),
                                    huisnummer: hn!,
                                    _t: Date.now(),
                                  },
                                })
                              }}
                              disabled={!canViewOnMap}
                              title={!canViewOnMap ? 'Adres/huisnummer ontbreekt' : undefined}
                              className="inline-flex items-center gap-1.5 rounded-md border border-grey-700 bg-grey-800/50 px-3 py-1.5 text-xs font-medium text-info hover:bg-grey-700/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <MapPinIcon />
                              Bekijk op kaart
                            </button>

                            <button
                              onClick={() => {
                                if (!canGenerate) return
                                if (primaryParcelId) {
                                  void handleGenerateReport(primaryParcelId, change.project_id)
                                  return
                                }
                                void handleGenerateReportByAddress({
                                  postcode: formatPostcode(change.postcode!),
                                  huisnummer: hn!,
                                  projectId: change.project_id,
                                })
                              }}
                              disabled={
                                !canGenerate ||
                                isGeneratingParcel ||
                                isGeneratingAddress
                              }
                              title={!canGenerate ? 'Adres/huisnummer ontbreekt' : undefined}
                              className="inline-flex items-center gap-1.5 rounded-md border border-amber-accent/30 bg-amber-accent/10 px-3 py-1.5 text-xs font-medium text-amber-accent hover:bg-amber-accent/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <ReportLinkIcon />
                              {isGeneratingParcel || isGeneratingAddress
                                ? 'Bezig...'
                                : 'Genereer rapport'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

interface ChangeInboxItemProps {
  change: ChangeRecord
  isActive: boolean
  isRead: boolean
  onClick: () => void
}

function ChangeInboxItem({
  change,
  isActive,
  isRead,
  onClick,
}: ChangeInboxItemProps) {
  const address = change.address?.trim() || 'Adres onbekend'
  const summary = change.title?.trim() || 'Geen omschrijving'
  const typeLabel =
    change.change_type === 'permit' ? 'Omgevingsvergunning' : 'Bestemmingsplan'

  return (
    <button
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-colors ${
        isActive
          ? 'border-overlay/[0.08] bg-overlay/[0.08]'
          : 'border-overlay/[0.08] bg-overlay/[0.03] hover:bg-overlay/[0.05]'
      }`}
    >
      <span
        className={`absolute inset-y-1 left-0 w-1 rounded-r ${
          isActive ? 'bg-amber-accent' : 'bg-transparent'
        }`}
      />
      {!isRead && (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-amber-accent" />
      )}
      <p className="pr-4 text-sm font-semibold leading-snug text-grey-100">{address}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-grey-400">{summary}</p>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-grey-500">
        <span>{typeLabel}</span>
        {change.category_label && (
          <>
            <span className="text-grey-600">&middot;</span>
            <span
              className={
                /verleend|vastgesteld/i.test(change.category_label)
                  ? 'text-amber-accent'
                  : 'text-grey-400'
              }
            >
              {change.category_label}
            </span>
          </>
        )}
      </div>
    </button>
  )
}

interface ChangeDetailPanelProps {
  change: ChangeRecord | null
  onNavigate: ReturnType<typeof useNavigate>
  onGenerateReport: (parcelId: string, projectId?: string) => Promise<void>
  onGenerateReportByAddress: (input: {
    postcode: string
    huisnummer: number
    projectId?: string
  }) => Promise<void>
  generatingId: string | null
}

function ChangeDetailPanel({
  change,
  onNavigate,
  onGenerateReport,
  onGenerateReportByAddress,
  generatingId,
}: ChangeDetailPanelProps) {
  if (!change) {
    return (
      <div className="rounded-xl border border-overlay/[0.08] bg-grey-900 p-5">
        <p className="text-sm text-grey-500">Selecteer links een melding om details te zien.</p>
      </div>
    )
  }

  const matchedParcels = Array.isArray(change.matched_parcels)
    ? change.matched_parcels
    : []
  const matchedReports = Array.isArray(change.matched_reports)
    ? change.matched_reports
    : []
  const primaryParcelId =
    change.matched_parcel_id ?? matchedParcels[0]?.parcel_id ?? null
  const expandedHn =
    change.huisnummer_hint ??
    (change.address ? extractHuisnummer(change.address) : null)
  const expandedCanNavigate = change.postcode && expandedHn
  const canViewOnMap = Boolean(primaryParcelId || expandedCanNavigate)
  const addressGenerateKey =
    expandedCanNavigate
      ? `addr:${change.postcode!.replace(/\s/g, '').toUpperCase()}:${expandedHn!}`
      : null
  const canGenerate = Boolean(primaryParcelId || expandedCanNavigate)
  const isGeneratingAddress =
    !!addressGenerateKey && generatingId === addressGenerateKey
  const isGeneratingParcel =
    !!primaryParcelId && generatingId === primaryParcelId
  const detailAddress = change.address?.trim() || 'Adres onbekend'
  const locationQualityLabel = primaryParcelId
    ? 'Perceel gekoppeld'
    : expandedCanNavigate
      ? 'Adres-hint beschikbaar'
      : 'Locatie onzeker'
  const locationQualityClass = primaryParcelId
    ? 'border-amber-accent/45 bg-amber-accent/15 text-amber-accent'
    : expandedCanNavigate
      ? 'border-overlay/[0.18] bg-overlay/[0.08] text-grey-200'
      : 'border-overlay/[0.12] bg-overlay/[0.05] text-grey-400'

  const openOnMap = () => {
    if (!canViewOnMap) return
    if (primaryParcelId) {
      onNavigate({
        to: '/map',
        search: {
          parcel_id: primaryParcelId,
          ...(matchedParcels[0]?.address
            ? { fallback_address: matchedParcels[0].address }
            : change.address
              ? { fallback_address: change.address }
              : {}),
          _t: Date.now(),
        },
      })
      return
    }
    onNavigate({
      to: '/map',
      search: {
        postcode: formatPostcode(change.postcode!),
        huisnummer: expandedHn!,
        _t: Date.now(),
      },
    })
  }

  return (
    <div className="space-y-4 rounded-xl border border-overlay/[0.08] bg-grey-900 p-4 sm:p-5">
      <button
        type="button"
        onClick={openOnMap}
        disabled={!canViewOnMap}
        className="group relative h-36 w-full overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-850 text-left disabled:cursor-default"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(217,170,56,0.14),transparent_46%),radial-gradient(circle_at_70%_75%,rgba(255,255,255,0.07),transparent_40%)]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className={`absolute left-3 top-3 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${locationQualityClass}`}>
          {locationQualityLabel}
        </div>
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-overlay/[0.12] bg-overlay/[0.06] px-2 py-0.5 text-[11px] text-grey-200">
          {matchedParcels.length}p
          <span className="text-grey-500">/</span>
          {matchedReports.length}r
        </div>
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-amber-accent/35 bg-amber-accent/15 px-3 py-1.5 text-xs font-medium text-amber-accent">
          <MapPinIcon />
          {canViewOnMap ? 'Open op kaart' : 'Locatie melding'}
        </div>
        <span className="absolute bottom-3 left-3 rounded-full border border-overlay/[0.12] bg-overlay/[0.06] px-2 py-0.5 text-[11px] text-grey-300">
          {change.gemeente_naam}
        </span>
      </button>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold text-grey-100">{detailAddress}</h3>
          {change.category_label && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              /verleend|vastgesteld/i.test(change.category_label)
                ? 'bg-amber-accent/15 text-amber-accent'
                : 'bg-grey-800/80 text-grey-300'
            }`}>
              {change.category_label}
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-overlay/[0.1] bg-overlay/[0.05] px-2 py-0.5 text-xs text-grey-300">
            {change.change_type === 'permit' ? 'Omgevingsvergunning' : 'Bestemmingsplan'}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-grey-300">{change.title}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {change.source_url && (
            <a
              href={change.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-overlay/[0.12] bg-overlay/[0.04] px-3 py-1.5 text-xs font-medium text-grey-300 transition-colors hover:bg-overlay/[0.08] hover:text-grey-100"
            >
              Bekijk officiële publicatie
              <ExternalLinkIcon />
            </a>
          )}
          <button
            onClick={() => {
              if (!canGenerate) return
              if (primaryParcelId) {
                void onGenerateReport(primaryParcelId, change.project_id)
                return
              }
              void onGenerateReportByAddress({
                postcode: formatPostcode(change.postcode!),
                huisnummer: expandedHn!,
                projectId: change.project_id,
              })
            }}
            disabled={!canGenerate || isGeneratingParcel || isGeneratingAddress}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-accent bg-amber-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-amber-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ReportLinkIcon />
            {isGeneratingParcel || isGeneratingAddress ? 'Bezig...' : 'Sla op in project +'}
          </button>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-overlay/[0.06] bg-overlay/[0.02] p-3 sm:grid-cols-2">
        <MetaRow label="Gemeente" value={change.gemeente_naam || '–'} />
        <MetaRow label="Project" value={change.project_name || 'Niet gekoppeld'} />
        <MetaRow label="Publicatiedatum" value={formatDate(change.change_date)} />
        <MetaRow label="Relatief" value={formatRelativeTime(change.change_date)} />
      </div>

      {(matchedParcels.length > 0 || matchedReports.length > 0) && (
        <div className="space-y-1.5 rounded-xl border border-overlay/[0.08] bg-overlay/[0.03] p-3">
          {matchedParcels.map((m) => (
            <button
              key={m.parcel_id}
              onClick={() =>
                onNavigate({
                  to: '/map',
                  search: {
                    parcel_id: m.parcel_id,
                    ...(m.address ? { fallback_address: m.address } : {}),
                    _t: Date.now(),
                  },
                })
              }
              className="flex items-center gap-1.5 text-sm text-grey-300 hover:text-grey-100 hover:underline"
            >
              <ParcelLinkIcon />
              {m.address ? `Perceel: ${m.address}` : `Perceel ${m.parcel_id}`}
            </button>
          ))}
          {matchedReports.map((m) => (
            <button
              key={m.report_id}
              onClick={() =>
                onNavigate({
                  to: '/rapport/$id',
                  params: { id: m.report_id },
                })
              }
              className="flex items-center gap-1.5 text-sm text-amber-accent hover:text-amber-accent-hover hover:underline"
            >
              <ReportLinkIcon />
              Rapport: {m.report_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-overlay/[0.035] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-grey-600">{label}</p>
      <p className="mt-0.5 text-sm text-grey-200">{value}</p>
    </div>
  )
}

function formatTimelineDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) return dateKey

  const date = new Date(year, month - 1, day)
  const today = new Date()
  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterdayAtMidnight = new Date(todayAtMidnight)
  yesterdayAtMidnight.setDate(todayAtMidnight.getDate() - 1)

  if (date.getTime() === todayAtMidnight.getTime()) return 'Vandaag'
  if (date.getTime() === yesterdayAtMidnight.getTime()) return 'Gisteren'

  const sameYear = date.getFullYear() === today.getFullYear()
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

// SVG Icons

function MapPinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function PermitIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-grey-700/30">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-grey-400"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    </div>
  )
}

function ZoningIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-grey-700/30">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-grey-400"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    </div>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function ParcelLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )
}

function ReportLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
