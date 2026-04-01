/**
 * S1 Locatiegegevens — Due Diligence Dashboard section 1
 *
 * Displays: address, building/BAG, energy label, WOZ, monument status
 * Each sub-section is wrapped in a SectionInsightCard (kicker + icon header).
 */

import { MapPin, Building2, Zap, TrendingUp, Landmark, Lightbulb } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { KVRow, SectionNotes, formatArea, formatCurrency } from '../components'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S1LocatiegegevensProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Shared helpers ─────────────────────────────────────────── */

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** Map BAG statuses to developer-oriented Dutch explanations */
export const STATUS_EXPLANATIONS: Record<
  string,
  { label: string; severity: 'high' | 'medium' | 'low' }
> = {
  'Sloopvergunning verleend': { label: 'Sloopvergunning verleend', severity: 'high' },
  'Pand gesloopt': { label: 'Pand gesloopt', severity: 'high' },
  'Bouw gestart': { label: 'Bouw gestart', severity: 'medium' },
  'Bouwvergunning verleend': { label: 'Bouwvergunning verleend', severity: 'medium' },
  'Niet gerealiseerd pand': { label: 'Niet gerealiseerd', severity: 'medium' },
  'Pand in gebruik (niet ingemeten)': {
    label: 'In gebruik (niet ingemeten)',
    severity: 'low',
  },
  'Pand in gebruik': { label: 'In gebruik', severity: 'low' },
  'Pand buiten gebruik': { label: 'Buiten gebruik', severity: 'medium' },
  'Verbouwing pand': { label: 'Verbouwing gaande', severity: 'low' },
}

/* ─── Badge helper ───────────────────────────────────────────── */

/** Uniform amber/slate pill badge used for all inline values */
function AmberBadge({ children, variant = 'amber' }: { children: React.ReactNode; variant?: 'amber' | 'slate' }) {
  const cls = variant === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-slate-200 bg-slate-50 text-slate-600'
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  )
}

/** Semantic pill — green (positive), amber (warning), red (negative) */
function SemanticPill({ children, tone }: { children: React.ReactNode; tone: 'green' | 'amber' | 'red' | 'slate' }) {
  const cls = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }[tone]
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  )
}

/** Energy label tone: A-B green, C-D amber, E-G red */
function energyTone(label: string): 'green' | 'amber' | 'red' | 'slate' {
  if (['A++', 'A+', 'A', 'B'].includes(label)) return 'green'
  if (['C', 'D'].includes(label)) return 'amber'
  if (['E', 'F', 'G'].includes(label)) return 'red'
  return 'slate'
}

function severityVariant(severity: string): 'amber' | 'slate' {
  return severity === 'high' || severity === 'medium' ? 'amber' : 'slate'
}

/* ─── Section ────────────────────────────────────────────────── */

