/**
 * ContactPhaseView — fase-2 (Contact) top-level view.
 *
 * Mounted by `routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx`
 * when `phase === '2-contact'`.
 *
 * Shares the workspace shell with fase-1 (Onderzoek): the SAME ResultsShell
 * (max-w-5xl ≈ 1024px centered container, matching the locked Contact.html
 * `.w5{max-width:1024px;margin:0 auto}`) + the SAME ParcelWorkspaceHeader
 * (address + meta + projecttype badge + score pills + "Bekijk rapport").
 * Below that shared header the three Contact-phase cards render:
 *   1. EigenaarCard          — "Eigendom & eigenaar" (ownerhero + 4-tile bidgrid + privacy-note)
 *   2. EigendomssituatieCard — "Eigendomssituatie" (A-list verwervings-aandachtspunten)
 *   3. BriefLetterCard       — "Persoonlijke brief" (.brief2 two-column: acties | letter)
 *
 * Data:
 *   - useParcelFavorites(): the favorite (workspace header source), found by parcelId
 *     the same way the index route (opgeslagen.perceel.$parcelId.index.tsx) does it.
 *   - useBrkRecords(parcelId): persisted rechtspersoon/overheid records (AVG-stripped).
 *   - records[0] drives the eigenaar + eigendomssituatie cards; brief auto-mode.
 *   - No record (particulier / not fetched) → BrkPersistPanel CTA state; the brief
 *     card shows a graceful "geen eigenaar-gegevens" empty state.
 *   - RescoreProgressBanner: gated on (pollStartAt !== null && hasRecords) per AD3.
 *
 * onBack → /opgeslagen (workspace header back button); onOpenMap → /map.
 * Aura tokens per DESIGN.md: ResultsShell wrap, Pure Glass cards inside.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toMapParcelSearch } from '@/lib/navigation/mapSearch'
import ResultsShell from '@/components/layout/ResultsShell'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ParcelWorkspaceHeader } from '@/components/cockpit/ParcelWorkspaceHeader'
import { PotentieModal, RisicoModal } from '@/components/projects/ScoreDetailModal'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { useParcelEnrichment } from '@/hooks/useScans'
import { useBrkRecords } from '@/hooks/useBrkRecords'
import { BrkPersistPanel } from './BrkPersistPanel'
import { RescoreProgressBanner } from './RescoreProgressBanner'
import { EigenaarCard } from './EigenaarCard'
import { EigendomssituatieCard } from './EigendomssituatieCard'
import { BriefLetterCard } from './BriefLetterCard'

// ============================================================================
// Pure dispatcher derivation — exported for unit tests
// ============================================================================

export interface ContactDispatchInput {
  isLoading: boolean
  hasRecords: boolean
  pollStartAt: number | null
}

export interface ContactDispatchView {
  showSkeleton: boolean
  showPersistPanel: boolean
  showRecordDisplay: boolean
  showRescoreBanner: boolean
}

/**
 * Pure branching logic for the ContactPhaseView render.
 *
 *   isLoading                                 → skeleton-only
 *   !isLoading && !hasRecords                 → persist-panel CTA (particulier/niet-opgehaald)
 *   !isLoading && hasRecords                  → 3 mockup cards (eigenaar / situatie / brief)
 *   !isLoading && hasRecords && pollStartAt   → rescore banner rendered (AD3)
 *
 * Note: with records present the persist-panel is hidden (the SUCCESS chip is
 * subsumed by the EigenaarCard "Bron: Kadaster" header), so showPersistPanel
 * means "show the standalone CTA/state panel" — only when there are no records.
 */
export function deriveContactDispatch(input: ContactDispatchInput): ContactDispatchView {
  const { isLoading, hasRecords, pollStartAt } = input
  return {
    showSkeleton: isLoading,
    showPersistPanel: !isLoading && !hasRecords,
    showRecordDisplay: !isLoading && hasRecords,
    showRescoreBanner: !isLoading && hasRecords && pollStartAt !== null,
  }
}

// ============================================================================
// Component
// ============================================================================

export interface ContactPhaseViewProps {
  parcelId: string
}

function SkeletonState() {
  return (
    <div className="space-y-4">
      <div className="h-24 w-full animate-pulse bg-white/40 rounded-[24px]" />
      <div className="h-32 w-full animate-pulse bg-white/40 rounded-[24px]" />
    </div>
  )
}

