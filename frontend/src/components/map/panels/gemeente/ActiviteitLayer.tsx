import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Bell, Heart, ExternalLink } from 'lucide-react'
import { VerdictHero } from './VerdictHero'
import { MeldingenModal } from './MeldingenModal'
import { CompactWijkCard } from './CompactWijkCard'
import { staggerContainer, fadeUp } from './animations'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { useUnreadCounts } from '@/hooks/useNotifications'
import type { ScanListItem } from '@/lib/types/scan'

interface ActiviteitLayerProps {
  scans: ScanListItem[]
  gemeenteNaam: string
  gemeenteCode: string
  wijkGeojson: GeoJSON.FeatureCollection | null
  onSelectWijk: (code: string, naam: string) => void
}

/* ── Wijk helpers (unchanged) ──────────────────────────────── */

interface WijkActivity { name: string; code: string; parcelCount: number; scanDate: string }

function deriveWijkActivity(scans: ScanListItem[], gemeenteCode: string): WijkActivity[] {
  const map = new Map<string, WijkActivity>()
  for (const s of scans) {
    if (s.gemeente_code !== gemeenteCode || s.status !== 'completed' || !s.wijk_naam) continue
    const existing = map.get(s.wijk_naam)
    if (!existing || s.scan_date > existing.scanDate) {
      map.set(s.wijk_naam, { name: s.wijk_naam, code: '', parcelCount: s.parcel_count, scanDate: s.scan_date })
    }
  }
  return [...map.values()].sort((a, b) => b.parcelCount - a.parcelCount)
}

interface WijkEntry { name: string; code: string; hasData: boolean; parcelCount?: number }

function deriveAllWijken(wijkGeojson: GeoJSON.FeatureCollection | null, scannedWijken: WijkActivity[]): WijkEntry[] {
  const scannedMap = new Map(scannedWijken.map(w => [w.name, w]))
  const entries: WijkEntry[] = []
  for (const f of (wijkGeojson?.features ?? [])) {
    const name = (f.properties?.statnaam as string) ?? ''
    const code = (f.properties?.statcode as string) ?? ''
    const scanned = scannedMap.get(name)
    entries.push({ name, code, hasData: !!scanned, parcelCount: scanned?.parcelCount })
  }
  return entries.sort((a, b) => {
    if (a.hasData && !b.hasData) return -1
    if (!a.hasData && b.hasData) return 1
    return a.name.localeCompare(b.name, 'nl')
  })
}

/* ── Section header ────────────────────────────────────────── */

