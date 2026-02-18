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
  hour: '2-digit',
  minute: '2-digit',
})

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
            <div className="h-32 rounded-xl bg-grey-800" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-grey-800" />)}
            </div>
            {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-grey-800" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-full overflow-y-auto bg-grey-950">
        <div className="mx-auto max-w-4xl px-8 py-10 text-center">
          <p className="text-grey-500">Rapport niet gevonden</p>
          <button onClick={onBack} className="mt-4 text-sm text-grey-400 underline hover:text-grey-100">
            Terug naar projecten
          </button>
        </div>
      </div>
    )
  }

  const { address, building, zoning, monuments, ai_parsing, completeness_score } = data

  return (
    <div className="h-full overflow-y-auto bg-grey-950">
      <div className="mx-auto max-w-4xl px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <button
              onClick={onBack}
              className="mb-3 flex items-center gap-1 text-sm text-grey-500 transition-colors hover:text-grey-400"
            >
              <ArrowLeftIcon />
              Terug naar projecten
            </button>
            <h1 className="text-2xl font-semibold text-grey-100">
              {address.straat} {address.huisnummer}
              {address.huisletter ?? ''}{address.toevoeging ?? ''}
            </h1>
            <p className="mt-1 text-grey-500">
              {address.postcode}, {address.woonplaats}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewOnMap}
              className="flex items-center gap-2 rounded-lg border border-grey-800 bg-grey-900 px-4 py-2 text-sm font-medium text-grey-200 shadow-sm transition-colors hover:bg-grey-800"
            >
              <MapPinIcon />
              Bekijk op kaart
            </button>
          </div>
        </div>

        {/* Overview metrics */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard label="Bouwjaar" value={building?.bouwjaar?.toString() ?? 'Onbekend'} />
          <MetricCard label="Oppervlakte" value={building?.oppervlakte ? `${building.oppervlakte} m²` : '–'} />
          <MetricCard
            label="Bestemming"
            value={zoning?.primary_bestemming ?? '–'}
          />
          <MetricCard
            label="Compleetheid"
            value={`${Math.round(completeness_score * 100)}%`}
            bar={completeness_score}
          />
        </div>

        {/* Monument alert */}
        {monuments?.is_monument && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <span className="text-2xl">🏛</span>
            <div>
              <p className="font-semibold text-amber-900">{monuments.consensus_status ?? 'Rijksmonument'}</p>
              {monuments.restrictions_summary && monuments.restrictions_summary.length > 0 && (
                <p className="mt-0.5 text-sm text-amber-700">
                  {monuments.restrictions_summary.length} beperkingen van toepassing
                </p>
              )}
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-6">
          <GebouwSection data={data} />
          <KadasterSection data={data} />
          <BestemmingSection data={data} />
          <MonumentSection data={data} />
          {ai_parsing?.parsed_plan && ai_parsing.status === 'complete' && (
            <AIInterpretatieSection data={data} />
          )}
          <BronnenSection data={data} />
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-grey-800 pt-4 text-center text-xs text-grey-600">
          Rapport gegenereerd op {dateFmt.format(new Date(data.resolved_at))}
        </div>
      </div>
    </div>
  )
}

/* ─── Metric Card ───────────────────────────────────────────── */

