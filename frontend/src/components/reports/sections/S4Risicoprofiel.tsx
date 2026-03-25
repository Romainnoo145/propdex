/**
 * S4 Risicoprofiel — Due Diligence Dashboard section 4
 *
 * Displays: fysiek risico profiel, bodem, fundering, asbest, and 4 environmental enrichment flags
 * Each sub-section wrapped in SectionInsightCard matching S01–S03 pattern.
 * Hero stat row at top with risk level badges.
 * Includes per-section document upload zone when sourceParcelId is available.
 */

import { useRef } from 'react'
import { ShieldAlert, Droplets, Construction, AlertTriangle, TreePine } from 'lucide-react'
import type { PropertyReportResponse, WBBDossierRef } from '@/lib/types/property'
import { useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'
import { SectionInsightCard } from '../components/SectionInsightCard'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S4RisicoprofielProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Risk styling helpers ───────────────────────────────────── */

const RISK_BADGE_STYLE: Record<string, string> = {
  hoog: 'border-red-200 bg-red-50 text-red-700',
  middel: 'border-amber-200 bg-amber-50 text-amber-700',
  laag: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  geen: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  onbekend: 'border-[#EAEFEF] bg-[#F8FAFA] text-slate-600',
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

/* ─── KVRow ──────────────────────────────────────────────────── */

function KVRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF] last:border-b-0">
      <span className="text-[12px] text-slate-400">{label}</span>
      <span
        className={`text-[13px] font-semibold text-[#0E1111] text-right ${mono ? 'font-mono text-[11px]' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

/* ─── WBB Row ────────────────────────────────────────────────── */

function WBBRow({ dossier }: { dossier: WBBDossierRef }) {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 space-y-1">
      {dossier.status_oord && <p className="text-[13px] font-semibold text-[#0E1111]">{dossier.status_oord}</p>}
      {dossier.vervolg_wbb && <p className="text-[11px] text-slate-600">Vervolg: {dossier.vervolg_wbb}</p>}
      {dossier.administrator_nm && <p className="text-[11px] text-slate-400">Bevoegd gezag: {dossier.administrator_nm}</p>}
    </div>
  )
}

/* ─── Upload Zone (dashed-border pattern matching S1) ────────── */

function UploadZone({
  parcelId,
  documentTypes,
  label,
}: {
  parcelId: string
  documentTypes: string[]
  label: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: docs } = useParcelDocuments(parcelId)
  const upload = useUploadDocument()
  const existing = docs?.documents?.filter((d) => documentTypes.includes(d.document_type)) ?? []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    upload.mutate({ parcelId, documentType: documentTypes[0] ?? 'overig', file })
    e.target.value = ''
  }

  return (
    <div
      className="rounded-[16px] border border-dashed border-[#EAEFEF] px-4 py-3 text-[12px] text-slate-400 flex items-center justify-between gap-3 cursor-pointer"
      onClick={() => fileRef.current?.click()}
    >
      <div>
        <p className="font-semibold text-slate-600">{label}</p>
        {existing.length > 0 && (
          <p className="mt-0.5 text-slate-500">
            {existing.length} document{existing.length !== 1 ? 'en' : ''} geupload
          </p>
        )}
      </div>
      <input ref={fileRef} type="file" onChange={handleChange} className="hidden" />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
        disabled={upload.isPending}
        className="text-[12px] font-semibold text-slate-500 hover:text-[#0E1111] transition-colors disabled:opacity-50"
      >
        {upload.isPending ? 'Uploaden...' : '+ Toevoegen'}
      </button>
    </div>
  )
}

function DisabledUploadZone() {
  return (
    <div className="rounded-[16px] border border-dashed border-[#EAEFEF] px-4 py-3 text-[12px] text-slate-400">
      Koppel een perceel om documenten te uploaden
    </div>
  )
}

/* ─── Currency formatting ────────────────────────────────────── */

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '–'
  return `€ ${Math.round(value).toLocaleString('nl-NL')}`
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

      {/* ── Hero Stat Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Totaal risico</p>
          <p className="mt-1 flex justify-center">
            {frp ? riskBadge(frp.overall_risk) : <span className="text-[18px] font-bold text-[#0E1111] tracking-tight">–</span>}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Fundering</p>
          <p className="mt-1 flex justify-center">
            {fundRisk ? riskBadge(fundRisk.risk) : <span className="text-[18px] font-bold text-[#0E1111] tracking-tight">–</span>}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Asbest</p>
          <p className="mt-1 flex justify-center">
            {asbest ? riskBadge(asbest.risk) : <span className="text-[18px] font-bold text-[#0E1111] tracking-tight">–</span>}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Bodem</p>
          <p className="text-[18px] font-bold text-[#0E1111] tracking-tight mt-1">
            {dossierCount > 0 ? `${dossierCount} dossier${dossierCount !== 1 ? 's' : ''}` : 'Geen verontreiniging'}
          </p>
        </div>
      </div>

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
        <div className="mt-4">
          {sourceParcelId ? (
            <UploadZone parcelId={sourceParcelId} documentTypes={['bodem', 'fundering']} label="Bodem / Fundering rapporten" />
          ) : (
            <DisabledUploadZone />
          )}
        </div>
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
        <div className="mt-4">
          {sourceParcelId ? (
            <UploadZone parcelId={sourceParcelId} documentTypes={['asbest']} label="Asbestinventarisatierapport" />
          ) : (
            <DisabledUploadZone />
          )}
        </div>
      </SectionInsightCard>

      {/* ── 5. Omgevingsrisico's ──────────────────────────────── */}
      {(natura ?? overstroom ?? geluid ?? lucht) && (
        <SectionInsightCard kicker="Omgeving" title="Omgevingsrisico's" Icon={TreePine}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Natura 2000</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-600">
                {natura ? `${(natura.distance_m as number | undefined) != null ? `${Math.round(natura.distance_m as number)}m` : 'In zone'}` : 'Onbekend'}
              </p>
              {(natura?.zone_name as string | undefined) && (
                <p className="mt-0.5 text-[11px] text-slate-400">{natura!.zone_name as string}</p>
              )}
            </div>
            <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Overstromingsrisico</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-600">
                {(overstroom?.risk_category as string | undefined) ?? 'Onbekend'}
              </p>
              {(overstroom?.risk_label as string | undefined) && (
                <p className="mt-0.5 text-[11px] text-slate-400">{overstroom!.risk_label as string}</p>
              )}
            </div>
            <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Geluidbelasting</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-600">
                {(geluid?.lden_category as string | undefined) ?? 'Onbekend'}
              </p>
              {(geluid?.lden_db as number | undefined) != null && (
                <p className="mt-0.5 text-[11px] text-slate-400">{(geluid!.lden_db as number).toFixed(0)} dB Lden</p>
              )}
            </div>
            <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Luchtkwaliteit</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-600">
                {(lucht?.no2_category as string | undefined) ?? 'Onbekend'}
              </p>
              {(lucht?.no2_ug_m3 as number | undefined) != null && (
                <p className="mt-0.5 text-[11px] text-slate-400">NO₂ {(lucht!.no2_ug_m3 as number).toFixed(0)} μg/m³</p>
              )}
            </div>
          </div>
          <div className="mt-4">
            {sourceParcelId ? (
              <UploadZone parcelId={sourceParcelId} documentTypes={['geluid', 'stikstof']} label="Geluid / Stikstof rapporten" />
            ) : (
              <DisabledUploadZone />
            )}
          </div>
        </SectionInsightCard>
      )}
    </div>
  )
}
