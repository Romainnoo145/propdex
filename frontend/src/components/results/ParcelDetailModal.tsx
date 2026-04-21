import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'

import { MapPanelShell } from '@/components/map/panels/MapPanelShell'
import { ParcelEnrichmentCard } from './ParcelEnrichmentCard'
import { FysiekRisicoprofielSection } from './FysiekRisicoprofielSection'
import { MarketSignalsCards } from './MarketSignalsCards'
import { ProjectTypePickerModal } from '@/components/parcel/ProjectTypePickerModal'
import { useParcelEnrichment, useParcelRiskProfile } from '@/hooks/useScans'
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import { useParcelChanges } from '@/hooks/useNotifications'
import { useParcelProjectType } from '@/hooks/useParcelProjectType'
import { useAuth } from '@/lib/auth/useAuth'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { toast } from 'sonner'
import { FileText, MapPin } from 'lucide-react'
import type { ScanResultItem, BuildingMetrics } from '@/lib/types/scan'
import { PROJECT_TYPE_LABELS } from '@/lib/types/projectType'

const VACANCY_LABELS: Record<string, string> = {
  leeg_perceel: 'Leeg perceel',
  leegstaand_pand: 'Leegstaand pand',
  in_gebruik: 'Pand in gebruik',
  onbekend: 'Onbekend',
}

function formatPandStatusLabel(status: string | null | undefined, hasPand: boolean): string {
  if (!status) return hasPand ? 'Onbekend' : 'Geen gebouw'
  const normalized = status.trim().toLowerCase()
  if (normalized.includes('in gebruik')) return 'Pand in gebruik'
  if (normalized.includes('verbouwing')) return 'In verbouwing'
  if (normalized.includes('gesloopt')) return 'Gesloopt'
  if (normalized.includes('buiten gebruik')) return 'Buiten gebruik'
  if (normalized.includes('bouw gestart')) return 'Bouw gestart'
  return status
}

/** Map bestemming type to a color scheme for visual distinction */
function getBestemmingColor(type: string | null | undefined): {
  border: string
  bg: string
  text: string
  dot: string
} {
  const t = (type ?? '').toLowerCase()
  if (t.includes('wonen') || t.includes('woongebied'))
    return { border: 'border-amber-500/30', bg: 'bg-amber-500/8', text: 'text-amber-400', dot: 'bg-amber-400' }
  if (t.includes('groen') || t.includes('natuur') || t.includes('bos'))
    return { border: 'border-emerald-500/30', bg: 'bg-emerald-500/8', text: 'text-emerald-400', dot: 'bg-emerald-400' }
  if (t.includes('bedrijf') || t.includes('bedrijventerrein'))
    return { border: 'border-violet-500/30', bg: 'bg-violet-500/8', text: 'text-violet-400', dot: 'bg-violet-400' }
  if (t.includes('centrum') || t.includes('gemengd') || t.includes('detailhandel'))
    return { border: 'border-sky-500/30', bg: 'bg-sky-500/8', text: 'text-sky-400', dot: 'bg-sky-400' }
  if (t.includes('maatschappelijk'))
    return { border: 'border-rose-500/30', bg: 'bg-rose-500/8', text: 'text-rose-400', dot: 'bg-rose-400' }
  if (t.includes('recreatie') || t.includes('sport'))
    return { border: 'border-teal-500/30', bg: 'bg-teal-500/8', text: 'text-teal-400', dot: 'bg-teal-400' }
  if (t.includes('agrarisch'))
    return { border: 'border-lime-500/30', bg: 'bg-lime-500/8', text: 'text-lime-400', dot: 'bg-lime-400' }
  if (t.includes('verkeer'))
    return { border: 'border-slate-500/30', bg: 'bg-slate-500/8', text: 'text-slate-400', dot: 'bg-slate-400' }
  if (t.includes('water'))
    return { border: 'border-blue-500/30', bg: 'bg-blue-500/8', text: 'text-blue-400', dot: 'bg-blue-400' }
  // Fallback
  return { border: 'border-neutral-300', bg: 'bg-aura-glass-white/40', text: 'text-neutral-600', dot: 'bg-neutral-400' }
}

