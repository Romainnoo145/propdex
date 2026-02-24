import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useReport } from '@/hooks/useReports'
import ReportDetailPage from '@/components/reports/ReportDetailPage'
import type { PropertyReportResponse } from '@/lib/types/property'

interface RapportSearchParams {
  postcode?: string
  huisnummer?: number
}

export const Route = createFileRoute('/_authenticated/rapport/$id')({
  component: RapportPage,
  validateSearch: (search: Record<string, unknown>): RapportSearchParams => ({
    postcode: typeof search.postcode === 'string' ? search.postcode : undefined,
    huisnummer: typeof search.huisnummer === 'number' ? search.huisnummer
      : typeof search.huisnummer === 'string' ? parseInt(search.huisnummer, 10) || undefined
      : undefined,
  }),
})

function RapportPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  // Try loading saved report from API
  const savedReport = useReport(id.startsWith('r') ? null : id)

  // Resolve property data from saved report
  let propertyData: PropertyReportResponse | null = null

  if (savedReport.data?.report_data) {
    propertyData = savedReport.data.report_data as unknown as PropertyReportResponse
  }

  const handleBack = () => {
    navigate({ to: '/projecten' })
  }

  const handleViewOnMap = () => {
    navigate({
      to: '/map',
      search: {
        reportId: id,
        _t: Date.now(),
      },
    })
  }

  return (
    <ReportDetailPage
      data={propertyData}
      isLoading={savedReport.isLoading}
      onBack={handleBack}
      onViewOnMap={handleViewOnMap}
    />
  )
}
