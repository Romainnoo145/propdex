import { motion, type Variants } from 'framer-motion'
import { ArrowLeft, Scan, Eye, Calendar, Home, BarChart3 } from 'lucide-react'
import { LeftPanelShell } from './LeftPanelShell'
import { CbsNeighborhoodCard } from '@/components/projects/CbsNeighborhoodCard'
import { JurisprudenceSection } from '@/components/projects/JurisprudenceSection'
import type { ScanListItem } from '@/lib/types/scan'

interface WijkMapPanelProps {
  naam: string
  gemeenteNaam: string
  latestScan: ScanListItem | null
  onClose: () => void
  onBack: () => void
  onStartScan: () => void
  onViewResults: (scanId: string) => void
}

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

export function WijkMapPanel({
  naam,
  gemeenteNaam,
  latestScan,
  onClose,
  onBack,
  onStartScan,
  onViewResults,
}: WijkMapPanelProps) {
  const hasCompletedScan = latestScan?.status === 'completed'

  /* Footer CTA — matches ParcelDetailPanel h-[60px] rounded-full */
  const footer = hasCompletedScan ? (
    <button
      type="button"
      onClick={() => onViewResults(latestScan.scan_id)}
      className="w-full h-[60px] rounded-full bg-[#0E1111] text-white text-[15px] font-bold tracking-tight transition-all hover:bg-slate-800 active:scale-[0.98] flex items-center justify-center gap-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Eye size={16} strokeWidth={2} />
      Bekijk resultaten
    </button>
  ) : (
    <button
      type="button"
      onClick={onStartScan}
      className="w-full h-[60px] rounded-full bg-[#F9A826] text-white text-[15px] font-bold tracking-tight transition-all hover:bg-[#e09520] active:scale-[0.98] flex items-center justify-center gap-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Scan size={16} strokeWidth={2} />
      Start scan
    </button>
  )

  return (
    <LeftPanelShell onClose={onClose} footer={footer}>
      <motion.div
        className="flex flex-col h-full overflow-y-auto"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* ── Header (px-8 pt-8, matches ParcelDetailPanel) ── */}
        <motion.div variants={fadeUp} className="px-8 pt-8">
          {/* Back breadcrumb — matches parcel back button style */}
          <button
            onClick={onBack}
            className="group flex items-center gap-1.5 mb-2 transition-colors duration-200"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-white/60 backdrop-blur-sm group-hover:bg-white/80 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4 text-aura-ink" />
            </div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">
              {gemeenteNaam}
            </span>
          </button>

          <div className="min-w-0 max-w-full pr-16">
            <h2 className="text-[28px] font-bold tracking-tighter text-slate-900 leading-tight truncate">
              {naam}
            </h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">
              Wijk
            </p>
          </div>
        </motion.div>

        {/* ── Scan Status Card ─────────────────────────── */}
        <motion.div variants={fadeUp} className="px-8 mt-6">
          {hasCompletedScan ? (
            <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[14px]"
                    style={{ backgroundColor: '#22C55E15', color: '#22C55E' }}
                  >
                    <Calendar size={16} strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase block"
                      style={{ letterSpacing: '0.15em' }}
                    >
                      Laatste scan
                    </span>
                    <span className="text-[14px] font-bold text-[#0E1111] tabular-nums">
                      {new Date(latestScan.scan_date).toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[14px]"
                    style={{ backgroundColor: '#22C55E15', color: '#22C55E' }}
                  >
                    <Home size={16} strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase block"
                      style={{ letterSpacing: '0.15em' }}
                    >
                      Percelen
                    </span>
                    <span className="text-[14px] font-bold text-[#0E1111] tabular-nums">
                      {latestScan.parcel_count?.toLocaleString('nl-NL') ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5 text-center">
              <p className="text-[13px] text-[#6B7280] font-medium">
                Nog niet gescand
              </p>
            </div>
          )}
        </motion.div>

        {/* ── CBS Section ──────────────────────────────── */}
        {hasCompletedScan && latestScan.neighborhood_metrics && (
          <motion.div variants={fadeUp} className="px-8 mt-6">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={13} className="text-slate-300" />
              <span
                className="text-[10px] font-black text-slate-400 uppercase"
                style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                CBS Wijkstatistieken
              </span>
            </div>
            <CbsNeighborhoodCard metrics={latestScan.neighborhood_metrics} />
          </motion.div>
        )}

        {/* ── Jurisprudence Section ────────────────────── */}
        <motion.div variants={fadeUp} className="px-8 mt-6">
          <JurisprudenceSection gemeenteNaam={gemeenteNaam} wijkNaam={naam} />
        </motion.div>

        {/* ── Trust metadata ───────────────────────────── */}
        <motion.div variants={fadeUp} className="px-8 pb-6 mt-auto pt-6">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-slate-300">
              Bron: CBS · Kadaster · PDOK
            </span>
          </div>
        </motion.div>
      </motion.div>
    </LeftPanelShell>
  )
}
