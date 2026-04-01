/**
 * S4 Risicoprofiel — Due Diligence Dashboard section 4
 *
 * Displays: fysiek risico profiel, bodem, fundering, asbest, and 4 environmental enrichment flags
 * Each sub-section wrapped in SectionInsightCard matching S01–S03 pattern.
 * Hero stat row at top with risk level badges.
 * Includes per-section document upload zone when sourceParcelId is available.
 */

import { ShieldAlert, Droplets, Construction, AlertTriangle, TreePine } from 'lucide-react'
import type { PropertyReportResponse, WBBDossierRef } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { KVRow, SubCard, formatCurrency, SectionNotes } from '../components'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S4RisicoprofielProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Risk styling helpers ───────────────────────────────────── */

const RISK_BADGE_STYLE: Record<string, string> = {
  hoog: 'border-amber-200 bg-amber-50 text-amber-700',
  middel: 'border-amber-200 bg-amber-50 text-amber-700',
  laag: 'border-slate-200 bg-slate-50 text-slate-600',
  geen: 'border-slate-200 bg-slate-50 text-slate-600',
  onbekend: 'border-slate-200 bg-slate-50 text-slate-600',
}

const RISK_LABEL: Record<string, string> = {
  hoog: 'Hoog risico',
  middel: 'Middel risico',
  laag: 'Laag risico',
  geen: 'Geen risico',
  onbekend: 'Onbekend',
}

