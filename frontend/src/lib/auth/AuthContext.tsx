import { createContext, useState, useEffect, useCallback } from 'react'
import type { AuthContextValue, User, RegisterData } from './types'
import {
  loginApi,
  registerApi,
  refreshApi,
  logoutApi,
  fetchUserApi,
} from './api'

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Silent refresh on mount
  useEffect(() => {
    refreshApi()
      .then(async (data) => {
        setAccessToken(data.access_token)
        const userData = await fetchUserApi(data.access_token)
        setUser(userData)
      })
      .catch(() => {
        // Refresh failed — user is not authenticated
        setUser(null)
        setAccessToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password)
    setAccessToken(data.access_token)
    const userData = await fetchUserApi(data.access_token)
    setUser(userData)
  }, [])

  const register = useCallback(async (registerData: RegisterData) => {
    const data = await registerApi(registerData)
    setAccessToken(data.access_token)
    const userData = await fetchUserApi(data.access_token)
    setUser(userData)
  }, [])

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {
      // Ignore logout API errors — clear local state regardless
    })
    setAccessToken(null)
    setUser(null)
  }, [])

  const loginWithToken = useCallback(async (token: string) => {
    setAccessToken(token)
    const userData = await fetchUserApi(token)
    setUser(userData)
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
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
