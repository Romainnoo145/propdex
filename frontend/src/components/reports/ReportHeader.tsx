/**
 * ReportHeader — extracted from ReportDetailPage.
 *
 * Displays: back button, address, kadaster perceel ID, status badges,
 * satellite thumbnail, and key property stat cards.
 */

import { useState, useCallback } from 'react'
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
  onPrint?: () => void
}

/* ─── Helpers (shared with ReportDetailPage) ─────────────────── */

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatArea(value: number | null | undefined): string {
  if (value == null) return '–'
  return `${Math.round(value).toLocaleString('nl-NL')} m²`
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '–'
  return `EUR ${Math.round(value).toLocaleString('nl-NL')}`
}

/* ─── Status helpers ─────────────────────────────────────────── */

const STATUS_SEVERITY: Record<string, 'high' | 'medium' | 'low'> = {
  'Sloopvergunning verleend': 'high',
  'Pand gesloopt': 'high',
  'Bouw gestart': 'medium',
  'Bouwvergunning verleend': 'medium',
  'Niet gerealiseerd pand': 'medium',
  'Pand buiten gebruik': 'medium',
  'Verbouwing pand': 'low',
  'Pand in gebruik (niet ingemeten)': 'low',
  'Pand in gebruik': 'low',
}

function statusSeverity(status: string | null | undefined): 'high' | 'medium' | 'low' {
  if (!status) return 'low'
  return STATUS_SEVERITY[status] ?? 'low'
}

/* ─── Sub-components ─────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  sublabel,
  icon,
}: {
  label: string
  value: string
  sublabel?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
        {icon && <span className="text-neutral-500">{icon}</span>}
      </div>
      <p className="mt-1 truncate text-2xl font-semibold leading-none text-aura-ink">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-neutral-500">{sublabel}</p>}
    </div>
  )
}

function CompletenessRing({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(1, value))
  const angle = Math.round(safeValue * 360)
  return (
    <div
      className="relative h-8 w-8 shrink-0 rounded-full"
      style={{
        background: `conic-gradient(rgba(217, 170, 56, 0.95) ${angle}deg, rgba(255, 255, 255, 0.12) ${angle}deg 360deg)`,
      }}
    >
      <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-aura-glass-white/60 text-[9px] font-semibold text-aura-amber">
        {Math.round(safeValue * 100)}
      </div>
    </div>
  )
}

/* ─── Icons (header-only) ────────────────────────────────────── */

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="3" y1="11" x2="21" y2="11" />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16" />
      <path d="M7 16h10" />
      <path d="M10 16V7h4v9" />
      <path d="M12 7V4" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="9" y1="9" x2="9" y2="9.01" />
      <line x1="15" y1="9" x2="15" y2="9.01" />
      <line x1="9" y1="13" x2="9" y2="13.01" />
      <line x1="15" y1="13" x2="15" y2="13.01" />
      <path d="M10 21v-4h4v4" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 2.1 5.4L19 9.5l-4.9 2.1L12 17l-2.1-5.4L5 9.5l4.9-2.1L12 2Z" />
      <path d="M5 20h.01" />
      <path d="M19 20h.01" />
    </svg>
  )
}

function PlanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="13" y2="16" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="6" y="11" width="3" height="7" rx="1" />
      <rect x="11" y="8" width="3" height="10" rx="1" />
      <rect x="16" y="5" width="3" height="13" rx="1" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function PrinterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </svg>
  )
}

/* ─── ReportHeader ───────────────────────────────────────────── */

