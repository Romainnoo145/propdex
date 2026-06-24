import { createFileRoute } from '@tanstack/react-router'
import { useDakkapelReport } from '@/hooks/useDakkapelReport'
import { DakkapelReportView } from '@/components/reportsV2/DakkapelReportView'

export const Route = createFileRoute('/_authenticated/rapport-v2/dakkapel/$parcelId')({
  component: DakkapelReportPage,
})

function DakkapelReportPage() {
  const { parcelId } = Route.useParams()
  const { data, isLoading, error } = useDakkapelReport(parcelId)

  if (isLoading) return <div className="p-6">Rapport laden…</div>
  if (error || !data) return <div className="p-6">Kon het rapport niet laden.</div>
  return <DakkapelReportView report={data} />
}
