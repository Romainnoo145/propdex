/**
 * S2 Kadaster & Eigendom — Due Diligence Dashboard section 2
 *
 * Displays: cadastral parcels, BRK ownership status, market signals
 * Includes per-section document upload zone when sourceParcelId is available.
 */

import { useRef } from 'react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S2KadasterEigendomProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Helpers ────────────────────────────────────────────────── */

function formatArea(value: number | null | undefined): string {
  if (value == null) return '–'
  return `${Math.round(value).toLocaleString('nl-NL')} m²`
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

/* ─── Upload Zone ────────────────────────────────────────────── */

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

  const existing =
    docs?.documents?.filter((d) => documentTypes.includes(d.document_type)) ?? []

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
      <p className="text-[11px] text-neutral-400">
        Koppel een perceel om documenten te uploaden
      </p>
    </div>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S2KadasterEigendom({ data, sourceParcelId }: S2KadasterEigendomProps) {
  const parcels = data.cadastral_parcels ?? []
  const ownership = data.brk_ownership
  const signals = data.market_signals
  const totalOpp = parcels.reduce((sum, p) => sum + (p.oppervlakte ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Kadastrale percelen */}
      <Card title="Kadastrale percelen">
        {parcels.length === 0 ? (
          <p className="text-sm text-neutral-500">Geen kadastrale gegevens beschikbaar</p>
        ) : (
          <div className="space-y-3">
            {parcels.map((parcel, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
              >
                {parcel.kadastrale_aanduiding && (
                  <p className="mb-2 text-sm font-semibold text-[#1A1C1E]">
                    <a
                      href={`https://kadastralekaart.com/perceel/${parcel.kadastrale_aanduiding.replace(/\s+/g, '/')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-neutral-400 underline-offset-2 hover:text-[#F9A826]"
                    >
                      {parcel.kadastrale_aanduiding}
                    </a>
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-neutral-500">Perceelnr</p>
                    <p className="text-sm font-medium text-neutral-700">
                      {parcel.perceelnummer ?? '–'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Sectie</p>
                    <p className="text-sm font-medium text-neutral-700">
                      {parcel.sectie ?? '–'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Kavelgrootte</p>
                    <p className="text-sm font-medium text-neutral-700">
                      {formatArea(parcel.oppervlakte)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {parcels.length > 1 && totalOpp > 0 && (
              <div className="flex justify-end">
                <span className="text-xs text-neutral-500">
                  Totaal: <strong className="text-neutral-700">{formatArea(totalOpp)}</strong>
                </span>
              </div>
            )}
          </div>
        )}
        {sourceParcelId ? (
          <UploadZone
            parcelId={sourceParcelId}
            documentTypes={['kadaster', 'eigendom', 'erfpacht']}
            label="Kadaster / Eigendom / Erfpacht"
          />
        ) : (
          <DisabledUploadZone />
        )}
      </Card>

      {/* BRK Eigendom */}
      <Card title="BRK Eigendom">
        {!ownership ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-sm text-neutral-600">
              Eigendomsgegevens niet opgeslagen (Kadaster Tier 3 voorwaarden)
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Open de eigendomsmodal vanuit de kaartweergave om actuele BRK-data op te halen.
            </p>
          </div>
        ) : ownership.status !== 'available' || !ownership.data || ownership.data.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {ownership.reason ?? 'Geen eigendomsdata beschikbaar'}
          </p>
        ) : (
          <div className="space-y-3">
            {ownership.data.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2"
              >
                <p className="text-sm font-semibold text-[#1A1C1E]">
                  {item.perceel_identificatie}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {item.gerechtigden.length} zakelijk gerechtigde
                  {item.gerechtigden.length !== 1 ? 'n' : ''}
                  {item.heeft_hypotheek ? ' · hypotheek geregistreerd' : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.gerechtigden.map((g, gIdx) => (
                    <span
                      key={gIdx}
                      className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs font-medium text-neutral-600"
                    >
                      {g.eigenaar_type}
                      {g.aandeel ? ` ${g.aandeel}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Marktsignalen */}
      <Card title="Marktsignalen">
        {!signals ? (
          <p className="text-sm text-neutral-500">
            Nog geen Funda-signalen beschikbaar voor dit adres
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-xs text-neutral-500">Te koop sinds</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1A1C1E]">
                {signals.listing_duration_days} dagen
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-xs text-neutral-500">Prijswijzigingen</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1A1C1E]">
                {signals.price_change_count}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-xs text-neutral-500">Snapshots</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1A1C1E]">
                {signals.listing_snapshots_count}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-xs text-neutral-500">Laatste waarneming</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1A1C1E]">
                {signals.days_since_last_seen} dagen geleden
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
