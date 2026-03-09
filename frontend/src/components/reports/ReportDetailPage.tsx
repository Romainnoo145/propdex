import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth/useAuth'
import { uploadBestemmingsplanPDF } from '@/lib/api'
import { splitZoningPlans } from '@/lib/zoningPlans'
import type { PropertyReportResponse, WBBDossierRef } from '@/lib/types/property'
import ReportHeader from './ReportHeader'
import ActieVereistSection from './ActieVereistSection'

interface ReportDetailPageProps {
  data: PropertyReportResponse | null
  isLoading: boolean
  backLabel?: string
  sourceParcelId?: string | null
  reportId?: string | null
  onBack: () => void
  onViewOnMap: () => void
}

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const dateFmtFull = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Map BAG statuses to developer-oriented Dutch explanations */
const STATUS_EXPLANATIONS: Record<string, { label: string; description: string; severity: 'high' | 'medium' | 'low' }> = {
  'Sloopvergunning verleend': {
    label: 'Sloopvergunning verleend',
    description: 'Er is een vergunning afgegeven om dit pand te slopen. Dit duidt op herontwikkelingsmogelijkheden — de grond komt mogelijk beschikbaar.',
    severity: 'high',
  },
  'Pand gesloopt': {
    label: 'Pand gesloopt',
    description: 'Dit pand is gesloopt. De locatie is mogelijk beschikbaar voor nieuwbouw, afhankelijk van het bestemmingsplan.',
    severity: 'high',
  },
  'Bouw gestart': {
    label: 'Bouw gestart',
    description: 'Er wordt momenteel gebouwd op deze locatie. Nieuwbouw of renovatie is gaande.',
    severity: 'medium',
  },
  'Bouwvergunning verleend': {
    label: 'Bouwvergunning verleend',
    description: 'Er is een bouwvergunning afgegeven. Bouw kan elk moment starten.',
    severity: 'medium',
  },
  'Niet gerealiseerd pand': {
    label: 'Niet gerealiseerd',
    description: 'Dit pand is nooit daadwerkelijk gebouwd ondanks een afgegeven vergunning.',
    severity: 'medium',
  },
  'Pand in gebruik (niet ingemeten)': {
    label: 'In gebruik (niet ingemeten)',
    description: 'Pand is in gebruik maar nog niet definitief ingemeten door het Kadaster.',
    severity: 'low',
  },
  'Pand in gebruik': {
    label: 'In gebruik',
    description: 'Regulier pand in normaal gebruik.',
    severity: 'low',
  },
  'Pand buiten gebruik': {
    label: 'Buiten gebruik',
    description: 'Dit pand is niet meer in gebruik. Mogelijk leegstand — potentieel geschikt voor transformatie of herontwikkeling.',
    severity: 'medium',
  },
  'Verbouwing pand': {
    label: 'Verbouwing gaande',
    description: 'Dit pand wordt momenteel verbouwd.',
    severity: 'low',
  },
}

function getStatusInfo(status: string | null | undefined) {
  if (!status) return null
  return STATUS_EXPLANATIONS[status] ?? {
    label: status,
    description: '',
    severity: 'low' as const,
  }
}

function formatArea(value: number | null | undefined): string {
  if (value == null) return '–'
  return `${Math.round(value).toLocaleString('nl-NL')} m²`
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '–'
  return `EUR ${Math.round(value).toLocaleString('nl-NL')}`
}

export default function ReportDetailPage({
  data,
  isLoading,
  backLabel = 'Terug naar projecten',
  sourceParcelId = null,
  reportId = null,
  onBack,
  onViewOnMap,
}: ReportDetailPageProps) {
  const { user } = useAuth()

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto bg-aura-canvas">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-40 rounded-2xl bg-neutral-200/50" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-neutral-200/50" />)}
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-neutral-200/50" />)}
              </div>
              <div className="space-y-4">
                {[1, 2].map((i) => <div key={i} className="h-36 rounded-xl bg-neutral-200/50" />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-full overflow-y-auto bg-aura-canvas">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center sm:px-6 lg:px-8">
          <p className="text-neutral-500">Rapport niet gevonden</p>
          <button onClick={onBack} className="mt-4 text-sm text-neutral-600 underline hover:text-aura-ink">
            {backLabel}
          </button>
        </div>
      </div>
    )
  }

  const { building, ai_parsing, completeness_score } = data
  const statusInfo = getStatusInfo(building?.status)
  const completenessPct = Math.round(completeness_score * 100)
  const { address } = data

  return (
    <div className="h-full overflow-y-auto bg-aura-canvas">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* PDF-only header — hidden on screen, visible in print */}
        <div className="pdf-only mb-6 border-b border-neutral-300 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-aura-ink">Vastgoedrapport</p>
              <p className="text-sm text-neutral-600">
                {address.straat} {address.huisnummer}{address.huisletter ?? ''}{address.toevoeging ?? ''}, {address.woonplaats}
              </p>
            </div>
            <div className="text-right text-sm text-neutral-500">
              <p>Opgesteld door: {user?.full_name ?? 'Propdex'}</p>
              <p>{dateFmt.format(new Date(data.resolved_at))}</p>
            </div>
          </div>
        </div>

        <ReportHeader
          data={data}
          backLabel={backLabel}
          sourceParcelId={sourceParcelId}
          reportId={reportId}
          onBack={onBack}
          onViewOnMap={onViewOnMap}
          onPrint={handlePrint}
        />

        {/* Replaced by ActieVereistSection — Plan 65-03 */}
        {/* {isActionableStatus && (
          <SignalBanner
            statusInfo={statusInfo}
            documentdatum={building?.documentdatum}
            documentnummer={building?.documentnummer}
          />
        )} */}

        {/* Replaced by ActieVereistSection — Plan 65-03 */}
        {/* {monuments?.is_monument && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-aura-amber/20 bg-aura-amber/[0.06] px-5 py-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-amber/10">
              <MonumentIcon />
            </div>
            <div>
              <p className="font-semibold text-aura-amber">{monuments.consensus_status ?? 'Rijksmonument'}</p>
              <p className="mt-0.5 text-sm text-neutral-600">
                Monumentale status beperkt sloop- en verbouwmogelijkheden. Vergunningsplicht voor wijzigingen.
                {monuments.restrictions_summary && monuments.restrictions_summary.length > 0 && (
                  <span className="ml-1 text-aura-amber/70">
                    {monuments.restrictions_summary.length} beperkingen van toepassing.
                  </span>
                )}
              </p>
            </div>
          </div>
        )} */}

        <div className="report-grid grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <ActieVereistSection data={data} />
            <BestemmingSection data={data} />
            <KadasterSection data={data} />
            <BRKOwnershipSection data={data} />
            <GebouwSection data={data} />
            <WOZSection data={data} />
            <EnergyLabelSection data={data} />
            <BuildabilityDeltaSection data={data} />
            <WkbClassificatieSection data={data} />
            <AsbestSection data={data} />
            <BodemSection data={data} />
            <WkbPrecheckSection data={data} />
            <PermitPrecedentsSection data={data} />
            <MarketSignalsSection data={data} />
            {ai_parsing?.parsed_plan && ai_parsing.status === 'complete' ? (
              <AIInterpretatieSection data={data} />
            ) : (
              <PDFUploadSection data={data} />
            )}
          </div>
          <aside className="report-aside space-y-5 xl:sticky xl:top-5 xl:self-start">
            <ReportMetaCard
              resolvedAt={data.resolved_at}
              status={statusInfo?.label}
              completenessPct={completenessPct}
              parcelCount={data.cadastral_parcels.length}
              onViewOnMap={onViewOnMap}
            />
            <MonumentSection data={data} />
            <BronnenSection data={data} />
          </aside>
        </div>

        {/* Screen footer */}
        <div className="print-hide mt-8 border-t border-neutral-200 pt-4 text-center text-xs text-neutral-500">
          Rapport gegenereerd op {dateFmtFull.format(new Date(data.resolved_at))}
        </div>

        {/* PDF-only footer — hidden on screen, visible in print */}
        <div className="pdf-only mt-8 border-t border-neutral-300 pt-4 text-center text-xs text-neutral-500">
          Gegenereerd via Propdex | {dateFmt.format(new Date())}
        </div>
      </div>
    </div>
  )
}

