export interface User {
  id: string
  email: string
  full_name: string | null
  organization_id: string
  email_verified: boolean
  auth_provider: string
  created_at: string
}

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
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
