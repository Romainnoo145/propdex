import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth/useAuth'

export const Route = createFileRoute('/auth/google-callback')({
  component: GoogleCallback,
})

function GoogleCallback() {
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()

  useEffect(() => {
    const handleCallback = async () => {
      // Extract code from URL
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (!code) {
        navigate({ to: '/auth' })
        return
      }

      try {
        // Exchange code for tokens
        const response = await fetch('/api/auth/google/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            code,
            redirect_uri: `${window.location.origin}/auth/google-callback`,
          }),
        })

        if (!response.ok) {
          throw new Error('Google callback failed')
        }

        const data = await response.json()

        // Update auth context with access token
        await loginWithToken(data.access_token)

        // Redirect to map
        navigate({ to: '/map' })
      } catch (error) {
        console.error('Google OAuth callback error:', error)
        navigate({ to: '/auth' })
      }
    }

    handleCallback()
  }, [navigate, loginWithToken])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-[var(--color-text-secondary)]">
        Authenticating with Google...
      </p>
    </div>
  )
}
