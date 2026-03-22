import { createContext, useState, useEffect, useCallback, useRef } from 'react'
import type { AuthContextValue, User, RegisterData } from './types'
import {
  loginApi,
  registerApi,
  refreshApi,
  logoutApi,
  fetchUserApi,
} from './api'
import { setTokenRefreshFn } from '@/lib/api'

/** Refresh 2 minutes before the 15-minute access token expires */
const REFRESH_INTERVAL_MS = 13 * 60 * 1000

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(false)

  /** Perform a silent token refresh and update state. Returns new token or null. */
  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const data = await refreshApi()
      setAccessToken(data.access_token)
      return data.access_token
    } catch {
      setAccessToken(null)
      setUser(null)
      return null
    }
  }, [])

  /** Start the proactive refresh timer */
  const startRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    refreshTimerRef.current = setInterval(() => {
      silentRefresh()
    }, REFRESH_INTERVAL_MS)
  }, [silentRefresh])

  const stopRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  // Register the refresh function so apiFetch can use it on 401
  useEffect(() => {
    setTokenRefreshFn(silentRefresh)
    return () => setTokenRefreshFn(null)
  }, [silentRefresh])

  // Silent refresh on mount — guarded against StrictMode double-mount
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true

    refreshApi()
      .then(async (data) => {
        setAccessToken(data.access_token)
        const userData = await fetchUserApi(data.access_token)
        setUser(userData)
        startRefreshTimer()
      })
      .catch(() => {
        setUser(null)
        setAccessToken(null)
      })
      .finally(() => setIsLoading(false))

    return () => stopRefreshTimer()
  }, [startRefreshTimer, stopRefreshTimer])

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password)
    setAccessToken(data.access_token)
    const userData = await fetchUserApi(data.access_token)
    setUser(userData)
    startRefreshTimer()
  }, [startRefreshTimer])

  const register = useCallback(async (registerData: RegisterData) => {
    const data = await registerApi(registerData)
    setAccessToken(data.access_token)
    const userData = await fetchUserApi(data.access_token)
    setUser(userData)
    startRefreshTimer()
  }, [startRefreshTimer])

  const logout = useCallback(async () => {
    stopRefreshTimer()
    await logoutApi().catch(() => {
      // Ignore logout API errors — clear local state regardless
    })
    setAccessToken(null)
    setUser(null)
  }, [stopRefreshTimer])

  const loginWithToken = useCallback(async (token: string) => {
    setAccessToken(token)
    const userData = await fetchUserApi(token)
    setUser(userData)
    startRefreshTimer()
  }, [startRefreshTimer])

  const loginAsDemo = useCallback(() => {
    setAccessToken('demo-token')
    setUser({
      id: 'demo-user-id',
      email: 'info@klarifai.nl',
      full_name: 'Klarifai Demo',
      organization_id: 'demo-org-id',
      email_verified: true,
      auth_provider: 'email',
      created_at: new Date().toISOString(),
    })
  }, [])

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        accessToken,
        login,
        register,
        logout,
        loginWithToken,
        loginAsDemo,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
