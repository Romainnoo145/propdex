import { createFileRoute } from '@tanstack/react-router'
import { ScoreSection } from '@/components/settings/ScoreSection'

export const Route = createFileRoute('/_authenticated/instellingen/score')({
  component: InstellingenScorePage,
})

function InstellingenScorePage() {
  return <ScoreSection />
}
