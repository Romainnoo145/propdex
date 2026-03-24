import { useMemo, useState } from 'react'
import { AMBER, GREEN, RED, OBSIDIAN, SLATE_MUTED } from '@/lib/tokens'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Heart, ExternalLink } from 'lucide-react'
import { MeldingenModal } from './MeldingenModal'
import { staggerContainer, fadeUp } from './animations'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { useGemeenteMonitoringState } from '@/hooks/useNotifications'
import { filterFavoritesForGemeente } from '@/lib/favorites'

interface ActiviteitLayerProps {
  gemeenteNaam: string
  gemeenteCode: string
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
  gemeenteNaam,
  gemeenteCode,
}: ActiviteitLayerProps) {
  const [showMeldingen, setShowMeldingen] = useState(false)

  const { data: favorites } = useParcelFavorites()
  const { unreadCount: totalUnread } = useGemeenteMonitoringState(gemeenteCode)

  // Favorieten in deze gemeente
  const gemeenteFavorites = useMemo(
    () => filterFavoritesForGemeente(favorites, { gemeenteCode, gemeenteNaam }),
    [favorites, gemeenteCode, gemeenteNaam],
  )

  return (
    <>
      <div className="flex flex-col flex-1 pt-4 px-6 pb-4">

        {/* ── Meldingen ──────────────────────────────── */}
        <motion.div className="mt-6" variants={staggerContainer} initial="hidden" animate="show">
          <SectionHeader icon={<Bell size={14} className="text-slate-400" />} label="Meldingen">
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums" style={{ color: AMBER.base, backgroundColor: 'rgba(249,168,38,0.1)' }}>
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
