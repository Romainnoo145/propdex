/**
 * ReportHeader — workspace-styled header card for the rapport page.
 *
 * Shows: kicker, back button, hero address, postcode/woonplaats, perceel ID,
 * score badges, satellite thumbnail, metric pills, and action buttons.
 */

import { useState, useCallback } from 'react'
import { ArrowLeft, MapPin, Download, FileText, ExternalLink } from 'lucide-react'
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

/* ─── Helpers ────────────────────────────────────────────────── */

function formatArea(value: number | null | undefined): string {
  if (value == null) return '–'
  return `${Math.round(value).toLocaleString('nl-NL')} m²`
}

/* ─── Score circle (compact) ─────────────────────────────────── */

function ScoreBadge({
  label,
  value,
  accent,
}: {
  label: string
  value: number | null | undefined
  accent: 'amber' | 'emerald' | 'red'
}) {
  const ring =
    accent === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : accent === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-[#F9A826]/20 bg-[#F9A826]/[0.06] text-[#F9A826]'

  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${ring}`}>
      <span className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</span>
      <span className="text-[15px] font-black tabular-nums">
        {value != null ? Math.round(value) : '–'}
      </span>
    </div>
  )
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
  const { address, building, completeness_score, cadastral_parcels } = data
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

  const completenessPct = Math.round(completeness_score * 100)
  const primaryPerceelId = cadastral_parcels[0]?.kadastrale_aanduiding ?? null
  const bestemming = data.zoning?.primary_bestemming ?? null
  const center = data.map_data?.center_wgs84 ?? null

  // Scores
  const scores = data.scores_v3 as Record<string, unknown> | null | undefined
  const potentieScore = scores && typeof scores.potentie === 'number' ? scores.potentie : null
  const risicoScore = scores && typeof scores.risico === 'number' ? scores.risico : null

  // Kadaster info
  const gemeente = cadastral_parcels[0]?.kadastrale_gemeente ?? null
  const wijk = data.address?.wijk ?? null

  // Metric pills data
  const pills = [
    { label: 'Bouwjaar', value: building?.bouwjaar?.toString() ?? '–' },
    { label: 'Oppervlakte', value: formatArea(building?.oppervlakte) },
    { label: 'Bestemming', value: bestemming ?? '–' },
    { label: 'Compleetheid', value: `${completenessPct}%` },
  ]

  return (
    <div
      className="pb-6 mb-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Kicker + back */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#F9A826]">
          Rapport
        </span>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-slate-400 transition-colors hover:text-[#0E1111]"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          {backLabel}
        </button>
      </div>

      {/* Main row: address info + satellite */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: address, perceel, scores, pills, buttons */}
        <div className="min-w-0 flex-1">
          {/* Hero address */}
          <h1 className="text-[28px] font-bold tracking-tighter text-[#0E1111] leading-tight">
            {address.straat} {address.huisnummer}
            {address.huisletter ?? ''}{address.toevoeging ?? ''}
          </h1>

          {/* Kadaster code · gemeente · wijk */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-400">
            {primaryPerceelId && <span>{primaryPerceelId}</span>}
            {primaryPerceelId && (gemeente || address.woonplaats) && (
              <span className="text-[#EAEFEF]">·</span>
            )}
            <span>{gemeente ?? address.woonplaats}</span>
            {wijk && (
              <>
                <span className="text-[#EAEFEF]">·</span>
                <span>{wijk}</span>
              </>
            )}
          </div>

          {/* Score badges */}
          {(potentieScore != null || risicoScore != null) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {potentieScore != null && (
                <ScoreBadge label="Potentie" value={potentieScore} accent="emerald" />
              )}
              {risicoScore != null && (
                <ScoreBadge label="Risico" value={risicoScore} accent="red" />
              )}
            </div>
          )}

          {/* Metric pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            {pills.map((pill) => (
              <span
                key={pill.label}
                className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-1.5 text-[11px] font-semibold text-slate-600"
              >
                {pill.label}: {pill.value}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {/* Open op kaart — black circle with amber icon */}
            <button
              onClick={onViewOnMap}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E1111] transition-opacity hover:opacity-90"
              title="Open op kaart"
            >
              <ExternalLink size={15} strokeWidth={2} className="text-[#F9A826]" />
            </button>
            <button
              onClick={onViewOnMap}
              className="flex items-center gap-1.5 rounded-full border border-[#EAEFEF] bg-white px-4 py-2 text-[12px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F8FAFA]"
            >
              <MapPin size={14} strokeWidth={2} />
              Bekijk op kaart
            </button>
            <button
              onClick={onExportPDF}
              className="flex items-center gap-1.5 rounded-full bg-[#0E1111] px-4 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Download size={14} strokeWidth={2} />
              Download PDF
            </button>
            {reportId && (
              <button
                onClick={handleGenerateDossier}
                disabled={isDossierGenerating}
                className="flex items-center gap-1.5 rounded-full bg-[#F9A826] px-4 py-2 text-[12px] font-semibold text-[#0E1111] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText size={14} strokeWidth={2} />
                {isDossierGenerating ? 'Bezig...' : 'Genereer Startdossier'}
              </button>
            )}
          </div>
        </div>

        {/* Right: satellite thumbnail */}
        <div className="w-full lg:w-56 lg:shrink-0">
          {center ? (
            <SatelliteThumbnail center={center} />
          ) : (
            <div className="flex h-36 w-full items-center justify-center rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA]">
              <span className="text-[11px] text-slate-400">Geen kaartlocatie</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
