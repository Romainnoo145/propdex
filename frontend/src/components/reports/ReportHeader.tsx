/**
 * ReportHeader — compact header card for the rapport page redesign.
 *
 * Shows: back button, hero address, postcode/woonplaats, perceel ID,
 * satellite thumbnail, metric pills, and action buttons.
 */

import { useState, useCallback } from 'react'
import { ArrowLeft, MapPin, Download, FileText } from 'lucide-react'
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

  // Metric pills data
  const pills = [
    { label: 'Bouwjaar', value: building?.bouwjaar?.toString() ?? '–' },
    { label: 'Oppervlakte', value: formatArea(building?.oppervlakte) },
    { label: 'Bestemming', value: bestemming ?? '–' },
    { label: 'Compleetheid', value: `${completenessPct}%` },
  ]

  return (
    <div
      className="rounded-[24px] border border-[#EAEFEF] bg-white p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-[13px] text-[#94a3b8] transition-colors hover:text-[#1A1C1E]"
      >
        <ArrowLeft size={15} strokeWidth={2} />
        {backLabel}
      </button>

      {/* Main row: address info + satellite */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: address, perceel, pills, buttons */}
        <div className="min-w-0 flex-1">
          {/* Hero address */}
          <h1 className="text-[28px] font-bold tracking-tighter text-[#0E1111] leading-tight">
            {address.straat} {address.huisnummer}
            {address.huisletter ?? ''}{address.toevoeging ?? ''}
          </h1>

          {/* Postcode + woonplaats + perceel */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[13px] text-[#94a3b8]">
              {address.postcode}, {address.woonplaats}
            </span>
            {primaryPerceelId && (
              <>
                <span className="text-[11px] text-[#EAEFEF]">•</span>
                <span className="text-[13px] text-[#94a3b8]">
                  Perceel {primaryPerceelId}
                  {cadastral_parcels.length > 1 && (
                    <span className="ml-1 text-[11px]">+{cadastral_parcels.length - 1}</span>
                  )}
                </span>
              </>
            )}
          </div>

          {/* Metric pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            {pills.map((pill) => (
              <span
                key={pill.label}
                className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-1 text-[11px] font-semibold text-slate-600"
              >
                {pill.label}: {pill.value}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={onViewOnMap}
              className="flex items-center gap-1.5 rounded-full border border-[#EAEFEF] bg-white px-4 py-2 text-[13px] font-semibold text-[#1A1C1E] transition-colors hover:bg-[#F8FAFA]"
            >
              <MapPin size={14} strokeWidth={2} />
              Bekijk op kaart
            </button>
            <button
              onClick={onExportPDF}
              className="flex items-center gap-1.5 rounded-full bg-[#0E1111] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Download size={14} strokeWidth={2} />
              Download PDF
            </button>
            {reportId && (
              <button
                onClick={handleGenerateDossier}
                disabled={isDossierGenerating}
                className="flex items-center gap-1.5 rounded-full bg-[#F9A826] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
              <span className="text-[11px] text-[#94a3b8]">Geen kaartlocatie</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