export function S1Locatiegegevens({ data, sourceParcelId }: S1LocatiegegevensProps) {
  const { address, building, monuments } = data
  const statusInfo = building?.status
    ? (STATUS_EXPLANATIONS[building.status] ?? { label: building.status, severity: 'low' as const })
    : null

  const energy = data.energy_label
  const woz = data.woz_data
  const isMonument = monuments?.is_monument ?? false

  return (
    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── 1. Adres & Gebouw Details (side by side on lg) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionInsightCard kicker="Locatie" title="Adresgegevens" Icon={MapPin}>
          <div>
            <KVRow
              label="Adres"
              value={`${address.straat} ${address.huisnummer}${address.huisletter ?? ''}${address.toevoeging ?? ''}`}
            />
            <KVRow label="Postcode" value={address.postcode} />
            <KVRow label="Woonplaats" value={address.woonplaats} />
            <KVRow label="Nummeraanduiding" value={address.nummeraanduiding_id} mono />
            {address.verblijfsobject_id && (
              <KVRow label="VBO" value={address.verblijfsobject_id} mono />
            )}
          </div>
        </SectionInsightCard>

        <SectionInsightCard kicker="Gebouw" title="Gebouwgegevens" Icon={Building2}>
          {building ? (
            <div>
              <KVRow label="Bouwjaar" value={building.bouwjaar?.toString()} />
              {building.status && statusInfo && (
                <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF] last:border-b-0">
                  <span className="text-[12px] text-slate-400">Status</span>
                  <AmberBadge variant={severityVariant(statusInfo.severity)}>{statusInfo.label}</AmberBadge>
                </div>
              )}
              <KVRow label="Oppervlakte" value={formatArea(building.oppervlakte)} />
              {building.gebruiksdoel.length > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF] last:border-b-0">
                  <span className="text-[12px] text-slate-400">Gebruiksdoel</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {building.gebruiksdoel.map((doel) => (
                      <AmberBadge key={doel}>{doel}</AmberBadge>
                    ))}
                  </div>
                </div>
              )}
              <KVRow label="Pand ID" value={building.pand_id} mono />
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">Geen gebouwgegevens beschikbaar</p>
          )}
        </SectionInsightCard>
      </div>

      {/* ── 3. Energielabel ───────────────────────────────────── */}
      <SectionInsightCard kicker="Energie" title="Energielabel" Icon={Zap}>
        {energy && energy.energieklasse ? (
          <div>
            <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
              <span className="text-[12px] text-slate-400">Klasse</span>
              <SemanticPill tone={energyTone(energy.energieklasse)}>
                {energy.energieklasse}
              </SemanticPill>
            </div>
            <KVRow
              label="Registratie"
              value={energy.registratie_datum
                ? dateFmt.format(new Date(energy.registratie_datum))
                : '–'}
            />
            <KVRow
              label="Geldig tot"
              value={energy.geldig_tot
                ? dateFmt.format(new Date(energy.geldig_tot))
                : '–'}
            />
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">
            {energy?.niet_geregistreerd_reden ?? 'Niet geregistreerd'}
          </p>
        )}
      </SectionInsightCard>

      {/* ── 4. WOZ Waarde ─────────────────────────────────────── */}
      <SectionInsightCard kicker="Waarde" title="WOZ Waarde" Icon={TrendingUp}>
        {woz ? (
          <div>
            <KVRow label="Meest recente waarde" value={formatCurrency(woz.meest_recente_waarde)} />
            <KVRow
              label="Peildatum"
              value={woz.meest_recente_peildatum
                ? new Date(woz.meest_recente_peildatum).toLocaleDateString('nl-NL')
                : '–'}
            />
            {woz.low_confidence && (
              <div className="mt-3 rounded-[16px] border border-[#F9A826]/15 bg-[#F9A826]/[0.04] px-4 py-3">
                <p className="text-[12px] text-[#F9A826]/80 font-semibold">Indicatief</p>
                <p className="mt-0.5 text-[13px] text-slate-600">
                  {woz.low_confidence_reden ?? 'WOZ-data is indicatief.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">Niet beschikbaar</p>
        )}
      </SectionInsightCard>

      {/* ── 5. Monumentstatus ─────────────────────────────────── */}
      <SectionInsightCard kicker="Monument" title="Monumentstatus" Icon={Landmark}>
        <SemanticPill tone={isMonument ? 'red' : 'green'}>
          {isMonument ? 'Rijksmonument' : 'Niet beschermd'}
        </SemanticPill>
        {monuments?.consensus_status && (
          <KVRow label="Bron" value={monuments.consensus_status} />
        )}
        {monuments?.restrictions_summary && monuments.restrictions_summary.length > 0 && (
          <div className="mt-2">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Restricties</p>
            <ul className="space-y-1">
              {monuments.restrictions_summary.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionInsightCard>

      {/* ── 6. Notities ───────────────────────────────────────── */}
      <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
        <SectionNotes parcelId={sourceParcelId ?? null} documentTypes={['locatie']} />
      </SectionInsightCard>
    </div>
  )
}
