import { createFileRoute, redirect } from '@tanstack/react-router'

interface AuthSearch {
  redirect?: string
}

export const Route = createFileRoute('/auth/')({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: (search.redirect as string) || undefined,
  }),
  beforeLoad: ({ context }) => {
    // Already authenticated? Redirect to map
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/map' })
    }
  },
  component: AuthPage,
})

function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-secondary)]">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Propdex</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Auth page stub — forms in Plan 04</p>
      </div>
    </div>
  )
}