function MetricCard({ label, value, bar }: { label: string; value: string; bar?: number }) {
  return (
    <div className="rounded-xl border border-grey-800 bg-grey-900 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-grey-600">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-grey-100">{value}</p>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-grey-800">
          <div
            className={`h-full rounded-full transition-all ${bar >= 0.9 ? 'bg-green-500' : bar >= 0.7 ? 'bg-yellow-500' : 'bg-red-400'}`}
            style={{ width: `${bar * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Section Wrapper ───────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-grey-800 bg-grey-900 shadow-sm">
      <div className="border-b border-grey-800 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-grey-500">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

/* ─── Row helper ────────────────────────────────────────────── */

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-sm text-grey-500">{label}</span>
      <span className={`text-sm font-medium text-grey-100 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

/* ─── Gebouw & BAG ──────────────────────────────────────────── */

function GebouwSection({ data }: { data: PropertyReportResponse }) {
  const { address, building } = data
  const gebruiksdoel = building?.gebruiksdoel ?? []

  return (
    <Section title="Gebouw & BAG">
      <div className="divide-y divide-grey-800">
        <Row label="Pand ID" value={building?.pand_id} mono />
        <Row label="Bouwjaar" value={building?.bouwjaar?.toString()} />
        <Row label="Status" value={building?.status} />
        <Row label="Oppervlakte" value={building?.oppervlakte ? `${building.oppervlakte} m²` : null} />
        {gebruiksdoel.length > 0 && (
          <div className="flex items-baseline justify-between py-1.5">
            <span className="text-sm text-grey-500">Gebruiksdoel</span>
            <div className="flex flex-wrap justify-end gap-1">
              {gebruiksdoel.map((doel) => (
                <span key={doel} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {doel}
                </span>
              ))}
            </div>
          </div>
        )}
        <Row label="Nummeraanduiding ID" value={address.nummeraanduiding_id} mono />
        <Row label="Verblijfsobject ID" value={address.verblijfsobject_id} mono />
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
          <div key={idx} className="rounded-lg border border-grey-800 bg-grey-950 p-3">
            {parcel.kadastrale_aanduiding && (
              <p className="mb-2 text-sm font-semibold text-grey-100">{parcel.kadastrale_aanduiding}</p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-grey-600">Perceelnr</p>
                <p className="text-sm font-medium text-grey-200">{parcel.perceelnummer ?? '–'}</p>
              </div>
              <div>
                <p className="text-xs text-grey-600">Sectie</p>
                <p className="text-sm font-medium text-grey-200">{parcel.sectie ?? '–'}</p>
              </div>
              <div>
                <p className="text-xs text-grey-600">Oppervlakte</p>
                <p className="text-sm font-medium text-grey-200">{parcel.oppervlakte ? `${parcel.oppervlakte} m²` : '–'}</p>
              </div>
            </div>
          </div>
        ))}
        {parcels.length > 1 && totalOpp > 0 && (
          <div className="flex justify-end pt-1">
            <span className="text-xs text-grey-500">Totaal: <strong className="text-grey-200">{totalOpp} m²</strong></span>
          </div>
        )}
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
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-500">Hoofdbestemming</p>
            <p className="mt-0.5 text-lg font-semibold text-blue-900">{zoning.primary_bestemming}</p>
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
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-600">Bestemmingsplannen</p>
            {zoning.plans.map((plan, idx) => (
              <div key={idx} className="rounded-lg border border-grey-800 bg-grey-950 p-4">
                <p className="font-medium text-grey-100">{plan.plan_naam}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-grey-500">
                  {plan.plan_status && <span className="rounded bg-grey-800 px-2 py-0.5">{plan.plan_status}</span>}
                  {plan.plan_datum && <span>{new Date(plan.plan_datum).toLocaleDateString('nl-NL')}</span>}
                  {plan.plan_type && <span className="text-grey-600">{plan.plan_type}</span>}
                </div>
                {plan.rules && plan.rules.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-grey-800 pt-3">
                    {plan.rules.map((rule, rIdx) => (
                      <div key={rIdx}>
                        <p className="text-sm font-medium text-grey-200">{rule.bestemming}</p>
                        {rule.omschrijving && (
                          <p className="mt-0.5 text-xs text-grey-500">{rule.omschrijving}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Data gaps */}
        {zoning.data_gaps && zoning.data_gaps.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-800">Onvolledige gegevens</p>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
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
    <div className="rounded-lg border border-grey-800 bg-grey-950 px-3 py-2 text-center">
      <p className="text-xs text-grey-600">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-grey-100">
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

  return (
    <Section title="Monumentstatus">
      <div className="space-y-4">
        {/* Status */}
        <div className={`rounded-lg px-4 py-3 ${monuments.is_monument ? 'border border-amber-200 bg-amber-50' : 'border border-green-200 bg-green-50'}`}>
          <p className={`font-semibold ${monuments.is_monument ? 'text-amber-900' : 'text-green-900'}`}>
            {monuments.is_monument ? 'Rijksmonument' : 'Geen monument'}
          </p>
          {monuments.consensus_status && (
            <p className={`mt-0.5 text-sm ${monuments.is_monument ? 'text-amber-700' : 'text-green-700'}`}>
              {monuments.consensus_status}
            </p>
          )}
        </div>

        {/* Conflict */}
        {monuments.has_conflict && monuments.conflict_note && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-800">Let op — bronconflict</p>
            <p className="mt-1 text-sm text-amber-700">{monuments.conflict_note}</p>
          </div>
        )}

        {/* Restrictions */}
        {monuments.restrictions_summary && monuments.restrictions_summary.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-600">Beperkingen</p>
            <ul className="space-y-1.5">
              {monuments.restrictions_summary.map((restriction, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-grey-200">
                  <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
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
            <div className="divide-y divide-grey-800 rounded-lg border border-grey-800 bg-grey-950">
              {monuments.sources.map((src, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-grey-400">{src.source}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${src.is_monument ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                    {src.is_monument ? 'Monument' : 'Geen'}
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

/* ─── AI Interpretatie ──────────────────────────────────────── */

function AIInterpretatieSection({ data }: { data: PropertyReportResponse }) {
  const parsed = data.ai_parsing?.parsed_plan
  if (!parsed) return null

  const confidenceColor = parsed.overall_confidence === 'HIGH'
    ? 'bg-green-100 text-green-800'
    : parsed.overall_confidence === 'MEDIUM'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800'

  return (
    <Section title="AI Interpretatie">
      <div className="space-y-4">
        {/* Confidence + Summary */}
        <div className="flex items-start gap-3">
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${confidenceColor}`}>
            {parsed.overall_confidence === 'HIGH' ? 'Hoog' : parsed.overall_confidence === 'MEDIUM' ? 'Gemiddeld' : 'Laag'}
          </span>
          <p className="text-sm text-grey-200">{parsed.samenvatting}</p>
        </div>

        {/* Regels */}
        {parsed.regels && parsed.regels.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-600">Bestemmingsregels (AI)</p>
            <div className="space-y-3">
              {parsed.regels.map((regel, idx) => (
                <div key={idx} className="rounded-lg border border-grey-800 bg-grey-950 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-grey-100">{regel.bestemming}</p>
                    <span className="text-xs text-grey-600">{regel.artikel}</span>
                  </div>

                  {regel.toegestane_gebruiken.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-green-700">Toegestaan gebruik</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {regel.toegestane_gebruiken.map((g, i) => (
                          <span key={i} className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {regel.verboden_gebruiken.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-red-700">Verboden gebruik</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {regel.verboden_gebruiken.map((g, i) => (
                          <span key={i} className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">{g}</span>
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
                    <p className="mt-2 text-xs text-grey-400"><strong>Parkeereis:</strong> {regel.parkeereis}</p>
                  )}

                  {regel.milieu_restricties.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-grey-400">Milieurestricties</p>
                      <ul className="mt-0.5 text-xs text-grey-500">
                        {regel.milieu_restricties.map((m, i) => <li key={i}>• {m}</li>)}
                      </ul>
                    </div>
                  )}

                  {regel.bijzondere_voorwaarden.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-grey-400">Bijzondere voorwaarden</p>
                      <ul className="mt-0.5 text-xs text-grey-500">
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
          <div className="rounded-lg border border-grey-800 bg-grey-950 px-4 py-3">
            <p className="text-xs font-semibold text-grey-500">Disclaimer</p>
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
    <div className="rounded bg-grey-900 px-2 py-1 text-center border border-grey-800">
      <p className="text-[10px] text-grey-600">{label}</p>
      <p className="text-sm font-semibold text-grey-100">{value}</p>
    </div>
  )
}

/* ─── Bronnen ───────────────────────────────────────────────── */

function BronnenSection({ data }: { data: PropertyReportResponse }) {
  const sources = data.data_sources || []

  const formatAge = (s: number | null): string => {
    if (!s) return 'Onbekend'
    if (s < 60) return 'Zojuist'
    if (s < 3600) return `${Math.floor(s / 60)} min geleden`
    if (s < 86400) return `${Math.floor(s / 3600)} uur geleden`
    return `${Math.floor(s / 86400)} dagen geleden`
  }

  return (
    <Section title="Data bronnen">
      <div className="divide-y divide-grey-800 rounded-lg border border-grey-800 bg-grey-950">
        {sources.map((src, idx) => (
          <div key={idx} className="flex items-center justify-between px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-grey-200">{src.source}</p>
              <p className="text-xs text-grey-600">{formatAge(src.age_seconds)}</p>
            </div>
            <div className="flex items-center gap-2">
              {src.confidence && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  src.confidence === 'HIGH' ? 'bg-green-100 text-green-700'
                    : src.confidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {src.confidence === 'HIGH' ? 'Hoog' : src.confidence === 'MEDIUM' ? 'Gemiddeld' : 'Laag'}
                </span>
              )}
              {src.is_cached && (
                <span className="text-xs text-grey-600">cached</span>
              )}
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