function riskBadge(risk: string) {
  const style = RISK_BADGE_STYLE[risk] ?? RISK_BADGE_STYLE.onbekend
  const label = RISK_LABEL[risk] ?? risk
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style}`}>
      {label}
    </span>
  )
}

/* ─── WBB Row ────────────────────────────────────────────────── */

function WBBRow({ dossier }: { dossier: WBBDossierRef }) {
  return (
    <SubCard className="space-y-1">
      {dossier.status_oord && <p className="text-[13px] font-semibold text-[#0E1111]">{dossier.status_oord}</p>}
      {dossier.vervolg_wbb && <p className="text-[11px] text-slate-600">Vervolg: {dossier.vervolg_wbb}</p>}
      {dossier.administrator_nm && <p className="text-[11px] text-slate-400">Bevoegd gezag: {dossier.administrator_nm}</p>}
    </SubCard>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S4Risicoprofiel({ data, sourceParcelId }: S4RisicoprofielProps) {
  const frp = data.fysiek_risico_profiel
  const asbest = frp?.asbest_indicator ?? data.asbest_indicator
  const bodem = frp?.bodem_data ?? data.bodem_data
  const fundRisk = frp?.foundation_risk
  const fundFlags = data.funderingsrisico_flags as Record<string, unknown> | null | undefined
  const kcaf = frp?.kcaf_cost

  // Environmental flags
  const natura = data.natura2000_flags as Record<string, unknown> | null | undefined
  const overstroom = data.overstromingsrisico_flags as Record<string, unknown> | null | undefined
  const geluid = data.geluid_flags as Record<string, unknown> | null | undefined
  const lucht = data.luchtkwaliteit_flags as Record<string, unknown> | null | undefined

  const dossierCount = bodem?.dossiers?.length ?? 0

  return (
    <div className="space-y-6">

      {/* ── 1. Fysiek Risicoprofiel ───────────────────────────── */}
      {frp && (
        <SectionInsightCard kicker="Risico" title="Fysiek Risicoprofiel" Icon={ShieldAlert}>
          <div className="space-y-2">
            {riskBadge(frp.overall_risk)}
            <p className="text-[13px] text-slate-600 leading-relaxed">{frp.overall_explanation}</p>
            <p className="text-[11px] text-slate-400 italic">{frp.disclaimer}</p>
          </div>
        </SectionInsightCard>
      )}

      {/* ── 2. Bodemkwaliteit ─────────────────────────────────── */}
      <SectionInsightCard kicker="Bodem" title="Bodemkwaliteit" Icon={Droplets}>
        {!bodem ? (
          <p className="text-[13px] text-slate-600 leading-relaxed">
            {data.bodem_flags ? `Type: ${data.bodemtype_flags ?? data.bodem_flags}` : 'Bodemdata niet beschikbaar'}
          </p>
        ) : bodem.dossiers.length === 0 ? (
          <div className="space-y-1">
            <p className="text-[13px] text-slate-600 leading-relaxed">Geen geregistreerde verontreiniging gevonden</p>
            <p className="text-[11px] text-slate-400 italic">{bodem.disclaimer}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bodem.dossiers.slice(0, 3).map((d, i) => <WBBRow key={i} dossier={d} />)}
            <p className="text-[11px] text-slate-400 italic">{bodem.disclaimer}</p>
          </div>
        )}
      </SectionInsightCard>

      {/* ── 3. Funderingsrisico ───────────────────────────────── */}
      <SectionInsightCard kicker="Fundering" title="Funderingsrisico" Icon={Construction}>
        {fundRisk ? (
          <div className="space-y-2">
            {riskBadge(fundRisk.risk)}
            <p className="text-[13px] text-slate-600 leading-relaxed">{fundRisk.reden}</p>
            {fundRisk.recommended_action && (
              <p className="text-[11px] text-slate-600">Aanbevolen actie: {fundRisk.recommended_action}</p>
            )}
            <p className="text-[11px] text-slate-400 italic">{fundRisk.disclaimer}</p>
          </div>
        ) : fundFlags ? (
          <div className="space-y-1">
            <p className="text-[13px] text-slate-600 leading-relaxed">
              {(fundFlags.legenda as string | undefined) ?? 'Funderingsrisicogebied gedetecteerd'}
            </p>
            {(fundFlags.percvoor1970 as number | undefined) != null && (
              <p className="text-[11px] text-slate-400">
                % panden voor 1970: {(fundFlags.percvoor1970 as number).toFixed(0)}%
              </p>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-slate-600 leading-relaxed">Geen funderingsrisicodata beschikbaar</p>
        )}

        {/* KCAF Cost Indication */}
        {kcaf && (
          <div className="mt-4 space-y-0">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Funderingsherstel kostenindicatie</p>
            <KVRow label="Kostenindicatie" value={`${formatCurrency(kcaf.low_eur)} – ${formatCurrency(kcaf.high_eur)}`} />
            <KVRow label="Per m²" value={`${formatCurrency(kcaf.low_per_m2)} – ${formatCurrency(kcaf.high_per_m2)}`} />
            <KVRow label="Oppervlakte" value={`${kcaf.oppervlakte_m2.toLocaleString('nl-NL')} m²`} />
            {kcaf.disclaimer && (
              <p className="text-[11px] text-slate-400 italic mt-2">{kcaf.disclaimer}</p>
            )}
          </div>
        )}
      </SectionInsightCard>

      {/* ── 4. Asbestrisico ───────────────────────────────────── */}
      <SectionInsightCard kicker="Asbest" title="Asbestrisico" Icon={AlertTriangle}>
        {asbest ? (
          <div className="space-y-2">
            {riskBadge(asbest.risk)}
            <p className="text-[13px] text-slate-600 leading-relaxed">{asbest.reden}</p>
            {asbest.norm_reference && (
              <p className="text-[11px] text-slate-400 italic">{asbest.norm_reference}</p>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-slate-600 leading-relaxed">Geen asbestrisicodata beschikbaar</p>
        )}
      </SectionInsightCard>

      {/* ── 5. Omgevingsrisico's ──────────────────────────────── */}
      {(natura ?? overstroom ?? geluid ?? lucht) && (
        <SectionInsightCard kicker="Omgeving" title="Omgevingsrisico's" Icon={TreePine}>
          <div className="grid grid-cols-2 gap-3">
            <SubCard>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Natura 2000</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-600">
                {natura ? `${(natura.distance_m as number | undefined) != null ? `${Math.round(natura.distance_m as number)}m` : 'In zone'}` : 'Onbekend'}
              </p>
              {(natura?.zone_name as string | undefined) && (
                <p className="mt-0.5 text-[11px] text-slate-400">{natura!.zone_name as string}</p>
              )}
            </SubCard>
            <SubCard>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Overstromingsrisico</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-600">
                {(overstroom?.risk_category as string | undefined) ?? 'Onbekend'}
              </p>
              {(overstroom?.risk_label as string | undefined) && (
                <p className="mt-0.5 text-[11px] text-slate-400">{overstroom!.risk_label as string}</p>
              )}
            </SubCard>
            <SubCard>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Geluidbelasting</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-600">
                {(geluid?.lden_category as string | undefined) ?? 'Onbekend'}
              </p>
              {(geluid?.lden_db as number | undefined) != null && (
                <p className="mt-0.5 text-[11px] text-slate-400">{(geluid!.lden_db as number).toFixed(0)} dB Lden</p>
              )}
            </SubCard>
            <SubCard>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Luchtkwaliteit</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-600">
                {(lucht?.no2_category as string | undefined) ?? 'Onbekend'}
              </p>
              {(lucht?.no2_ug_m3 as number | undefined) != null && (
                <p className="mt-0.5 text-[11px] text-slate-400">NO₂ {(lucht!.no2_ug_m3 as number).toFixed(0)} μg/m³</p>
              )}
            </SubCard>
          </div>
        </SectionInsightCard>
      )}

      {/* ── Section Notes ─────────────────────────────────────── */}
      <SectionNotes
        parcelId={sourceParcelId ?? null}
        documentTypes={['bodem', 'fundering', 'asbest', 'geluid', 'stikstof']}
        label="Risicoprofiel documenten"
      />
    </div>
  )
}
