import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import ResultsShell from '@/components/layout/ResultsShell'
import {
  useInfiniteAllChanges,
  useMarkAllRead,
  useRefreshMonitoring,
  useUnreadCounts,
} from '@/hooks/useNotifications'
import { useMonitoredProjects } from '@/hooks/useProjects'
import { useReadTracking } from '@/hooks/useReadTracking'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Select } from '@/components/primitives/Select'
import type { ChangeRecord } from '@/lib/types/monitoring'
import { extractHuisnummer, formatPostcode } from '@/lib/utils/address'
import { formatRelativeTime } from '@/lib/utils/date'
import { useIsMobile } from '@/hooks/useIsMobile'
import { toMapAddressSearch, toMapParcelSearch } from '@/lib/navigation/mapSearch'

export const Route = createFileRoute('/_authenticated/meldingen')({
  validateSearch: (search: Record<string, unknown>) => ({
    gemeente:
      typeof search.gemeente === 'string' && search.gemeente.trim().length > 0
        ? search.gemeente.trim()
        : undefined,
  }),
  component: MeldingenPage,
})

const detailDateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const detailDateTimeFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

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

function MeldingenPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const isMobile = useIsMobile()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const selectedGemeente = search.gemeente ?? null

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteAllChanges(true, selectedGemeente ?? undefined)

  const { data: unreadData } = useUnreadCounts()
  const { data: monitoredData } = useMonitoredProjects()
  const totalUnread = unreadData?.total_unread ?? 0

  const markAllRead = useMarkAllRead()
  const refreshMonitoring = useRefreshMonitoring()

  // Flatten pages into single arrays
  const allChanges = useMemo(
    () => data?.pages.flatMap((p) => p.changes) ?? [],
    [data?.pages]
  )

  const allReadIds = useMemo(
    () => data?.pages.flatMap((p) => p.read_change_ids ?? []) ?? [],
    [data?.pages]
  )

  const {
    readIds,
    handleToggle,
    handleGenerateReport,
    handleGenerateReportByAddress,
    generatingId,
  } = useReadTracking({ readChangeIds: allReadIds, reportSource: 'meldingen' })

  // Prefer top-level monitored gemeente projects for stable filter options.
  const monitoredGemeenteProjects = useMemo(
    () => (monitoredData?.projects ?? []).filter((p) => !p.parent_id),
    [monitoredData?.projects]
  )

  const monitoredGemeenteNames = useMemo(
    () =>
      [...new Set(
        monitoredGemeenteProjects
          .map((p) => p.name.trim())
          .filter((name) => name.length > 0)
      )].sort((a, b) => a.localeCompare(b, 'nl')),
    [monitoredGemeenteProjects]
  )

  // Fallback source from loaded pages (also useful to include newly seen names)
  const observedGemeenteNames = useMemo(
    () =>
      [...new Set(
        allChanges
          .map((c) => (c.gemeente_naam ?? '').trim())
          .filter((name) => name.length > 0)
      )].sort((a, b) => a.localeCompare(b, 'nl')),
    [allChanges]
  )

  const gemeenteNames = useMemo(
    () => {
      const merged = new Set<string>([
        ...(monitoredGemeenteNames.length > 0
          ? monitoredGemeenteNames
          : observedGemeenteNames),
        ...observedGemeenteNames,
      ])
      if (selectedGemeente) {
        merged.add(selectedGemeente)
      }
      return [...merged].sort((a, b) => a.localeCompare(b, 'nl'))
    },
    [monitoredGemeenteNames, observedGemeenteNames, selectedGemeente]
  )

  const isRefreshing =
    manualRefreshing || isRefetching || refreshMonitoring.isPending

  const setSelectedGemeente = (nextGemeente: string | null) => {
    navigate({
      to: '/meldingen',
      search: {
        gemeente: nextGemeente?.trim() || undefined,
      },
      replace: true,
    })
  }

  const handleRefresh = async () => {
    setManualRefreshing(true)
    const monitoredProjects =
      monitoredGemeenteProjects.length > 0
        ? monitoredGemeenteProjects
        : monitoredData?.projects ?? []
    const minDuration = new Promise((r) => setTimeout(r, 500))

    try {
      if (!selectedGemeente) {
        toast.info('Kies eerst een gemeente om gericht te verversen')
        await Promise.all([refetch(), minDuration])
        return
      }

      const targets = monitoredProjects.filter(
        (p) =>
          p.name.trim().toLowerCase() ===
          selectedGemeente.trim().toLowerCase()
      )

      if (targets.length === 0) {
        toast.info(
          `Geen monitoringproject gevonden voor ${selectedGemeente}`
        )
        await Promise.all([refetch(), minDuration])
        return
      }

      let totalNewChanges = 0
      for (const project of targets) {
        const result = await refreshMonitoring.mutateAsync(project.id)
        totalNewChanges += result.new_changes ?? 0
      }

      await Promise.all([refetch(), minDuration])

      if (targets.length > 0) {
        if (totalNewChanges > 0) {
          toast.success(
            `Refresh voltooid: ${totalNewChanges} ${totalNewChanges === 1 ? 'nieuwe melding' : 'nieuwe meldingen'} gevonden`
          )
        } else {
          toast.info('Refresh voltooid: geen nieuwe meldingen gevonden')
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Verversen van meldingen mislukt'
      )
    } finally {
      setManualRefreshing(false)
    }
  }

  // Intersection observer sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' } // Trigger 200px before reaching the bottom
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Group changes by publication date (YYYY-MM-DD from change_date)
  const groupedChanges = allChanges.reduce<Record<string, ChangeRecord[]>>(
    (acc, change) => {
      const dateKey = change.change_date.split('T')[0]
      if (!dateKey) return acc
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(change)
      return acc
    },
    {}
  )

  const sortedDates = Object.keys(groupedChanges).sort().reverse()
  const selectedChange = useMemo(
    () => allChanges.find((change) => change.id === expandedId) ?? null,
    [allChanges, expandedId]
  )

  useEffect(() => {
    if (isMobile) return
    if (allChanges.length === 0) {
      if (expandedId !== null) setExpandedId(null)
      return
    }
    if (!expandedId || !allChanges.some((change) => change.id === expandedId)) {
      setExpandedId(allChanges[0]!.id)
    }
  }, [isMobile, allChanges, expandedId])

  return (
    <ResultsShell contentClassName="max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 rounded-2xl border border-overlay/[0.08] bg-grey-900 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-grey-100">Meldingen</h1>
            {totalUnread > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-accent/15 px-2.5 py-0.5 text-sm font-medium text-amber-accent">
                {totalUnread} nieuw
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {(gemeenteNames.length > 1 || selectedGemeente !== null) && (
                <Select
                  value={selectedGemeente ?? ''}
                  onChange={(e) => setSelectedGemeente(e.target.value || null)}
                  className="h-8 w-[170px] rounded-md border-grey-700 bg-grey-900 px-2.5 pr-8 text-xs text-grey-200 focus-visible:ring-1 focus-visible:ring-amber-accent focus-visible:border-amber-accent sm:w-[210px]"
                  iconClassName="text-grey-500"
                >
                  <option value="">Alle gemeentes</option>
                  {gemeenteNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
              {totalUnread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="text-xs text-grey-400 transition-colors hover:text-grey-100 disabled:opacity-50"
                >
                  Markeer alles als gelezen
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="rounded p-1 text-grey-600 transition-colors hover:bg-grey-800 hover:text-grey-300 disabled:opacity-50"
                aria-label="Ververs meldingen"
              >
                <RefreshIcon spinning={isRefreshing} />
              </button>
            </div>
          </div>
          {selectedGemeente && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-full border border-amber-accent/35 bg-amber-accent/12 px-2.5 py-1 text-amber-accent">
                Scope: {selectedGemeente}
              </span>
              <button
                onClick={() => setSelectedGemeente(null)}
                className="text-grey-400 transition-colors hover:text-grey-100"
              >
                Wis scope
              </button>
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-grey-800 bg-grey-900 p-4"
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && allChanges.length === 0 && (
          <EmptyState
            icon={<Bell size={32} />}
            title="Geen meldingen"
            description="Wijzigingen in bestemmingsplannen en vergunningen verschijnen hier zodra ze gedetecteerd worden."
            action={{
              label: 'Naar projecten',
              onClick: () => navigate({ to: '/projecten' }),
            }}
          />
        )}

        {/* Feed grouped by date */}
        {!isLoading && allChanges.length > 0 && (
          isMobile ? (
            <div className="space-y-6">
              {sortedDates.map((dateKey) => {
                const dateChanges = groupedChanges[dateKey]!
                return (
                  <div key={dateKey}>
                    {/* Date header */}
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-overlay/[0.08]" />
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-grey-500">
                        {formatTimelineDateLabel(dateKey).toUpperCase()}
                      </h2>
                      <div className="h-px flex-1 bg-overlay/[0.08]" />
                    </div>

                    {/* Changes for this date */}
                    <div className="space-y-2.5">
                      {dateChanges.map((change) => (
                        <MeldingItem
                          key={change.id}
                          change={change}
                          isExpanded={expandedId === change.id}
                          isRead={readIds.has(change.id)}
                          onToggle={() =>
                            handleToggle(change.id, expandedId, setExpandedId)
                          }
                          onNavigate={navigate}
                          onGenerateReport={handleGenerateReport}
                          onGenerateReportByAddress={handleGenerateReportByAddress}
                          generatingId={generatingId}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Infinite scroll sentinel */}
              {hasNextPage && (
                <div
                  ref={sentinelRef}
                  className="flex items-center justify-center py-4"
                >
                  {isFetchingNextPage ? (
                    <div className="flex items-center gap-2 text-sm text-grey-400">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      Meer laden...
                    </div>
                  ) : (
                    <span className="text-xs text-grey-600">Scroll voor meer</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.65fr)]">
              <div className="overflow-hidden rounded-2xl border border-overlay/[0.08] bg-grey-900">
                <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-3">
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
                              <MeldingInboxItem
                                key={change.id}
                                change={change}
                                isActive={expandedId === change.id}
                                isRead={readIds.has(change.id)}
                                onClick={() => handleToggle(change.id, null, setExpandedId)}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {hasNextPage && (
                    <div
                      ref={sentinelRef}
                      className="mt-4 flex items-center justify-center py-2"
                    >
                      {isFetchingNextPage ? (
                        <div className="flex items-center gap-2 text-xs text-grey-400">
                          <Skeleton className="h-3.5 w-3.5 rounded-full" />
                          Meer laden...
                        </div>
                      ) : (
                        <span className="text-[11px] text-grey-600">Scroll voor meer</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <MeldingDetailPanel
                change={selectedChange}
                onNavigate={navigate}
                onGenerateReport={handleGenerateReport}
                onGenerateReportByAddress={handleGenerateReportByAddress}
                generatingId={generatingId}
              />
            </div>
          )
        )}
      </div>
    </ResultsShell>
  )
}

// --- MeldingItem ---

interface MeldingItemProps {
  change: ChangeRecord
  isExpanded: boolean
  isRead: boolean
  onToggle: () => void
  onNavigate: ReturnType<typeof useNavigate>
  onGenerateReport: (parcelId: string, projectId?: string) => Promise<void>
  onGenerateReportByAddress: (input: {
    postcode: string
    huisnummer: number
    projectId?: string
  }) => Promise<void>
  generatingId: string | null
}

function MeldingItem({
  change,
  isExpanded,
  isRead,
  onToggle,
  onNavigate,
  onGenerateReport,
  onGenerateReportByAddress,
  generatingId,
}: MeldingItemProps) {
  const matchedParcels = Array.isArray(change.matched_parcels)
    ? change.matched_parcels
    : []
  const matchedReports = Array.isArray(change.matched_reports)
    ? change.matched_reports
    : []
  const pc = matchedParcels.length
  const rc = matchedReports.length
  const hasMatches = pc > 0 || rc > 0
  const primaryParcelId =
    change.matched_parcel_id ?? matchedParcels[0]?.parcel_id ?? null
  const normalizedAddress = change.address?.trim()
  const primaryTitle = normalizedAddress && normalizedAddress.length > 0
    ? normalizedAddress
    : change.title
  const secondaryTitle = normalizedAddress ? change.title : null

  return (
    <div className="overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-900">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-overlay/[0.04]"
      >
        {/* Type icon + unread dot */}
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-overlay/[0.08] bg-overlay/[0.04]">
          {change.change_type === 'permit' ? (
            <PermitIcon />
          ) : (
            <ZoningIcon />
          )}
          {!isRead && (
            <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-grey-900 bg-amber-accent" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-grey-100">
            {primaryTitle}
          </p>
          {secondaryTitle && (
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-grey-400">
              {secondaryTitle}
            </p>
          )}

          {/* Gemeente + project context */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs text-grey-400">
              {change.gemeente_naam}
            </span>
            {change.project_name && (
              <>
                <span className="text-grey-600">&middot;</span>
                <span className="text-xs text-grey-500">
                  {change.project_name}
                </span>
              </>
            )}
          </div>

          {/* Category label badge — amber for important statuses */}
          {change.category_label && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                /verleend|vastgesteld/i.test(change.category_label)
                  ? 'bg-amber-accent/15 text-amber-accent'
                  : 'bg-grey-800/80 text-grey-300'
              }`}>
                {change.category_label}
              </span>
            </div>
          )}

          {/* Timestamp + match pills */}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] text-grey-600">
              {formatRelativeTime(change.change_date)}
            </span>
            {hasMatches && (
              <div className="flex gap-1.5">
                {pc > 0 && (
                  <span className="inline-flex items-center rounded-full border border-overlay/[0.1] bg-overlay/[0.05] px-2 py-0.5 text-[11px] font-medium text-grey-300">
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

        {/* Chevron */}
        <svg
          className={`h-4 w-4 shrink-0 text-grey-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Expanded detail */}
      {isExpanded && (() => {
        const hasParcels = matchedParcels.length > 0
        const hasReports = matchedReports.length > 0
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

        return (
          <div className="border-t border-overlay/[0.08] bg-overlay/[0.03] px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              {/* Left: details */}
              <div className="min-w-0 flex-1 space-y-2">
                {/* Address */}
                {change.address && (
                  <p className="text-xs text-grey-400">{change.address}</p>
                )}

                {/* Matched parcels */}
                {hasParcels && (
                  <div className="space-y-1">
                    {matchedParcels.map((m) => (
                      <div key={m.parcel_id} className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            onNavigate({
                              to: '/map',
                              search: toMapParcelSearch({
                                parcelId: m.parcel_id,
                                fallbackAddress: m.address ?? change.address,
                              }),
                            })
                          }
                          className="flex items-center gap-1.5 text-sm text-grey-300 hover:text-grey-100 hover:underline"
                        >
                          <ParcelLinkIcon />
                          {m.address
                            ? `Bekijk perceel — ${m.address}`
                            : 'Bekijk op kaart'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Matched reports */}
                {hasReports && (
                  <div className="space-y-1">
                    {matchedReports.map((m) => (
                      <button
                        key={m.report_id}
                        onClick={() =>
                          onNavigate({
                            to: '/rapport/$id',
                            params: { id: m.report_id },
                            search: { from: 'meldingen' },
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

                {/* Source URL */}
                {change.source_url && (
                  <a
                    href={change.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-grey-300 hover:text-grey-100 hover:underline"
                  >
                    Bekijk officiële publicatie
                    <ExternalLinkIcon />
                  </a>
                )}
              </div>

              {/* Right: action buttons */}
              <div className="flex shrink-0 flex-col gap-2">
                <button
                  onClick={() => {
                    if (!canViewOnMap) return
                    if (primaryParcelId) {
                      onNavigate({
                        to: '/map',
                        search: toMapParcelSearch({
                          parcelId: primaryParcelId,
                          fallbackAddress: matchedParcels[0]?.address ?? change.address,
                        }),
                      })
                      return
                    }
                    onNavigate({
                      to: '/map',
                      search: toMapAddressSearch({
                        postcode: formatPostcode(change.postcode!),
                        huisnummer: expandedHn!,
                      }),
                    })
                  }}
                  disabled={!canViewOnMap}
                  title={!canViewOnMap ? 'Adres/huisnummer ontbreekt' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-md border border-overlay/[0.12] bg-overlay/[0.05] px-3 py-1.5 text-xs font-medium text-grey-300 transition-colors hover:bg-overlay/[0.1] hover:text-grey-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MapPinIcon />
                  Bekijk op kaart
                </button>

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
}

interface MeldingInboxItemProps {
  change: ChangeRecord
  isActive: boolean
  isRead: boolean
  onClick: () => void
}

function MeldingInboxItem({
  change,
  isActive,
  isRead,
  onClick,
}: MeldingInboxItemProps) {
  const address = change.address?.trim() || 'Adres onbekend'
  const typeLabel = change.change_type === 'permit'
    ? 'Omgevingsvergunning'
    : 'Bestemmingsplan'
  const summary = change.title?.trim() || 'Geen omschrijving'

  return (
    <button
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-colors ${
        isActive
          ? 'border-amber-accent/40 bg-overlay/[0.06] ring-1 ring-inset ring-amber-accent/20'
          : 'border-overlay/[0.08] bg-overlay/[0.03] hover:bg-overlay/[0.05]'
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-0.5 ${isActive ? 'bg-amber-accent' : 'bg-transparent'}`} />
      {!isRead && (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-amber-accent" />
      )}
      <p className="pr-4 text-sm font-semibold leading-snug text-grey-100">
        {address}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-grey-400">
        {summary}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-grey-500">
        <span>{typeLabel}</span>
        {change.category_label && (
          <>
            <span className="text-grey-600">&middot;</span>
            <span className={/verleend|vastgesteld/i.test(change.category_label) ? 'text-amber-accent' : 'text-grey-400'}>
              {change.category_label}
            </span>
          </>
        )}
      </div>
    </button>
  )
}

interface MeldingDetailPanelProps {
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

function MeldingDetailPanel({
  change,
  onNavigate,
  onGenerateReport,
  onGenerateReportByAddress,
  generatingId,
}: MeldingDetailPanelProps) {
  if (!change) {
    return (
      <div className="rounded-2xl border border-overlay/[0.08] bg-grey-900 p-6">
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
        search: toMapParcelSearch({
          parcelId: primaryParcelId,
          fallbackAddress: matchedParcels[0]?.address ?? change.address,
        }),
      })
      return
    }
    onNavigate({
      to: '/map',
      search: toMapAddressSearch({
        postcode: formatPostcode(change.postcode!),
        huisnummer: expandedHn!,
      }),
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-overlay/[0.08] bg-grey-900 p-4 sm:p-5">
      <button
        type="button"
        onClick={openOnMap}
        disabled={!canViewOnMap}
        className="group relative h-40 w-full overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-850 text-left disabled:cursor-default"
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
        <span className="absolute bottom-3 right-3 rounded-full border border-overlay/[0.12] bg-overlay/[0.06] px-2 py-0.5 text-[11px] text-grey-300 transition-colors group-hover:text-grey-100">
          {canViewOnMap ? 'Klik voor kaart' : 'Geen kaartmatch'}
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
      </div>

      <div className="grid gap-2 rounded-xl border border-overlay/[0.08] bg-overlay/[0.03] p-3 sm:grid-cols-2">
        <MetaRow label="Gemeente" value={change.gemeente_naam || '–'} />
        <MetaRow label="Project" value={change.project_name || 'Niet gekoppeld'} />
        <MetaRow label="Publicatiedatum" value={detailDateFmt.format(new Date(change.change_date))} />
        <MetaRow label="Gedetecteerd" value={detailDateTimeFmt.format(new Date(change.detected_at))} />
      </div>

      {(matchedParcels.length > 0 || matchedReports.length > 0 || change.source_url || canGenerate) && (
        <div className="space-y-1.5 rounded-xl border border-overlay/[0.08] bg-overlay/[0.03] p-3">
          {canGenerate && (
            <button
              onClick={() => {
                if (primaryParcelId) {
                  void onGenerateReport(primaryParcelId, change.project_id)
                  return
                }
                if (!expandedCanNavigate) return
                void onGenerateReportByAddress({
                  postcode: formatPostcode(change.postcode!),
                  huisnummer: expandedHn!,
                  projectId: change.project_id,
                })
              }}
              disabled={!canGenerate || isGeneratingParcel || isGeneratingAddress}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-accent/30 bg-amber-accent/10 px-3 py-1.5 text-xs font-medium text-amber-accent transition-colors hover:bg-amber-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ReportLinkIcon />
              {isGeneratingParcel || isGeneratingAddress ? 'Bezig...' : 'Sla op in project +'}
            </button>
          )}
          {change.source_url && (
            <a
              href={change.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-grey-300 hover:text-grey-100 hover:underline"
            >
              Bekijk officiële publicatie
              <ExternalLinkIcon />
            </a>
          )}
          {matchedParcels.map((m) => (
            <button
              key={m.parcel_id}
              onClick={() =>
                onNavigate({
                  to: '/map',
                  search: toMapParcelSearch({
                    parcelId: m.parcel_id,
                    fallbackAddress: m.address,
                  }),
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
                  search: { from: 'meldingen' },
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
    <div className="rounded-md border border-overlay/[0.08] bg-overlay/[0.03] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-grey-600">{label}</p>
      <p className="mt-0.5 text-sm text-grey-200">{value}</p>
    </div>
  )
}

// --- SVG Icons ---

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  if (spinning) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

function PermitIcon() {
  return (
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
  )
}

function ZoningIcon() {
  return (
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
