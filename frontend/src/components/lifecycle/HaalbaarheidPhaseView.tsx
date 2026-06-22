/**
 * HaalbaarheidPhaseView — fase-3 (Haalbaarheid) top-level view.
 *
 * Mounted by `routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx`
 * when `phase === '3-haalbaarheid'` (M052/S02 acquisitie-arc, FUND-03/HAAL-01/HAAL-02).
 *
 * Shares the workspace shell with fase-1 (Onderzoek) and fase-2 (Contact): the SAME
 * ResultsShell (max-w-5xl centered container) + the SAME ParcelWorkspaceHeader
 * (address + meta + projecttype badge + score pills + "Bekijk rapport"). Below that
 * shared header it hosts the use-case checklist (`ChecklistCore`) driven by the
 * parcel's chosen `projecttype` — NOT by the report's use_case_scores.
 *
 * Data flow:
 *   ParcelFavorite.project_type (S01, persisted, org-scoped)
 *     → projectTypeToUseCase(projecttype)
 *        ├─ onbepaald / null → empty state → ProjectTypePickerModal (S01)
 *        └─ use_case → ChecklistCore (existing checklist + checklist-progress APIs)
 *
 * The ChecklistProgress persistence is identical to the report path (parcel_id +
 * use_case), so checking/uploading here persists against the same rows.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toMapParcelSearch } from '@/lib/navigation/mapSearch'
import { ClipboardCheck } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ParcelWorkspaceHeader } from '@/components/cockpit/ParcelWorkspaceHeader'
import { PotentieModal, RisicoModal } from '@/components/projects/ScoreDetailModal'
import { ProjectTypePickerModal } from '@/components/parcel/ProjectTypePickerModal'
import { ChecklistCore } from '@/components/checklist/ChecklistCore'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { useParcelProjectType } from '@/hooks/useParcelProjectType'
import { projectTypeToUseCase } from '@/lib/types/projectTypeChip'
import { PROJECT_TYPE_LABELS } from '@/lib/types/projectType'
import type { ProjectType } from '@/lib/types/projectType'

export interface HaalbaarheidPhaseViewProps {
  parcelId: string
}

export function HaalbaarheidPhaseView({ parcelId }: HaalbaarheidPhaseViewProps) {
  const navigate = useNavigate()
  const favoritesQuery = useParcelFavorites()
  // Live projecttype is the single source of truth for the checklist use_case.
  // The picker mutation invalidates this query (not the favorites list), so reading
  // it here means the checklist appears immediately after the user picks an aanpak —
  // it does not wait for the favorites list to refetch.
  const { data: projectTypeData } = useParcelProjectType(parcelId)
  const [scoreModal, setScoreModal] = useState<'potentie' | 'risico' | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Favorite drives the shared workspace header + projecttype — found by parcelId
  // exactly like the index route (opgeslagen.perceel.$parcelId.index.tsx).
  const favorite = useMemo(
    () => favoritesQuery.data?.find((f) => f.parcel_id === parcelId),
    [favoritesQuery.data, parcelId],
  )

  const handleClose = () => void navigate({ to: '/opgeslagen', search: { stage: undefined } })
  const handleOpenMap = () =>
    void navigate({
      to: '/map',
      search: toMapParcelSearch({ parcelId, fallbackAddress: favorite?.address ?? null }),
    })

  // Favorite-loading shell — matches the index route's loading skeleton.
  if (favoritesQuery.isLoading) {
    return (
      <ResultsShell>
        <div className="h-screen w-full animate-pulse bg-white/40 rounded-[24px]" />
      </ResultsShell>
    )
  }

  // Not-found shell — matches the index/Contact route's EmptyState.
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

  // projecttype = single source of truth for which checklist to load.
  // Prefer the live project-type query (reflects a just-made pick); fall back to the
  // value embedded in the favorite when the dedicated query has not resolved yet.
  const projectType = projectTypeData?.project_type ?? favorite.project_type ?? null
  const useCase = projectTypeToUseCase(projectType)
  const currentType = (projectType as ProjectType | null) ?? null

  return (
    <ResultsShell>
      {/* Same shell + width + shared header as Onderzoek/Contact phase views. */}
      <div className="pb-8">
        <ParcelWorkspaceHeader
          favorite={favorite}
          onBack={handleClose}
          onOpenMap={handleOpenMap}
          onScoreClick={setScoreModal}
        />

        {useCase ? (
          /* projecttype gekozen → render checklist-core voor dat use_case. */
          <ChecklistCore
            useCases={[{ id: useCase, label: PROJECT_TYPE_LABELS[currentType ?? 'onbepaald'] }]}
            parcelId={parcelId}
          />
        ) : (
          /* Geen projecttype (onbepaald / niet gekozen) → prompt picker, geen checklist. */
          <div className="mt-2 rounded-[24px] border border-slate-200 bg-white/60 backdrop-blur-[24px] p-8 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-aura-amber/10">
              <ClipboardCheck size={22} strokeWidth={1.5} className="text-aura-amber-dark" />
            </div>
            <p className="text-[15px] font-semibold text-aura-ink">
              Kies een projecttype om de haalbaarheidschecklist te laden
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-500">
              De checklist hangt af van wat je hier wilt ontwikkelen. Kies eerst een aanpak;
              daarna laadt de bijbehorende due-diligence-checklist automatisch.
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-aura-amber bg-aura-amber px-5 text-[13px] font-semibold text-aura-obsidian shadow-[0_4px_14px_rgba(249,168,38,0.35)] transition hover:bg-amber-400"
            >
              Kies een aanpak
            </button>
          </div>
        )}
      </div>

      <ProjectTypePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        parcelId={parcelId}
        currentType={currentType}
        onSkip={() => setPickerOpen(false)}
      />

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
