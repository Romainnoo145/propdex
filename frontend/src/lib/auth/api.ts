import type { User, RegisterData } from './types'

const API_BASE = '/api/auth'

interface LoginResponse {
  access_token: string
}

interface RefreshResponse {
  access_token: string
}

/**
 * Login with email and password
 * Returns access token, sets httpOnly refresh cookie
 */
export async function loginApi(
  email: string,
  password: string
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // CRITICAL: Send httpOnly cookie
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Login failed' }))
    throw new Error(error.detail || 'Login failed')
  }

  return response.json()
}

/**
 * Register a new user and organization
 * Returns access token, sets httpOnly refresh cookie
 */
export async function registerApi(
  data: RegisterData
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // CRITICAL: Send httpOnly cookie
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Registration failed' }))
    throw new Error(error.detail || 'Registration failed')
  }

  return response.json()
}

/**
 * Silent token refresh using httpOnly refresh cookie
 * No body needed - cookie is sent automatically
 */
export async function refreshApi(): Promise<RefreshResponse> {
  const response = await fetch(`${API_BASE}/refresh`, {
    method: 'POST',
    credentials: 'include', // CRITICAL: Send httpOnly cookie
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Token refresh failed' }))
    throw new Error(error.detail || 'Token refresh failed')
  }

  return response.json()
}

/**
 * Logout - clears httpOnly refresh cookie on server
 * No body needed
 */
export async function logoutApi(): Promise<void> {
  const response = await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include', // CRITICAL: Send httpOnly cookie
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Logout failed' }))
    throw new Error(error.detail || 'Logout failed')
  }
}

/**
 * Fetch current user details using access token
 */
export async function fetchUserApi(accessToken: string): Promise<User> {
  const response = await fetch(`${API_BASE}/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include', // CRITICAL: Send httpOnly cookie
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Failed to fetch user' }))
    throw new Error(error.detail || 'Failed to fetch user')
  }

  return response.json()
}