export function ContactPhaseView({ parcelId }: ContactPhaseViewProps) {
  const navigate = useNavigate()
  const favoritesQuery = useParcelFavorites()
  const { data: records, isLoading: isLoadingRecords } = useBrkRecords(parcelId)
  const [pollStartAt, setPollStartAt] = useState<number | null>(null)
  const [scoreModal, setScoreModal] = useState<'potentie' | 'risico' | null>(null)

  // Favorite drives the shared workspace header — found by parcelId exactly like
  // the index route (opgeslagen.perceel.$parcelId.index.tsx).
  const favorite = useMemo(
    () => favoritesQuery.data?.find((f) => f.parcel_id === parcelId),
    [favoritesQuery.data, parcelId],
  )

  // Real WOZ for the EigenaarCard tile comes from the parcel-enrichment source
  // (WOZ Waardeloket, pre-cached in scan_results.flags['woz']). The enrich
  // endpoint keys on the ParcelCache UUID, so use the favorite's parcel_cache_id.
  const enrichmentQuery = useParcelEnrichment(favorite?.parcel_cache_id ?? null)
  const wozData = enrichmentQuery.data?.woz_data ?? null

  // onBack → terug naar opgeslagen lijst; onOpenMap → /map met perceel-focus.
  const handleClose = () => void navigate({ to: '/opgeslagen', search: { stage: undefined } })
  const handleOpenMap = () =>
    void navigate({
      to: '/map',
      search: toMapParcelSearch({ parcelId, fallbackAddress: favorite?.address ?? null }),
    })

  const recs = records ?? []
  const hasRecords = recs.length > 0
  const dispatch = deriveContactDispatch({ isLoading: isLoadingRecords, hasRecords, pollStartAt })

  // record[0] = de primaire eigenaar (rechtspersoon/overheid) voor de auto-modus.
  const primary = recs[0] ?? null

  const onPersistSuccess = () => {
    setPollStartAt(Date.now())
  }

  // Favorite-loading shell — matches the index route's loading skeleton.
  if (favoritesQuery.isLoading) {
    return (
      <ResultsShell>
        <div className="h-screen w-full animate-pulse bg-white/40 rounded-[24px]" />
      </ResultsShell>
    )
  }

  // Not-found shell — matches the index route's EmptyState. The back-action copy
  // keeps the "Terug naar Onderzoek" affordance for users who reached fase 2 for a
  // parcel that's no longer in their opgeslagen lijst.
  if (!favorite) {
    return (
      <ResultsShell>
        <EmptyState
          title="Perceel niet gevonden"
          description="Dit perceel staat niet in je opgeslagen lijst. Terug naar Onderzoek om het opnieuw te openen."
          action={{ label: 'Terug naar Onderzoek', onClick: handleClose }}
        />
      </ResultsShell>
    )
  }

  return (
    <ResultsShell>
      {/* Same shell + width + shared header as OnderzoekPhaseView. */}
      <div className="pb-8">
        <ParcelWorkspaceHeader
          favorite={favorite}
          onBack={handleClose}
          onOpenMap={handleOpenMap}
          onScoreClick={setScoreModal}
        />

        {dispatch.showSkeleton && <SkeletonState />}

        {dispatch.showRescoreBanner && pollStartAt !== null && (
          <RescoreProgressBanner parcelId={parcelId} pollStartAt={pollStartAt} />
        )}

        {/* Geen record (particulier / niet-opgehaald): BRK persist-CTA + state-machine. */}
        {dispatch.showPersistPanel && (
          <BrkPersistPanel
            parcelId={parcelId}
            records={recs}
            onPersistSuccess={onPersistSuccess}
          />
        )}

        {/* Record aanwezig: card 1 + 2 uit de gelockte mockup. */}
        {dispatch.showRecordDisplay && primary && (
          <>
            <EigenaarCard record={primary} woz={wozData} />
            <EigendomssituatieCard record={primary} />
          </>
        )}

        {/* Card 3 — Persoonlijke brief (auto bij record, empty-state zonder record). */}
        {!dispatch.showSkeleton && <BriefLetterCard parcelId={parcelId} record={primary} />}
      </div>

      <PotentieModal
        open={scoreModal === 'potentie'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={favorite.parcel_cache_id}
      />
      <RisicoModal
        open={scoreModal === 'risico'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={favorite.parcel_cache_id}
      />
    </ResultsShell>
  )
}
