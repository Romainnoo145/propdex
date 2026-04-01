/**
 * S2 Kadaster & Eigendom — Due Diligence Dashboard section 2
 *
 * Displays: cadastral parcels, BRK ownership status, market signals
 * Each sub-section wrapped in SectionInsightCard with icon + kicker.
 * Includes per-section document upload zone when sourceParcelId is available.
 */

import { Landmark, Users, TrendingUp } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { SubCard, SectionNotes, formatArea } from '../components'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S2KadasterEigendomProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Badge helpers ──────────────────────────────────────────── */

const OWNER_TYPE_COLORS: Record<string, string> = {
  natuurlijk_persoon: 'bg-amber-100 text-amber-700',
  rechtspersoon: 'bg-slate-100 text-slate-600',
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
    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
      Hypotheek geregistreerd
    </span>
  )
}

function ListingDurationBadge({ days }: { days: number }) {
  const colors =
    days < 30
      ? 'bg-amber-100 text-amber-700'
      : days <= 180
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${colors}`}>
      {days} dagen
    </span>
  )
}

function MarketFreshnessBadge({ days }: { days: number }) {
  const colors =
    days < 30
      ? 'bg-amber-100 text-amber-700'
      : days <= 90
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${colors}`}>
      {days}d geleden
    </span>
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
              <SubCard key={idx}>
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
              </SubCard>
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

      </SectionInsightCard>

      {/* ── BRK Eigendom ── */}
      <SectionInsightCard kicker="Eigendom" title="BRK Eigendom" Icon={Users}>
        {!ownership ? (
          <SubCard>
            <p className="text-[13px] text-slate-600">
              Eigendomsgegevens niet opgeslagen (Kadaster Tier 3 voorwaarden)
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Open de eigendomsmodal vanuit de kaartweergave om actuele BRK-data op te halen.
            </p>
          </SubCard>
        ) : ownership.status !== 'available' || !ownership.data || ownership.data.length === 0 ? (
          <p className="text-[13px] text-slate-500">
            {ownership.reason ?? 'Geen eigendomsdata beschikbaar'}
          </p>
        ) : (
          <div className="space-y-3">
            {ownership.data.map((item, idx) => (
              <SubCard key={idx}>
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
              </SubCard>
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
          <SubCard>
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
          </SubCard>
        )}
      </SectionInsightCard>

      {/* ── Section Notes ─────────────────────────────────────── */}
      <SectionNotes parcelId={sourceParcelId ?? null} documentTypes={['kadaster']} />
    </div>
  )
}
