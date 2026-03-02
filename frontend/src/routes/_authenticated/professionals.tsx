import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import ResultsShell from '@/components/layout/ResultsShell'
import { ProfessionalDirectory } from '@/components/professionals/ProfessionalDirectory'

const professionalsSearchSchema = z.object({
  gemeente: z.string().optional().catch(undefined),
  gevolgklasse: z.enum(['GK1', 'GK2', 'GK3']).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/professionals')({
  validateSearch: professionalsSearchSchema,
  component: ProfessionalsPage,
})

function ProfessionalsPage() {
  return (
    <ResultsShell contentClassName="max-w-6xl px-6 py-8">
      <ProfessionalDirectory />
    </ResultsShell>
  )
}
