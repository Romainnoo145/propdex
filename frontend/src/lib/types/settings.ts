/**
 * TypeScript types for settings API contracts
 *
 * Mirrors backend Pydantic schemas for user profile, password,
 * and preferences endpoints.
 */

/** Partial update payload for PATCH /api/users/me */
export interface UserProfileUpdate {
  full_name?: string
  email?: string
}

/** Request payload for PUT /api/users/me/password */
export interface PasswordChangeRequest {
  current_password: string
  new_password: string
}

/** User preference state from GET /api/users/me/preferences */
export interface UserPreferences {
  notification_email_alerts: boolean
  map_style: string // "satellite" | "light"
}

/** Partial update payload for PATCH /api/users/me/preferences */
export interface UserPreferencesUpdate {
  notification_email_alerts?: boolean
  map_style?: string
}
