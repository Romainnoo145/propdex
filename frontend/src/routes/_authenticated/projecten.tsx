import { createFileRoute } from '@tanstack/react-router'
import AppLayout from '@/components/layout/AppLayout'
import ProjectList from '@/components/projects/ProjectList'

export const Route = createFileRoute('/_authenticated/projecten')({
  component: ProjectenPage,
})

function ProjectenPage() {
  return (
    <AppLayout>
      <div className="mx-auto h-full max-w-4xl overflow-y-auto px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Projecten</h1>
          <p className="mt-1 text-white/50">
            Organiseer je rapporten in projectmappen
          </p>
        </div>

        {/* Project list */}
        <ProjectList />
      </div>
    </AppLayout>
  )
}