/* ─── Signal Banner — replaced by ActieVereistSection (Plan 65-03) ──── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SignalBanner({
  statusInfo,
  documentdatum,
  documentnummer,
}: {
  statusInfo: { label: string; description: string; severity: 'high' | 'medium' | 'low' }
  documentdatum: string | null | undefined
  documentnummer: string | null | undefined
}) {
  const isHigh = statusInfo.severity === 'high'
  const borderColor = isHigh ? 'border-aura-amber/30' : 'border-neutral-200'
  const bgColor = isHigh ? 'bg-aura-amber/[0.06]' : 'bg-neutral-50'
  const iconBg = isHigh ? 'bg-aura-amber/15' : 'bg-neutral-50'
  const titleColor = isHigh ? 'text-aura-amber' : 'text-neutral-700'

  return (
    <div className={`mb-6 rounded-2xl border ${borderColor} ${bgColor} px-5 py-4`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <AlertIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`font-semibold ${titleColor}`}>{statusInfo.label}</p>
            {documentdatum && (
              <span className="text-xs text-neutral-500">
                {dateFmt.format(new Date(documentdatum))}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            {statusInfo.description}
          </p>
          {documentnummer && (
            <p className="mt-2 text-xs text-neutral-500">
              Documentnr: <span className="font-mono text-neutral-500">{documentnummer}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* MetricCard and CompletenessRing moved to ReportHeader.tsx */

