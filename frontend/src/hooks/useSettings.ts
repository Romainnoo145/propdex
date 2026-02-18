/**
 * TanStack Query hooks for settings operations
 *
 * Provides hooks for:
 * - Fetching and updating user preferences
 * - Updating user profile (name/email)
 * - Changing password
 *
 * All mutations use useMutation (never useQuery for state changes).
 * useUpdateProfile returns updated User for AuthContext.updateUser call-site pattern.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type {
  UserPreferences,
  UserPreferencesUpdate,
  UserProfileUpdate,
  PasswordChangeRequest,
} from '@/lib/types/settings'
import type { User } from '@/lib/auth/types'

const USERS_BASE = '/api/users'

/**
 * Fetch user preferences
 *
 * Query key: ['user', 'preferences']
 * Stale time: 5 minutes
 */
export function useUserPreferences() {
  const { accessToken } = useAuth()

  return useQuery<UserPreferences, Error>({
    queryKey: ['user', 'preferences'],
    queryFn: () =>
      apiFetch<UserPreferences>(USERS_BASE + '/me/preferences', {
        accessToken,
        method: 'GET',
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!accessToken,
  })
}

/**
 * Update user preferences (optimistic cache update)
 *
 * PATCH /api/users/me/preferences
 * Sets query data directly on success — avoids round-trip refetch.
 */
export function useUpdatePreferences() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<UserPreferences, Error, UserPreferencesUpdate>({
    mutationFn: (data: UserPreferencesUpdate) =>
      apiFetch<UserPreferences>(USERS_BASE + '/me/preferences', {
        accessToken,
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      // Optimistic cache update — no extra GET needed
      queryClient.setQueryData(['user', 'preferences'], data)
    },
  })
}

/**
 * Update user profile (name and/or email)
 *
 * PATCH /api/users/me
 * Returns updated User — caller must call AuthContext.updateUser to keep
 * SideRailNav and other user-displaying components fresh.
 */
export function useUpdateProfile() {
  const { accessToken } = useAuth()

  return useMutation<User, Error, UserProfileUpdate>({
    mutationFn: (data: UserProfileUpdate) =>
      apiFetch<User>(USERS_BASE + '/me', {
        accessToken,
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    // No automatic cache update — caller (AccountSection) handles AuthContext.updateUser
  })
}

/**
 * Change user password
 *
 * PUT /api/users/me/password
 * Returns confirmation message. No cache effects — caller clears form on success.
 */
export function useChangePassword() {
  const { accessToken } = useAuth()

  return useMutation<{ message: string }, Error, PasswordChangeRequest>({
    mutationFn: (data: PasswordChangeRequest) =>
      apiFetch<{ message: string }>(USERS_BASE + '/me/password', {
        accessToken,
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  })
}
