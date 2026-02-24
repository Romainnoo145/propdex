import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth/useAuth'
import { uploadBestemmingsplanPDF } from '@/lib/api'
import type { PropertyReportResponse } from '@/lib/types/property'

interface ReportDetailPageProps {
  data: PropertyReportResponse | null
  isLoading: boolean
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

export default function ReportDetailPage({
  data,
  isLoading,
  onBack,
  onViewOnMap,
}: ReportDetailPageProps) {
  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto bg-grey-950">
        <div className="mx-auto max-w-4xl px-8 py-10">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded bg-grey-800" />
            <div className="h-32 rounded-xl bg-grey-800/50" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-grey-800/50" />)}
            </div>
            {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-grey-800/50" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-full overflow-y-auto bg-grey-950">
        <div className="mx-auto max-w-4xl px-8 py-10 text-center">
          <p className="text-grey-600">Rapport niet gevonden</p>
          <button onClick={onBack} className="mt-4 text-sm text-grey-400 underline hover:text-grey-100">
            Terug naar projecten
          </button>
        </div>
      </div>
    )
  }

  const { address, building, monuments, ai_parsing, completeness_score } = data
  const statusInfo = getStatusInfo(building?.status)
  const isActionableStatus = statusInfo && statusInfo.severity !== 'low'

  return (
    <div className="h-full overflow-y-auto bg-grey-950">
      <div className="mx-auto max-w-4xl px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <button
              onClick={onBack}
              className="mb-3 flex items-center gap-1.5 text-sm text-grey-600 transition-colors hover:text-grey-300"
            >
              <ArrowLeftIcon />
              Terug naar projecten
            </button>
            <h1 className="text-2xl font-semibold text-grey-100">
              {address.straat} {address.huisnummer}
              {address.huisletter ?? ''}{address.toevoeging ?? ''}
            </h1>
            <p className="mt-1 text-grey-600">
              {address.postcode}, {address.woonplaats}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewOnMap}
              className="flex items-center gap-2 rounded-lg border border-overlay/5 bg-grey-900 px-4 py-2 text-sm font-medium text-grey-300 transition-colors hover:bg-overlay/[0.04] hover:text-grey-100"
            >
              <MapPinIcon />
              Bekijk op kaart
            </button>
          </div>
        </div>

        {/* Signal banner — actionable status */}
        {isActionableStatus && (
          <SignalBanner
            statusInfo={statusInfo}
            documentdatum={building?.documentdatum}
            documentnummer={building?.documentnummer}
          />
        )}