function SectionHeader({ icon, label, count, children }: {
  icon: React.ReactNode; label: string; count?: number; children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-black text-slate-400 uppercase" style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {label}
        </span>
        {count != null && count > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 tabular-nums">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

/* ── Main component ────────────────────────────────────────── */

export function ActiviteitLayer({
  scans,
  gemeenteNaam,
  gemeenteCode,
  wijkGeojson,
  onSelectWijk,
}: ActiviteitLayerProps) {
  const [showMeldingen, setShowMeldingen] = useState(false)

  const { data: favorites } = useParcelFavorites()
  const { data: unreadData } = useUnreadCounts()

  const totalUnread = unreadData?.total_unread ?? 0

  // Favorieten in deze gemeente
  const gemeenteFavorites = useMemo(() => {
    if (!favorites) return []
    return favorites.filter((f) => f.gemeente_naam?.toLowerCase() === gemeenteNaam.toLowerCase())
  }, [favorites, gemeenteNaam])

  // Wijken
  const scannedWijken = useMemo(() => deriveWijkActivity(scans, gemeenteCode), [scans, gemeenteCode])
  const allWijken = useMemo(() => deriveAllWijken(wijkGeojson, scannedWijken), [wijkGeojson, scannedWijken])
  const totalWijken = allWijken.length
  const wijkenMetData = scannedWijken.length
  const totalPercelen = scannedWijken.reduce((sum, w) => sum + w.parcelCount, 0)

  // Verdict
  const activityScore = totalWijken > 0 ? Math.round((wijkenMetData / totalWijken) * 100) : null
  const verdictLabel = activityScore == null ? 'GEEN WIJKEN'
    : activityScore >= 60 ? 'ACTIEF' : activityScore >= 20 ? 'GESTART'
    : wijkenMetData > 0 ? 'VERKENNEND' : 'NIEUW GEBIED'
  const verdictColor = activityScore == null ? '#94a3b8'
    : activityScore >= 60 ? '#22C55E' : activityScore >= 20 ? '#F9A826'
    : wijkenMetData > 0 ? '#F9A826' : '#94a3b8'
  const verdictSubtitle = wijkenMetData > 0
    ? `${wijkenMetData} van ${totalWijken} wijken · ${totalPercelen.toLocaleString('nl-NL')} percelen`
    : `${totalWijken} wijken beschikbaar`

  return (
    <>
      <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
        <VerdictHero
          score={activityScore}
          label={verdictLabel}
          subtitle={verdictSubtitle}
          color={verdictColor}
          icon={activityScore != null && activityScore > 0
            ? <MapPin className="size-6 text-white" strokeWidth={2.5} />
            : <Bell className="size-6 text-white" strokeWidth={2.5} />
          }
        />

        {/* ── Meldingen ──────────────────────────────── */}
        <motion.div className="mt-6" variants={staggerContainer} initial="hidden" animate="show">
          <SectionHeader icon={<Bell size={14} className="text-slate-400" />} label="Meldingen">
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums" style={{ color: '#F9A826', backgroundColor: 'rgba(249,168,38,0.1)' }}>
                {totalUnread} nieuw
              </span>
            )}
          </SectionHeader>

          <motion.button
            variants={fadeUp}
            type="button"
            onClick={() => setShowMeldingen(true)}
            className="w-full rounded-[16px] p-4 border border-[#EAEFEF] bg-white text-left transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[14px] font-bold text-[#0E1111]">
                  Bekendmakingen
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {totalUnread > 0
                    ? `${totalUnread} ongelezen meldingen`
                    : 'Alle meldingen bekeken'
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                {totalUnread > 0 && (
                  <motion.span
                    className="h-3 w-3 rounded-full bg-[#F9A826]"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}
                <ExternalLink size={14} className="text-slate-300" />
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* ── Favorieten ─────────────────────────────── */}
        <motion.div className="mt-6" variants={staggerContainer} initial="hidden" animate="show">
          <SectionHeader
            icon={<Heart size={14} className="text-slate-400" />}
            label="Favorieten"
            count={gemeenteFavorites.length}
          />

          {gemeenteFavorites.length === 0 && (
            <motion.div variants={fadeUp} className="bg-[#F8FAF9] border border-dashed border-[#EAEFEF] rounded-[16px] p-4 text-center">
              <Heart size={20} className="text-slate-300 mx-auto mb-1.5" />
              <p className="text-[12px] text-slate-400">Geen favorieten in deze gemeente</p>
            </motion.div>
          )}

          {gemeenteFavorites.length > 0 && (
            <div className="space-y-1.5">
              {gemeenteFavorites.slice(0, 6).map((fav) => (
                <motion.div
                  key={fav.id}
                  variants={fadeUp}
                  className="bg-white border border-[#EAEFEF] rounded-[12px] px-4 py-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <span className="text-[13px] font-bold text-[#0E1111] block truncate">
                      {fav.address || fav.parcel_id}
                    </span>
                    {fav.wijk_naam && (
                      <span className="text-[10px] text-slate-400">{fav.wijk_naam}</span>
                    )}
                  </div>
                  <Heart size={14} fill="#EF4444" className="text-[#EF4444] shrink-0" />
                </motion.div>
              ))}
              {gemeenteFavorites.length > 6 && (
                <span className="text-[11px] text-slate-400 text-center block mt-1">
                  + {gemeenteFavorites.length - 6} meer
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Wijken ─────────────────────────────────── */}
        <motion.div className="mt-6" variants={staggerContainer} initial="hidden" animate="show">
          <SectionHeader
            icon={<MapPin size={14} className="text-slate-400" />}
            label="Wijken"
            count={totalWijken}
          />

          <div className="grid grid-cols-2 gap-1.5">
            {allWijken.slice(0, 8).map((wijk) => (
              <CompactWijkCard
                key={wijk.code || wijk.name}
                name={wijk.name}
                code={wijk.code}
                isScanned={wijk.hasData}
                parcelCount={wijk.parcelCount}
                onSelect={() => onSelectWijk(wijk.code, wijk.name)}
              />
            ))}
          </div>

          {allWijken.length > 8 && (
            <motion.div variants={fadeUp} className="mt-2 text-center">
              <span className="text-[11px] text-slate-400">+ {allWijken.length - 8} meer wijken</span>
            </motion.div>
          )}
        </motion.div>

        {/* ── Trust metadata ──────────────────────────── */}
        <motion.div variants={fadeUp} className="mt-6 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider text-slate-300">Bron: KOOP · PDOK</span>
        </motion.div>
      </div>

      {/* Meldingen modal */}
      <AnimatePresence>
        {showMeldingen && (
          <MeldingenModal
            gemeenteNaam={gemeenteNaam}
            gemeenteCode={gemeenteCode}
            onClose={() => setShowMeldingen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
