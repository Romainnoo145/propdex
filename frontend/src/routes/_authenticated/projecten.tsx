import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import ResultsShell from '@/components/layout/ResultsShell'
import ProjectList from '@/components/projects/ProjectList'

const projectenSearchSchema = z.object({
  gemeente_id: z.string().optional(),
  wijk_id: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/projecten')({
  validateSearch: projectenSearchSchema,
  component: ProjectenPage,
})

function ProjectenPage() {
  return (
    <ResultsShell contentClassName="max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Project list */}
      <ProjectList />
    </ResultsShell>
  )
}