        {/* Monument alert */}
        {monuments?.is_monument && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-accent/20 bg-amber-accent/[0.06] px-5 py-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-accent/10">
              <MonumentIcon />
            </div>
            <div>
              <p className="font-semibold text-amber-accent">{monuments.consensus_status ?? 'Rijksmonument'}</p>
              <p className="mt-0.5 text-sm text-grey-400">
                Monumentale status beperkt sloop- en verbouwmogelijkheden. Vergunningsplicht voor wijzigingen.
                {monuments.restrictions_summary && monuments.restrictions_summary.length > 0 && (
                  <span className="ml-1 text-amber-accent/70">
                    {monuments.restrictions_summary.length} beperkingen van toepassing.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Quick facts */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Bouwjaar"
            value={building?.bouwjaar?.toString() ?? '–'}
            sublabel={building?.bouwjaar ? `${new Date().getFullYear() - building.bouwjaar} jaar oud` : undefined}
          />
          <MetricCard
            label="Vloeroppervlak"
            value={building?.oppervlakte ? `${building.oppervlakte} m²` : '–'}
            sublabel="gebruiksoppervlakte"
          />
          <MetricCard
            label="Gebruiksdoel"
            value={building?.gebruiksdoel?.[0] ?? '–'}
          />
          <MetricCard
            label="Compleetheid"
            value={`${Math.round(completeness_score * 100)}%`}
            bar={completeness_score}
          />
        </div>

        {/* Sections */}
        <div className="space-y-5">
          <GebouwSection data={data} />
          <KadasterSection data={data} />
          <WOZSection data={data} />
          <EnergyLabelSection data={data} />
          <BRKOwnershipSection data={data} />
          <BestemmingSection data={data} />
          <MonumentSection data={data} />
          {ai_parsing?.parsed_plan && ai_parsing.status === 'complete' ? (
            <AIInterpretatieSection data={data} />
          ) : (
            <PDFUploadSection data={data} />
          )}
          <BronnenSection data={data} />
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-overlay/5 pt-4 text-center text-xs text-grey-600">
          Rapport gegenereerd op {dateFmtFull.format(new Date(data.resolved_at))}
        </div>
      </div>
    </div>
  )
}

/* ─── Signal Banner ────────────────────────────────────────── */

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
  const borderColor = isHigh ? 'border-amber-accent/30' : 'border-overlay/10'
  const bgColor = isHigh ? 'bg-amber-accent/[0.06]' : 'bg-overlay/[0.03]'
  const iconBg = isHigh ? 'bg-amber-accent/15' : 'bg-overlay/[0.06]'
  const titleColor = isHigh ? 'text-amber-accent' : 'text-grey-300'

  return (
    <div className={`mb-6 rounded-xl border ${borderColor} ${bgColor} px-5 py-4`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <AlertIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`font-semibold ${titleColor}`}>{statusInfo.label}</p>
            {documentdatum && (
              <span className="text-xs text-grey-600">
                {dateFmt.format(new Date(documentdatum))}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-grey-400">
            {statusInfo.description}
          </p>
          {documentnummer && (
            <p className="mt-2 text-xs text-grey-600">
              Documentnr: <span className="font-mono text-grey-600">{documentnummer}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Metric Card ───────────────────────────────────────────── */

function MetricCard({ label, value, sublabel, bar }: { label: string; value: string; sublabel?: string; bar?: number }) {
  return (
    <div className="rounded-xl border border-overlay/5 bg-grey-900 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-grey-600">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-grey-100">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-grey-600">{sublabel}</p>}
      {bar !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-grey-800">
          <div
            className="h-full rounded-full bg-amber-accent transition-all"
            style={{ width: `${bar * 100}%`, opacity: bar >= 0.8 ? 1 : bar >= 0.5 ? 0.7 : 0.4 }}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Section Wrapper ───────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-overlay/5 bg-grey-900">
      <div className="border-b border-overlay/5 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-grey-600">{title}</h2>
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
      <span className="text-sm text-grey-600">{label}</span>
      <span className={`text-sm font-medium ${muted ? 'text-grey-600' : 'text-grey-300'} ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

/* ─── Gebouw & BAG ──────────────────────────────────────────── */

function GebouwSection({ data }: { data: PropertyReportResponse }) {
  const { address, building } = data
  const gebruiksdoel = building?.gebruiksdoel ?? []
  const statusInfo = getStatusInfo(building?.status)

  return (
    <Section title="Gebouw & BAG">
      <div className="divide-y divide-overlay/[0.03]">
        <Row label="Bouwjaar" value={building?.bouwjaar?.toString()} />
        {building?.status && (
          <div className="flex items-baseline justify-between py-2">
            <span className="text-sm text-grey-600">Status</span>
            <div className="text-right">
              <span className={`text-sm font-medium ${statusInfo?.severity === 'high' ? 'text-amber-accent' : statusInfo?.severity === 'medium' ? 'text-grey-300' : 'text-grey-300'}`}>
                {statusInfo?.label ?? building.status}
              </span>
            </div>
          </div>
        )}
        {building?.documentnummer && (
          <Row label="Documentnr" value={building.documentnummer} mono />
        )}
        <Row label="Gebruiksoppervlakte (VBO)" value={building?.oppervlakte ? `${building.oppervlakte} m²` : null} />
        {gebruiksdoel.length > 0 && (
          <div className="flex items-baseline justify-between py-2">
            <span className="text-sm text-grey-600">Gebruiksdoel</span>
            <div className="flex flex-wrap justify-end gap-1">
              {gebruiksdoel.map((doel) => (
                <span key={doel} className="rounded-full border border-overlay/10 bg-overlay/[0.04] px-2.5 py-0.5 text-xs font-medium text-grey-300">
                  {doel}
                </span>
              ))}
            </div>
          </div>
        )}
        {/* BAG IDs — de-emphasized */}
        <div className="pt-3">
          <p className="mb-1.5 text-xs font-medium text-grey-600">BAG referenties</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-xs text-grey-600">
              Pand <a
                href={`https://bagviewer.kadaster.nl/lvbag/bag-viewer/?searchQuery=${building?.pand_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-grey-600 underline decoration-grey-700 underline-offset-2 hover:text-grey-300"
              >{building?.pand_id}</a>
            </span>
            <span className="text-xs text-grey-600">
              Nummeraanduiding <span className="font-mono text-grey-600">{address.nummeraanduiding_id}</span>
            </span>
            {address.verblijfsobject_id && (
              <span className="text-xs text-grey-600">
                VBO <span className="font-mono text-grey-600">{address.verblijfsobject_id}</span>
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
      <Section title="Kadaster">
        <p className="text-sm italic text-grey-600">Geen kadastrale gegevens beschikbaar</p>
      </Section>
    )
  }

  const totalOpp = parcels.reduce((sum, p) => sum + (p.oppervlakte ?? 0), 0)

  return (
    <Section title="Kadaster">
      <div className="space-y-3">
        {parcels.map((parcel, idx) => (
          <div key={idx} className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] p-3">
            {parcel.kadastrale_aanduiding && (
              <p className="mb-2 text-sm font-semibold text-grey-300">
                <a
                  href={`https://kadastralekaart.com/perceel/${parcel.kadastrale_aanduiding?.replace(/\s+/g, '/')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-grey-700 underline-offset-2 hover:text-grey-100"
                >
                  {parcel.kadastrale_aanduiding}
                </a>
              </p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-grey-600">Perceelnr</p>
                <p className="text-sm font-medium text-grey-300">{parcel.perceelnummer ?? '–'}</p>
              </div>
              <div>
                <p className="text-xs text-grey-600">Sectie</p>
                <p className="text-sm font-medium text-grey-300">{parcel.sectie ?? '–'}</p>
              </div>
              <div>
                <p className="text-xs text-grey-600">Kavelgrootte</p>
                <p className="text-sm font-medium text-grey-300">{parcel.oppervlakte ? `${parcel.oppervlakte} m²` : '–'}</p>
              </div>
            </div>
          </div>
        ))}
        {parcels.length > 1 && totalOpp > 0 && (
          <div className="flex justify-end pt-1">
            <span className="text-xs text-grey-600">Totaal: <strong className="text-grey-300">{totalOpp} m²</strong></span>
          </div>
        )}
      </div>
    </Section>
  )
}

/* ─── WOZ ───────────────────────────────────────────────────── */

function WOZSection({ data }: { data: PropertyReportResponse }) {
  const woz = data.woz_data

  if (!woz) {
    return (
      <Section title="WOZ">
        <p className="text-sm italic text-grey-600">Geen WOZ-gegevens beschikbaar</p>
      </Section>
    )
  }

  return (
    <Section title="WOZ">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] px-3 py-2">
            <p className="text-xs text-grey-600">Meest recente waarde</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-grey-100">
              {woz.meest_recente_waarde != null
                ? `EUR ${woz.meest_recente_waarde.toLocaleString('nl-NL')}`
                : '–'}
            </p>
          </div>
          <div className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] px-3 py-2">
            <p className="text-xs text-grey-600">Peildatum</p>
            <p className="mt-0.5 text-sm font-medium text-grey-300">
              {woz.meest_recente_peildatum
                ? new Date(woz.meest_recente_peildatum).toLocaleDateString('nl-NL')
                : '–'}
            </p>
          </div>
          <div className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] px-3 py-2">
            <p className="text-xs text-grey-600">Grondoppervlakte</p>
            <p className="mt-0.5 text-sm font-medium text-grey-300">
              {woz.grondoppervlakte != null ? `${woz.grondoppervlakte} m²` : '–'}
            </p>
          </div>
        </div>

        {woz.low_confidence && (
          <div className="rounded-lg border border-amber-accent/15 bg-amber-accent/[0.04] px-4 py-3">
            <p className="text-xs font-semibold text-amber-accent/80">Datakwaliteit</p>
            <p className="mt-1 text-sm text-grey-400">
              {woz.low_confidence_reden || 'WOZ-data is indicatief.'}
            </p>
          </div>
        )}

        {woz.waarden && woz.waarden.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-600">
              Historie
            </p>
            <div className="divide-y divide-overlay/[0.03] rounded-lg border border-overlay/[0.03] bg-overlay/[0.02]">
              {woz.waarden.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-grey-400">
                    {item.peildatum
                      ? new Date(item.peildatum).toLocaleDateString('nl-NL')
                      : 'Onbekend'}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-grey-300">
                    {item.vastgestelde_waarde != null
                      ? `EUR ${item.vastgestelde_waarde.toLocaleString('nl-NL')}`
                      : '–'}
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
      <Section title="Energielabel">
        <p className="text-sm italic text-grey-600">
          {label?.niet_geregistreerd_reden || 'Geen geregistreerd energielabel gevonden'}
        </p>
      </Section>
    )
  }

  return (
    <Section title="Energielabel">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] px-3 py-2">
          <p className="text-xs text-grey-600">Klasse</p>
          <p className="mt-0.5 text-lg font-semibold text-grey-100">{label.energieklasse}</p>
        </div>
        <div className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] px-3 py-2">
          <p className="text-xs text-grey-600">Registratie</p>
          <p className="mt-0.5 text-sm font-medium text-grey-300">
            {label.registratie_datum
              ? new Date(label.registratie_datum).toLocaleDateString('nl-NL')
              : '–'}
          </p>
        </div>
        <div className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] px-3 py-2">
          <p className="text-xs text-grey-600">Geldig tot</p>
          <p className="mt-0.5 text-sm font-medium text-grey-300">
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
      <Section title="BRK Eigendom">
        <p className="text-sm text-grey-400">
          BRK eigendomsdata wordt bewust niet opgeslagen in rapporten (Kadaster Tier 3 voorwaarden).
        </p>
      </Section>
    )
  }

  if (ownership.status !== 'available' || !ownership.data || ownership.data.length === 0) {
    return (
      <Section title="BRK Eigendom">
        <p className="text-sm italic text-grey-600">
          {ownership.reason || 'Geen eigendomsdata beschikbaar'}
        </p>
      </Section>
    )
  }

  return (
    <Section title="BRK Eigendom">
      <div className="space-y-3">
        {ownership.data.map((item, idx) => (
          <div key={idx} className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] px-3 py-2">
            <p className="text-sm font-medium text-grey-300">{item.perceel_identificatie}</p>
            <p className="mt-1 text-xs text-grey-600">
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
      <Section title="Bestemmingsplan">
        <p className="text-sm italic text-grey-600">Geen bestemmingsplangegevens beschikbaar</p>
      </Section>
    )
  }

  return (
    <Section title="Bestemmingsplan">
      <div className="space-y-4">
        {/* Primary bestemming */}
        {zoning.primary_bestemming && (
          <div className="rounded-lg border border-overlay/10 bg-overlay/[0.03] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-grey-600">Hoofdbestemming</p>
            <p className="mt-0.5 text-lg font-semibold text-grey-100">{zoning.primary_bestemming}</p>
          </div>
        )}

        {/* Building dimensions */}
        {zoning.building_dimensions && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-600">Bouwregels</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DimensionCard label="Max. hoogte" value={zoning.building_dimensions.max_hoogte} unit="m" />
              <DimensionCard label="Max. goothoogte" value={zoning.building_dimensions.max_goothoogte} unit="m" />
              <DimensionCard label="Bebouwings%" value={zoning.building_dimensions.max_bebouwingspercentage} unit="%" />
              <DimensionCard label="Max. FSI" value={zoning.building_dimensions.max_floor_area_ratio} />
            </div>
          </div>
        )}

        {/* Plans */}
        {zoning.plans && zoning.plans.length > 0 && (
          <div className="space-y-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-600">
              Plannen op locatie ({zoning.plans.length})
            </p>
            {zoning.plans.map((plan, idx) => (
              <div key={idx} className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] p-4">
                <p className="font-medium text-grey-300">{plan.plan_naam}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-grey-600">
                  {plan.plan_status && <span className="rounded border border-overlay/5 bg-overlay/[0.04] px-2 py-0.5">{plan.plan_status}</span>}
                  {plan.plan_datum && <span>{new Date(plan.plan_datum).toLocaleDateString('nl-NL')}</span>}
                  {plan.plan_type && <span className="text-grey-600">{plan.plan_type}</span>}
                </div>
                {plan.rules && plan.rules.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-overlay/[0.03] pt-3">
                    {plan.rules.map((rule, rIdx) => (
                      <div key={rIdx}>
                        <p className="text-sm font-medium text-grey-300">{rule.bestemming}</p>
                        {rule.omschrijving && (
                          <p className="mt-0.5 text-xs text-grey-600">{rule.omschrijving}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Functie aanduidingen */}
                {plan.functie_aanduidingen && plan.functie_aanduidingen.length > 0 && (
                  <div className="mt-3 border-t border-overlay/[0.03] pt-3">
                    <p className="mb-1.5 text-xs font-medium text-grey-600">Functieaanduidingen</p>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.functie_aanduidingen.map((fa, fIdx) => (
                        <span key={fIdx} className="rounded-full border border-info/20 bg-info/[0.06] px-2.5 py-0.5 text-xs font-medium text-info">
                          {fa.naam}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gebieds aanduidingen */}
                {plan.gebieds_aanduidingen && plan.gebieds_aanduidingen.length > 0 && (
                  <div className="mt-3 border-t border-overlay/[0.03] pt-3">
                    <p className="mb-1.5 text-xs font-medium text-grey-600">Gebiedsaanduidingen</p>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.gebieds_aanduidingen.map((ga, gIdx) => (
                        <span key={gIdx} className="rounded-full border border-purple-500/20 bg-purple-500/[0.06] px-2.5 py-0.5 text-xs font-medium text-purple-400">
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

        {/* Plan teksten (only first plan, only articles with content) */}
        {(() => {
          const artikelen = zoning.plans?.[0]?.teksten?.filter(t => t.inhoud) ?? []
          if (artikelen.length === 0) return null
          return (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-600">
                Planregels ({zoning.plans?.[0]?.plan_naam})
              </p>
              <div className="space-y-1">
                {artikelen.slice(0, 15).map((tekst, tIdx) => (
                  <details key={tIdx} className="group rounded-lg border border-overlay/[0.03] bg-overlay/[0.02]">
                    <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm text-grey-300 hover:text-grey-100">
                      <span className="text-[10px] text-grey-600 transition-transform group-open:rotate-90">&#9654;</span>
                      {tekst.titel}
                    </summary>
                    <div className="border-t border-overlay/[0.03] px-4 py-3 text-xs leading-relaxed text-grey-400">
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
          <div className="rounded-lg border border-amber-accent/15 bg-amber-accent/[0.04] px-4 py-3">
            <p className="text-xs font-semibold text-amber-accent/80">Onvolledige gegevens</p>
            <ul className="mt-1 space-y-0.5 text-xs text-grey-400">
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
    <div className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] px-3 py-2 text-center">
      <p className="text-xs text-grey-600">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-grey-100">
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
      <Section title="Monumentstatus">
        <p className="text-sm italic text-grey-600">Geen monumentgegevens beschikbaar</p>
      </Section>
    )
  }

  // Check if all sources have errors (no definitive answer)
  const allSourcesFailed = monuments.sources.every((s) => s.error != null)

  return (
    <Section title="Monumentstatus">
      <div className="space-y-4">
        {/* Status */}
        {allSourcesFailed ? (
          <div className="rounded-lg border border-overlay/5 bg-overlay/[0.03] px-4 py-3">
            <p className="font-semibold text-grey-400">Niet vast te stellen</p>
            <p className="mt-0.5 text-sm text-grey-600">
              Alle bronnen voor monumentstatus zijn momenteel niet beschikbaar. Dit betekent niet dat het pand geen monument is.
            </p>
          </div>
        ) : (
          <div className={`rounded-lg px-4 py-3 ${monuments.is_monument ? 'border border-amber-accent/20 bg-amber-accent/[0.06]' : 'border border-overlay/5 bg-overlay/[0.03]'}`}>
            <p className={`font-semibold ${monuments.is_monument ? 'text-amber-accent' : 'text-grey-300'}`}>
              {monuments.is_monument ? 'Rijksmonument' : 'Niet beschermd'}
            </p>
            {monuments.is_monument && monuments.consensus_status && (
              <p className="mt-0.5 text-sm text-grey-400">
                Status: {monuments.consensus_status}
              </p>
            )}
            {!monuments.is_monument && (
              <p className="mt-0.5 text-sm text-grey-600">
                Dit pand staat niet geregistreerd als rijks- of gemeentelijk monument
              </p>
            )}
          </div>
        )}

        {/* Conflict */}
        {monuments.has_conflict && monuments.conflict_note && (
          <div className="rounded-lg border border-amber-accent/15 bg-amber-accent/[0.04] px-4 py-3">
            <p className="text-xs font-semibold text-amber-accent/80">Let op — bronconflict</p>
            <p className="mt-1 text-sm text-grey-400">{monuments.conflict_note}</p>
          </div>
        )}

        {/* Restrictions */}
        {monuments.restrictions_summary && monuments.restrictions_summary.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-600">Beperkingen</p>
            <ul className="space-y-1.5">
              {monuments.restrictions_summary.map((restriction, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-grey-300">
                  <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-accent/50" />
                  {restriction}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sources */}
        {monuments.sources && monuments.sources.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-600">Bronverificatie</p>
            <div className="divide-y divide-overlay/[0.03] rounded-lg border border-overlay/[0.03] bg-overlay/[0.02]">
              {monuments.sources.map((src, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-grey-400">{src.source}</span>
                  {src.error ? (
                    <span className="text-xs text-grey-600">Niet beschikbaar</span>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${src.is_monument ? 'border border-amber-accent/20 bg-amber-accent/10 text-amber-accent' : 'border border-success/20 bg-success/[0.06] text-success'}`}>
                      {src.is_monument ? 'Beschermd' : 'Niet beschermd'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {allSourcesFailed && (
              <p className="mt-2 text-xs text-grey-600">
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
    <Section title="AI Interpretatie">
      {status === 'done' ? (
        <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/[0.04] px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-success">PDF ontvangen</p>
            <p className="text-xs text-grey-600">AI-analyse loopt op de achtergrond. Ververs over enkele minuten.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4 rounded-lg border border-overlay/[0.06] bg-overlay/[0.02] px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-overlay/10 bg-overlay/[0.03]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-error"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-grey-300">Bestemmingsplan PDF</p>
            <p className="mt-0.5 text-xs text-grey-600">
              Upload de PDF voor een AI-analyse van bouw- en gebruiksregels
            </p>

            <input ref={fileRef} type="file" accept=".pdf,application/pdf" onChange={handleUpload} className="hidden" />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={status === 'uploading'}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-overlay/10 bg-overlay/[0.05] px-3 py-1.5 text-xs font-medium text-grey-300 transition-colors hover:bg-overlay/[0.08] hover:text-grey-100 disabled:opacity-50"
            >
              {status === 'uploading' ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-grey-400"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  Uploaden...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-grey-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  PDF uploaden
                </>
              )}
            </button>

            {status === 'error' && (
              <p className="mt-1.5 text-xs text-error">{errorMsg}</p>
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
    ? 'border-amber-accent/30 bg-amber-accent/10 text-amber-accent'
    : parsed.overall_confidence === 'MEDIUM'
      ? 'border-overlay/10 bg-overlay/[0.06] text-grey-300'
      : 'border-overlay/5 bg-overlay/[0.03] text-grey-600'

  return (
    <Section title="AI Interpretatie">
      <div className="space-y-4">
        {/* Confidence + Summary */}
        <div className="flex items-start gap-3">
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceStyle}`}>
            {parsed.overall_confidence === 'HIGH' ? 'Hoog' : parsed.overall_confidence === 'MEDIUM' ? 'Gemiddeld' : 'Laag'}
          </span>
          <p className="text-sm text-grey-300">{parsed.samenvatting}</p>
        </div>

        {/* Regels */}
        {parsed.regels && parsed.regels.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-600">Bestemmingsregels (AI)</p>
            <div className="space-y-3">
              {parsed.regels.map((regel, idx) => (
                <div key={idx} className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-grey-300">{regel.bestemming}</p>
                    <span className="text-xs text-grey-600">{regel.artikel}</span>
                  </div>

                  {regel.toegestane_gebruiken.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-grey-600">Toegestaan gebruik</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {regel.toegestane_gebruiken.map((g, i) => (
                          <span key={i} className="rounded border border-overlay/5 bg-overlay/[0.04] px-2 py-0.5 text-xs text-grey-300">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {regel.verboden_gebruiken.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-grey-600">Verboden gebruik</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {regel.verboden_gebruiken.map((g, i) => (
                          <span key={i} className="rounded border border-error/20 bg-error/[0.06] px-2 py-0.5 text-xs text-error">{g}</span>
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
                    <p className="mt-2 text-xs text-grey-600"><strong className="text-grey-400">Parkeereis:</strong> {regel.parkeereis}</p>
                  )}

                  {regel.milieu_restricties.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-grey-600">Milieurestricties</p>
                      <ul className="mt-0.5 text-xs text-grey-600">
                        {regel.milieu_restricties.map((m, i) => <li key={i}>• {m}</li>)}
                      </ul>
                    </div>
                  )}

                  {regel.bijzondere_voorwaarden.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-grey-600">Bijzondere voorwaarden</p>
                      <ul className="mt-0.5 text-xs text-grey-600">
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
          <div className="rounded-lg border border-overlay/[0.03] bg-overlay/[0.02] px-4 py-3">
            <p className="text-xs font-semibold text-grey-600">Disclaimer</p>
            {parsed.disclaimers.map((d, idx) => (
              <p key={idx} className="mt-1 text-xs italic text-grey-600">{d}</p>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}

function MiniDim({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-overlay/[0.03] bg-overlay/[0.02] px-2 py-1 text-center">
      <p className="text-[10px] text-grey-600">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-grey-300">{value}</p>
    </div>
  )
}

/* ─── Bronnen ───────────────────────────────────────────────── */

function BronnenSection({ data }: { data: PropertyReportResponse }) {
  type SourceRow = {
    source: string
    age_seconds: number | null
    status: 'ok' | 'unlinked' | 'error'
    note?: string
  }

  const byKey = new Map<string, SourceRow>()

  const classifyIssue = (message?: string | null): 'unlinked' | 'error' => {
    const msg = (message ?? '').toLowerCase()
    if (!msg) return 'unlinked'
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
      if (lower.includes('403')) return 'RCE API toegang geweigerd (403)'
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
    byKey.set(key, {
      ...existing,
      ...row,
      age_seconds: row.age_seconds ?? existing.age_seconds,
      note: row.note ?? existing.note,
      status:
        existing.status === 'error' || row.status === 'error'
          ? 'error'
          : existing.status === 'unlinked' || row.status === 'unlinked'
            ? 'unlinked'
            : 'ok',
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
      status: src.error ? classifyIssue(src.error) : 'ok',
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
    <Section title="Data bronnen">
      {sources.length === 0 && (
        <p className="text-sm italic text-grey-600">Geen broninformatie beschikbaar</p>
      )}
      <div className="divide-y divide-overlay/[0.03] rounded-lg border border-overlay/[0.03] bg-overlay/[0.02]">
        {sources.map((src, idx) => (
          <div key={idx} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-grey-300">{src.source}</p>
              <p className="text-xs text-grey-600">{formatAge(src.age_seconds)}</p>
              {src.note && (
                <p className="text-xs text-grey-600 break-words">
                  {sanitizeSourceNote(src.note, src.source)}
                </p>
              )}
            </div>
            <div className="shrink-0">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  src.status === 'error'
                    ? 'border-error/20 bg-error/10 text-error'
                    : src.status === 'unlinked'
                      ? 'border-overlay/10 bg-overlay/[0.06] text-grey-300'
                      : 'border-success/20 bg-success/[0.06] text-success'
                }`}
              >
                {src.status === 'error' ? 'Fout' : src.status === 'unlinked' ? 'Niet gekoppeld' : 'OK'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ─── Icons ─────────────────────────────────────────────────── */

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
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

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function MonumentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent">
      <rect x="3" y="21" width="18" height="2" rx="1" />
      <rect x="5" y="11" width="2" height="10" />
      <rect x="17" y="11" width="2" height="10" />
      <rect x="10" y="11" width="4" height="10" />
      <path d="M12 3L4 11h16L12 3z" />
    </svg>
  )
}
