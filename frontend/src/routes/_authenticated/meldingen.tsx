import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import {
  useInfiniteAllChanges,
  useMarkAllRead,
  useUnreadCounts,
} from '@/hooks/useNotifications'
import { useReadTracking } from '@/hooks/useReadTracking'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import type { ChangeRecord } from '@/lib/types/monitoring'
import { extractHuisnummer, formatPostcode } from '@/lib/utils/address'
import { formatDate, formatRelativeTime } from '@/lib/utils/date'

export const Route = createFileRoute('/_authenticated/meldingen')({
  component: MeldingenPage,
})

function MeldingenPage() {
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedGemeente, setSelectedGemeente] = useState<string | null>(null)

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
  const totalUnread = unreadData?.total_unread ?? 0

  const markAllRead = useMarkAllRead()

  // Flatten pages into single arrays
  const allChanges = useMemo(
    () => data?.pages.flatMap((p) => p.changes) ?? [],
    [data?.pages]
  )

  const allReadIds = useMemo(
    () => data?.pages.flatMap((p) => p.read_change_ids ?? []) ?? [],
    [data?.pages]
  )

  const { readIds, handleToggle, handleGenerateReport, generatingId } =
    useReadTracking({ readChangeIds: allReadIds })

  // Derive gemeente names from loaded pages (progressively more as pages load)
  const gemeenteNames = useMemo(
    () => [...new Set(allChanges.map((c) => c.gemeente_naam))].sort(),
    [allChanges]
  )

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

  return (
    <ResultsShell>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-grey-100">Meldingen</h1>
        {totalUnread > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-accent/15 px-2.5 py-0.5 text-sm font-medium text-amber-accent">
            {totalUnread} nieuw
          </span>
        )}
        {/* Gemeente filter dropdown */}
        {gemeenteNames.length > 1 && (
          <select
            value={selectedGemeente ?? ''}
            onChange={(e) => setSelectedGemeente(e.target.value || null)}
            className="rounded-md border border-grey-700 bg-grey-900 px-2.5 py-1 text-sm text-grey-200 focus:border-amber-accent focus:outline-none focus:ring-1 focus:ring-amber-accent"
          >
            <option value="">Alle gemeentes</option>
            {gemeenteNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-2">
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
            onClick={() => refetch()}
            disabled={isRefetching}
            className="rounded p-1 text-grey-600 transition-colors hover:bg-grey-800 hover:text-grey-300 disabled:opacity-50"
            aria-label="Ververs meldingen"
          >
            <RefreshIcon spinning={isRefetching} />
          </button>
        </div>
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
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const dateChanges = groupedChanges[dateKey]!
            return (
              <div key={dateKey}>
                {/* Date header */}
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-grey-400">
                  {formatDate(dateKey)}
                </h2>

                {/* Changes for this date */}
                <div className="space-y-2">
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
      )}
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
  onGenerateReport: (parcelId: string) => Promise<void>
  generatingId: string | null
}

function MeldingItem({
  change,
  isExpanded,
  isRead,
  onToggle,
  onNavigate,
  onGenerateReport,
  generatingId,
}: MeldingItemProps) {
  const pc = change.matched_parcels?.length ?? 0
  const rc = change.matched_reports?.length ?? 0
  const hasMatches = pc > 0 || rc > 0

  return (
    <div className="rounded-lg border border-grey-800 bg-grey-900 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-grey-850"
      >
        {/* Type icon + unread dot */}
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-grey-700/30">
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
          {/* Title */}
          <p className="line-clamp-2 text-sm font-medium text-grey-200">
            {change.title}
          </p>

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
                  : 'bg-grey-800 text-grey-300'
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
        const hasParcels = (change.matched_parcels?.length ?? 0) > 0
        const hasReports = (change.matched_reports?.length ?? 0) > 0
        const expandedHn = change.address ? extractHuisnummer(change.address) : null
        const expandedCanNavigate = change.postcode && expandedHn

        return (
          <div className="border-t border-grey-800 bg-grey-900/50 px-4 py-3">
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
                    {change.matched_parcels!.map((m) => (
                      <div key={m.parcel_id} className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            onNavigate({
                              to: '/map',
                              search: { parcel_id: m.parcel_id },
                            })
                          }
                          className="flex items-center gap-1.5 text-sm text-info hover:text-info/80 hover:underline"
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
                    {change.matched_reports!.map((m) => (
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
                    className="inline-flex items-center gap-1 text-sm text-info hover:underline"
                  >
                    Bekijk officiële publicatie
                    <ExternalLinkIcon />
                  </a>
                )}
              </div>

              {/* Right: action buttons */}
              <div className="flex shrink-0 flex-col gap-2">
                {/* Bekijk op kaart — prefer parcel-ID (Phase 48 verified), fallback to address */}
                {change.matched_parcel_id ? (
                  <button
                    onClick={() =>
                      onNavigate({
                        to: '/map',
                        search: { parcel_id: change.matched_parcel_id! },
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-grey-700 bg-grey-800/50 px-3 py-1.5 text-xs font-medium text-info hover:bg-grey-700/50 transition-colors"
                  >
                    <MapPinIcon />
                    Bekijk op kaart
                  </button>
                ) : expandedCanNavigate ? (
                  <button
                    onClick={() =>
                      onNavigate({
                        to: '/map',
                        search: {
                          postcode: formatPostcode(change.postcode!),
                          huisnummer: expandedHn!,
                          _t: Date.now(),
                        },
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-grey-700 bg-grey-800/50 px-3 py-1.5 text-xs font-medium text-info hover:bg-grey-700/50 transition-colors"
                  >
                    <MapPinIcon />
                    Bekijk op kaart
                  </button>
                ) : null}

                {/* Genereer rapport — prefer matched_parcel_id (verified), fallback to matched_parcels list */}
                {change.matched_parcel_id ? (
                  <button
                    onClick={() => onGenerateReport(change.matched_parcel_id!)}
                    disabled={generatingId === change.matched_parcel_id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-accent/30 bg-amber-accent/10 px-3 py-1.5 text-xs font-medium text-amber-accent hover:bg-amber-accent/20 transition-colors disabled:opacity-50"
                  >
                    <ReportLinkIcon />
                    {generatingId === change.matched_parcel_id ? 'Bezig...' : 'Genereer rapport'}
                  </button>
                ) : hasParcels ? (
                  change.matched_parcels!.map((m) => (
                    <button
                      key={`gen-${m.parcel_id}`}
                      onClick={() => onGenerateReport(m.parcel_id)}
                      disabled={generatingId === m.parcel_id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-accent/30 bg-amber-accent/10 px-3 py-1.5 text-xs font-medium text-amber-accent hover:bg-amber-accent/20 transition-colors disabled:opacity-50"
                    >
                      <ReportLinkIcon />
                      {generatingId === m.parcel_id ? 'Bezig...' : 'Genereer rapport'}
                    </button>
                  ))
                ) : null}
              </div>
            </div>
          </div>
        )
      })()}
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
