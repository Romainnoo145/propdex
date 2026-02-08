import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/google-callback')({
  component: GoogleCallback,
})

function GoogleCallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-[var(--color-text-secondary)]">Authenticating with Google...</p>
    </div>
  )
}
