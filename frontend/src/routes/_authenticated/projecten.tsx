import { createFileRoute } from '@tanstack/react-router'
import ProjectList from '@/components/projects/ProjectList'

export const Route = createFileRoute('/_authenticated/projecten')({
  component: ProjectenPage,
})

function ProjectenPage() {
  return (
    <div className="h-full overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-4xl px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Projecten</h1>
          <p className="mt-1 text-gray-500">
            Organiseer je rapporten in projectmappen
          </p>
        </div>

        {/* Project list */}
        <ProjectList />
      </div>
    </div>
  )
}
