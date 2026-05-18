import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useMemo } from 'react'
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

  // FavoriteParcelWorkspaceView is a self-contained dossier (1922 lines) with its
  // own header (parcel number + stage + scores + action buttons) and width-management.
  // Render it bare — no wrapping ResultsShell, no extra headers, no slot placeholders.
  // The lifecycle sidebar handles workspace entry/exit; the workspace handles its content.
  return <FavoriteParcelWorkspaceView favorite={parcel} onBack={handleClose} onOpenMap={handleOpenMap} />
}
