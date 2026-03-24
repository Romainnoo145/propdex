/**
 * S1 Locatiegegevens — Due Diligence Dashboard section 1
 *
 * Displays: address, building/BAG, energy label, WOZ, monument status
 * Includes per-section document upload zone when sourceParcelId is available.
 */

import { useRef } from 'react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'

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

function formatArea(value: number | null | undefined): string {
  if (value == null) return '–'
  return `${Math.round(value).toLocaleString('nl-NL')} m²`
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '–'
  return `EUR ${Math.round(value).toLocaleString('nl-NL')}`
}

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

/* ─── Sub-components ─────────────────────────────────────────── */

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
      <span className="text-[12px] text-slate-400">
        {label}
      </span>
      <span
        className={`text-[13px] font-semibold text-[#0E1111] text-right ${mono ? 'font-mono text-[11px]' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

/* ─── Upload Zone ────────────────────────────────────────────── */

function UploadZone({
  parcelId,
  documentType,
  label,
}: {
  parcelId: string
  documentType: string
  label: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: docs } = useParcelDocuments(parcelId)
  const upload = useUploadDocument()

  const existing = docs?.documents?.filter((d) => d.document_type === documentType) ?? []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    upload.mutate({ parcelId, documentType, file })
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
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Bouwjaar</p>
          <p className="text-[18px] font-bold text-[#0E1111] tracking-tight mt-1">
            {building?.bouwjaar ?? '–'}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Oppervlakte</p>
          <p className="text-[18px] font-bold text-[#0E1111] tracking-tight mt-1">
            {formatArea(building?.oppervlakte)}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Gebruiksdoel</p>
          <p className="text-[18px] font-bold text-[#0E1111] tracking-tight mt-1">
            {building?.gebruiksdoel?.[0] ?? '–'}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Energielabel</p>
          <p className="text-[18px] font-bold text-[#0E1111] tracking-tight mt-1">
            {energy?.energieklasse ?? 'N/A'}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">WOZ Waarde</p>
          <p className="text-[15px] font-bold text-[#0E1111] tracking-tight mt-1">
            {formatCurrency(woz?.meest_recente_waarde)}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Monument</p>
          <p className={`text-[18px] font-bold tracking-tight mt-1 ${isMonument ? 'text-[#F9A826]' : 'text-slate-500'}`}>
            {isMonument ? 'Beschermd' : 'Vrij'}
          </p>
        </div>
      </div>

      {/* ── 2. Adres & Gebouw Details (side by side on lg) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card A: Adresgegevens */}
        <div className="rounded-[16px] border border-[#EAEFEF] p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Adresgegevens</p>
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
        </div>

        {/* Card B: Gebouwgegevens */}
        <div className="rounded-[16px] border border-[#EAEFEF] p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Gebouwgegevens</p>
          {building ? (
            <div>
              <KVRow label="Bouwjaar" value={building.bouwjaar?.toString()} />
              {building.status && (
                <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF] last:border-b-0">
                  <span className="text-[12px] text-slate-400">Status</span>
                  <span
                    className={`text-[13px] font-semibold text-right ${
                      statusInfo?.severity === 'high'
                        ? 'text-[#F9A826]'
                        : statusInfo?.severity === 'medium'
                          ? 'text-amber-600'
                          : 'text-[#0E1111]'
                    }`}
                  >
                    {statusInfo?.label ?? building.status}
                  </span>
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
        </div>
      </div>

      {/* ── 3. Energielabel Detail ────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Energielabel</p>
        {energy && energy.energieklasse ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Klasse</p>
              <p className="mt-1 text-2xl font-black tracking-tighter text-[#0E1111]">
                {energy.energieklasse}
              </p>
            </div>
            <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Registratie</p>
              <p className="mt-1 text-[13px] font-semibold text-[#0E1111]">
                {energy.registratie_datum
                  ? dateFmt.format(new Date(energy.registratie_datum))
                  : '–'}
              </p>
            </div>
            <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Geldig tot</p>
              <p className="mt-1 text-[13px] font-semibold text-[#0E1111]">
                {energy.geldig_tot
                  ? dateFmt.format(new Date(energy.geldig_tot))
                  : '–'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">
            {energy?.niet_geregistreerd_reden ?? 'Geen geregistreerd energielabel gevonden'}
          </p>
        )}
      </div>

      {/* ── 4. WOZ Detail ─────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">WOZ Waarde</p>
        {woz ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Meest recente waarde</p>
                <p className="mt-1 text-lg font-black tracking-tighter text-[#0E1111]">
                  {formatCurrency(woz.meest_recente_waarde)}
                </p>
              </div>
              <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Peildatum</p>
                <p className="mt-1 text-[13px] font-semibold text-[#0E1111]">
                  {woz.meest_recente_peildatum
                    ? new Date(woz.meest_recente_peildatum).toLocaleDateString('nl-NL')
                    : '–'}
                </p>
              </div>
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
      </div>

      {/* ── 5. Monumentstatus ─────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Monumentstatus</p>
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
      </div>

      {/* ── 6. Upload Zone ────────────────────────────────────── */}
      {sourceParcelId ? (
        <UploadZone parcelId={sourceParcelId} documentType="perceeldata" label="Document toevoegen" />
      ) : (
        <DisabledUploadZone />
      )}
    </div>
  )
}
