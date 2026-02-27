import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useReport } from '@/hooks/useReports'
import ReportDetailPage from '@/components/reports/ReportDetailPage'
import type { PropertyReportResponse } from '@/lib/types/property'

interface RapportSearchParams {
  postcode?: string
  huisnummer?: number
  from?: 'rapporten' | 'projecten' | 'meldingen' | 'resultaten'
}

export const Route = createFileRoute('/_authenticated/rapport/$id')({
  component: RapportPage,
  validateSearch: (search: Record<string, unknown>): RapportSearchParams => ({
    postcode: typeof search.postcode === 'string' ? search.postcode : undefined,
    huisnummer: typeof search.huisnummer === 'number' ? search.huisnummer
      : typeof search.huisnummer === 'string' ? parseInt(search.huisnummer, 10) || undefined
      : undefined,
    from:
      search.from === 'rapporten' ||
      search.from === 'projecten' ||
      search.from === 'meldingen' ||
      search.from === 'resultaten'
      ? search.from
      : undefined,
  }),
})

function RapportPage() {
  const { id } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()

  // Try loading saved report from API
  const savedReport = useReport(id.startsWith('r') ? null : id)

  // Resolve property data from saved report
  let propertyData: PropertyReportResponse | null = null

  if (savedReport.data?.report_data) {
    propertyData = savedReport.data.report_data as unknown as PropertyReportResponse
  }

  const backLabel =
    search.from === 'rapporten'
      ? 'Terug naar rapporten'
      : search.from === 'projecten'
        ? 'Terug naar projecten'
        : search.from === 'meldingen'
          ? 'Terug naar meldingen'
          : search.from === 'resultaten'
            ? 'Terug naar resultaten'
            : 'Terug'

  const handleBack = () => {
    if (search.from === 'rapporten') {
      navigate({ to: '/rapporten', search: { project_id: undefined, q: undefined } })
      return
    }
    if (search.from === 'projecten') {
      navigate({ to: '/projecten' })
      return
    }
    if (search.from === 'meldingen') {
      navigate({ to: '/meldingen', search: { gemeente: undefined } })
      return
    }
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    navigate({ to: search.from === 'resultaten' ? '/resultaten' : '/projecten' })
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
      backLabel={backLabel}
      sourceParcelId={savedReport.data?.source_parcel_id ?? null}
      onBack={handleBack}
      onViewOnMap={handleViewOnMap}
    />
  )
}
