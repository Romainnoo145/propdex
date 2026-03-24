/**
 * ReportHeader — pixel-for-pixel match of the workspace header pattern
 * from FavoriteParcelWorkspaceView.tsx.
 */

import { useState, useCallback } from 'react'
import { ChevronLeft, MapPin, Download, FileText } from 'lucide-react'
import { motion } from 'framer-motion'
import type { PropertyReportResponse } from '@/lib/types/property'
import { generateStartdossier } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import SatelliteThumbnail from './SatelliteThumbnail'

/* ─── Props ─────────────────────────────────────────────────── */

interface ReportHeaderProps {
  data: PropertyReportResponse
  backLabel: string
  sourceParcelId: string | null
  reportId?: string | null
  onBack: () => void
  onViewOnMap: () => void
  onExportPDF: () => void
}

/* ─── Component ──────────────────────────────────────────────── */

export default function ReportHeader({
  data,
  backLabel,
  sourceParcelId,
  reportId = null,
  onBack,
  onViewOnMap,
  onExportPDF,
}: ReportHeaderProps) {
  const { address, cadastral_parcels } = data
  const { accessToken } = useAuth()
  const [isDossierGenerating, setIsDossierGenerating] = useState(false)

  const handleGenerateDossier = useCallback(async () => {
    if (!reportId || !accessToken) return
    setIsDossierGenerating(true)
    try {
      const blob = await generateStartdossier(reportId, accessToken)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `risicobeoordeling-${data.address?.postcode?.replace(' ', '') || 'rapport'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Dossier generation failed:', err)
    } finally {
      setIsDossierGenerating(false)
    }
  }, [reportId, accessToken, data.address?.postcode])

  // Scores
  const scores = data.scores_v3 as Record<string, unknown> | null | undefined
  const potentieScore = scores && typeof scores.potentie === 'number' ? scores.potentie : null
  const risicoScore = scores && typeof scores.risico === 'number' ? scores.risico : null

  // Kadaster info
  const primaryPerceelId = cadastral_parcels[0]?.kadastrale_aanduiding ?? null
  const gemeente = cadastral_parcels[0]?.kadastrale_gemeente ?? address.woonplaats ?? null
  const postcode = address.postcode ?? null

  // Map center for satellite thumbnail
  const center = data.map_data?.center_wgs84 ?? null

  return (
    <div
      className="mb-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Left column */}
        <div className="min-w-0 flex-1">
          {/* Kicker */}
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Rapport
          </p>

          {/* Back button + title */}
          <div className="mt-2 flex items-start gap-2 pr-6 lg:pr-12">
            <button
              type="button"
              onClick={onBack}
              className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/60 backdrop-blur-sm transition-colors hover:bg-white/80"
              aria-label="Terug"
            >
              <ChevronLeft className="h-4 w-4 text-aura-ink" />
            </button>

            <div className="min-w-0 max-w-full">
              <h1 className="text-[28px] font-bold leading-tight tracking-tighter text-slate-900">
                {address.straat} {address.huisnummer}
                {address.huisletter ?? ''}{address.toevoeging ?? ''}
              </h1>

              {/* Subtitle + score badges */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-[14px] leading-relaxed text-slate-500">
                  {primaryPerceelId ?? ''}
                  {primaryPerceelId && gemeente ? ' · ' : ''}
                  {gemeente ?? ''}
                  {(primaryPerceelId || gemeente) && postcode ? ' · ' : ''}
                  {postcode ?? ''}
                </p>

                {/* Score badges — exact workspace pattern */}
                {potentieScore != null && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.15 }}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-700"
                  >
                    <svg viewBox="0 0 12 12" className="size-3">
                      <circle cx="6" cy="6" r="5" fill="none" stroke="#d1fae5" strokeWidth="2" />
                      <circle
                        cx="6" cy="6" r="5" fill="none" stroke="#22c55e" strokeWidth="2"
                        strokeDasharray={`${(potentieScore / 100) * 31.4} 31.4`}
                        strokeLinecap="round"
                        transform="rotate(-90 6 6)"
                      />
                    </svg>
                    {Math.round(potentieScore)}
                  </motion.span>
                )}
                {risicoScore != null && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.25 }}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 text-[12px] font-semibold text-red-700"
                  >
                    <svg viewBox="0 0 12 12" className="size-3">
                      <circle cx="6" cy="6" r="5" fill="none" stroke="#fee2e2" strokeWidth="2" />
                      <circle
                        cx="6" cy="6" r="5" fill="none" stroke="#ef4444" strokeWidth="2"
                        strokeDasharray={`${(risicoScore / 100) * 31.4} 31.4`}
                        strokeLinecap="round"
                        transform="rotate(-90 6 6)"
                      />
                    </svg>
                    {Math.round(risicoScore)}
                  </motion.span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: satellite + action buttons */}
        <div className="flex flex-col items-end gap-3 lg:shrink-0">
          {/* Satellite thumbnail */}
          <div className="w-full lg:w-56">
            {center ? (
              <SatelliteThumbnail center={center} />
            ) : (
              <div className="flex h-36 w-full items-center justify-center rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA]">
                <span className="text-[11px] text-slate-400">Geen kaartlocatie</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              type="button"
              onClick={onViewOnMap}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#F9A826] bg-[#F9A826] px-4 text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F4B44A]"
              aria-label="Open op kaart"
              title="Open op kaart"
            >
              <MapPin size={15} />
              Open op kaart
            </motion.button>

            <motion.button
              type="button"
              onClick={onExportPDF}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#0E1111] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
            >
              <Download size={15} />
              Download PDF
            </motion.button>

            {reportId && (
              <motion.button
                type="button"
                onClick={handleGenerateDossier}
                disabled={isDossierGenerating}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#F9A826] bg-[#F9A826] px-4 text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F4B44A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText size={15} />
                {isDossierGenerating ? 'Bezig...' : 'Genereer Startdossier'}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
