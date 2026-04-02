/**
 * S4 Risicoprofiel — Due Diligence Dashboard section 4
 *
 * Redesign: visual anchors, color-coded risk levels, KV-rows for structure,
 * prominent cost indication, and a clean omgevingsrisico grid.
 */

import { motion } from 'framer-motion'
import { ShieldAlert, Droplets, Construction, AlertTriangle, TreePine, Lightbulb, Euro } from 'lucide-react'
import type { PropertyReportResponse, WBBDossierRef } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { KVRow, SubCard, formatCurrency, SectionNotes } from '../components'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S4RisicoprofielProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Risk badge — color-coded by severity ───────────────────── */

const RISK_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  hoog:    { border: 'border-red-200',   bg: 'bg-red-50',   text: 'text-red-700',   dot: 'bg-red-500' },
  middel:  { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  laag:    { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  geen:    { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  onbekend: { border: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
}

const RISK_LABEL: Record<string, string> = {
  hoog: 'Hoog risico',
  middel: 'Middel risico',
  laag: 'Laag risico',
  geen: 'Geen risico',
  onbekend: 'Onbekend',
}

function RiskBadge({ risk }: { risk: string }) {
  const c = RISK_COLORS[risk] ?? RISK_COLORS.onbekend
  const label = RISK_LABEL[risk] ?? risk
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${c.border} ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {label}
    </span>
  )
}

/* ─── Risk bar — animated horizontal bar showing risk level ──── */

function RiskBar({ risk }: { risk: string }) {
  const pct = { hoog: 85, middel: 50, laag: 20, geen: 5, onbekend: 0 }[risk] ?? 0
  const c = RISK_COLORS[risk] ?? RISK_COLORS.onbekend

  if (pct === 0) return null

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <motion.div
        className={`absolute inset-y-0 left-0 rounded-full ${c.dot}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  )
}

/* ─── WBB Dossier row ────────────────────────────────────────── */

function WBBRow({ dossier, idx }: { dossier: WBBDossierRef; idx: number }) {
  return (
    <SubCard className="space-y-0">
      <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
        <span className="text-[12px] text-slate-400">Dossier {idx + 1}</span>
        {dossier.status_oord ? (
          <span className="text-[13px] font-semibold text-[#0E1111]">{dossier.status_oord}</span>
        ) : (
          <span className="text-[13px] text-slate-400">–</span>
        )}
      </div>
      {dossier.vervolg_wbb && (
        <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
          <span className="text-[12px] text-slate-400">Vervolg</span>
          <span className="text-[13px] font-semibold text-[#0E1111]">{dossier.vervolg_wbb}</span>
        </div>
      )}
      {dossier.administrator_nm && (
        <div className="flex items-center justify-between py-2">
          <span className="text-[12px] text-slate-400">Bevoegd gezag</span>
          <span className="text-[13px] text-slate-600">{dossier.administrator_nm}</span>
        </div>
      )}
    </SubCard>
  )
}

/* ─── Omgevings grid cell ────────────────────────────────────── */

function EnvCell({ label, value, detail, risk }: { label: string; value: string; detail?: string; risk?: 'hoog' | 'middel' | 'laag' | 'onbekend' }) {
  const dotColor = risk ? (RISK_COLORS[risk]?.dot ?? 'bg-slate-400') : 'bg-slate-400'
  return (
    <SubCard>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
        <p className="text-[13px] font-semibold text-[#0E1111]">{value}</p>
      </div>
      {detail && (
        <p className="mt-0.5 text-[11px] text-slate-400 pl-4">{detail}</p>
      )}
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
  const soilProfile = frp?.soil_profile

  // Environmental flags
  const natura = data.natura2000_flags as Record<string, unknown> | null | undefined
  const overstroom = data.overstromingsrisico_flags as Record<string, unknown> | null | undefined
  const geluid = data.geluid_flags as Record<string, unknown> | null | undefined
  const lucht = data.luchtkwaliteit_flags as Record<string, unknown> | null | undefined

  return (
    <div className="space-y-6">

      {/* ── 1. Fysiek Risicoprofiel — visual anchor ───────────── */}
      {frp && (
        <SectionInsightCard kicker="Risico" title="Fysiek Risicoprofiel" Icon={ShieldAlert}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RiskBadge risk={frp.overall_risk} />
            </div>
            <RiskBar risk={frp.overall_risk} />
            <p className="text-[13px] text-slate-600 leading-relaxed">{frp.overall_explanation}</p>

            {/* Quick risk factor summary */}
            {(fundRisk || asbest || bodem) && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {fundRisk && (
                  <div className="rounded-[12px] border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-2 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Fundering</p>
                    <div className="mt-1 flex items-center justify-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${RISK_COLORS[fundRisk.risk]?.dot ?? 'bg-slate-400'}`} />
                      <p className="text-[12px] font-semibold text-[#0E1111]">{RISK_LABEL[fundRisk.risk] ?? fundRisk.risk}</p>
                    </div>
                  </div>
                )}
                {asbest && (
                  <div className="rounded-[12px] border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-2 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Asbest</p>
                    <div className="mt-1 flex items-center justify-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${RISK_COLORS[asbest.risk]?.dot ?? 'bg-slate-400'}`} />
                      <p className="text-[12px] font-semibold text-[#0E1111]">{RISK_LABEL[asbest.risk] ?? asbest.risk}</p>
                    </div>
                  </div>
                )}
                <div className="rounded-[12px] border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-2 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Bodem</p>
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${bodem && bodem.dossiers.length > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <p className="text-[12px] font-semibold text-[#0E1111]">
                      {bodem ? (bodem.dossiers.length > 0 ? `${bodem.dossiers.length} dossier${bodem.dossiers.length !== 1 ? 's' : ''}` : 'Schoon') : 'Onbekend'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-400 italic">{frp.disclaimer}</p>
          </div>
        </SectionInsightCard>
      )}

      {/* ── 2. Bodemkwaliteit ─────────────────────────────────── */}
      <SectionInsightCard kicker="Bodem" title="Bodemkwaliteit" Icon={Droplets}>
        {!bodem ? (
          <p className="text-[13px] text-slate-500">
            {data.bodem_flags ? `Type: ${data.bodemtype_flags ?? data.bodem_flags}` : 'Bodemdata niet beschikbaar'}
          </p>
        ) : bodem.dossiers.length === 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RiskBadge risk="geen" />
            </div>
            <p className="text-[13px] text-slate-600">Geen geregistreerde verontreiniging gevonden</p>
            {soilProfile && (
              <SubCard className="space-y-0">
                <KVRow label="Bodemtype" value={soilProfile.dominant_type_label} />
                <KVRow label="Bodemcode" value={soilProfile.soilcode} />
                {soilProfile.soilname && <KVRow label="Naam" value={soilProfile.soilname} />}
              </SubCard>
            )}
            <p className="text-[11px] text-slate-400 italic">{bodem.disclaimer}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RiskBadge risk="middel" />
              <span className="text-[11px] text-slate-400">
                {bodem.dossiers.length} verontreinigingsdossier{bodem.dossiers.length !== 1 ? 's' : ''}
              </span>
            </div>
            {bodem.dossiers.slice(0, 3).map((d, i) => <WBBRow key={i} dossier={d} idx={i} />)}
            {bodem.dossiers.length > 3 && (
              <p className="text-[11px] text-slate-400 italic">+{bodem.dossiers.length - 3} overige dossiers</p>
            )}
            <p className="text-[11px] text-slate-400 italic">{bodem.disclaimer}</p>
          </div>
        )}
      </SectionInsightCard>

      {/* ── 3. Funderingsrisico ───────────────────────────────── */}
      <SectionInsightCard kicker="Fundering" title="Funderingsrisico" Icon={Construction}>
        {fundRisk ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RiskBadge risk={fundRisk.risk} />
              {fundRisk.bouwjaar && (
                <span className="text-[11px] text-slate-400">Bouwjaar {fundRisk.bouwjaar}</span>
              )}
            </div>
            <RiskBar risk={fundRisk.risk} />
            <p className="text-[13px] text-slate-600 leading-relaxed">{fundRisk.reden}</p>
            {fundRisk.recommended_action && (
              <SubCard>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Aanbevolen actie</p>
                <p className="text-[13px] text-slate-700">{fundRisk.recommended_action}</p>
              </SubCard>
            )}
            {fundRisk.bodemtype && (
              <KVRow label="Bodemtype" value={fundRisk.bodemtype} />
            )}
            <p className="text-[11px] text-slate-400 italic">{fundRisk.disclaimer}</p>
          </div>
        ) : fundFlags ? (
          <div className="space-y-2">
            <p className="text-[13px] text-slate-600 leading-relaxed">
              {(fundFlags.legenda as string | undefined) ?? 'Funderingsrisicogebied gedetecteerd'}
            </p>
            <SubCard className="space-y-0">
              {(fundFlags.percvoor1970 as number | undefined) != null && (
                <KVRow label="% panden vóór 1970" value={`${(fundFlags.percvoor1970 as number).toFixed(0)}%`} />
              )}
              {(fundFlags.n_bag as number | undefined) != null && (
                <KVRow label="BAG panden" value={`${fundFlags.n_bag as number}`} />
              )}
              {(fundFlags.gemeente as string | undefined) && (
                <KVRow label="Gemeente" value={fundFlags.gemeente as string} />
              )}
            </SubCard>
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">Geen funderingsrisicodata beschikbaar</p>
        )}
      </SectionInsightCard>

      {/* ── 3b. Funderingsherstel kosten — prominent ──────────── */}
      {kcaf && (
        <SectionInsightCard kicker="Kosten" title="Funderingsherstel indicatie" Icon={Euro}>
          <div className="space-y-3">
            {/* Big number */}
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-bold text-[#0E1111] tabular-nums">
                {formatCurrency(kcaf.low_eur)}
              </span>
              <span className="text-[16px] text-slate-400">–</span>
              <span className="text-[24px] font-bold text-[#0E1111] tabular-nums">
                {formatCurrency(kcaf.high_eur)}
              </span>
            </div>

            <SubCard className="space-y-0">
              <KVRow label="Per m²" value={`${formatCurrency(kcaf.low_per_m2)} – ${formatCurrency(kcaf.high_per_m2)}`} />
              <KVRow label="Oppervlakte" value={`${kcaf.oppervlakte_m2.toLocaleString('nl-NL')} m²`} />
            </SubCard>

            {kcaf.disclaimer && (
              <p className="text-[11px] text-slate-400 italic">{kcaf.disclaimer}</p>
            )}
          </div>
        </SectionInsightCard>
      )}

      {/* ── 4. Asbestrisico ───────────────────────────────────── */}
      <SectionInsightCard kicker="Asbest" title="Asbestrisico" Icon={AlertTriangle}>
        {asbest ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RiskBadge risk={asbest.risk} />
              {asbest.bouwjaar && (
                <span className="text-[11px] text-slate-400">Bouwjaar {asbest.bouwjaar}</span>
              )}
            </div>
            <RiskBar risk={asbest.risk} />
            <p className="text-[13px] text-slate-600 leading-relaxed">{asbest.reden}</p>
            {asbest.gebruiksdoel_factor && (
              <KVRow label="Gebruiksdoel" value={asbest.gebruiksdoel_factor} />
            )}
            {asbest.norm_reference && (
              <p className="text-[11px] text-slate-400 italic">{asbest.norm_reference}</p>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">Geen asbestrisicodata beschikbaar</p>
        )}
      </SectionInsightCard>

      {/* ── 5. Omgevingsrisico's — clean grid ─────────────────── */}
      {(natura ?? overstroom ?? geluid ?? lucht) && (
        <SectionInsightCard kicker="Omgeving" title="Omgevingsrisico's" Icon={TreePine}>
          <div className="grid grid-cols-2 gap-3">
            <EnvCell
              label="Natura 2000"
              value={natura
                ? `${(natura.distance_m as number | undefined) != null ? `${Math.round(natura.distance_m as number)}m` : 'In zone'}`
                : 'Onbekend'}
              detail={(natura?.zone_name as string | undefined) ?? undefined}
              risk={(natura?.distance_m as number | undefined) != null && (natura.distance_m as number) < 500 ? 'hoog' : 'laag'}
            />
            <EnvCell
              label="Overstromingsrisico"
              value={(overstroom?.risk_category as string | undefined) ?? 'Onbekend'}
              detail={(overstroom?.risk_label as string | undefined) ?? undefined}
              risk={
                (overstroom?.risk_category as string | undefined)?.toLowerCase().includes('hoog') ? 'hoog'
                  : (overstroom?.risk_category as string | undefined)?.toLowerCase().includes('middel') ? 'middel'
                    : 'laag'
              }
            />
            <EnvCell
              label="Geluidbelasting"
              value={(geluid?.lden_category as string | undefined) ?? 'Onbekend'}
              detail={(geluid?.lden_db as number | undefined) != null ? `${(geluid!.lden_db as number).toFixed(0)} dB Lden` : undefined}
              risk={
                (geluid?.lden_db as number | undefined) != null && (geluid!.lden_db as number) > 65 ? 'hoog'
                  : (geluid?.lden_db as number | undefined) != null && (geluid!.lden_db as number) > 55 ? 'middel'
                    : 'laag'
              }
            />
            <EnvCell
              label="Luchtkwaliteit"
              value={(lucht?.no2_category as string | undefined) ?? 'Onbekend'}
              detail={(lucht?.no2_ug_m3 as number | undefined) != null ? `NO₂ ${(lucht!.no2_ug_m3 as number).toFixed(0)} μg/m³` : undefined}
              risk={
                (lucht?.no2_ug_m3 as number | undefined) != null && (lucht!.no2_ug_m3 as number) > 32 ? 'hoog'
                  : (lucht?.no2_ug_m3 as number | undefined) != null && (lucht!.no2_ug_m3 as number) > 20 ? 'middel'
                    : 'laag'
              }
            />
          </div>
        </SectionInsightCard>
      )}

      {/* ── Section Notes ─────────────────────────────────────── */}
      <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
        <SectionNotes
          parcelId={sourceParcelId ?? null}
          documentTypes={['bodem', 'fundering', 'asbest', 'geluid', 'stikstof']}
        />
      </SectionInsightCard>
    </div>
  )
}
