import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/primitives'
import { ParcelEnrichmentCard } from './ParcelEnrichmentCard'
import { MarketSignalsCards } from './MarketSignalsCards'
import { useParcelEnrichment } from '@/hooks/useScans'
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import { useParcelChanges } from '@/hooks/useNotifications'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { toast } from 'sonner'
import { FileText, MapPin } from 'lucide-react'
import type { ScanResultItem, BuildingMetrics } from '@/lib/types/scan'

const VACANCY_LABELS: Record<string, string> = {
  leeg_perceel: 'Leeg perceel',
  leegstaand_pand: 'Leegstaand pand',
  in_gebruik: 'Pand in gebruik',
  onbekend: 'Onbekend',
}

function formatPandStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Onbekend'
  const normalized = status.trim().toLowerCase()
  if (normalized.includes('in gebruik')) return 'Pand in gebruik'
  if (normalized.includes('verbouwing')) return 'In verbouwing'
  if (normalized.includes('gesloopt')) return 'Gesloopt'
  if (normalized.includes('buiten gebruik')) return 'Buiten gebruik'
  return status
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
    return 'bg-grey-800 text-grey-300'
  }
  if (score >= 65) {
    return 'bg-amber-accent/20 text-amber-accent'
  }
  if (score >= 35) {
    return 'bg-amber-accent/15 text-amber-accent'
  }
  return 'bg-amber-accent/10 text-amber-accent'
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

  if (hasDSOData) {
    // DSO/PLU WMS data-driven path
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
        <p className="text-2xl font-semibold tabular-nums text-grey-100">
          {score != null ? Math.round(score) : '--'}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-grey-500">Score</p>
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
    <div className="rounded-md border border-grey-800 bg-grey-900/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-grey-300">{label}</p>
        <p className="text-xs tabular-nums text-amber-accent">
          {value != null ? `${Math.round(value)}%` : '--'}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-grey-800">
        <div
          className="h-full bg-amber-accent"
          style={{ width: `${widthPct}%`, opacity }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-grey-500">
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
  // Fetch enrichment only when modal is open
  const enrichment = useParcelEnrichment(parcel?.parcel_id ?? null, {
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

  const statusLabel = formatPandStatusLabel(parcel.pand_status)
  const vacancyLabel = parcel.vacancy_signal
    ? (VACANCY_LABELS[parcel.vacancy_signal] ?? parcel.vacancy_signal)
    : null
  const showVacancySignal =
    !!vacancyLabel &&
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
  const pandOppervlaktM2 = parcel.building_metrics?.pand_oppervlakte_m2 ?? null
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
  const isNotInUse = statusLabel !== 'Pand in gebruik' && statusLabel !== 'Onbekend'

  const content = (
    <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-grey-100">
              {titleLabel}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {secondaryLabel && (
                <p className="text-sm text-grey-400">{secondaryLabel}</p>
              )}
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                  parcel.has_report
                    ? 'bg-amber-accent/15 text-amber-accent'
                    : 'bg-grey-800 text-grey-300'
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
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-grey-600 hover:text-grey-100 transition-colors"
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

        {/* Score Section */}
        {parcel.score !== null && (
          <div className="bg-grey-850 rounded-md border border-grey-800 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-grey-100">Propdex Potentiescore</p>
              <span className="rounded bg-grey-900 px-2 py-0.5 text-[11px] text-grey-400">
                0-100
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-[132px_1fr]">
              <div>
                <ScoreDonut score={parcel.score} />
                <p className="mt-2 text-center text-[11px] text-grey-500">
                  {formatScoreLabel(parcel.score)}
                </p>
              </div>
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
        )}

        {/* Property Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-grey-850 rounded-md border border-grey-800 p-4">
            <p className="text-xs text-grey-400 mb-1">Oppervlak</p>
            <p className="text-sm font-medium text-grey-100">
              {parcel.area_m2 != null ? Math.round(parcel.area_m2).toLocaleString('nl-NL') : '--'} m²
            </p>
          </div>
          <div className="bg-grey-850 rounded-md border border-grey-800 p-4">
            <p className="text-xs text-grey-400 mb-1">Bouwjaar</p>
            <p className="text-sm font-medium text-grey-100">
              {parcel.bouwjaar ?? 'Onbekend'}
            </p>
          </div>
          <div className={`rounded-md border p-4 ${
            isNotInUse
              ? 'border-amber-accent/40 bg-amber-accent/5'
              : 'border-grey-800 bg-grey-850'
          }`}>
            <p className="text-xs text-grey-400 mb-1">Status</p>
            <p className={`text-sm font-medium ${isNotInUse ? 'text-amber-accent' : 'text-grey-100'}`}>
              {statusLabel}
            </p>
          </div>
          {showVacancySignal && (
            <div className="bg-grey-850 rounded-md border border-grey-800 p-4">
              <p className="text-xs text-grey-400 mb-1">Leegstandsignaal</p>
              <p className="text-sm font-medium text-grey-100">
                {vacancyLabel}
              </p>
            </div>
          )}
          {parcel.gemeente_code && (
            <div className="bg-grey-850 rounded-md border border-grey-800 p-4">
              <p className="text-xs text-grey-400 mb-1">Gemeente</p>
              <p className="text-sm font-medium text-grey-100">
                {parcel.gemeente_code}
              </p>
            </div>
          )}
        </div>

        {(parcel.vacancy_reasons?.length || actionableOpportunitySignals.length > 0) && (
          <div>
            <h3 className="text-sm font-medium text-grey-100 mb-3">Kansen & aandachtspunten</h3>
            <div className="flex flex-wrap gap-2">
              {actionableOpportunitySignals.slice(0, 5).map((signal) => (
                <span
                  key={`opp-${signal}`}
                  className="rounded-full border border-amber-accent/40 bg-amber-accent/10 px-2.5 py-1 text-xs text-amber-accent"
                >
                  {signal}
                </span>
              ))}
              {(parcel.vacancy_reasons ?? []).slice(0, 3).map((reason) => (
                <span
                  key={`risk-${reason}`}
                  className="rounded-full border border-grey-700 bg-grey-850 px-2.5 py-1 text-xs text-grey-300"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}

        {parcel.market_signals && (
          <div>
            <h3 className="text-sm font-medium text-grey-100 mb-3">
              Marktsignalen
            </h3>
            <MarketSignalsCards signals={parcel.market_signals} />
          </div>
        )}

        {/* Bestemmingen Section */}
        {parcel.bestemmingen && parcel.bestemmingen.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-grey-100 mb-3">
              Bestemmingen
            </h3>
            <div className="flex flex-wrap gap-2">
              {parcel.bestemmingen.map((bestemming, idx) => (
                <Badge key={idx} variant="amber">
                  {(bestemming as { type?: string }).type ||
                    (bestemming as { naam?: string }).naam ||
                    'Onbekend'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Vergunningen Section (Tier 2 enrichment) */}
        <div>
          <h3 className="text-sm font-medium text-grey-100 mb-3">
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
            <h3 className="text-sm font-medium text-grey-100 mb-3">
              Meldingen
            </h3>
            <div className="space-y-2">
              {parcelChanges.data.map((change) => (
                <div
                  key={change.id}
                  className="flex items-start gap-2.5 rounded-md border border-grey-800 bg-grey-850 px-3 py-2.5"
                >
                  <div
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-grey-300 line-clamp-2">
                      {change.title}
                    </p>
                    <p className="mt-0.5 text-xs text-grey-400">
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
                      className="shrink-0 text-grey-400 hover:text-info transition-colors"
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
                         border border-grey-800 text-grey-300 font-medium rounded text-sm
                         hover:bg-grey-850 hover:text-grey-100
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
                       bg-amber-accent text-on-accent font-medium rounded text-sm
                       hover:bg-amber-accent/90 disabled:opacity-50 disabled:cursor-not-allowed
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
    </div>
  )

  if (presentation === 'map-panel') {
    if (!isOpen) return null

    return (
      <>
        <div
          className="fixed right-4 top-20 bottom-4 hidden md:block w-96"
          style={{ zIndex: 'calc(var(--z-map-controls) + 2)' }}
        >
          <div className="h-full overflow-y-auto rounded-lg border border-grey-800 bg-grey-900 shadow-2xl">
            {content}
          </div>
        </div>

        <div
          className="fixed inset-x-0 bottom-0 md:hidden max-h-[72vh]"
          style={{ zIndex: 'calc(var(--z-map-controls) + 2)' }}
        >
          <div className="h-full overflow-y-auto rounded-t-lg border border-grey-800 bg-grey-900 shadow-2xl">
            {content}
          </div>
        </div>
      </>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {content}
    </Modal>
  )
}
