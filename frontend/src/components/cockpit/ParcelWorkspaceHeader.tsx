/**
 * ParcelWorkspaceHeader — top header of OnderzoekPhaseView (workspace label,
 * title, parcel metadata badges, score buttons, action buttons row).
 * Extracted from FavoriteParcelWorkspaceView.tsx 2026-05-19 (Plan 08-06 split,
 * M050/S06 cont.) so the OnderzoekPhaseView shell stays ≤300 LOC.
 */
import { motion } from 'framer-motion'
import { ChevronLeft, FileText, MapPin } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { FavoriteResponse } from '@/lib/types/portfolio'

function stageBadgeClasses(stage: FavoriteResponse['pipeline_stage']): string {
  switch (stage) {
    case 'Afgerond':
      return 'border-[#CFE7D6] bg-[#EDF7F0] text-[#2E6A40]'
    case 'Besluit':
      return 'border-[#E4D7C6] bg-[#F8F1E7] text-[#7B5A2B]'
    case 'Contact':
      return 'border-[#D2D9EA] bg-[#EEF2F9] text-[#3E557E]'
    case 'Onderzoek':
      return 'border-[#DAD8EE] bg-[#F2F0FA] text-[#5D4F91]'
    default:
      return 'border-[#F1DCA6] bg-[#FFF8E8] text-[#7A5A00]'
  }
}

function buildParcelTitle(favorite: FavoriteResponse): string {
  return favorite.address ?? favorite.parcel_id
}

interface ParcelWorkspaceHeaderProps {
  favorite: FavoriteResponse
  onBack: () => void
  onOpenMap: () => void
  onScoreClick: (which: 'potentie' | 'risico') => void
}

export function ParcelWorkspaceHeader({
  favorite,
  onBack,
  onOpenMap,
  onScoreClick,
}: ParcelWorkspaceHeaderProps) {
  const navigate = useNavigate()
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Portfolio workspace
          </p>
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
                {buildParcelTitle(favorite)}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-[14px] leading-relaxed text-slate-500">
                  {favorite.parcel_id}
                  {favorite.gemeente_naam ? ` · ${favorite.gemeente_naam}` : ''}
                  {favorite.wijk_naam ? ` · ${favorite.wijk_naam}` : ''}
                </p>
                <span
                  className={`inline-flex min-h-[34px] items-center rounded-full border px-3 text-[12px] font-semibold ${stageBadgeClasses(favorite.pipeline_stage)}`}
                >
                  {favorite.pipeline_stage}
                </span>
                {favorite.potentie_score != null && (
                  <motion.button
                    type="button"
                    onClick={() => onScoreClick('potentie')}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.15 }}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-700 cursor-pointer hover:shadow-sm transition-shadow"
                    title="Potentie score — klik voor details"
                  >
                    <svg viewBox="0 0 12 12" className="size-3">
                      <circle cx="6" cy="6" r="5" fill="none" stroke="#d1fae5" strokeWidth="2" />
                      <circle
                        cx="6"
                        cy="6"
                        r="5"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="2"
                        strokeDasharray={`${(favorite.potentie_score / 100) * 31.4} 31.4`}
                        strokeLinecap="round"
                        transform="rotate(-90 6 6)"
                      />
                    </svg>
                    {Math.round(favorite.potentie_score)}
                  </motion.button>
                )}
                {favorite.risico_score != null && (
                  <motion.button
                    type="button"
                    onClick={() => onScoreClick('risico')}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.25 }}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 text-[12px] font-semibold text-red-700 cursor-pointer hover:shadow-sm transition-shadow"
                    title="Risico score — klik voor details"
                  >
                    <svg viewBox="0 0 12 12" className="size-3">
                      <circle cx="6" cy="6" r="5" fill="none" stroke="#fee2e2" strokeWidth="2" />
                      <circle
                        cx="6"
                        cy="6"
                        r="5"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2"
                        strokeDasharray={`${(favorite.risico_score / 100) * 31.4} 31.4`}
                        strokeLinecap="round"
                        transform="rotate(-90 6 6)"
                      />
                    </svg>
                    {Math.round(favorite.risico_score)}
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </div>
        {/*
          HAAL-03 (M052/S02): checklist-snelkoppeling verwijderd uit de workspace-header.
          De checklist leeft nu in de Haalbaarheid-fase (tab 3); de ReportHeader-ingang
          blijft als secundaire route. Onderzoek-context bevat geen checklist-knop meer.
        */}
        <div className="flex items-center gap-2 lg:shrink-0">
          <button
            type="button"
            onClick={onOpenMap}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0E1111] text-[#F9A826] transition-colors hover:bg-slate-800"
            aria-label="Open op kaart"
            title="Open op kaart"
          >
            <MapPin size={16} />
          </button>
          <motion.button
            type="button"
            onClick={() => {
              if (favorite.has_report && favorite.report_id) {
                navigate({ to: '/rapport/$id', params: { id: favorite.report_id } })
              }
            }}
            disabled={!favorite.has_report}
            whileHover={favorite.has_report ? { scale: 1.04 } : undefined}
            whileTap={favorite.has_report ? { scale: 0.96 } : undefined}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors ${
              favorite.has_report
                ? 'border-2 border-[#0E1111] bg-amber-500 text-[#0E1111] hover:bg-amber-400'
                : 'border border-[#EAEFEF] bg-[#F2F6F3] text-slate-400 cursor-default'
            }`}
            title={favorite.has_report ? 'Bekijk rapport' : 'Rapport wordt gegenereerd…'}
          >
            <FileText size={15} />
            Bekijk rapport
          </motion.button>
        </div>
      </div>
    </div>
  )
}
