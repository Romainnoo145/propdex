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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      {children}
    </div>
  )
}

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
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 shrink-0">
        {label}
      </span>
      <span
        className={`text-sm text-right text-[#1A1C1E] ${mono ? 'font-mono text-xs' : ''}`}
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
      <p className="text-[11px] text-neutral-400">
        Koppel een perceel om documenten te uploaden
      </p>
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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Adresgegevens */}
      <Card title="Adresgegevens">
        <div className="divide-y divide-neutral-100">
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
        {sourceParcelId ? (
          <UploadZone parcelId={sourceParcelId} documentType="perceeldata" label="Perceeldocument" />
        ) : (
          <DisabledUploadZone />
        )}
      </Card>

      {/* Gebouwgegevens */}
      <Card title="Gebouwgegevens">
        {building ? (
          <div className="divide-y divide-neutral-100">
            <KVRow label="Bouwjaar" value={building.bouwjaar?.toString()} />
            {building.status && (
              <div className="flex items-baseline justify-between gap-4 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 shrink-0">
                  Status
                </span>
                <span
                  className={`text-sm ${statusInfo?.severity === 'high' ? 'text-[#F9A826]' : 'text-[#1A1C1E]'}`}
                >
                  {statusInfo?.label ?? building.status}
                </span>
              </div>
            )}
            <KVRow label="Oppervlakte" value={formatArea(building.oppervlakte)} />
            {building.gebruiksdoel.length > 0 && (
              <div className="flex items-start justify-between gap-4 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 shrink-0">
                  Gebruiksdoel
                </span>
                <div className="flex flex-wrap justify-end gap-1">
                  {building.gebruiksdoel.map((doel) => (
                    <span
                      key={doel}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-[#1A1C1E]"
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
          <p className="text-sm text-neutral-500">Geen gebouwgegevens beschikbaar</p>
        )}
      </Card>

      {/* Energielabel */}
      <Card title="Energielabel">
        {energy && energy.energieklasse ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
              <p className="text-xs text-neutral-500">Klasse</p>
              <p className="mt-1 text-2xl font-black tracking-tighter text-[#1A1C1E]">
                {energy.energieklasse}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
              <p className="text-xs text-neutral-500">Registratie</p>
              <p className="mt-1 text-sm font-semibold text-[#1A1C1E]">
                {energy.registratie_datum
                  ? dateFmt.format(new Date(energy.registratie_datum))
                  : '–'}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
              <p className="text-xs text-neutral-500">Geldig tot</p>
              <p className="mt-1 text-sm font-semibold text-[#1A1C1E]">
                {energy.geldig_tot
                  ? dateFmt.format(new Date(energy.geldig_tot))
                  : '–'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            {energy?.niet_geregistreerd_reden ?? 'Geen geregistreerd energielabel gevonden'}
          </p>
        )}
      </Card>

      {/* WOZ Waarde */}
      <Card title="WOZ Waarde">
        {woz ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                <p className="text-xs text-neutral-500">Meest recente waarde</p>
                <p className="mt-1 text-lg font-black tracking-tighter text-[#1A1C1E]">
                  {formatCurrency(woz.meest_recente_waarde)}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                <p className="text-xs text-neutral-500">Peildatum</p>
                <p className="mt-1 text-sm font-semibold text-[#1A1C1E]">
                  {woz.meest_recente_peildatum
                    ? new Date(woz.meest_recente_peildatum).toLocaleDateString('nl-NL')
                    : '–'}
                </p>
              </div>
            </div>
            {woz.low_confidence && (
              <div className="rounded-xl border border-[#F9A826]/15 bg-[#F9A826]/[0.04] px-3 py-2">
                <p className="text-xs text-[#F9A826]/80 font-semibold">Indicatief</p>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {woz.low_confidence_reden ?? 'WOZ-data is indicatief.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Geen WOZ-gegevens beschikbaar</p>
        )}
      </Card>

      {/* Monumentstatus */}
      <Card title="Monumentstatus">
        {monuments ? (
          <div className="space-y-3">
            <div
              className={`rounded-xl px-4 py-3 ${monuments.is_monument ? 'border border-[#F9A826]/20 bg-[#F9A826]/[0.06]' : 'border border-neutral-200 bg-neutral-50'}`}
            >
              <p
                className={`font-semibold ${monuments.is_monument ? 'text-[#F9A826]' : 'text-neutral-700'}`}
              >
                {monuments.is_monument ? 'Rijksmonument' : 'Niet beschermd'}
              </p>
              {monuments.consensus_status && (
                <p className="mt-0.5 text-sm text-neutral-600">
                  {monuments.consensus_status}
                </p>
              )}
            </div>
            {monuments.restrictions_summary.length > 0 && (
              <ul className="space-y-1">
                {monuments.restrictions_summary.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F9A826]/50" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Geen monumentgegevens beschikbaar</p>
        )}
        {sourceParcelId ? (
          <UploadZone
            parcelId={sourceParcelId}
            documentType="monument"
            label="Monumentdocument"
          />
        ) : (
          <DisabledUploadZone />
        )}
      </Card>
    </div>
  )
}
