import { useMemo, useRef, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { GemeenteModal } from './GemeenteModal'
import {
  useInfiniteAllChanges,
  useMarkAllRead,
  useUnreadCounts,
} from '@/hooks/useNotifications'
import { useReadTracking } from '@/hooks/useReadTracking'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import type { ChangeRecord } from '@/lib/types/monitoring'
import { formatRelativeTime } from '@/lib/utils/date'
import { toMapParcelSearch, toMapAddressSearch } from '@/lib/navigation/mapSearch'
import { extractHuisnummer, formatPostcode } from '@/lib/utils/address'

interface MeldingenModalProps {
  gemeenteNaam: string
  gemeenteCode: string
  onClose: () => void
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) return dateKey
  const date = new Date(year, month - 1, day)
  const today = new Date()
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterdayMid = new Date(todayMid)
  yesterdayMid.setDate(todayMid.getDate() - 1)
  if (date.getTime() === todayMid.getTime()) return 'Vandaag'
  if (date.getTime() === yesterdayMid.getTime()) return 'Gisteren'
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  })
}

export function MeldingenModal({ gemeenteNaam, onClose }: MeldingenModalProps) {
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteAllChanges(true, gemeenteNaam)

  const { data: unreadData } = useUnreadCounts()
  const markAllRead = useMarkAllRead()

  const allChanges = useMemo(
    () => data?.pages.flatMap((p) => p.changes) ?? [],
    [data?.pages],
  )
  const allReadIds = useMemo(
    () => data?.pages.flatMap((p) => p.read_change_ids ?? []) ?? [],
    [data?.pages],
  )

  const { readIds, handleToggle } = useReadTracking({
    readChangeIds: allReadIds,
    reportSource: 'meldingen',
  })

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Group by date
  const grouped = useMemo(() => {
    const acc: Record<string, ChangeRecord[]> = {}
    for (const change of allChanges) {
      const dateKey = change.change_date.split('T')[0]
      if (!dateKey) continue
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(change)
    }
    return acc
  }, [allChanges])

  const sortedDates = Object.keys(grouped).sort().reverse()

  const handleChangeClick = (change: ChangeRecord) => {
    handleToggle(change.id, expandedId, setExpandedId)

    // Navigate to map with parcel or address
    const parcelId = change.matched_parcel_id ?? change.matched_parcels?.[0]?.parcel_id
    if (parcelId) {
      navigate({
        to: '/map',
        search: toMapParcelSearch({
          parcelId,
          fallbackAddress: change.address,
        }),
      })
      onClose()
      return
    }

    const hn = change.huisnummer_hint ?? (change.address ? extractHuisnummer(change.address) : null)
    if (change.postcode && hn) {
      navigate({
        to: '/map',
        search: toMapAddressSearch({
          postcode: change.postcode,
          huisnummer: hn,
        }),
      })
      onClose()
    }
  }

  const totalUnread = unreadData?.total_unread ?? 0

  return (
    <GemeenteModal title={`Meldingen · ${gemeenteNaam}`} onClose={onClose}>
      {/* Actions bar */}
      {totalUnread > 0 && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200">
          <span className="text-sm text-neutral-600">
            {totalUnread} ongelezen
          </span>
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs text-aura-amber hover:text-aura-amber-hover transition-colors disabled:opacity-50"
          >
            Alles gelezen markeren
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-neutral-200">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
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
          description={`Geen bestemmingsplanwijzigingen of vergunningen gevonden voor ${gemeenteNaam}.`}
        />
      )}

      {/* Feed */}
      {!isLoading && allChanges.length > 0 && (
        <div className="space-y-5">
          {sortedDates.map((dateKey) => {
            const dateChanges = grouped[dateKey]!
            return (
              <div key={dateKey}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-neutral-100" />
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    {formatDateLabel(dateKey)}
                  </h3>
                  <div className="h-px flex-1 bg-neutral-100" />
                </div>

                <div className="space-y-1.5">
                  {dateChanges.map((change) => {
                    const isRead = readIds.has(change.id)
                    const address = change.address?.trim()
                    const title = address && address.length > 0 ? address : change.title
                    const matchCount = (change.matched_parcels?.length ?? 0) + (change.matched_reports?.length ?? 0)

                    return (
                      <button
                        key={change.id}
                        onClick={() => handleChangeClick(change)}
                        className="w-full flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left transition-colors hover:bg-neutral-100 hover:border-neutral-300"
                      >
                        {/* Type indicator + unread */}
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white">
                          <span className="text-xs text-neutral-500">
                            {change.change_type === 'permit' ? '📄' : '🗺️'}
                          </span>
                          {!isRead && (
                            <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-aura-amber" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-aura-ink truncate">
                            {title}
                          </p>

                          {change.category_label && (
                            <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              /verleend|vastgesteld/i.test(change.category_label)
                                ? 'bg-aura-amber/15 text-aura-amber'
                                : 'bg-neutral-200/80 text-neutral-600'
                            }`}>
                              {change.category_label}
                            </span>
                          )}

                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[11px] text-neutral-500">
                              {formatRelativeTime(change.change_date)}
                            </span>
                            {matchCount > 0 && (
                              <span className="text-[11px] text-neutral-400">
                                · {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Infinite scroll sentinel */}
          {hasNextPage && (
            <div ref={sentinelRef} className="flex items-center justify-center py-4">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-xs text-neutral-600">
                  <Skeleton className="h-3.5 w-3.5 rounded-full" />
                  Meer laden...
                </div>
              ) : (
                <span className="text-xs text-neutral-400">Scroll voor meer</span>
              )}
            </div>
          )}
        </div>
      )}
    </GemeenteModal>
  )
}
