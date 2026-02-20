/**
 * Change timeline component for displaying project change history
 *
 * Shows:
 * - Permit changes (blue document icon)
 * - Zoning changes (green map icon)
 * - Grouped by date with expandable details
 * - Match pills linking to parcels/reports when postcode matches exist
 *
 * Auto-marks project as viewed on mount (clears unread badge).
 */

import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useProjectChanges, useMarkViewed } from '@/hooks/useNotifications'
import type { ChangeRecord } from '@/lib/types/monitoring'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'

interface ChangeTimelineProps {
  projectId: string
}

export default function ChangeTimeline({ projectId }: ChangeTimelineProps) {
  const { data, isLoading, error, refetch } = useProjectChanges(
    projectId,
    true // include_matches for timeline view
  )
  const markViewed = useMarkViewed()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const navigate = useNavigate()

  // Auto-mark as viewed when component mounts
  useEffect(() => {
    markViewed.mutate(projectId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]) // Only run when projectId changes (markViewed is stable from useMutation)

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

  const changes = data?.changes ?? []

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

  const parcelCount = (change: ChangeRecord) =>
    change.matched_parcels?.length ?? 0
  const reportCount = (change: ChangeRecord) =>
    change.matched_reports?.length ?? 0

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
              const isExpanded = expandedId === change.id
              const Icon =
                change.change_type === 'permit' ? PermitIcon : ZoningIcon
              const pc = parcelCount(change)
              const rc = reportCount(change)
              const hasMatches = pc > 0 || rc > 0

              return (
                <div
                  key={change.id}
                  className="border-t border-grey-800/50 first:border-t-0"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : change.id)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-grey-800/70"
                  >
                    <Icon />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-grey-100">
                        {change.title}
                      </p>
                      {change.address && (
                        <p className="mt-0.5 text-xs text-grey-400">
                          {change.address}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-grey-400">
                          {formatRelativeTime(change.detected_at)}
                        </span>
                        {hasMatches && (
                          <div className="flex gap-1.5">
                            {pc > 0 && (
                              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                                {pc} {pc === 1 ? 'perceel' : 'percelen'}
                              </span>
                            )}
                            {rc > 0 && (
                              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
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
                  {isExpanded && (
                    <div className="border-t border-grey-800/50 bg-grey-900 px-5 py-3 space-y-2">
                      {change.postcode && (
                        <p className="text-xs text-grey-400">
                          Postcode:{' '}
                          <span className="font-mono text-grey-300">
                            {change.postcode}
                          </span>
                        </p>
                      )}

                      {/* Matched parcels */}
                      {change.matched_parcels &&
                        change.matched_parcels.length > 0 && (
                          <div className="space-y-1">
                            {change.matched_parcels.map((m) => (
                              <button
                                key={m.parcel_id}
                                onClick={() =>
                                  navigate({
                                    to: '/resultaten',
                                    search: {
                                      scan_id: m.scan_id,
                                      highlight: m.parcel_id,
                                    },
                                  })
                                }
                                className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 hover:underline"
                              >
                                <ParcelLinkIcon />
                                {m.address
                                  ? `Bekijk perceel — ${m.address}`
                                  : 'Bekijk in scanresultaten'}
                              </button>
                            ))}
                          </div>
                        )}

                      {/* Matched reports */}
                      {change.matched_reports &&
                        change.matched_reports.length > 0 && (
                          <div className="space-y-1">
                            {change.matched_reports.map((m) => (
                              <button
                                key={m.report_id}
                                onClick={() =>
                                  navigate({
                                    to: '/rapport/$id',
                                    params: { id: m.report_id },
                                  })
                                }
                                className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 hover:underline"
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
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          Bekijk officiële publicatie
                          <ExternalLinkIcon />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// Format YYYY-MM-DD to human-readable Dutch date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Check if today
  if (date.toDateString() === today.toDateString()) {
    return 'Vandaag'
  }

  // Check if yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Gisteren'
  }

  // Otherwise format as "15 feb"
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

// Format relative time (e.g., "2 uur geleden", "3 dagen geleden")
function formatRelativeTime(isoDateStr: string): string {
  const date = new Date(isoDateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Net gedetecteerd'
  if (diffMinutes < 60)
    return `${diffMinutes} ${diffMinutes === 1 ? 'minuut' : 'minuten'} geleden`
  if (diffHours < 24)
    return `${diffHours} ${diffHours === 1 ? 'uur' : 'uur'} geleden`
  if (diffDays < 7)
    return `${diffDays} ${diffDays === 1 ? 'dag' : 'dagen'} geleden`

  // For older dates, show absolute date
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

// SVG Icons

function PermitIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-blue-600"
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
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-green-600"
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
