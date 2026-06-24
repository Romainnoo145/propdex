import { createFileRoute } from '@tanstack/react-router'
import { useSplitsingReport } from '@/hooks/useSplitsingReport'
import { SplitsingReportView } from '@/components/reportsV2/SplitsingReportView'

export const Route = createFileRoute('/_authenticated/rapport-v2/splitsing/$parcelId')({
  component: SplitsingReportPage,
})

function SplitsingReportPage() {
  const { parcelId } = Route.useParams()
  const { data, isLoading, error } = useSplitsingReport(parcelId)

  if (isLoading) return <div className="p-6">Rapport laden…</div>
  if (error || !data) return <div className="p-6">Kon het rapport niet laden.</div>
  return <SplitsingReportView report={data} />
}
