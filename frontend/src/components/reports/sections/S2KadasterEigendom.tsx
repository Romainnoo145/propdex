/**
 * S2 Kadaster & Eigendom — Due Diligence Dashboard section 2
 *
 * Displays: cadastral parcels, BRK ownership status, market signals
 * Each sub-section wrapped in SectionInsightCard with icon + kicker.
 * Includes per-section document upload zone when sourceParcelId is available.
 */

import { useRef } from 'react'
import { Landmark, Users, TrendingUp } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'
import { SectionInsightCard } from '../components/SectionInsightCard'

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

/* ─── Badge helpers ──────────────────────────────────────────── */

const OWNER_TYPE_COLORS: Record<string, string> = {
  natuurlijk_persoon: 'bg-blue-100 text-blue-700',
  rechtspersoon: 'bg-purple-100 text-purple-700',
  overheid: 'bg-amber-100 text-amber-700',
  onbekend: 'bg-slate-100 text-slate-600',
}

const OWNER_TYPE_LABELS: Record<string, string> = {
  natuurlijk_persoon: 'Natuurlijk persoon',
  rechtspersoon: 'Rechtspersoon',
  overheid: 'Overheid',
  onbekend: 'Onbekend',
}

function OwnerTypeBadge({ type }: { type: string }) {
  const colors = OWNER_TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-600'
  const label = OWNER_TYPE_LABELS[type] ?? type
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${colors}`}>
      {label}
    </span>
  )
}

function HypotheekBadge() {
  return (
    <span className="inline-block rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-600">
      Hypotheek geregistreerd
    </span>
  )
}

function ListingDurationBadge({ days }: { days: number }) {
  const colors =
    days < 30
      ? 'bg-emerald-100 text-emerald-700'
      : days <= 180
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${colors}`}>
      {days} dagen
    </span>
  )
}

