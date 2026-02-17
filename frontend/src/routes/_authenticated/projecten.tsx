import { createFileRoute } from '@tanstack/react-router'
import ResultsShell from '@/components/layout/ResultsShell'
import ProjectList from '@/components/projects/ProjectList'

export const Route = createFileRoute('/_authenticated/projecten')({
  component: ProjectenPage,
})

function ProjectenPage() {
  return (
    <ResultsShell>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-grey-100">Projecten</h1>
        <p className="mt-1 text-grey-400">
          Organiseer je rapporten in projectmappen
        </p>
      </div>

      {/* Project list */}
      <ProjectList />
    </ResultsShell>
  )
}