function ReportMetaCard({
  resolvedAt,
  status,
  completenessPct,
  parcelCount,
  onViewOnMap,
}: {
  resolvedAt: string
  status?: string
  completenessPct: number
  parcelCount: number
  onViewOnMap: () => void
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-aura-glass-white/60 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Overzicht</p>
      <div className="mt-3 space-y-2 text-sm text-neutral-700">
        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-500">Status</span>
          <span className="truncate text-right">{status ?? 'Onbekend'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-500">Compleetheid</span>
          <span className="font-semibold text-aura-amber">{completenessPct}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-500">Percelen</span>
          <span>{parcelCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-500">Laatste update</span>
          <span>{dateFmt.format(new Date(resolvedAt))}</span>
        </div>
      </div>
      <button
        onClick={onViewOnMap}
        className="print-hide mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200/[0.1] bg-neutral-50 px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-aura-ink"
      >
        <MapPinIcon />
        Bekijk op kaart
      </button>
    </div>
  )
}

/* ─── Section Wrapper ───────────────────────────────────────── */

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="section-card rounded-2xl border border-neutral-200 bg-aura-glass-white/60">
      <div className="border-b border-neutral-200 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide leading-none text-neutral-500">
          {icon && (
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-neutral-500">
              {icon}
            </span>
          )}
          {title}
        </h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

/* ─── Row helper ────────────────────────────────────────────── */

function Row({ label, value, mono, muted }: { label: string; value: string | null | undefined; mono?: boolean; muted?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className={`text-sm font-medium ${muted ? 'text-neutral-500' : 'text-neutral-700'} ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

/* ─── Gebouw & BAG ──────────────────────────────────────────── */

function GebouwSection({ data }: { data: PropertyReportResponse }) {
  const { address, building } = data
  const gebruiksdoel = building?.gebruiksdoel ?? []
  const statusInfo = getStatusInfo(building?.status)

  return (
    <Section title="Gebouw & BAG" icon={<BuildingIcon />}>
      <div className="divide-y divide-neutral-200">
        <Row label="Bouwjaar" value={building?.bouwjaar?.toString()} />
        {building?.status && (
          <div className="flex items-baseline justify-between py-2">
            <span className="text-sm text-neutral-500">Status</span>
            <div className="text-right">
              <span className={`text-sm font-medium ${statusInfo?.severity === 'high' ? 'text-aura-amber' : statusInfo?.severity === 'medium' ? 'text-neutral-700' : 'text-neutral-700'}`}>
                {statusInfo?.label ?? building.status}
              </span>
            </div>
          </div>
        )}
        {building?.documentnummer && (
          <Row label="Documentnr" value={building.documentnummer} mono />
        )}
        <Row label="Gebruiksoppervlakte (VBO)" value={formatArea(building?.oppervlakte)} />
        {gebruiksdoel.length > 0 && (
          <div className="flex items-baseline justify-between py-2">
            <span className="text-sm text-neutral-500">Gebruiksdoel</span>
            <div className="flex flex-wrap justify-end gap-1">
              {gebruiksdoel.map((doel) => (
                <span key={doel} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                  {doel}
                </span>
              ))}
            </div>
          </div>
        )}
        {/* BAG IDs — de-emphasized */}
        <div className="pt-3">
          <p className="mb-1.5 text-xs font-medium text-neutral-500">BAG referenties</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-xs text-neutral-500">
              Pand <a
                href={`https://bagviewer.kadaster.nl/lvbag/bag-viewer/?searchQuery=${building?.pand_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-neutral-500 underline decoration-neutral-400 underline-offset-2 hover:text-neutral-700"
              >{building?.pand_id}</a>
            </span>
            <span className="text-xs text-neutral-500">
              Nummeraanduiding <span className="font-mono text-neutral-500">{address.nummeraanduiding_id}</span>
            </span>
            {address.verblijfsobject_id && (
              <span className="text-xs text-neutral-500">
                VBO <span className="font-mono text-neutral-500">{address.verblijfsobject_id}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}

/* ─── Kadaster ──────────────────────────────────────────────── */

function KadasterSection({ data }: { data: PropertyReportResponse }) {
  const parcels = data.cadastral_parcels || []

  if (parcels.length === 0) {
    return (
      <Section title="Kadaster" icon={<ParcelIcon />}>
        <p className="text-sm text-neutral-500">Geen kadastrale gegevens beschikbaar</p>
      </Section>
    )
  }

  const totalOpp = parcels.reduce((sum, p) => sum + (p.oppervlakte ?? 0), 0)

  return (
    <Section title="Kadaster" icon={<ParcelIcon />}>
      <div className="space-y-3">
        {parcels.map((parcel, idx) => (
          <div key={idx} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            {parcel.kadastrale_aanduiding && (
              <p className="mb-2 text-sm font-semibold text-neutral-700">
                <a
                  href={`https://kadastralekaart.com/perceel/${parcel.kadastrale_aanduiding?.replace(/\s+/g, '/')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-neutral-400 underline-offset-2 hover:text-aura-ink"
                >
                  {parcel.kadastrale_aanduiding}
                </a>
              </p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-neutral-500">Perceelnr</p>
                <p className="text-sm font-medium text-neutral-700">{parcel.perceelnummer ?? '–'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Sectie</p>
                <p className="text-sm font-medium text-neutral-700">{parcel.sectie ?? '–'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Kavelgrootte</p>
                <p className="text-sm font-medium text-neutral-700">{formatArea(parcel.oppervlakte)}</p>
              </div>
            </div>
          </div>
        ))}
        {parcels.length > 1 && totalOpp > 0 && (
          <div className="flex justify-end pt-1">
            <span className="text-xs text-neutral-500">Totaal: <strong className="text-neutral-700">{formatArea(totalOpp)}</strong></span>
          </div>
        )}
      </div>
    </Section>
  )
}

/* ─── Bebouwingsanalyse ────────────────────────────────────── */

function BuildabilityDeltaSection({ data }: { data: PropertyReportResponse }) {
  const delta = data.buildability_delta

  if (!delta) {
    return (
      <Section title="Bebouwingsanalyse" icon={<BuildabilityIcon />}>
        <p className="text-sm text-neutral-500">
          Nog geen berekende bouwruimte beschikbaar voor dit dossier
        </p>
      </Section>
    )
  }

  const confidenceLabel =
    delta.confidence === 'high' ? 'Hoog' : delta.confidence === 'medium' ? 'Middel' : 'Laag'
  const confidenceClass =
    delta.confidence === 'high'
      ? 'border-success/25 bg-success/[0.08] text-success'
      : delta.confidence === 'medium'
        ? 'border-aura-amber/25 bg-aura-amber/10 text-aura-amber'
        : 'border-warning/25 bg-warning/[0.08] text-warning'
  const limitConfidenceLabel =
    delta.limit_confidence === 'high'
      ? 'Hoog'
      : delta.limit_confidence === 'medium'
        ? 'Middel'
        : delta.limit_confidence === 'low'
          ? 'Laag'
          : null

  const parcelArea = delta.parcel_area_m2
  const currentBuiltArea = delta.current_built_area_m2
  const builtRatioRaw =
    delta.current_built_ratio_pct != null
      ? delta.current_built_ratio_pct
      : parcelArea != null && currentBuiltArea != null && parcelArea > 0
        ? (currentBuiltArea / parcelArea) * 100
        : null
  const builtRatio = builtRatioRaw == null ? null : Math.max(0, Math.min(100, builtRatioRaw))
  const builtRatioVisual =
    builtRatio == null || builtRatio <= 0 ? 0 : builtRatio < 2 ? 2 : builtRatio
  const currentFarLabel =
    delta.current_far == null
      ? null
      : `FAR ${delta.current_far.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}`

  const missingPlanInputs: string[] = []
  if (delta.max_bebouwingspercentage_pct == null) {
    missingPlanInputs.push('Max bebouwingspercentage (TAR)')
  }
  if (delta.max_far == null) {
    missingPlanInputs.push('Max vloerfactor (FAR)')
  }
  const hasPlanBlocker = missingPlanInputs.length > 0

  return (
    <Section title="Bouwruimte Delta" icon={<BuildabilityIcon />}>
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-3">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceClass}`}>
            Confidence: {confidenceLabel}
          </span>
        </div>
        {delta.limit_source && (
          <p className="text-xs text-neutral-500">
            Planlimiet bron:
            <span className="ml-1 font-medium text-neutral-700">{delta.limit_source}</span>
            {limitConfidenceLabel && (
              <span className="ml-1 text-neutral-500">({limitConfidenceLabel})</span>
            )}
          </p>
        )}

        <div className="space-y-2">
          <p className="text-xs text-neutral-500">
            Perceeloppervlakte:
            <span className="ml-1 font-semibold text-aura-ink">
              {parcelArea == null ? 'Onbekend' : formatArea(parcelArea)}
            </span>
          </p>

          <div className="relative h-8 overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.02) 8px, rgba(255,255,255,0.02) 16px)',
              }}
            />
            {builtRatioVisual > 0 && (
              <div
                className="absolute inset-y-0 left-0 bg-aura-amber"
                style={{ width: `${builtRatioVisual}%` }}
              />
            )}
          </div>

          <p className="text-xs text-neutral-500">
            Huidig gebouwd:
            <span className="ml-1 font-semibold text-aura-ink">
              {currentBuiltArea == null ? 'Onbekend' : formatArea(currentBuiltArea)}
            </span>
            <span className="ml-1 text-neutral-500">
              ({builtRatio == null
                ? 'ratio onbekend'
                : `${builtRatio.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}%`}
              {currentFarLabel ? ` · ${currentFarLabel}` : ''})
            </span>
          </p>
        </div>

        {hasPlanBlocker ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <p className="text-sm font-medium text-aura-ink">Resterende bouwruimte niet te berekenen</p>
            <p className="mt-1 text-xs text-neutral-500">
              Niet in bestemmingsplan gevonden: {missingPlanInputs.join(' en ')}.
              Bovenstaande balk toont alleen het huidige bebouwingspercentage.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <p className="text-sm text-neutral-700">
              Planlimiet: TAR {delta.max_bebouwingspercentage_pct?.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}% · FAR {delta.max_far?.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Resterend bebouwbaar: {delta.remaining_buildable_area_m2 == null ? 'Niet berekend' : formatArea(delta.remaining_buildable_area_m2)}
            </p>
          </div>
        )}

        {delta.notes.length > 0 && (
          <div className="border-t border-neutral-200 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Toelichting</p>
            <div className="mt-1 space-y-1">
              {delta.notes.slice(0, 3).map((note) => (
                <p key={note} className="text-xs text-neutral-600">{note}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

/* ─── Wkb Classificatie ─────────────────────────────────────── */

const ASBEST_RISK_STYLES: Record<string, string> = {
  hoog: 'border-red-500/30 bg-red-500/10 text-red-400',
  middel: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  geen: 'border-green-500/25 bg-green-500/[0.08] text-green-400',
  onbekend: 'border-neutral-200 bg-neutral-50 text-neutral-600',
}

const ASBEST_RISK_LABELS: Record<string, string> = {
  hoog: 'Hoog',
  middel: 'Middel',
  geen: 'Geen',
  onbekend: 'Onbekend',
}

function WkbClassificatieSection({ data }: { data: PropertyReportResponse }) {
  const classification = data.wkb_classification

  if (!classification) {
    return (
      <Section title="Wkb Classificatie" icon={<WkbClassificatieIcon />}>
        <p className="text-sm text-neutral-500">Classificatie niet beschikbaar</p>
      </Section>
    )
  }

  if (!classification.wkb_applicable) {
    const exclusionMessage =
      classification.exclusion_reason === 'rijksmonument'
        ? 'Wkb niet van toepassing — rijksmonumenten zijn vrijgesteld'
        : classification.exclusion_reason === 'verbouwing'
          ? 'Wkb niet van toepassing — verbouwingen zijn uitgesloten (december 2024)'
          : 'Wkb niet van toepassing'

    return (
      <Section title="Wkb Classificatie" icon={<WkbClassificatieIcon />}>
        <div className="space-y-2">
          <p className="text-sm text-neutral-600">{exclusionMessage}</p>
          <p className="text-[11px] text-neutral-500">{classification.disclaimer}</p>
        </div>
      </Section>
    )
  }

  const gevolgklasseLabel =
    classification.gevolgklasse === 'GK1'
      ? 'Gevolgklasse 1'
      : classification.gevolgklasse

  return (
    <Section title="Wkb Classificatie" icon={<WkbClassificatieIcon />}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-aura-amber/30 bg-aura-amber/10 px-3 py-1 text-xs font-semibold text-aura-amber">
            {gevolgklasseLabel}
          </span>
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
            Indicatief
          </span>
        </div>
        <p className="text-[11px] text-neutral-500">{classification.disclaimer}</p>
      </div>
    </Section>
  )
}

function AsbestSection({ data }: { data: PropertyReportResponse }) {
  const indicator = data.asbest_indicator

  if (!indicator) return null

  const riskStyle = ASBEST_RISK_STYLES[indicator.risk] ?? ASBEST_RISK_STYLES.onbekend
  const riskLabel = ASBEST_RISK_LABELS[indicator.risk] ?? indicator.risk

  return (
    <Section title="Asbestrisico" icon={<AsbestIcon />}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskStyle}`}>
            {riskLabel}
          </span>
          {indicator.norm_reference && (
            <span className="text-xs text-neutral-500">{indicator.norm_reference}</span>
          )}
        </div>
        <p className="text-sm text-neutral-600">{indicator.reden}</p>
      </div>
    </Section>
  )
}

/* ─── Bodemkwaliteit ─────────────────────────────────────── */

function BodemIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Layers icon — represents soil strata */}
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function WBBDossierRow({ dossier }: { dossier: WBBDossierRef }) {
  return (
    <div className="rounded-md border border-neutral-200/[0.06] bg-neutral-50 p-3 space-y-1">
      {dossier.status_oord && (
        <p className="text-sm font-medium text-aura-ink">{dossier.status_oord}</p>
      )}
      {dossier.vervolg_wbb && (
        <p className="text-xs text-neutral-600">Vervolg: {dossier.vervolg_wbb}</p>
      )}
      {dossier.administrator_nm && (
        <p className="text-xs text-neutral-500">Bevoegd gezag: {dossier.administrator_nm}</p>
      )}
      {dossier.wbb_dossier_dbk && (
        <p className="text-[11px] text-neutral-500">Dossier: {dossier.wbb_dossier_dbk}</p>
      )}
    </div>
  )
}

function BodemSection({ data }: { data: PropertyReportResponse }) {
  const bodem = data.bodem_data

  if (!bodem) {
    return (
      <Section title="Bodemkwaliteit" icon={<BodemIcon />}>
        <p className="text-sm text-neutral-500">Bodemdata niet beschikbaar</p>
      </Section>
    )
  }

  if (bodem.dossiers.length === 0) {
    return (
      <Section title="Bodemkwaliteit" icon={<BodemIcon />}>
        <div className="space-y-2">
          <p className="text-sm text-neutral-600">Geen geregistreerde verontreiniging gevonden</p>
          <p className="text-[11px] text-neutral-500">{bodem.disclaimer}</p>
        </div>
      </Section>
    )
  }

  return (
    <Section title="Bodemkwaliteit" icon={<BodemIcon />}>
      <div className="space-y-3">
        {bodem.dossiers.map((d, idx) => (
          <WBBDossierRow key={d.wbb_dossier_dbk ?? idx} dossier={d} />
        ))}
        <p className="text-[11px] text-neutral-500 mt-2">{bodem.disclaimer}</p>
      </div>
    </Section>
  )
}

/* ─── Wkb Startdossier ─────────────────────────────────────── */

function WkbPrecheckSection({ data }: { data: PropertyReportResponse }) {
  const precheck = data.wkb_precheck

  if (!precheck) {
    return (
      <Section title="Wkb Startdossier" icon={<WkbIcon />}>
        <p className="text-sm text-neutral-500">
          Nog geen Wkb precheck beschikbaar voor dit dossier
        </p>
      </Section>
    )
  }

  const statusLabel =
    precheck.status === 'likely_required'
      ? 'Waarschijnlijk vereist'
      : precheck.status === 'likely_not_required'
        ? 'Waarschijnlijk niet vereist'
        : precheck.status === 'not_applicable'
          ? 'Niet toepasbaar'
          : 'Onzeker'

  const statusClass =
    precheck.status === 'likely_required'
      ? 'border-aura-amber/30 bg-aura-amber/10 text-aura-amber'
      : precheck.status === 'likely_not_required'
        ? 'border-success/25 bg-success/[0.08] text-success'
        : 'border-neutral-200 bg-neutral-50 text-neutral-700'

  const confidenceLabel =
    precheck.confidence === 'high'
      ? 'Hoog'
      : precheck.confidence === 'medium'
        ? 'Middel'
        : 'Laag'

  const missingLabels: Record<string, string> = {
    project_scope: 'Projectscope',
    constructieve_wijziging: 'Constructieve wijziging',
    uitbreiding_m2: 'Uitbreidingsomvang',
    functiewijziging: 'Functiewijziging',
    bag_building_status: 'BAG-status',
    zoning_primary_bestemming: 'Bestemming',
    buildability_delta: 'Bebouwingsanalyse',
    monument_status: 'Monumentstatus',
  }

  return (
    <Section title="Wkb Startdossier" icon={<WkbIcon />}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
            Confidence: {confidenceLabel}
          </span>
        </div>

        {precheck.triggered_rules.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-500">Regelhits</p>
            <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
              {precheck.triggered_rules.slice(0, 4).map((rule) => (
                <div key={rule.code} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-neutral-700">{rule.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      rule.impact === 'increase'
                        ? 'border border-aura-amber/25 bg-aura-amber/10 text-aura-amber'
                        : rule.impact === 'decrease'
                          ? 'border border-success/25 bg-success/[0.08] text-success'
                          : 'border border-neutral-200 bg-neutral-50 text-neutral-600'
                    }`}>
                      {rule.impact === 'increase'
                        ? 'Verhoogt'
                        : rule.impact === 'decrease'
                          ? 'Verlaagt'
                          : 'Onzeker'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">{rule.reason}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Geen regelhits beschikbaar</p>
        )}

        {precheck.required_documents.length > 0 && (
          <div className="border-t border-neutral-200 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Vervolgdocumenten</p>
            <ul className="mt-1 space-y-1">
              {precheck.required_documents.slice(0, 5).map((doc) => (
                <li key={doc} className="text-xs text-neutral-600">• {doc}</li>
              ))}
            </ul>
          </div>
        )}

        {precheck.missing_inputs.length > 0 && (
          <div className="border-t border-neutral-200 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ontbrekende inputs</p>
            <p className="mt-1 text-xs text-neutral-600">
              {precheck.missing_inputs.map((key) => missingLabels[key] ?? key).join(' · ')}
            </p>
          </div>
        )}

        <div className="border-t border-neutral-200 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Layer B verfijning</p>
          <p className="mt-1 text-xs text-neutral-600">
            {precheck.layer_b.applied
              ? (precheck.layer_b.effect_note ?? 'Layer B toegepast.')
              : `Optioneel beschikbaar: ${precheck.layer_b.available_inputs.join(', ')}`}
          </p>
        </div>

        <p className="text-[11px] text-neutral-500">{precheck.disclaimer}</p>
      </div>
    </Section>
  )
}

/* ─── Vergunning Precedenten ──────────────────────────────── */

function PermitPrecedentsSection({ data }: { data: PropertyReportResponse }) {
  const benchmark = data.permit_precedents

  if (!benchmark) {
    return (
      <Section title="Vergunning Precedenten" icon={<PermitPrecedentIcon />}>
        <p className="text-sm text-neutral-500">
          Nog geen precedentbenchmark beschikbaar voor dit dossier
        </p>
      </Section>
    )
  }

  const outcomes = benchmark.outcome_distribution || {}
  const orderedOutcomeKeys = ['granted', 'requested', 'rejected', 'withdrawn', 'other']
  const outcomeLabels: Record<string, string> = {
    granted: 'Verleend',
    requested: 'Aangevraagd',
    rejected: 'Geweigerd',
    withdrawn: 'Ingetrokken',
    other: 'Overig',
  }
  const outcomeChipClass = (outcome: string) => {
    if (outcome === 'granted') return 'border-success/25 bg-success/[0.08] text-success'
    if (outcome === 'requested') return 'border-aura-amber/25 bg-aura-amber/10 text-aura-amber'
    if (outcome === 'rejected' || outcome === 'withdrawn') return 'border-warning/25 bg-warning/[0.08] text-warning'
    return 'border-neutral-200 bg-neutral-50 text-neutral-600'
  }

  return (
    <Section title="Vergunning Precedenten" icon={<PermitPrecedentIcon />}>
      <div className="space-y-4">
        <div className="rounded-xl border border-neutral-200">
          <div className="grid grid-cols-2 divide-x divide-neutral-200 sm:grid-cols-3">
            <div className="px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Gemeente</p>
              <p className="mt-1 text-xl font-semibold leading-none text-aura-ink">{benchmark.gemeente_scope}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Type</p>
              <p className="mt-1 text-base font-semibold leading-none text-aura-ink">{benchmark.comparable_type}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Steekproef</p>
              <p className="mt-1 text-xl font-semibold leading-none tabular-nums text-aura-ink">{benchmark.sample_size}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-neutral-200 divide-x divide-neutral-200">
            <div className="px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Venster</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-aura-ink">{benchmark.lookback_days} dagen</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Median</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-aura-ink">
                {benchmark.median_processing_days != null ? `${benchmark.median_processing_days} dagen` : 'Onbekend'}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">P75</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-aura-ink">
                {benchmark.p75_processing_days != null ? `${benchmark.p75_processing_days} dagen` : 'Onbekend'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-3">
          <p className="text-xs font-medium text-neutral-500">Uitkomstverdeling</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {orderedOutcomeKeys
              .filter((key) => outcomes[key] != null)
              .map((key) => (
                <span key={key} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${outcomeChipClass(key)}`}>
                  {outcomeLabels[key] ?? key}: {outcomes[key]}
                </span>
              ))}
          </div>
        </div>

        {benchmark.low_sample_warning && (
          <div className="rounded-lg border border-aura-amber/20 bg-aura-amber/[0.06] px-3 py-2">
            <p className="text-xs text-aura-amber">{benchmark.low_sample_warning}</p>
          </div>
        )}

        {benchmark.references.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-500">Recente referenties</p>
            <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
              {benchmark.references.map((ref) => (
                <div key={ref.change_record_id} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${outcomeChipClass(ref.outcome)}`}>
                      {outcomeLabels[ref.outcome] ?? ref.outcome}
                    </span>
                    <p className="text-sm font-medium text-neutral-700">{ref.title}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span>{new Date(ref.change_date).toLocaleDateString('nl-NL')}</span>
                    {ref.source_url && (
                      <a
                        href={ref.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-neutral-600 transition-colors hover:text-aura-ink"
                      >
                        Officiële publicatie
                        <span aria-hidden>↗</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

/* ─── Markt (Funda) ────────────────────────────────────────── */

function MarketSignalsSection({ data }: { data: PropertyReportResponse }) {
  const signals = data.market_signals

  if (!signals) {
    return (
      <Section title="Marktsignalen" icon={<SignalIcon />}>
        <p className="text-sm text-neutral-500">
          Nog geen Funda-signalen beschikbaar voor dit adres
        </p>
      </Section>
    )
  }

  return (
    <Section title="Marktsignalen" icon={<SignalIcon />}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">Te koop sinds</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-neutral-700">
            {signals.listing_duration_days} dagen
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">Prijswijzigingen</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-neutral-700">
            {signals.price_change_count}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">Snapshots</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-neutral-700">
            {signals.listing_snapshots_count}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">Laatste waarneming</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-neutral-700">
            {signals.days_since_last_seen} dagen geleden
          </p>
        </div>
      </div>
    </Section>
  )
}

/* ─── WOZ ───────────────────────────────────────────────────── */

function WOZSection({ data }: { data: PropertyReportResponse }) {
  const woz = data.woz_data

  if (!woz) {
    return (
      <Section title="WOZ" icon={<ChartIcon />}>
        <p className="text-sm text-neutral-500">Geen WOZ-gegevens beschikbaar</p>
      </Section>
    )
  }

  return (
    <Section title="WOZ" icon={<ChartIcon />}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">Meest recente waarde</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-aura-ink">
              {formatCurrency(woz.meest_recente_waarde)}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">Peildatum</p>
            <p className="mt-0.5 text-sm font-medium text-neutral-700">
              {woz.meest_recente_peildatum
                ? new Date(woz.meest_recente_peildatum).toLocaleDateString('nl-NL')
                : '–'}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">Grondoppervlakte</p>
            <p className="mt-0.5 text-sm font-medium text-neutral-700">
              {formatArea(woz.grondoppervlakte)}
            </p>
          </div>
        </div>

        {woz.low_confidence && (
          <div className="rounded-lg border border-aura-amber/15 bg-aura-amber/[0.04] px-4 py-3">
            <p className="text-xs font-semibold text-aura-amber/80">Datakwaliteit</p>
            <p className="mt-1 text-sm text-neutral-600">
              {woz.low_confidence_reden || 'WOZ-data is indicatief.'}
            </p>
          </div>
        )}

        {woz.waarden && woz.waarden.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Historie
            </p>
            <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50">
              {woz.waarden.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-neutral-600">
                    {item.peildatum
                      ? new Date(item.peildatum).toLocaleDateString('nl-NL')
                      : 'Onbekend'}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-neutral-700">
                    {formatCurrency(item.vastgestelde_waarde)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

/* ─── Energy Label ──────────────────────────────────────────── */

function EnergyLabelSection({ data }: { data: PropertyReportResponse }) {
  const label = data.energy_label

  if (!label || label.is_geregistreerd === false || !label.energieklasse) {
    return (
      <Section title="Energielabel" icon={<LightningIcon />}>
        <p className="text-sm text-neutral-500">
          {label?.niet_geregistreerd_reden || 'Geen geregistreerd energielabel gevonden'}
        </p>
      </Section>
    )
  }

  return (
    <Section title="Energielabel" icon={<LightningIcon />}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">Klasse</p>
          <p className="mt-0.5 text-lg font-semibold text-aura-ink">{label.energieklasse}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">Registratie</p>
          <p className="mt-0.5 text-sm font-medium text-neutral-700">
            {label.registratie_datum
              ? new Date(label.registratie_datum).toLocaleDateString('nl-NL')
              : '–'}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">Geldig tot</p>
          <p className="mt-0.5 text-sm font-medium text-neutral-700">
            {label.geldig_tot ? new Date(label.geldig_tot).toLocaleDateString('nl-NL') : '–'}
          </p>
        </div>
      </div>
    </Section>
  )
}

/* ─── BRK Ownership ─────────────────────────────────────────── */

function BRKOwnershipSection({ data }: { data: PropertyReportResponse }) {
  const ownership = data.brk_ownership

  if (!ownership) {
    return (
      <Section title="BRK Eigendom" icon={<OwnershipIcon />}>
        <p className="text-sm text-neutral-600">
          BRK eigendomsdata wordt bewust niet opgeslagen in rapporten (Kadaster Tier 3 voorwaarden).
        </p>
      </Section>
    )
  }

  if (ownership.status !== 'available' || !ownership.data || ownership.data.length === 0) {
    return (
      <Section title="BRK Eigendom" icon={<OwnershipIcon />}>
        <p className="text-sm text-neutral-500">
          {ownership.reason || 'Geen eigendomsdata beschikbaar'}
        </p>
      </Section>
    )
  }

  return (
    <Section title="BRK Eigendom" icon={<OwnershipIcon />}>
      <div className="space-y-3">
        {ownership.data.map((item, idx) => (
          <div key={idx} className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <p className="text-sm font-medium text-neutral-700">{item.perceel_identificatie}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {item.gerechtigden.length} zakelijk gerechtigden
              {item.heeft_hypotheek ? ' · hypotheek geregistreerd' : ''}
            </p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ─── Bestemming ────────────────────────────────────────────── */

function BestemmingSection({ data }: { data: PropertyReportResponse }) {
  const zoning = data.zoning

  if (!zoning) {
    return (
      <Section title="Bestemmingsplan" icon={<PlanIcon />}>
        <p className="text-sm text-neutral-500">Geen bestemmingsplangegevens beschikbaar</p>
      </Section>
    )
  }

  const { actionablePlans, policyPlans } = splitZoningPlans(zoning.plans)
  const primaryPlanForRules = actionablePlans.find((plan) =>
    (plan.teksten ?? []).some((tekst) => Boolean(tekst.inhoud))
  )

  return (
    <Section title="Bestemmingsplan" icon={<PlanIcon />}>
      <div className="space-y-4">
        {/* Primary bestemming */}
        {zoning.primary_bestemming && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Hoofdbestemming</p>
            <p className="mt-0.5 text-lg font-semibold text-aura-ink">{zoning.primary_bestemming}</p>
          </div>
        )}

        {/* Building dimensions */}
        {zoning.building_dimensions && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Bouwregels</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DimensionCard label="Max. hoogte" value={zoning.building_dimensions.max_hoogte} unit="m" />
              <DimensionCard label="Max. goothoogte" value={zoning.building_dimensions.max_goothoogte} unit="m" />
              <DimensionCard label="Bebouwings%" value={zoning.building_dimensions.max_bebouwingspercentage} unit="%" />
              <DimensionCard label="Max. FSI" value={zoning.building_dimensions.max_floor_area_ratio} />
            </div>
          </div>
        )}

        {/* Plans */}
        {actionablePlans.length > 0 && (
          <div className="space-y-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Plannen op locatie ({actionablePlans.length})
            </p>
            {actionablePlans.map((plan, idx) => (
              <div key={idx} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-medium text-neutral-700">{plan.plan_naam}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                  {plan.plan_status && <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5">{plan.plan_status}</span>}
                  {plan.plan_datum && <span>{new Date(plan.plan_datum).toLocaleDateString('nl-NL')}</span>}
                  {plan.plan_type && <span className="text-neutral-500">{plan.plan_type}</span>}
                </div>
                {plan.rules && plan.rules.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-neutral-200/[0.06] pt-3">
                    {plan.rules.map((rule, rIdx) => (
                      <div key={rIdx}>
                        <p className="text-sm font-medium text-neutral-700">{rule.bestemming}</p>
                        {rule.omschrijving && (
                          <p className="mt-0.5 text-xs text-neutral-500">{rule.omschrijving}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Functie aanduidingen */}
                {plan.functie_aanduidingen && plan.functie_aanduidingen.length > 0 && (
                  <div className="mt-3 border-t border-neutral-200/[0.06] pt-3">
                    <p className="mb-1.5 text-xs font-medium text-neutral-500">Functieaanduidingen</p>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.functie_aanduidingen.map((fa, fIdx) => (
                        <span key={fIdx} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                          {fa.naam}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gebieds aanduidingen */}
                {plan.gebieds_aanduidingen && plan.gebieds_aanduidingen.length > 0 && (
                  <div className="mt-3 border-t border-neutral-200/[0.06] pt-3">
                    <p className="mb-1.5 text-xs font-medium text-neutral-500">Gebiedsaanduidingen</p>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.gebieds_aanduidingen.map((ga, gIdx) => (
                        <span key={gIdx} className="rounded-full border border-aura-amber/25 bg-aura-amber/10 px-2.5 py-0.5 text-xs font-medium text-aura-amber">
                          {ga.naam}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {actionablePlans.length === 0 && policyPlans.length > 0 && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-xs text-neutral-500">
              Geen perceelsspecifieke plannen gevonden. Alleen bovenlokale beleidskaders beschikbaar.
            </p>
          </div>
        )}

        {policyPlans.length > 0 && (
          <details className="rounded-lg border border-neutral-200 bg-neutral-50">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Beleidskaders (niet perceelspecifiek) ({policyPlans.length})
            </summary>
            <div className="space-y-2 border-t border-neutral-200/[0.06] px-4 py-3">
              {policyPlans.map((plan, idx) => (
                <div key={idx} className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <p className="text-sm font-medium text-neutral-700">{plan.plan_naam}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                    {plan.plan_status && <span>{plan.plan_status}</span>}
                    {plan.plan_type && <span>{plan.plan_type}</span>}
                    {plan.plan_datum && <span>{new Date(plan.plan_datum).toLocaleDateString('nl-NL')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Plan teksten (only first plan, only articles with content) */}
        {(() => {
          const artikelen = primaryPlanForRules?.teksten?.filter(t => t.inhoud) ?? []
          if (artikelen.length === 0) return null
          return (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Planregels ({primaryPlanForRules?.plan_naam})
              </p>
              <div className="space-y-2">
                {artikelen.slice(0, 15).map((tekst, tIdx) => (
                  <details key={tIdx} className="group rounded-lg border border-neutral-200 bg-neutral-50">
                    <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:text-aura-ink">
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 px-1.5 text-[10px] font-semibold text-neutral-600">
                        {tIdx + 1}
                      </span>
                      <span className="text-[10px] text-neutral-500 transition-transform group-open:rotate-90">&#9654;</span>
                      {tekst.titel}
                    </summary>
                    <div className="border-t border-neutral-200/[0.06] px-4 py-3 text-xs leading-relaxed text-neutral-600">
                      {tekst.inhoud!.length > 600 ? `${tekst.inhoud!.slice(0, 600)}…` : tekst.inhoud}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Data gaps */}
        {zoning.data_gaps && zoning.data_gaps.length > 0 && (
          <div className="rounded-lg border border-aura-amber/15 bg-aura-amber/[0.04] px-4 py-3">
            <p className="text-xs font-semibold text-aura-amber/80">Onvolledige gegevens</p>
            <ul className="mt-1 space-y-0.5 text-xs text-neutral-600">
              {zoning.data_gaps.map((gap, idx) => <li key={idx}>• {gap}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Section>
  )
}

function DimensionCard({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-aura-ink">
        {value != null ? `${value}${unit ?? ''}` : '–'}
      </p>
    </div>
  )
}

/* ─── Monument ──────────────────────────────────────────────── */

function MonumentSection({ data }: { data: PropertyReportResponse }) {
  const monuments = data.monuments

  if (!monuments) {
    return (
      <Section title="Monumentstatus" icon={<MonumentIcon className="text-current" />}>
        <p className="text-sm text-neutral-500">Geen monumentgegevens beschikbaar</p>
      </Section>
    )
  }

  // Check if all sources have errors (no definitive answer)
  const allSourcesFailed = monuments.sources.every((s) => s.error != null)

  return (
    <Section title="Monumentstatus" icon={<MonumentIcon className="text-current" />}>
      <div className="space-y-4">
        {/* Status */}
        {allSourcesFailed ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="font-semibold text-neutral-600">Niet vast te stellen</p>
            <p className="mt-0.5 text-sm text-neutral-500">
              Alle bronnen voor monumentstatus zijn momenteel niet beschikbaar. Dit betekent niet dat het pand geen monument is.
            </p>
          </div>
        ) : (
          <div className={`rounded-lg px-4 py-3 ${monuments.is_monument ? 'border border-aura-amber/20 bg-aura-amber/[0.06]' : 'border border-neutral-200 bg-neutral-50'}`}>
            <p className={`font-semibold ${monuments.is_monument ? 'text-aura-amber' : 'text-neutral-700'}`}>
              {monuments.is_monument ? 'Rijksmonument' : 'Niet beschermd'}
            </p>
            {monuments.is_monument && monuments.consensus_status && (
              <p className="mt-0.5 text-sm text-neutral-600">
                Status: {monuments.consensus_status}
              </p>
            )}
            {!monuments.is_monument && (
              <p className="mt-0.5 text-sm text-neutral-500">
                Dit pand staat niet geregistreerd als rijks- of gemeentelijk monument
              </p>
            )}
          </div>
        )}

        {/* Conflict */}
        {monuments.has_conflict && monuments.conflict_note && (
          <div className="rounded-lg border border-aura-amber/15 bg-aura-amber/[0.04] px-4 py-3">
            <p className="text-xs font-semibold text-aura-amber/80">Let op — bronconflict</p>
            <p className="mt-1 text-sm text-neutral-600">{monuments.conflict_note}</p>
          </div>
        )}

        {/* Restrictions */}
        {monuments.restrictions_summary && monuments.restrictions_summary.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Beperkingen</p>
            <ul className="space-y-1.5">
              {monuments.restrictions_summary.map((restriction, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-neutral-700">
                  <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-aura-amber/50" />
                  {restriction}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sources */}
        {monuments.sources && monuments.sources.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Bronverificatie</p>
            <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50">
              {monuments.sources.map((src, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-neutral-600">{src.source}</span>
                  {src.error ? (
                    <span className="text-xs text-neutral-500">Niet beschikbaar</span>
                  ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${src.is_monument ? 'border border-aura-amber/20 bg-aura-amber/10 text-aura-amber' : 'border border-neutral-200 bg-neutral-50 text-neutral-700'}`}>
                        {src.is_monument ? 'Beschermd' : 'Niet beschermd'}
                      </span>
                    )}
                </div>
              ))}
            </div>
            {allSourcesFailed && (
              <p className="mt-2 text-xs text-neutral-500">
                De RCE API is momenteel niet bereikbaar. BAG en Kadaster bieden geen monumentstatus in hun standaard API.
              </p>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

/* ─── PDF Upload ───────────────────────────────────────────── */

function PDFUploadSection({ data }: { data: PropertyReportResponse }) {
  const { accessToken } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const planIdn = data.zoning?.plans?.[0]?.plan_id

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !planIdn) return

    setStatus('uploading')
    setErrorMsg('')

    try {
      await uploadBestemmingsplanPDF(planIdn, file, accessToken)
      setStatus('done')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Upload mislukt')
    }
  }, [planIdn, accessToken])

  if (!planIdn) return null

  return (
    <Section title="AI Interpretatie" icon={<BrainIcon />}>
      {status === 'done' ? (
        <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/[0.04] px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-success">PDF ontvangen</p>
            <p className="text-xs text-neutral-500">AI-analyse loopt op de achtergrond. Ververs over enkele minuten.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-neutral-700">Bestemmingsplan PDF</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Upload de PDF voor een AI-analyse van bouw- en gebruiksregels
            </p>

            <input ref={fileRef} type="file" accept=".pdf,application/pdf" onChange={handleUpload} className="hidden" />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={status === 'uploading'}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-aura-ink disabled:opacity-50"
            >
              {status === 'uploading' ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-neutral-600"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  Uploaden...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  PDF uploaden
                </>
              )}
            </button>

            {status === 'error' && (
              <p className="mt-1.5 text-xs text-warning">{errorMsg}</p>
            )}
          </div>
        </div>
      )}
    </Section>
  )
}

/* ─── AI Interpretatie ──────────────────────────────────────── */

function AIInterpretatieSection({ data }: { data: PropertyReportResponse }) {
  const parsed = data.ai_parsing?.parsed_plan
  if (!parsed) return null

  const confidenceStyle = parsed.overall_confidence === 'HIGH'
    ? 'border-aura-amber/30 bg-aura-amber/10 text-aura-amber'
    : parsed.overall_confidence === 'MEDIUM'
      ? 'border-neutral-200 bg-neutral-50 text-neutral-700'
      : 'border-neutral-200 bg-neutral-50 text-neutral-500'

  return (
    <Section title="AI Interpretatie" icon={<BrainIcon />}>
      <div className="space-y-4">
        {/* Confidence + Summary */}
        <div className="flex items-start gap-3">
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceStyle}`}>
            {parsed.overall_confidence === 'HIGH' ? 'Hoog' : parsed.overall_confidence === 'MEDIUM' ? 'Gemiddeld' : 'Laag'}
          </span>
          <p className="text-sm text-neutral-700">{parsed.samenvatting}</p>
        </div>

        {/* Regels */}
        {parsed.regels && parsed.regels.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Bestemmingsregels (AI)</p>
            <div className="space-y-3">
              {parsed.regels.map((regel, idx) => (
                <div key={idx} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-neutral-700">{regel.bestemming}</p>
                    <span className="text-xs text-neutral-500">{regel.artikel}</span>
                  </div>

                  {regel.toegestane_gebruiken.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-neutral-500">Toegestaan gebruik</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {regel.toegestane_gebruiken.map((g, i) => (
                          <span key={i} className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-700">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {regel.verboden_gebruiken.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-neutral-500">Verboden gebruik</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {regel.verboden_gebruiken.map((g, i) => (
                          <span key={i} className="rounded border border-warning/25 bg-warning/[0.10] px-2 py-0.5 text-xs text-warning">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {regel.bouwregels && (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {regel.bouwregels.max_bouwhoogte && <MiniDim label="Bouwhoogte" value={`${regel.bouwregels.max_bouwhoogte}m`} />}
                      {regel.bouwregels.max_goothoogte && <MiniDim label="Goothoogte" value={`${regel.bouwregels.max_goothoogte}m`} />}
                      {regel.bouwregels.max_bebouwingspercentage && <MiniDim label="Bebouwing" value={`${regel.bouwregels.max_bebouwingspercentage}%`} />}
                      {regel.bouwregels.max_oppervlakte && <MiniDim label="Oppervlakte" value={`${regel.bouwregels.max_oppervlakte}m²`} />}
                      {regel.bouwregels.max_inhoud && <MiniDim label="Inhoud" value={`${regel.bouwregels.max_inhoud}m³`} />}
                    </div>
                  )}

                  {regel.parkeereis && (
                    <p className="mt-2 text-xs text-neutral-500"><strong className="text-neutral-600">Parkeereis:</strong> {regel.parkeereis}</p>
                  )}

                  {regel.milieu_restricties.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-neutral-500">Milieurestricties</p>
                      <ul className="mt-0.5 text-xs text-neutral-500">
                        {regel.milieu_restricties.map((m, i) => <li key={i}>• {m}</li>)}
                      </ul>
                    </div>
                  )}

                  {regel.bijzondere_voorwaarden.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-neutral-500">Bijzondere voorwaarden</p>
                      <ul className="mt-0.5 text-xs text-neutral-500">
                        {regel.bijzondere_voorwaarden.map((b, i) => <li key={i}>• {b}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimers */}
        {parsed.disclaimers && parsed.disclaimers.length > 0 && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-xs font-semibold text-neutral-500">Disclaimer</p>
            {parsed.disclaimers.map((d, idx) => (
              <p key={idx} className="mt-1 text-xs italic text-neutral-500">{d}</p>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}

function MiniDim({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-center">
      <p className="text-[10px] text-neutral-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-neutral-700">{value}</p>
    </div>
  )
}

/* ─── Bronnen ───────────────────────────────────────────────── */

function BronnenSection({ data }: { data: PropertyReportResponse }) {
  type SourceStatus = 'ok' | 'unlinked' | 'blocked' | 'error'
  type SourceRow = {
    source: string
    age_seconds: number | null
    status: SourceStatus
    note?: string
  }

  const byKey = new Map<string, SourceRow>()

  const classifyIssue = (
    message?: string | null,
    source?: string
  ): 'unlinked' | 'blocked' | 'error' => {
    const msg = (message ?? '').toLowerCase()
    const sourceKey = (source ?? '').toLowerCase()
    if (!msg) return 'unlinked'
    if (sourceKey.includes('monumenten: rce') && msg.includes('403')) return 'blocked'
    const unlinkedHints = [
      'api key',
      'apikey',
      'not configured',
      'niet geconfigureerd',
      'niet beschikbaar via',
      'not available via',
      'geen verblijfsobject id beschikbaar',
      'geen kadastraal perceel',
      'forbidden',
      'unauthorized',
      '401',
      '403',
      'permission',
      'toegang',
      'niet gekoppeld',
      'disabled',
      'not enabled',
    ]
    return unlinkedHints.some((hint) => msg.includes(hint)) ? 'unlinked' : 'error'
  }

  const sanitizeSourceNote = (
    note?: string | null,
    source?: string
  ): string | undefined => {
    if (!note) return undefined
    const raw = note.trim()
    const lower = raw.toLowerCase()
    const sourceKey = (source ?? '').toLowerCase()

    if (sourceKey.includes('monumenten: rce')) {
      if (lower.includes('403')) {
        return 'RCE endpoint geblokkeerd (HTTP 403) vanuit deze omgeving; monumentstatus via RCE nu niet verifieerbaar.'
      }
      if (lower.includes('401')) return 'RCE API authenticatie mislukt (401)'
      if (lower.includes('rce api error')) return 'RCE API fout'
    }

    // Strip raw URLs from notes to keep rows readable.
    let cleaned = raw.replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim()
    if (!cleaned) cleaned = raw
    if (cleaned.length > 180) cleaned = `${cleaned.slice(0, 177)}...`
    return cleaned
  }

  const addRow = (row: SourceRow) => {
    const key = row.source.toLowerCase()
    if (!byKey.has(key)) {
      byKey.set(key, row)
      return
    }
    const existing = byKey.get(key)!
    const statusPriority: Record<SourceStatus, number> = {
      ok: 0,
      unlinked: 1,
      blocked: 2,
      error: 3,
    }
    byKey.set(key, {
      ...existing,
      ...row,
      age_seconds: row.age_seconds ?? existing.age_seconds,
      note: row.note ?? existing.note,
      status:
        statusPriority[row.status] >= statusPriority[existing.status]
          ? row.status
          : existing.status,
    })
  }

  for (const src of data.data_sources || []) {
    addRow({
      source: src.source,
      age_seconds: src.age_seconds,
      status: 'ok',
    })
  }

  for (const section of data.section_sources || []) {
    for (const src of section.sources || []) {
      addRow({
        source: src.source,
        age_seconds: src.age_seconds,
        status: 'ok',
      })
    }
  }

  for (const src of data.monuments?.sources || []) {
    addRow({
      source: `Monumenten: ${src.source}`,
      age_seconds: src.age_seconds ?? null,
      status: src.error ? classifyIssue(src.error, `Monumenten: ${src.source}`) : 'ok',
      note: sanitizeSourceNote(
        src.error || (src.is_monument ? 'Beschermd' : 'Niet beschermd'),
        `Monumenten: ${src.source}`
      ),
    })
  }

  if (data.energy_label) {
    addRow({
      source: 'EP-Online V5',
      age_seconds: null,
      status: 'ok',
      note: data.energy_label.is_geregistreerd
        ? `Label ${data.energy_label.energieklasse ?? ''}`.trim()
        : data.energy_label.niet_geregistreerd_reden || 'Geen labelregistratie',
    })
  } else {
    const energyError = (data.errors || []).find((e) =>
      e.toLowerCase().includes('energielabel') || e.toLowerCase().includes('ep-online')
    )
    addRow({
      source: 'EP-Online V5',
      age_seconds: null,
      // "Geen data voor dit adres" is not a broken integration.
      status: energyError ? classifyIssue(energyError) : 'ok',
      note: sanitizeSourceNote(
        energyError || 'Geen energielabel-data beschikbaar voor dit adres',
        'EP-Online V5'
      ),
    })
  }

  if (data.woz_data) {
    addRow({
      source: data.woz_data.bron || 'WOZ Waardeloket',
      age_seconds: null,
      status: 'ok',
      note: data.woz_data.low_confidence_reden || undefined,
    })
  } else {
    const wozError = (data.errors || []).find((e) =>
      e.toLowerCase().includes('woz')
    )
    addRow({
      source: 'WOZ Waardeloket',
      age_seconds: null,
      // "Geen data voor dit adres" is not a broken integration.
      status: wozError ? classifyIssue(wozError) : 'ok',
      note: sanitizeSourceNote(
        wozError || 'Geen WOZ-data beschikbaar voor dit adres',
        'WOZ Waardeloket'
      ),
    })
  }

  if (!data.brk_ownership) {
    addRow({
      source: 'BRK Bevragen V2',
      age_seconds: null,
      status: 'unlinked',
      note: 'Niet opgeslagen in rapport (compliance)',
    })
  } else {
    const brkStatus =
      data.brk_ownership.status === 'available'
        ? 'ok'
        : data.brk_ownership.status === 'error'
          ? classifyIssue(data.brk_ownership.reason)
          : 'unlinked'
    addRow({
      source: 'BRK Bevragen V2',
      age_seconds: null,
      status: brkStatus,
      note: data.brk_ownership.reason || undefined,
    })
  }

  const sources = Array.from(byKey.values()).sort((a, b) =>
    a.source.localeCompare(b.source, 'nl')
  )

  const formatAge = (s: number | null): string => {
    if (s == null) return 'Onbekend'
    if (s < 60) return 'Zojuist'
    if (s < 3600) return `${Math.floor(s / 60)} min geleden`
    if (s < 86400) return `${Math.floor(s / 3600)} uur geleden`
    return `${Math.floor(s / 86400)} dagen geleden`
  }

  return (
    <Section title="Data bronnen" icon={<DatabaseIcon />}>
      {sources.length === 0 && (
        <p className="text-sm text-neutral-500">Geen broninformatie beschikbaar</p>
      )}
      <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50">
        {sources.map((src, idx) => (
          <div key={idx} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-700">{src.source}</p>
              <p className="text-xs text-neutral-500">{formatAge(src.age_seconds)}</p>
              {src.note && (
                <p className="text-xs text-neutral-500 break-words">
                  {sanitizeSourceNote(src.note, src.source)}
                </p>
              )}
            </div>
            <div className="shrink-0">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  src.status === 'error'
                    ? 'border-warning/30 bg-warning/[0.14] text-warning'
                    : src.status === 'blocked'
                      ? 'border-warning/30 bg-warning/10 text-warning'
                    : src.status === 'unlinked'
                      ? 'border-neutral-200 bg-neutral-50 text-neutral-700'
                      : 'border-success/20 bg-success/[0.06] text-success'
                }`}
              >
                {src.status === 'error'
                  ? 'Fout'
                  : src.status === 'blocked'
                    ? 'Geblokkeerd'
                    : src.status === 'unlinked'
                      ? 'Niet gekoppeld'
                      : 'OK'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ─── Icons ─────────────────────────────────────────────────── */
/* ArrowLeftIcon moved to ReportHeader.tsx */

function MapPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-aura-amber">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function MonumentIcon({ className = 'text-aura-amber' }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="21" width="18" height="2" rx="1" />
      <rect x="5" y="11" width="2" height="10" />
      <rect x="17" y="11" width="2" height="10" />
      <rect x="10" y="11" width="4" height="10" />
      <path d="M12 3L4 11h16L12 3z" />
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

function ParcelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5 12 3l9 4.5-9 4.5L3 7.5Z" />
      <path d="M3 12 12 16.5 21 12" />
      <path d="M3 16.5 12 21l9-4.5" />
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

function SignalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h3l2-5 4 10 2-5h7" />
    </svg>
  )
}

function BuildabilityIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16" />
      <path d="M6 20v-7h4v7" />
      <path d="M14 20v-11h4v11" />
      <path d="M12 9h-1.5a2.5 2.5 0 1 1 0-5H12" />
      <path d="M12 4h1.5a2.5 2.5 0 0 1 0 5H12" />
    </svg>
  )
}

function WkbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 5v6c0 5 3.4 9.5 8 11 4.6-1.5 8-6 8-11V5l-8-3Z" />
      <path d="M9 12.5 11 14.5l4-4" />
    </svg>
  )
}

function WkbClassificatieIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 5v6c0 5 3.4 9.5 8 11 4.6-1.5 8-6 8-11V5l-8-3Z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}

function AsbestIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function PermitPrecedentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16" />
      <path d="M6 20V8h3v12" />
      <path d="M11 20V4h3v16" />
      <path d="M16 20v-6h3v6" />
    </svg>
  )
}

function LightningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 10-13h-7l0-7Z" />
    </svg>
  )
}

function OwnershipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10 12 3l8 7" />
      <path d="M6 9v10h12V9" />
      <path d="M10 19v-5h4v5" />
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

function BrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 2.8A3 3 0 0 0 6 13v2a3 3 0 0 0 3 3" />
      <path d="M15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 2 2.8A3 3 0 0 1 18 13v2a3 3 0 0 1-3 3" />
      <path d="M9 11h6" />
      <path d="M12 8v8" />
    </svg>
  )
}

function DatabaseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  )
}

/* CalendarIcon, ScaleIcon, SparkIcon moved to ReportHeader.tsx */
