/**
 * Change timeline component for displaying project change history
 *
 * Shows:
 * - Permit changes (document icon) and zoning changes (map icon)
 * - Grouped by date with expandable details
 * - Match pills linking to parcels/reports when postcode matches exist
 * - Amber dot indicator on unread changes (per-change via server read state)
 */

import { useState } from 'react'
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
}

export default function ChangeTimeline({ projectId }: ChangeTimelineProps) {
  const { data, isLoading, error, refetch } = useProjectChanges(
    projectId,
    true // include_matches for timeline view
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const navigate = useNavigate()

  const {
    readIds,
    handleToggle,
    handleGenerateReport,
    handleGenerateReportByAddress,
    generatingId,
  } = useReadTracking({ readChangeIds: data?.read_change_ids })

  const changes = data?.changes ?? []

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

  // Group changes by date (YYYY-MM-DD)
  const groupedChanges = changes.reduce<Record<string, ChangeRecord[]>>(
    (acc, change) => {
      const dateKey = change.change_date.split('T')[0]
      if (!dateKey) return acc // Skip if no date
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(change)
      return acc
    },
    {}
  )

  const sortedDates = Object.keys(groupedChanges).sort().reverse() // Newest first

  return (
    <div className="border-t border-grey-800 bg-grey-900/50">
      {sortedDates.map((dateKey) => {
        const dateChanges = groupedChanges[dateKey]!
        if (dateChanges.length === 0) return null

        return (
          <div key={dateKey} className="border-b border-grey-800 last:border-b-0">
            {/* Date header */}
            <div className="px-5 py-2 text-xs font-medium text-grey-400">
              {formatDate(dateKey)}
            </div>

            {/* Changes for this date */}
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

                  {/* Expanded details */}
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

                    return (
                      <div className="border-t border-grey-800/50 bg-grey-900 px-5 py-3">
                        <div className="flex items-start justify-between gap-4">
                          {/* Left: details */}
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

                          {/* Right: action buttons */}
                          <div className="flex shrink-0 flex-col gap-2">
                            <button
                              onClick={() => {
                                if (!canViewOnMap) return
                                if (primaryParcelId) {
                                  navigate({
                                    to: '/map',
                                    search: {
                                      parcel_id: primaryParcelId,
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
                                generatingId === primaryParcelId ||
                                isGeneratingAddress
                              }
                              title={!canGenerate ? 'Adres/huisnummer ontbreekt' : undefined}
                              className="inline-flex items-center gap-1.5 rounded-md border border-amber-accent/30 bg-amber-accent/10 px-3 py-1.5 text-xs font-medium text-amber-accent hover:bg-amber-accent/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <ReportLinkIcon />
                              {generatingId === primaryParcelId || isGeneratingAddress
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