function MarketFreshnessBadge({ days }: { days: number }) {
  const colors =
    days < 30
      ? 'bg-emerald-100 text-emerald-700'
      : days <= 90
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${colors}`}>
      {days}d geleden
    </span>
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
    <div className="rounded-[16px] border border-dashed border-[#EAEFEF] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-600">{label}</p>
          {existing.length > 0 && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              {existing.length} document{existing.length !== 1 ? 'en' : ''} geupload
            </p>
          )}
        </div>
        <input ref={fileRef} type="file" onChange={handleChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 rounded-full border border-[#EAEFEF] px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-[#0E1111] disabled:opacity-50"
        >
          {upload.isPending ? 'Uploaden...' : '+ Document toevoegen'}
        </button>
      </div>
    </div>
  )
}

function DisabledUploadZone() {
  return (
    <div className="rounded-[16px] border border-dashed border-[#EAEFEF] px-4 py-3">
      <p className="text-[11px] text-slate-400">
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
    <div className="space-y-6">
      {/* ── Kadastrale percelen ── */}
      <SectionInsightCard kicker="Kadaster" title="Kadastrale percelen" Icon={Landmark}>
        {parcels.length === 0 ? (
          <p className="text-[13px] text-slate-500">Geen kadastrale gegevens beschikbaar</p>
        ) : (
          <div className="space-y-3">
            {parcels.map((parcel, idx) => (
              <div
                key={idx}
                className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3"
              >
                {parcel.kadastrale_aanduiding && (
                  <p className="mb-2 text-[13px] font-semibold text-[#0E1111]">
                    <a
                      href={`https://kadastralekaart.com/perceel/${parcel.kadastrale_aanduiding.replace(/\s+/g, '/')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-slate-300 underline-offset-2 hover:text-[#F9A826]"
                    >
                      {parcel.kadastrale_aanduiding}
                    </a>
                  </p>
                )}
                <div>
                  <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
                    <span className="text-[12px] text-slate-400">Perceelnr</span>
                    <span className="text-[13px] font-semibold text-[#0E1111] text-right">
                      {parcel.perceelnummer ?? '–'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
                    <span className="text-[12px] text-slate-400">Sectie</span>
                    <span className="text-[13px] font-semibold text-[#0E1111] text-right">
                      {parcel.sectie ?? '–'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b-0">
                    <span className="text-[12px] text-slate-400">Kavelgrootte</span>
                    <span className="text-[13px] font-semibold text-[#0E1111] text-right">
                      {formatArea(parcel.oppervlakte)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {parcels.length > 1 && totalOpp > 0 && (
              <div className="flex justify-end">
                <span className="text-[11px] text-slate-500">
                  Totaal: <strong className="text-[#0E1111]">{formatArea(totalOpp)}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          {sourceParcelId ? (
            <UploadZone
              parcelId={sourceParcelId}
              documentTypes={['kadaster', 'eigendom', 'erfpacht']}
              label="Kadaster / Eigendom / Erfpacht"
            />
          ) : (
            <DisabledUploadZone />
          )}
        </div>
      </SectionInsightCard>

      {/* ── BRK Eigendom ── */}
      <SectionInsightCard kicker="Eigendom" title="BRK Eigendom" Icon={Users}>
        {!ownership ? (
          <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
            <p className="text-[13px] text-slate-600">
              Eigendomsgegevens niet opgeslagen (Kadaster Tier 3 voorwaarden)
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Open de eigendomsmodal vanuit de kaartweergave om actuele BRK-data op te halen.
            </p>
          </div>
        ) : ownership.status !== 'available' || !ownership.data || ownership.data.length === 0 ? (
          <p className="text-[13px] text-slate-500">
            {ownership.reason ?? 'Geen eigendomsdata beschikbaar'}
          </p>
        ) : (
          <div className="space-y-3">
            {ownership.data.map((item, idx) => (
              <div
                key={idx}
                className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3"
              >
                <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
                  <span className="text-[12px] text-slate-400">Perceel</span>
                  <span className="text-[13px] font-semibold text-[#0E1111] text-right">
                    {item.perceel_identificatie}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
                  <span className="text-[12px] text-slate-400">Gerechtigden</span>
                  <span className="text-[13px] font-semibold text-[#0E1111] text-right">
                    {item.gerechtigden.length} zakelijk gerechtigde
                    {item.gerechtigden.length !== 1 ? 'n' : ''}
                  </span>
                </div>
                {item.heeft_hypotheek && (
                  <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
                    <span className="text-[12px] text-slate-400">Hypotheek</span>
                    <HypotheekBadge />
                  </div>
                )}
                {item.gerechtigden.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.gerechtigden.map((g, gIdx) => (
                      <span key={gIdx} className="flex items-center gap-1.5">
                        <OwnerTypeBadge type={g.eigenaar_type} />
                        {g.aandeel && (
                          <span className="text-[11px] text-slate-500">{g.aandeel}</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionInsightCard>

      {/* ── Marktsignalen ── */}
      <SectionInsightCard kicker="Markt" title="Marktsignalen" Icon={TrendingUp}>
        {!signals ? (
          <p className="text-[13px] text-slate-500">
            Nog geen Funda-signalen beschikbaar voor dit adres
          </p>
        ) : (
          <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
            <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
              <span className="text-[12px] text-slate-400">Te koop sinds</span>
              <ListingDurationBadge days={signals.listing_duration_days} />
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
              <span className="text-[12px] text-slate-400">Prijswijzigingen</span>
              <span className="text-[13px] font-semibold text-[#0E1111] text-right tabular-nums">
                {signals.price_change_count}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
              <span className="text-[12px] text-slate-400">Snapshots</span>
              <span className="text-[13px] font-semibold text-[#0E1111] text-right tabular-nums">
                {signals.listing_snapshots_count}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b-0">
              <span className="text-[12px] text-slate-400">Laatste waarneming</span>
              <MarketFreshnessBadge days={signals.days_since_last_seen} />
            </div>
          </div>
        )}
      </SectionInsightCard>
    </div>
  )
}
