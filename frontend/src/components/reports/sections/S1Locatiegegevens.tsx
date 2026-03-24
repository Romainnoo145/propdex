/**
 * S1 Locatiegegevens — Due Diligence Dashboard section 1
 *
 * Compact stat-card layout: key stats grid, WOZ, energy label, monument status.
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

/* ─── Stat Card ──────────────────────────────────────────────── */

function StatCard({ kicker, value }: { kicker: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
        {kicker}
      </p>
      <p className="mt-1 text-[18px] font-bold tracking-tight text-[#0E1111]">
        {value}
      </p>
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
  const energy = data.energy_label
  const woz = data.woz_data

  // Derive stat values
  const bouwjaar = building?.bouwjaar?.toString() ?? 'Onbekend'
  const oppervlakte = building?.oppervlakte
    ? `${Math.round(building.oppervlakte).toLocaleString('nl-NL')} m²`
    : '–'
  const gebruiksdoel = building?.gebruiksdoel?.[0] ?? '–'
  const status = building?.status
    ? (STATUS_EXPLANATIONS[building.status]?.label ?? building.status)
    : '–'
  const adres = [
    `${address.straat} ${address.huisnummer}${address.huisletter ?? ''}${address.toevoeging ?? ''}`,
    `${address.postcode} ${address.woonplaats}`,
  ].join(', ')
  const perceel = data.cadastral_parcels?.[0]?.kadastrale_aanduiding ?? '–'

  return (
    <div className="space-y-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── Key Stats Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard kicker="Bouwjaar" value={bouwjaar} />
        <StatCard kicker="Oppervlakte" value={oppervlakte} />
        <StatCard kicker="Gebruiksdoel" value={gebruiksdoel} />
        <StatCard kicker="Status" value={status} />
        <StatCard kicker="Adres" value={adres} />
        <StatCard kicker="Perceel" value={perceel} />
      </div>

      {/* ── WOZ + Energielabel + Monument ───────────────────── */}
      <div className="flex flex-wrap gap-3">
        {/* WOZ Waarde */}
        {woz ? (
          <div className="flex-1 min-w-[200px] rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              WOZ Waarde
            </p>
            <p className="mt-1 text-[24px] font-black text-[#0E1111]">
              {formatCurrency(woz.meest_recente_waarde)}
            </p>
            {woz.meest_recente_peildatum && (
              <p className="mt-0.5 text-[11px] text-slate-400">
                Peildatum{' '}
                {new Date(woz.meest_recente_peildatum).toLocaleDateString('nl-NL')}
              </p>
            )}
            {woz.low_confidence && (
              <p className="mt-1 text-[11px] text-amber-600">
                {woz.low_confidence_reden ?? 'WOZ-data is indicatief'}
              </p>
            )}
          </div>
        ) : null}

        {/* Energielabel */}
        <div className="flex items-center">
          {energy?.energieklasse ? (
            <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 text-[12px] font-semibold">
              Energielabel {energy.energieklasse}
            </span>
          ) : (
            <span className="text-[13px] text-slate-400">Niet geregistreerd</span>
          )}
        </div>

        {/* Monument Status */}
        <div className="flex items-center">
          {monuments?.is_monument ? (
            <span className="rounded-full bg-red-50 border border-red-200 text-red-700 px-3 py-1 text-[12px] font-semibold">
              Rijksmonument
            </span>
          ) : (
            <span className="text-[13px] text-slate-400">Niet beschermd</span>
          )}
        </div>
      </div>

      {/* ── Upload Zone ─────────────────────────────────────── */}
      {sourceParcelId ? (
        <UploadZone parcelId={sourceParcelId} documentType="perceeldata" label="Perceeldocument" />
      ) : (
        <DisabledUploadZone />
      )}
    </div>
  )
}