export default function ReportHeader({
  data,
  backLabel,
  sourceParcelId,
  reportId = null,
  onBack,
  onViewOnMap,
  onPrint,
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

  const severity = statusSeverity(building?.status)
  const statusBadgeClass =
    severity === 'high'
      ? 'border-aura-amber/35 bg-aura-amber/10 text-aura-amber'
      : severity === 'medium'
        ? 'border-neutral-200/15 bg-neutral-50 text-neutral-700'
        : 'border-neutral-200 bg-neutral-50 text-neutral-600'

  // First parcel kadaster ID for header display
  const primaryPerceelId = cadastral_parcels[0]?.kadastrale_aanduiding ?? null

  // Derived values for metric cards
  const bestemming = data.zoning?.primary_bestemming ?? null
  const wozWaarde = data.woz_data?.meest_recente_waarde ?? null
  const center = data.map_data?.center_wgs84 ?? null

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-5 py-5 sm:px-6 sm:py-6">
      {/* Background glows */}
      <div className="pointer-events-none absolute -right-20 -top-16 h-52 w-52 rounded-full bg-aura-amber/10 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-36 w-36 rounded-full bg-neutral-50 blur-3xl" />

      <div className="relative">
        {/* Top row: address info + satellite thumbnail */}
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: back button, address, perceel badge, status badges */}
          <div className="min-w-0 flex-1">
            <div className="print-hide mb-3 flex items-center gap-3">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-700"
              >
                <ArrowLeftIcon />
                {backLabel}
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleGenerateDossier}
                  disabled={!reportId || isDossierGenerating}
                  className="flex items-center gap-2 rounded-lg border border-aura-amber/25 bg-aura-amber/10 px-3 py-2 text-sm font-medium text-aura-amber transition-colors hover:bg-aura-amber/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDossierGenerating ? <SpinnerIcon /> : <DocumentIcon />}
                  {isDossierGenerating ? 'Bezig...' : 'Genereer Startdossier'}
                </button>
                {onPrint && (
                  <button
                    onClick={onPrint}
                    className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-aura-ink"
                  >
                    <PrinterIcon />
                    Download PDF
                  </button>
                )}
              </div>
            </div>

            <h1 className="text-2xl font-semibold text-aura-ink sm:text-3xl">
              {address.straat} {address.huisnummer}
              {address.huisletter ?? ''}{address.toevoeging ?? ''}
            </h1>
            <p className="mt-1 text-neutral-500">
              {address.postcode}, {address.woonplaats}
            </p>

            {/* Kadaster perceel ID — prominent */}
            {primaryPerceelId && (
              <p className="mt-1.5 text-sm font-medium text-neutral-600">
                <span className="mr-1.5 text-xs font-normal text-neutral-500">Perceel</span>
                {primaryPerceelId}
                {cadastral_parcels.length > 1 && (
                  <span className="ml-1 text-xs text-neutral-500">+ {cadastral_parcels.length - 1} meer</span>
                )}
              </p>
            )}

            {/* Status + meta badges */}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {building?.status && (
                <span className={`rounded-full border px-2.5 py-1 font-medium ${statusBadgeClass}`}>
                  {building.status}
                </span>
              )}
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-medium text-neutral-600">
                {cadastral_parcels.length} percelen gekoppeld
              </span>
              {sourceParcelId && (
                <>
                  <span className="rounded-full border border-aura-amber/35 bg-aura-amber/10 px-2.5 py-1 font-medium text-aura-amber">
                    Perceelrapport gekoppeld
                  </span>
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-medium text-neutral-600">
                    Duplicaatbeveiliging actief
                  </span>
                </>
              )}
            </div>

            {/* Report date */}
            <p className="mt-2 text-xs text-neutral-500">
              Rapport van {dateFmt.format(new Date(data.resolved_at))}
            </p>
          </div>

          {/* Right: satellite thumbnail + view-on-map */}
          <div className="flex w-full flex-col gap-2 lg:w-64 lg:shrink-0">
            {center ? (
              <SatelliteThumbnail center={center} />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
                <span className="text-xs text-neutral-500">Geen kaartlocatie</span>
              </div>
            )}
            <button
              onClick={onViewOnMap}
              className="print-hide inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200/[0.1] bg-neutral-50 px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-aura-ink"
            >
              <MapPinIcon />
              Bekijk op kaart
            </button>
          </div>
        </div>

        {/* Metric cards grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            label="Bouwjaar"
            value={building?.bouwjaar?.toString() ?? '–'}
            sublabel={building?.bouwjaar ? `${new Date().getFullYear() - building.bouwjaar} jaar oud` : undefined}
            icon={<CalendarIcon />}
          />
          <MetricCard
            label="Vloeroppervlak"
            value={formatArea(building?.oppervlakte)}
            sublabel="gebruiksoppervlakte"
            icon={<ScaleIcon />}
          />
          <MetricCard
            label="Gebruiksdoel"
            value={building?.gebruiksdoel?.[0] ?? '–'}
            icon={<BuildingIcon />}
          />
          <MetricCard
            label="Bestemming"
            value={bestemming ?? '–'}
            icon={<PlanIcon />}
          />
          <MetricCard
            label="WOZ-waarde"
            value={formatCurrency(wozWaarde)}
            icon={<ChartIcon />}
          />
          <MetricCard
            label="Compleetheid"
            value={`${completenessPct}%`}
            icon={<SparkIcon />}
          />
        </div>

        {/* Completeness bar (compact) */}
        <div className="mt-3 flex items-center gap-2.5">
          <CompletenessRing value={completeness_score} />
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/80">
            <div
              className="h-full rounded-full bg-aura-amber transition-all"
              style={{
                width: `${completeness_score * 100}%`,
                opacity: completeness_score >= 0.8 ? 1 : completeness_score >= 0.5 ? 0.75 : 0.45,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
