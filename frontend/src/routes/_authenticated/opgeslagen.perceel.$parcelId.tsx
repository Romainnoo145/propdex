import { createFileRoute, useNavigate, useParams, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { FavoriteParcelWorkspaceView } from '@/components/projects/FavoriteParcelWorkspaceView'
import { EmptyState } from '@/components/feedback/EmptyState'

export const Route = createFileRoute('/_authenticated/opgeslagen/perceel/$parcelId')({
  component: OpgeslagenPerceelPage,
})

function OpgeslagenPerceelPage() {
  const { parcelId } = useParams({ from: '/_authenticated/opgeslagen/perceel/$parcelId' })
  const navigate = useNavigate()
  const favoritesQuery = useParcelFavorites()

  const parcel = useMemo(
    () => favoritesQuery.data?.find((f) => f.parcel_id === parcelId),
    [favoritesQuery.data, parcelId],
  )

  const handleClose = () => void navigate({ to: '/opgeslagen', search: { stage: undefined } })
  const handleOpenMap = () => void navigate({ to: '/map' })

  if (favoritesQuery.isLoading) {
    return (
      <ResultsShell>
        <div className="h-screen w-full animate-pulse bg-white/40 rounded-[24px]" />
      </ResultsShell>
    )
  }

  if (!parcel) {
    return (
      <ResultsShell>
        <EmptyState
          title="Perceel niet gevonden"
          description="Dit perceel staat niet in je opgeslagen lijst. Mogelijk is het verwijderd."
          action={{ label: 'Terug naar Opgeslagen', onClick: handleClose }}
        />
      </ResultsShell>
    )
  }

  return (
    <ResultsShell fullWidth>
      {/* AANPAK header — single focus per scherm rule (Minimal Calm Intelligence) */}
      <div className="mb-4 px-6 pt-6">
        <Link
          to="/opgeslagen"
          search={{ stage: undefined }}
          className="inline-flex items-center gap-2 text-[12px] text-slate-500 hover:text-aura-ink mb-3 transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.5} /> Opgeslagen
        </Link>
        <h1 className="text-[24px] font-semibold text-aura-ink">
          {parcel.address ?? 'Perceel'}
        </h1>
        <p className="text-[13px] text-slate-500 mt-1">
          AANPAK · 1. Onderzoek — scan-data, scoring, en de eerste actie-stappen.
        </p>
      </div>

      {/* M050 slot placeholders (functionaliteit komt uit S04+/S01-S02) */}
      <div className="mx-6 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[20px] p-4 flex items-center gap-3">
          <div className="text-[14px] font-medium text-aura-ink">Brief sturen</div>
          <div className="ml-auto text-[11px] text-slate-400 uppercase tracking-wide">
            Komt later (M050/S04)
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[20px] p-4 flex items-center gap-3">
          <div className="text-[14px] font-medium text-aura-ink">BRK Eigendom (persistent)</div>
          <div className="ml-auto text-[11px] text-slate-400 uppercase tracking-wide">
            Komt later (M050/S01-S02)
          </div>
        </div>
      </div>

      {/* PORTFOLIO WORKSPACE — existing 1922-line component mounted as-is */}
      <FavoriteParcelWorkspaceView favorite={parcel} onBack={handleClose} onOpenMap={handleOpenMap} />
    </ResultsShell>
  )
}