function hasResidentialMixedBestemming(
  bestemmingen: ScanResultItem['bestemmingen']
): boolean {
  if (!Array.isArray(bestemmingen)) return false
  return bestemmingen.some((bestemming) => {
    const type = (bestemming as { type?: string | null }).type ?? ''
    const naam = (bestemming as { naam?: string | null }).naam ?? ''
    const candidate = `${type} ${naam}`.toLowerCase()
    return (
      candidate.includes('wonen') ||
      candidate.includes('gemengd') ||
      candidate.includes('centrum')
    )
  })
}

function getScoreBadgeClass(score: number | null): string {
  if (score == null) {
    return 'bg-neutral-200 text-neutral-700'
  }
  if (score >= 65) {
    return 'bg-aura-amber/20 text-aura-amber'
  }
  if (score >= 35) {
    return 'bg-aura-amber/15 text-aura-amber'
  }
  return 'bg-aura-amber/10 text-aura-amber'
}

function clampPercent(value: number | null): number {
  if (value == null || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function formatScoreLabel(score: number | null): string {
  if (score == null) return 'Onbekend'
  if (score >= 70) return 'Zeer interessant'
  if (score >= 50) return 'Interessant'
  if (score >= 30) return 'Twijfelachtig'
  return 'Laag potentieel'
}

function formatPillarLevel(value: number | null): string {
  if (value == null) return 'Onbekend'
  if (value >= 80) return 'Zeer hoog'
  if (value >= 60) return 'Hoog'
  if (value >= 35) return 'Matig'
  return 'Laag'
}

function deriveTransformatiePotentie(
  metrics: BuildingMetrics | null,
  bouwjaar: number | null,
  supportsResidentialMixed: boolean,
  area_m2: number | null,
): { score: number; label: string } {
  const bouwhoogte = metrics?.max_bouwhoogte ?? null
  const bouwlagen = metrics?.max_bouwlagen ?? null
  const hasDSOData = bouwhoogte != null || bouwlagen != null

  // Extract actual dimensions from 3D BAG
  const actualHoogte = metrics?.actual_bouwhoogte ?? null
  const actualLagen = metrics?.actual_bouwlagen ?? null
  const has3DData = actualHoogte != null || actualLagen != null

  // Priority 1: Headroom path — actual vs permitted comparison
  if (has3DData && hasDSOData) {
    // Headroom = fraction of permitted envelope still unused
    // 0 = fully built out, 1 = empty (full headroom)
    const hoogteHeadroom =
      actualHoogte != null && bouwhoogte != null && bouwhoogte > 0
        ? Math.max(0, 1 - actualHoogte / bouwhoogte)
        : null
    const lagenHeadroom =
      actualLagen != null && bouwlagen != null && bouwlagen > 0
        ? Math.max(0, 1 - actualLagen / bouwlagen)
        : null

    // Use best available headroom signal (avoid double-counting — same envelope)
    const headroom =
      hoogteHeadroom != null && lagenHeadroom != null
        ? Math.max(hoogteHeadroom, lagenHeadroom)
        : (hoogteHeadroom ?? lagenHeadroom ?? 0)

    // Score from headroom — higher headroom = higher transformation potential
    const headroomPts =
      headroom >= 0.6 ? 50
      : headroom >= 0.4 ? 35
      : headroom >= 0.2 ? 20
      : 10

    const bestemmingPts = supportsResidentialMixed ? 20 : 5

    // Area score (same bands as existing heuristic)
    const areaScore =
      area_m2 == null ? 8
      : area_m2 > 5000 ? 15
      : area_m2 > 1000 ? 12
      : area_m2 > 200 ? 8
      : 3

    const score = Math.min(100, headroomPts + bestemmingPts + areaScore)

    // Label: "3/5 lagen · 8.5/15m · wonen ok"
    const parts: string[] = []
    if (actualLagen != null) parts.push(`${actualLagen}/${bouwlagen ?? '?'} lagen`)
    if (actualHoogte != null) parts.push(`${actualHoogte}/${bouwhoogte ?? '?'}m`)
    parts.push(supportsResidentialMixed ? 'wonen ok' : 'geen wonen')
    return { score, label: parts.join(' \u00b7 ') }
  }

  // Priority 2: DSO/PLU WMS data-driven path
  if (hasDSOData) {
    const hoogtePts =
      bouwhoogte == null ? 0
      : bouwhoogte >= 15 ? 35
      : bouwhoogte >= 10 ? 25
      : bouwhoogte >= 7 ? 18
      : bouwhoogte >= 4 ? 10
      : 5

    const lagenPts =
      bouwlagen == null ? 0
      : bouwlagen >= 5 ? 30
      : bouwlagen >= 4 ? 25
      : bouwlagen >= 3 ? 18
      : bouwlagen >= 2 ? 10
      : 5

    // Use stronger signal when both present; sum when only one is non-zero
    const buildingPts =
      bouwhoogte != null && bouwlagen != null
        ? Math.max(hoogtePts, lagenPts)
        : hoogtePts + lagenPts

    const bestemmingPts = supportsResidentialMixed ? 20 : 5
    const areaScore =
      area_m2 == null ? 3
      : area_m2 >= 2000 ? 15
      : area_m2 >= 1000 ? 10
      : area_m2 >= 500 ? 6
      : 3

    const score = Math.min(100, buildingPts + bestemmingPts + areaScore)

    const parts: string[] = []
    if (bouwlagen != null) parts.push(`${bouwlagen} lagen`)
    if (bouwhoogte != null) parts.push(`${bouwhoogte}m`)
    parts.push(supportsResidentialMixed ? 'wonen ok' : 'geen wonen')
    const label = parts.join(' \u00b7 ')

    return { score, label }
  }

  // Heuristic fallback — no PLU WMS dimension data available
  const bouwjaarScore =
    bouwjaar == null ? 10
    : bouwjaar < 1960 ? 30
    : bouwjaar < 1980 ? 22
    : bouwjaar < 2000 ? 14
    : bouwjaar < 2010 ? 8
    : 3
  const bestemmingScore = supportsResidentialMixed ? 30 : 10
  const areaScore =
    area_m2 == null ? 5
    : area_m2 >= 2000 ? 20
    : area_m2 >= 1000 ? 15
    : area_m2 >= 500 ? 10
    : 3
  const score = bouwjaarScore + bestemmingScore + areaScore

  const parts: string[] = []
  if (bouwjaar != null) parts.push(`Bouwjaar ${bouwjaar}`)
  parts.push(supportsResidentialMixed ? 'wonen ok' : 'niet-wonen')
  return { score, label: parts.join(' \u00b7 ') }
}

function ScoreDonut({
  score,
}: {
  score: number | null
}) {
  const normalized = clampPercent(score)
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const progress = (normalized / 100) * circumference

  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="h-full w-full">
        <circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth={10}
        />
        <circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          transform="rotate(-90 66 66)"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-semibold tabular-nums text-aura-ink">
          {score != null ? Math.round(score) : '--'}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-neutral-500">Score</p>
      </div>
    </div>
  )
}

function ScorePillarRows({
  label,
  value,
  context,
}: {
  label: string
  value: number | null
  context?: string
}) {
  const widthPct = clampPercent(value)
  const opacity = value == null ? 0.35 : value >= 65 ? 1 : value >= 40 ? 0.85 : 0.65

  return (
    <div className="rounded-md border border-neutral-200 bg-aura-glass-white/60/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-neutral-700">{label}</p>
        <p className="text-xs tabular-nums text-aura-amber">
          {value != null ? `${Math.round(value)}%` : '--'}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full bg-aura-amber"
          style={{ width: `${widthPct}%`, opacity }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-neutral-500">
        {formatPillarLevel(value)}
        {context ? ` · ${context}` : ''}
      </p>
    </div>
  )
}

interface ParcelDetailModalProps {
  parcel: ScanResultItem | null
  isOpen: boolean
  onClose: () => void
  onViewOnMap?: () => void
  presentation?: 'modal' | 'map-panel'
}

/**
 * Parcel detail modal with Tier 1 data and on-demand Tier 2 enrichment
 *
 * Shows immediately:
 * - Parcel code, address, gemeente
 * - Area, bebouwd status
 * - Score with breakdown
 * - Bestemmingen list
 *
 * Fetches on open:
 * - Tier 2 enrichment (vergunningen via SRU)
 */
export function ParcelDetailModal({
  parcel,
  isOpen,
  onClose,
  onViewOnMap,
  presentation = 'modal',
}: ParcelDetailModalProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Project type — query + first-open modal trigger
  const parcelId = parcel?.parcel_id
  const { data: projectTypeData } = useParcelProjectType(parcelId)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!parcelId || !projectTypeData || !user) return
    const hasAssignment =
      projectTypeData.project_type !== 'onbepaald' && projectTypeData.set_at !== null
    const skipKey = `parcelProjectTypeSkipped:${user.id}:${parcelId}`
    const hasSkipped = localStorage.getItem(skipKey) === 'true'
    if (!hasAssignment && !hasSkipped) {
      setPickerOpen(true)
    }
  }, [parcelId, projectTypeData, user])

  const handleSkip = () => {
    if (user && parcelId) {
      localStorage.setItem(`parcelProjectTypeSkipped:${user.id}:${parcelId}`, 'true')
    }
  }

  // Fetch enrichment only when modal is open
  const enrichment = useParcelEnrichment(parcel?.parcel_id ?? null, {
    enabled: isOpen && !!parcel?.parcel_id,
  })

  // Fetch fysiek risicoprofiel on demand when modal opens
  const riskProfile = useParcelRiskProfile(parcel?.parcel_id ?? null, {
    enabled: isOpen && !!parcel?.parcel_id,
  })

  const generateReport = useGenerateReportFromParcel()

  // Fetch matching bekendmakingen for this parcel's postcode
  const parcelChanges = useParcelChanges(
    isOpen && parcel?.parcel_id ? parcel.parcel_id : null
  )

  const handleGenerateReport = async () => {
    if (!parcel?.parcel_id) return
    const toastId = toast.loading('Rapport laden...')
    try {
      const result = await generateReport.mutateAsync(parcel.parcel_id)
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(result.created ? 'Rapport opgeslagen' : 'Bestaand rapport geopend', { id: toastId })
      onClose()
      void navigate({
        to: '/rapport/$id',
        params: { id: String(result.report.id) },
        search: { from: 'resultaten' },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Genereren mislukt'
      toast.error(message, { id: toastId })
    }
  }

  useEscapeKey(onClose, presentation === 'map-panel' && isOpen)

  if (!parcel) return null

  const statusLabel = formatPandStatusLabel(parcel.pand_status, parcel.has_pand)
  const vacancyLabel = parcel.vacancy_signal
    ? (VACANCY_LABELS[parcel.vacancy_signal] ?? parcel.vacancy_signal)
    : null
  // Hide vacancy signal when it contradicts BAG status:
  // - "Leeg perceel" makes no sense when BAG says "Pand in gebruik"
  // - Also hide when vacancy label duplicates the status label
  const vacancyContradictsStatus =
    parcel.vacancy_signal === 'leeg_perceel' && statusLabel === 'Pand in gebruik'
  const showVacancySignal =
    !!vacancyLabel &&
    !vacancyContradictsStatus &&
    statusLabel.trim().toLowerCase() !== vacancyLabel.trim().toLowerCase()
  const hasAddress = !!parcel.address?.trim()
  const titleLabel = hasAddress ? (parcel.address as string).trim() : 'Adres onbekend'
  const secondaryLabel = parcel.parcel_code || null
  const supportsResidentialMixed = hasResidentialMixedBestemming(parcel.bestemmingen)
  const scoreBadgeClass = getScoreBadgeClass(parcel.score)
  const actionableOpportunitySignals = (parcel.opportunity_signals ?? []).filter((signal) => {
    const normalized = signal.toLowerCase()
    return (
      !normalized.includes('pand momenteel in gebruik') &&
      !normalized.includes('leegstand onbekend')
    )
  })

  // Pillar 1: Vrije ruimte from pand_oppervlakte_m2
  // Treat 0 as null when parcel has a building — 0 means BAG footprint data missing, not truly empty
  const rawPandOpp = parcel.building_metrics?.pand_oppervlakte_m2 ?? null
  const pandOppervlaktM2 = rawPandOpp === 0 && parcel.has_pand ? null : rawPandOpp
  const vrijeRuimtePct: number | null =
    pandOppervlaktM2 != null && parcel.area_m2 != null && parcel.area_m2 > 0
      ? Math.max(0, Math.min(100, (1 - pandOppervlaktM2 / parcel.area_m2) * 100))
      : null

  // Pillar 2: Transformatiepotentie
  const buildingMetrics = parcel.building_metrics
  const transformatiePotentie = deriveTransformatiePotentie(
    buildingMetrics,
    parcel.bouwjaar,
    supportsResidentialMixed,
    parcel.area_m2,
  )

  // Status is "niet in gebruik" when it's anything other than "Pand in gebruik"
  const isNotInUse = statusLabel !== 'Pand in gebruik' && statusLabel !== 'Onbekend' && statusLabel !== 'Geen gebouw'

  const content = (
    <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-aura-ink">
              {titleLabel}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {secondaryLabel && (
                <p className="text-sm text-neutral-600">{secondaryLabel}</p>
              )}
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                  parcel.has_report
                    ? 'bg-aura-amber/15 text-aura-amber'
                    : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {parcel.has_report ? 'Rapport aanwezig' : 'Nog geen rapport'}
              </span>
              {parcel.score != null && (
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${scoreBadgeClass}`}
                >
                  Potentie {Math.round(parcel.score)}
                </span>
              )}
              {projectTypeData && projectTypeData.project_type !== 'onbepaald' && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                             bg-[#F9A826]/15 text-[#0E1111] text-xs font-bold tracking-wide
                             hover:bg-[#F9A826]/25 transition"
                >
                  {PROJECT_TYPE_LABELS[projectTypeData.project_type]}
                  <span className="text-neutral-500 font-normal">· wijzigen</span>
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-aura-ink transition-colors"
            aria-label="Sluiten"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Score + Pillar Section */}
        <div className="bg-aura-glass-white/40 rounded-md border border-neutral-200 p-4">
          {parcel.score != null && (
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-aura-ink">Propdex Potentiescore</p>
              <span className="rounded bg-aura-glass-white/60 px-2 py-0.5 text-[11px] text-neutral-600">
                0-100
              </span>
            </div>
          )}
          <div className={`grid gap-4 ${parcel.score != null ? 'sm:grid-cols-[132px_1fr]' : ''}`}>
            {parcel.score != null && (
              <div>
                <ScoreDonut score={parcel.score} />
                <p className="mt-2 text-center text-[11px] text-neutral-500">
                  {formatScoreLabel(parcel.score)}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <ScorePillarRows
                label="Vrije ruimte"
                value={vrijeRuimtePct}
                context={
                  pandOppervlaktM2 != null && parcel.area_m2 != null
                    ? `${Math.round(pandOppervlaktM2)} m\u00b2 bebouwd`
                    : parcel.has_pand
                      ? 'Footprint onbekend'
                      : 'Geen pand'
                }
              />
              <ScorePillarRows
                label="Transformatiepotentie"
                value={transformatiePotentie.score}
                context={transformatiePotentie.label}
              />
            </div>
          </div>
        </div>

        {/* Bestemmingsplan Section — between potentie and property info */}
        {parcel.bestemmingen && parcel.bestemmingen.length > 0 && (
          <div className="rounded-md border border-aura-amber/30 bg-aura-amber/5 p-4">
            <h3 className="text-sm font-medium text-aura-amber mb-3">
              Bestemmingsplan
            </h3>
            <div className="space-y-2">
              {parcel.bestemmingen.map((bestemming, idx) => {
                const b = bestemming as {
                  type?: string | null
                  naam?: string | null
                  max_bebouwingspercentage?: number | null
                  max_floor_area_ratio?: number | null
                }
                const colors = getBestemmingColor(b.type)
                return (
                  <div
                    key={idx}
                    className={`rounded-md border ${colors.border} ${colors.bg} px-3 py-2.5`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
                        <p className="text-sm font-medium text-aura-ink">
                          {b.naam || b.type || 'Onbekend'}
                        </p>
                      </div>
                      {b.type && (
                        <span className={`rounded px-2 py-0.5 text-[11px] ${colors.text} ${colors.bg}`}>
                          {b.type}
                        </span>
                      )}
                    </div>
                    {(b.max_bebouwingspercentage != null || b.max_floor_area_ratio != null) && (
                      <div className="mt-1.5 ml-4 flex gap-4 text-xs text-neutral-600">
                        {b.max_bebouwingspercentage != null && (
                          <span>Bebouwing max {b.max_bebouwingspercentage}%</span>
                        )}
                        {b.max_floor_area_ratio != null && (
                          <span>FAR {b.max_floor_area_ratio}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Property Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-aura-glass-white/40 rounded-md border border-neutral-200 p-4">
            <p className="text-xs text-neutral-600 mb-1">Oppervlak</p>
            <p className="text-sm font-medium text-aura-ink">
              {parcel.area_m2 != null ? Math.round(parcel.area_m2).toLocaleString('nl-NL') : '--'} m²
            </p>
          </div>
          <div className="bg-aura-glass-white/40 rounded-md border border-neutral-200 p-4">
            <p className="text-xs text-neutral-600 mb-1">Bouwjaar</p>
            <p className="text-sm font-medium text-aura-ink">
              {parcel.bouwjaar ?? 'Onbekend'}
            </p>
          </div>
          <div className={`rounded-md border p-4 ${
            isNotInUse
              ? 'border-aura-amber/40 bg-aura-amber/5'
              : 'border-neutral-200 bg-aura-glass-white/40'
          }`}>
            <p className="text-xs text-neutral-600 mb-1">Status</p>
            <p className={`text-sm font-medium ${isNotInUse ? 'text-aura-amber' : 'text-aura-ink'}`}>
              {statusLabel}
            </p>
          </div>
          {showVacancySignal && (
            <div className="bg-aura-glass-white/40 rounded-md border border-neutral-200 p-4">
              <p className="text-xs text-neutral-600 mb-1">Leegstandsignaal</p>
              <p className="text-sm font-medium text-aura-ink">
                {vacancyLabel}
              </p>
            </div>
          )}
          {parcel.gemeente_code && (
            <div className="bg-aura-glass-white/40 rounded-md border border-neutral-200 p-4">
              <p className="text-xs text-neutral-600 mb-1">Gemeente</p>
              <p className="text-sm font-medium text-aura-ink">
                {parcel.gemeente_code}
              </p>
            </div>
          )}
        </div>

        {/* Fysiek Risicoprofiel Section */}
        <FysiekRisicoprofielSection
          profiel={riskProfile.data?.fysiek_risico_profiel}
          isLoading={riskProfile.isLoading}
          isError={riskProfile.isError}
        />

        {(parcel.vacancy_reasons?.length || actionableOpportunitySignals.length > 0) && (
          <div>
            <h3 className="text-sm font-medium text-aura-ink mb-3">Kansen & aandachtspunten</h3>
            <div className="flex flex-wrap gap-2">
              {actionableOpportunitySignals.slice(0, 5).map((signal) => (
                <span
                  key={`opp-${signal}`}
                  className="rounded-full border border-aura-amber/40 bg-aura-amber/10 px-2.5 py-1 text-xs text-aura-amber"
                >
                  {signal}
                </span>
              ))}
              {(parcel.vacancy_reasons ?? []).slice(0, 3).map((reason) => (
                <span
                  key={`risk-${reason}`}
                  className="rounded-full border border-neutral-300 bg-aura-glass-white/40 px-2.5 py-1 text-xs text-neutral-700"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}

        {parcel.market_signals && (
          <div>
            <h3 className="text-sm font-medium text-aura-ink mb-3">
              Marktsignalen
            </h3>
            <MarketSignalsCards signals={parcel.market_signals} />
          </div>
        )}

        {/* Vergunningen Section (Tier 2 enrichment) */}
        <div>
          <h3 className="text-sm font-medium text-aura-ink mb-3">
            Vergunningen
          </h3>
          <ParcelEnrichmentCard
            data={enrichment.data}
            isLoading={enrichment.isLoading}
            error={enrichment.error?.message ?? null}
          />
        </div>

        {/* Meldingen Section — only shown when matching bekendmakingen exist */}
        {parcelChanges.data && parcelChanges.data.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-aura-ink mb-3">
              Meldingen
            </h3>
            <div className="space-y-2">
              {parcelChanges.data.map((change) => (
                <div
                  key={change.id}
                  className="flex items-start gap-2.5 rounded-md border border-neutral-200 bg-aura-glass-white/40 px-3 py-2.5"
                >
                  <div
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-aura-amber"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-700 line-clamp-2">
                      {change.title}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {new Intl.DateTimeFormat('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      }).format(new Date(change.change_date))}
                    </p>
                  </div>
                  {change.source_url && (
                    <a
                      href={change.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-neutral-600 hover:text-info transition-colors"
                      title="Bekijk publicatie"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {onViewOnMap && (
            <button
              onClick={() => { onClose(); onViewOnMap(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4
                         border border-neutral-200 text-neutral-700 font-medium rounded text-sm
                         hover:bg-aura-glass-white/40 hover:text-aura-ink
                         transition-colors motion-reduce:transition-none min-h-[44px]"
            >
              <MapPin size={14} />
              Bekijk op kaart
            </button>
          )}
          <button
            onClick={handleGenerateReport}
            disabled={generateReport.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4
                       bg-aura-amber text-aura-obsidian font-medium rounded text-sm
                       hover:bg-aura-amber/90 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors motion-reduce:transition-none min-h-[44px]"
          >
            <FileText size={14} />
            {generateReport.isPending
              ? 'Rapport laden...'
              : parcel.has_report
                ? 'Open bestaand rapport'
                : 'Genereer rapport'}
          </button>
        </div>

        {/* Project type picker modal — first-open trigger + wijzigen */}
        {parcelId && (
          <ProjectTypePickerModal
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            parcelId={parcelId}
            currentType={projectTypeData?.project_type ?? null}
            onSkip={handleSkip}
          />
        )}
    </div>
  )

  if (presentation === 'map-panel') {
    if (!isOpen) return null

    return (
      <MapPanelShell onClose={onClose}>
        {content}
      </MapPanelShell>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {content}
    </Modal>
  )
}
