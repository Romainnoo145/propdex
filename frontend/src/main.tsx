import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import * as Sentry from '@sentry/react'
import { routeTree } from './routeTree.gen'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './lib/auth/AuthContext'
import { useAuth } from './lib/auth/useAuth'
import { AuthLoadingScreen } from './components/AuthLoadingScreen'
import './styles/index.css'

// Initialize Sentry before any rendering
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
  })
}

// Create router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: {
    auth: {
      isAuthenticated: false,
      user: null,
    },
  },
})

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function InnerApp() {
  const { isLoading, isAuthenticated, user } = useAuth()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  return (
    <RouterProvider
      router={router}
      context={{
        auth: {
          isAuthenticated,
          user,
        },
      }}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>
    <Toaster
      position="bottom-right"
      theme="light"
      toastOptions={{
        style: {
          background: 'rgba(255,255,255,0.90)',
          border: '1px solid rgba(0,0,0,0.08)',
          color: '#1A1C1E',
          backdropFilter: 'blur(12px)',
        },
      }}
    />
  </StrictMode>
)
