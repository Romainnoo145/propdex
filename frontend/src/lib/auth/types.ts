export interface User {
  id: string
  email: string
  full_name: string | null
  organization_id: string
  email_verified: boolean
  auth_provider: string
  is_superuser: boolean
  created_at: string
  /** M052/S01 (DEMO-01) — true only for the Hauzer demo org. Backend enforces org isolation. */
  hauzer_demo: boolean
}

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  loginWithToken: (accessToken: string) => Promise<void>
  loginAsDemo: () => void
  updateUser: (user: User) => void
}

export interface RegisterData {
  email: string
  password: string
  full_name: string
  organization_name: string
}

export interface RouterContext {
  auth: {
    isAuthenticated: boolean
    user: User | null
  }
}
