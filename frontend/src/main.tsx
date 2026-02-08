import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './lib/auth/AuthContext'
import { useAuth } from './lib/auth/useAuth'
import { AuthLoadingScreen } from './components/AuthLoadingScreen'
import './styles/index.css'

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
  </StrictMode>
)
