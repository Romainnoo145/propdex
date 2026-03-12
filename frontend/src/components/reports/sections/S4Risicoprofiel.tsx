/**
 * S4 Risicoprofiel — Due Diligence Dashboard section 4
 *
 * Displays: fysiek risico profiel, bodem, fundering, asbest, and 4 environmental enrichment flags
 * Includes per-section document upload zone when sourceParcelId is available.
 */

import { useRef } from 'react'
import type { PropertyReportResponse, WBBDossierRef } from '@/lib/types/property'
import { useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S4RisicoprofielProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Sub-components ─────────────────────────────────────────── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      {children}
    </div>
  )
}

const RISK_BADGE: Record<string, string> = {
  hoog: 'border-red-300 bg-red-50 text-red-700',
  middel: 'border-amber-300 bg-amber-50 text-amber-700',
  laag: 'border-green-200 bg-green-50 text-green-700',
  geen: 'border-green-200 bg-green-50 text-green-700',
  onbekend: 'border-neutral-200 bg-neutral-50 text-neutral-600',
}

const RISK_LABEL: Record<string, string> = {
  hoog: 'Hoog risico',
  middel: 'Middel risico',
  laag: 'Laag risico',
  geen: 'Geen risico',
  onbekend: 'Onbekend',
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${RISK_BADGE[risk] ?? RISK_BADGE.onbekend}`}>
      {RISK_LABEL[risk] ?? risk}
    </span>
  )
}

function WBBRow({ dossier }: { dossier: WBBDossierRef }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 space-y-1">
      {dossier.status_oord && <p className="text-sm font-medium text-[#1A1C1E]">{dossier.status_oord}</p>}
      {dossier.vervolg_wbb && <p className="text-xs text-neutral-600">Vervolg: {dossier.vervolg_wbb}</p>}
      {dossier.administrator_nm && <p className="text-xs text-neutral-500">Bevoegd gezag: {dossier.administrator_nm}</p>}
    </div>
  )
}

/* ─── Upload Zone ────────────────────────────────────────────── */

function UploadZone({ parcelId, documentTypes, label }: { parcelId: string; documentTypes: string[]; label: string }) {
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
    <div className="mt-4 border-t border-neutral-100 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-neutral-600">{label}</p>
          {existing.length > 0 && (
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {existing.length} document{existing.length !== 1 ? 'en' : ''} geupload
            </p>
          )}
        </div>
        <input ref={fileRef} type="file" onChange={handleChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-800 disabled:opacity-50"
        >
          {upload.isPending ? 'Uploaden...' : '+ Document toevoegen'}
        </button>
      </div>
    </div>
  )
}

function DisabledUploadZone() {
  return (
    <div className="mt-4 border-t border-neutral-100 pt-4">
      <p className="text-[11px] text-neutral-400">Koppel een perceel om documenten te uploaden</p>
    </div>
  )
}

/* ─── Environmental flag helpers ─────────────────────────────── */

function EnvCard({
  title,
  value,
  unit,
  detail,
  risk,
}: {
  title: string
  value: string | null | undefined
  unit?: string
  detail?: string | null
  risk?: string | null
}) {
  const riskStyle = risk ? (RISK_BADGE[risk] ?? RISK_BADGE.onbekend) : 'border-neutral-200 bg-neutral-50'
  return (
    <div className={`rounded-xl border p-3 ${riskStyle}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{title}</p>
      <p className="mt-1 text-sm font-semibold">
        {value ?? 'Onbekend'}
        {unit ? ` ${unit}` : ''}
      </p>
      {detail && <p className="mt-0.5 text-[11px] opacity-75">{detail}</p>}
    </div>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S4Risicoprofiel({ data, sourceParcelId }: S4RisicoprofielProps) {
  const frp = data.fysiek_risico_profiel
  const asbest = frp?.asbest_indicator ?? data.asbest_indicator
  const bodem = frp?.bodem_data ?? data.bodem_data
  const fundRisk = frp?.foundation_risk
  const fundFlags = data.funderingsrisico_flags as Record<string, unknown> | null | undefined

  // Environmental flags
  const natura = data.natura2000_flags as Record<string, unknown> | null | undefined
  const overstroom = data.overstromingsrisico_flags as Record<string, unknown> | null | undefined
  const geluid = data.geluid_flags as Record<string, unknown> | null | undefined
  const lucht = data.luchtkwaliteit_flags as Record<string, unknown> | null | undefined

  return (
    <div className="space-y-4">
      {/* Fysiek Risicoprofiel overview */}
      {frp && (
        <Card title="Fysiek Risicoprofiel">
          <div className="space-y-2">
            <RiskBadge risk={frp.overall_risk} />
            <p className="text-sm text-neutral-700">{frp.overall_explanation}</p>
            <p className="text-[11px] text-neutral-500">{frp.disclaimer}</p>
          </div>
        </Card>
      )}

      {/* Bodemkwaliteit */}
      <Card title="Bodemkwaliteit">
        {!bodem ? (
          <p className="text-sm text-neutral-500">
            {data.bodem_flags ? `Type: ${data.bodemtype_flags ?? data.bodem_flags}` : 'Bodemdata niet beschikbaar'}
          </p>
        ) : bodem.dossiers.length === 0 ? (
          <div className="space-y-1">
            <p className="text-sm text-neutral-600">Geen geregistreerde verontreiniging gevonden</p>
            <p className="text-[11px] text-neutral-500">{bodem.disclaimer}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bodem.dossiers.slice(0, 3).map((d, i) => <WBBRow key={i} dossier={d} />)}
            <p className="text-[11px] text-neutral-500">{bodem.disclaimer}</p>
          </div>
        )}
        {sourceParcelId ? (
          <UploadZone parcelId={sourceParcelId} documentTypes={['bodem', 'fundering']} label="Bodem / Fundering rapporten" />
        ) : (
          <DisabledUploadZone />
        )}
      </Card>

      {/* Funderingsrisico */}
      <Card title="Funderingsrisico">
        {fundRisk ? (
          <div className="space-y-2">
            <RiskBadge risk={fundRisk.risk} />
            <p className="text-sm text-neutral-700">{fundRisk.reden}</p>
            {fundRisk.recommended_action && (
              <p className="text-xs text-neutral-600">Aanbevolen actie: {fundRisk.recommended_action}</p>
            )}
            <p className="text-[11px] text-neutral-500">{fundRisk.disclaimer}</p>
          </div>
        ) : fundFlags ? (
          <div className="space-y-1">
            <p className="text-sm text-neutral-700">
              {(fundFlags.legenda as string | undefined) ?? 'Funderingsrisicogebied gedetecteerd'}
            </p>
            {(fundFlags.percvoor1970 as number | undefined) != null && (
              <p className="text-xs text-neutral-500">
                % panden voor 1970: {(fundFlags.percvoor1970 as number).toFixed(0)}%
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Geen funderingsrisicodata beschikbaar</p>
        )}
      </Card>

      {/* Asbest */}
      {asbest && (
        <Card title="Asbestrisico">
          <div className="space-y-2">
            <RiskBadge risk={asbest.risk} />
            <p className="text-sm text-neutral-700">{asbest.reden}</p>
            {asbest.norm_reference && (
              <p className="text-xs text-neutral-500">{asbest.norm_reference}</p>
            )}
          </div>
          {sourceParcelId ? (
            <UploadZone parcelId={sourceParcelId} documentTypes={['asbest']} label="Asbestinventarisatierapport" />
          ) : (
            <DisabledUploadZone />
          )}
        </Card>
      )}

      {/* Environmental enrichment 2x2 grid */}
      {(natura ?? overstroom ?? geluid ?? lucht) && (
        <Card title="Omgevingsrisico's (Phase 99)">
          <div className="grid grid-cols-2 gap-3">
            <EnvCard
              title="Natura 2000"
              value={natura ? `${(natura.distance_m as number | undefined) != null ? `${Math.round(natura.distance_m as number)}m` : 'In zone'}` : undefined}
              detail={(natura?.zone_name as string | undefined) ?? null}
              risk={natura ? ((natura.distance_m as number | undefined) != null && (natura.distance_m as number) < 1000 ? 'middel' : 'laag') : undefined}
            />
            <EnvCard
              title="Overstromingsrisico"
              value={(overstroom?.risk_category as string | undefined) ?? undefined}
              detail={(overstroom?.risk_label as string | undefined) ?? null}
              risk={overstroom ? (overstroom.risk_category as string | undefined) ?? 'onbekend' : undefined}
            />
            <EnvCard
              title="Geluidbelasting"
              value={(geluid?.lden_category as string | undefined) ?? undefined}
              detail={(geluid?.lden_db as number | undefined) != null ? `${(geluid!.lden_db as number).toFixed(0)} dB Lden` : null}
              risk={geluid ? ((geluid.lden_db as number | undefined) != null && (geluid.lden_db as number) > 65 ? 'hoog' : (geluid.lden_db as number | undefined) != null && (geluid.lden_db as number) > 55 ? 'middel' : 'laag') : undefined}
            />
            <EnvCard
              title="Luchtkwaliteit"
              value={(lucht?.no2_category as string | undefined) ?? undefined}
              detail={(lucht?.no2_ug_m3 as number | undefined) != null ? `NO₂ ${(lucht!.no2_ug_m3 as number).toFixed(0)} μg/m³` : null}
              risk={lucht ? ((lucht.no2_ug_m3 as number | undefined) != null && (lucht.no2_ug_m3 as number) > 40 ? 'hoog' : (lucht.no2_ug_m3 as number | undefined) != null && (lucht.no2_ug_m3 as number) > 25 ? 'middel' : 'laag') : undefined}
            />
          </div>
          {sourceParcelId ? (
            <UploadZone parcelId={sourceParcelId} documentTypes={['geluid', 'stikstof']} label="Geluid / Stikstof rapporten" />
          ) : (
            <DisabledUploadZone />
          )}
        </Card>
      )}
    </div>
  )
}
