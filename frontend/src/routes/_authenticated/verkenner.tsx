import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/verkenner')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/verkenner"!</div>
}
