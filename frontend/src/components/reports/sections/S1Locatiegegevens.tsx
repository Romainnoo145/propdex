/**
 * S1 Locatiegegevens — Due Diligence Dashboard section 1
 *
 * Displays: address, building/BAG, energy label, WOZ, monument status
 * Each sub-section is wrapped in a SectionInsightCard (kicker + icon header).
 * Includes per-section document upload zone when sourceParcelId is available.
 */

import { MapPin, Building2, Zap, TrendingUp, Landmark } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { KVRow, SubCard, AmberCircleBadge, SectionNotes, formatArea, formatCurrency } from '../components'

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

/* ─── Badge helpers ──────────────────────────────────────────── */

const ENERGY_BADGE_COLORS: Record<string, string> = {
  'A++': 'bg-amber-100 text-amber-700',
  'A+': 'bg-amber-100 text-amber-700',
  A: 'bg-amber-100 text-amber-700',
  B: 'bg-amber-100 text-amber-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-slate-100 text-slate-600',
  E: 'bg-slate-100 text-slate-600',
  F: 'bg-slate-100 text-slate-600',
  G: 'bg-slate-100 text-slate-600',
}

function EnergyBadge({ label }: { label: string }) {
  const colors = ENERGY_BADGE_COLORS[label] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${colors}`}>
      {label}
    </span>
  )
}

const SEVERITY_BADGE_COLORS: Record<string, string> = {
  high: 'bg-amber-200 text-amber-800',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
}

function SeverityBadge({ label, severity }: { label: string; severity: string }) {
  const colors = SEVERITY_BADGE_COLORS[severity] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${colors}`}>
      {label}
    </span>
  )
}

function MonumentBadge({ isMonument }: { isMonument: boolean }) {
  const colors = isMonument ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${colors}`}>
      {isMonument ? 'Beschermd' : 'Vrij'}
    </span>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S1Locatiegegevens({ data, sourceParcelId }: S1LocatiegegevensProps) {
  const { address, building, monuments } = data
  const statusInfo = building?.status
    ? (STATUS_EXPLANATIONS[building.status] ?? { label: building.status, severity: 'low' as const })
    : null

  // Energy label: prefer flags over report field
  const energy = data.energy_label
  const woz = data.woz_data

  const isMonument = monuments?.is_monument ?? false

  return (
    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── 1. Hero Stats Row ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 justify-start">
        <AmberCircleBadge label="Bouwjaar" value={building?.bouwjaar ?? '–'} />
        <AmberCircleBadge label="Oppervlakte" value={formatArea(building?.oppervlakte)} size="sm" />
        <AmberCircleBadge label="Gebruiksdoel" value={building?.gebruiksdoel?.[0] ?? '–'} size="sm" />
        <AmberCircleBadge
          label="Energielabel"
          value={energy?.energieklasse
            ? <EnergyBadge label={energy.energieklasse} />
            : 'N/A'}
        />
        <AmberCircleBadge label="WOZ Waarde" value={formatCurrency(woz?.meest_recente_waarde)} size="sm" />
        <AmberCircleBadge
          label="Monument"
          value={<MonumentBadge isMonument={isMonument} />}
        />
      </div>

      {/* ── 2. Adres & Gebouw Details (side by side on lg) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card A: Adresgegevens */}
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

        {/* Card B: Gebouwgegevens */}
        <SectionInsightCard kicker="Gebouw" title="Gebouwgegevens" Icon={Building2}>
          {building ? (
            <div>
              <KVRow label="Bouwjaar" value={building.bouwjaar?.toString()} />
              {building.status && statusInfo && (
                <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF] last:border-b-0">
                  <span className="text-[12px] text-slate-400">Status</span>
                  <SeverityBadge label={statusInfo.label} severity={statusInfo.severity} />
                </div>
              )}
              <KVRow label="Oppervlakte" value={formatArea(building.oppervlakte)} />
              {building.gebruiksdoel.length > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF] last:border-b-0">
                  <span className="text-[12px] text-slate-400">Gebruiksdoel</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {building.gebruiksdoel.map((doel) => (
                      <span
                        key={doel}
                        className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-2.5 py-0.5 text-[11px] font-medium text-[#0E1111]"
                      >
                        {doel}
                      </span>
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

      {/* ── 3. Energielabel Detail ────────────────────────────── */}
      <SectionInsightCard kicker="Energie" title="Energielabel" Icon={Zap}>
        {energy && energy.energieklasse ? (
          <div>
            <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
              <span className="text-[12px] text-slate-400">Klasse</span>
              <EnergyBadge label={energy.energieklasse} />
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
            {energy?.niet_geregistreerd_reden ?? 'Geen geregistreerd energielabel gevonden'}
          </p>
        )}
      </SectionInsightCard>

      {/* ── 4. WOZ Detail ─────────────────────────────────────── */}
      <SectionInsightCard kicker="Waarde" title="WOZ Waarde" Icon={TrendingUp}>
        {woz ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <SubCard>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Meest recente waarde</p>
                <p className="mt-1 text-lg font-black tracking-tighter text-[#0E1111]">
                  {formatCurrency(woz.meest_recente_waarde)}
                </p>
              </SubCard>
              <SubCard>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Peildatum</p>
                <p className="mt-1 text-[13px] font-semibold text-[#0E1111]">
                  {woz.meest_recente_peildatum
                    ? new Date(woz.meest_recente_peildatum).toLocaleDateString('nl-NL')
                    : '–'}
                </p>
              </SubCard>
            </div>
            {woz.low_confidence && (
              <div className="rounded-[16px] border border-[#F9A826]/15 bg-[#F9A826]/[0.04] px-4 py-3">
                <p className="text-[12px] text-[#F9A826]/80 font-semibold">Indicatief</p>
                <p className="mt-0.5 text-[13px] text-slate-600">
                  {woz.low_confidence_reden ?? 'WOZ-data is indicatief.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">Geen WOZ-gegevens beschikbaar</p>
        )}
      </SectionInsightCard>

      {/* ── 5. Monumentstatus ─────────────────────────────────── */}
      <SectionInsightCard kicker="Monument" title="Monumentstatus" Icon={Landmark}>
        {monuments ? (
          <div className="space-y-3">
            <div
              className={`rounded-[16px] px-4 py-3 ${isMonument ? 'border border-[#F9A826]/20 bg-[#F9A826]/[0.06]' : 'border border-[#EAEFEF] bg-[#F8FAFA]'}`}
            >
              <p
                className={`font-semibold ${isMonument ? 'text-[#F9A826]' : 'text-[#0E1111]'}`}
              >
                {isMonument ? 'Rijksmonument' : 'Niet beschermd'}
              </p>
              {monuments.consensus_status && (
                <p className="mt-0.5 text-[13px] text-slate-600">
                  {monuments.consensus_status}
                </p>
              )}
            </div>
            {monuments.restrictions_summary.length > 0 && (
              <ul className="space-y-1">
                {monuments.restrictions_summary.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F9A826]/50" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">Geen monumentgegevens beschikbaar</p>
        )}

        {/* Upload zone inside Monumentstatus card flow */}
      </SectionInsightCard>

      {/* ── 6. Section Notes ──────────────────────────────────── */}
      <SectionNotes parcelId={sourceParcelId ?? null} documentTypes={['locatie']} />
    </div>
  )
}
