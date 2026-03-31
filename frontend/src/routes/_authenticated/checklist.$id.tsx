import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ChevronLeft, FileText, MapPin } from 'lucide-react'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { useReport } from '@/hooks/useReports'
import ResultsShell from '@/components/layout/ResultsShell'
import { S8VergunningChecklist } from '@/components/reports/sections/S8VergunningChecklist'
import type { PropertyReportResponse } from '@/lib/types/property'
import { Skeleton } from '@/components/feedback/Skeleton'

export const Route = createFileRoute('/_authenticated/checklist/$id')({
  component: ChecklistPage,
})

function ChecklistPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  const savedReport = useReport(id)

  const propertyData: PropertyReportResponse | null =
    savedReport.data?.report_data
      ? (savedReport.data.report_data as unknown as PropertyReportResponse)
      : null

  const sourceParcelId = savedReport.data?.source_parcel_id ?? null
  const address = propertyData?.address

  const handleBack = () => {
    navigate({ to: '/rapport/$id', params: { id } })
  }

  const handleViewRapport = () => {
    navigate({ to: '/rapport/$id', params: { id } })
  }

  const handleViewOnMap = () => {
    navigate({ to: '/map', search: { reportId: id, _t: Date.now() } })
  }

  if (savedReport.isLoading) {
    return (
      <ResultsShell>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </ResultsShell>
    )
  }

  if (!propertyData) {
    return (
      <ResultsShell>
        <div className="py-16 text-center">
          <p className="text-[14px] text-slate-400">Rapport niet gevonden.</p>
        </div>
      </ResultsShell>
    )
  }

  return (
    <ResultsShell>
      <motion.div variants={staggerContainer} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={fadeUp} className="mb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                Vergunning Checklist
              </p>

              <div className="mt-2 flex items-start gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-white/60 backdrop-blur-sm transition-colors hover:bg-white/80"
                  aria-label="Terug naar rapport"
                >
                  <ChevronLeft className="size-4 text-[#0E1111]" />
                </button>

                <div className="min-w-0">
                  <h1 className="text-[28px] font-bold leading-tight tracking-tighter text-slate-900">
                    {address?.straat} {address?.huisnummer}
                    {address?.huisletter ?? ''}{address?.toevoeging ?? ''}
                  </h1>
                  <p className="mt-1 text-[14px] text-slate-500">
                    {address?.woonplaats}
                    {address?.postcode ? ` · ${address.postcode}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 lg:shrink-0">
              <button
                type="button"
                onClick={handleViewOnMap}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0E1111] text-[#F9A826] transition-colors hover:bg-slate-800"
                aria-label="Open op kaart"
                title="Open op kaart"
              >
                <MapPin size={16} />
              </button>
              <button
                type="button"
                onClick={handleViewRapport}
                className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-[#0E1111] bg-amber-500 px-4 text-[12px] font-semibold text-[#0E1111] transition-colors hover:bg-amber-400"
              >
                <FileText size={14} />
                Bekijk rapport
              </button>
            </div>
          </div>
        </motion.div>

        {/* Checklist content */}
        <motion.div variants={fadeUp}>
          <S8VergunningChecklist data={propertyData} sourceParcelId={sourceParcelId} />
        </motion.div>
      </motion.div>
    </ResultsShell>
  )
}
