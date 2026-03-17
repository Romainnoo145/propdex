import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ExternalLink, CheckCheck } from 'lucide-react'
import { NotificationBadge } from './NotificationBadge'
import { useUnreadCounts, useInfiniteAllChanges, useMarkAllRead, useMarkChangeRead } from '@/hooks/useNotifications'
import { toMapParcelSearch, toMapAddressSearch } from '@/lib/navigation/mapSearch'
import { extractHuisnummer, formatPostcode } from '@/lib/utils/address'
import { formatRelativeTime } from '@/lib/utils/date'
import type { ChangeRecord } from '@/lib/types/monitoring'

const CHANGE_TYPE_LABELS: Record<string, string> = {
  bestemmingsplan_wijziging: 'Bestemmingsplan',
  bouwvergunning: 'Bouwvergunning',
  sloopvergunning: 'Sloopvergunning',
  omgevingsvergunning: 'Omgevingsvergunning',
  eigenaar_wijziging: 'Eigendomswijziging',
  status_wijziging: 'Statuswijziging',
  woz_wijziging: 'WOZ-wijziging',
  bekendmaking: 'Bekendmaking',
}

function ChangeItem({
  change,
  isRead,
  onNavigate,
  onMarkRead,
}: {
  change: ChangeRecord
  isRead: boolean
  onNavigate: () => void
  onMarkRead: () => void
}) {
  const label = CHANGE_TYPE_LABELS[change.change_type] ?? change.change_type
  const address = change.address || change.parcel_id || 'Onbekend adres'

  return (
    <button
      onClick={() => {
        if (!isRead) onMarkRead()
        onNavigate()
      }}
      className="w-full text-left px-4 py-3 hover:bg-[#F2F6F3] transition-colors border-b border-[#EAEFEF] last:border-b-0"
    >
      <div className="flex items-start gap-2">
        {!isRead && (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-aura-amber" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-aura-ink truncate">
            {label}
          </p>
          <p className="text-[12px] text-slate-500 truncate">{address}</p>
          {change.gemeente_naam && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              {change.gemeente_naam} &middot; {formatRelativeTime(change.detected_at)}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

export function MeldingenPopover() {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: unreadData } = useUnreadCounts()
  const totalUnread = unreadData?.total_unread ?? 0

  const { data } = useInfiniteAllChanges(true)
  const markAllRead = useMarkAllRead()
  const markChangeRead = useMarkChangeRead()

  const recentChanges = useMemo(
    () => (data?.pages.flatMap((p) => p.changes) ?? []).slice(0, 20),
    [data?.pages]
  )

  const readIds = useMemo(
    () => new Set(data?.pages.flatMap((p) => p.read_change_ids ?? []) ?? []),
    [data?.pages]
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleNavigateToChange = (change: ChangeRecord) => {
    setOpen(false)
    // Try to navigate to the parcel on the map
    if (change.parcel_id) {
      navigate({
        to: '/map',
        search: toMapParcelSearch({
          parcelId: change.parcel_id,
          fallbackAddress: change.address,
        }),
      })
    } else if (change.address) {
      const huisnummer = extractHuisnummer(change.address)
      const postcode = formatPostcode(change.address)
      if (postcode && huisnummer) {
        navigate({
          to: '/map',
          search: toMapAddressSearch({ postcode, huisnummer }),
        })
      }
    }
  }

  return (
    <div ref={popoverRef} className="relative">
      {/* Bell trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="group relative flex h-12 w-12 items-center justify-center"
      >
        <span className="relative z-10 text-slate-500 transition-colors duration-300 group-hover:text-aura-ink">
          <Bell size={22} strokeWidth={1.5} />
          <NotificationBadge count={totalUnread} />
        </span>
        <span className="absolute inset-0 rounded-full bg-white/0 transition-all duration-300 group-hover:bg-white/20" />
      </button>

      {/* Tooltip */}
      {!open && (
        <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
          Meldingen
        </span>
      )}

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full top-0 ml-3 w-[340px] bg-white/90 backdrop-blur-2xl rounded-[24px] border border-white/40 shadow-xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EAEFEF]">
              <h3 className="text-[14px] font-bold text-aura-ink tracking-tight">
                Meldingen
                {totalUnread > 0 && (
                  <span className="ml-2 text-[12px] font-medium text-aura-amber">
                    {totalUnread} nieuw
                  </span>
                )}
              </h3>
              {totalUnread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-aura-ink transition-colors"
                >
                  <CheckCheck size={14} />
                  Alles gelezen
                </button>
              )}
            </div>

            {/* Changes list */}
            <div className="max-h-[400px] overflow-y-auto">
              {recentChanges.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-slate-400">
                  Geen meldingen
                </div>
              ) : (
                recentChanges.map((change) => (
                  <ChangeItem
                    key={change.id}
                    change={change}
                    isRead={readIds.has(change.id)}
                    onNavigate={() => handleNavigateToChange(change)}
                    onMarkRead={() => markChangeRead.mutate(change.id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
