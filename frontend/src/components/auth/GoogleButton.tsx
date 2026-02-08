import { useState } from 'react'

export function GoogleButton() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/google', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 501) {
          throw new Error('Google OAuth is not configured on this server')
        }
        throw new Error('Failed to initialize Google login')
      }

      const data = await response.json()

      if (!data.authorization_url) {
        throw new Error('No authorization URL received')
      }

      // Redirect to Google OAuth
      window.location.href = data.authorization_url
    } catch (err) {
      setIsLoading(false)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred')
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? 'Loading...' : 'Continue with Google'}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
