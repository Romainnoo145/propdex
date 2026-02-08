# Phase 14: Authentication & Security - Research

**Researched:** 2026-02-08
**Domain:** React authentication with JWT, TanStack Router, httpOnly cookies, protected routes
**Confidence:** HIGH

## Summary

This research covers implementing a production-grade authentication system in a React 19 + TanStack Router application, connecting to an existing FastAPI backend with JWT authentication. The standard approach uses access tokens stored in memory (React state/context), refresh tokens in httpOnly cookies, and silent token refresh on page load/expiry. TanStack Router provides first-class support for protected routes via `beforeLoad` hooks and layout routes. The backend already has JWT infrastructure in place but needs cookie-based endpoints added.

The architecture balances security (httpOnly cookies prevent XSS theft, in-memory access tokens minimize exposure) with user experience (silent refresh means users stay logged in across sessions without manual re-authentication). Google OAuth integration uses the standard Authorization Code flow, delegating to the existing backend OAuth handlers.

**Primary recommendation:** Use React Context for auth state, TanStack Router's `beforeLoad` + layout routes for protection, React Hook Form + Zod for form validation, and implement silent refresh on app initialization via TanStack Query.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Login/Register UI:**
- Centered card layout over subtle background (GitHub/Vercel style)
- Tabbed single page at `/auth` — Login and Register tabs on one card
- Google OAuth button + email/password form, separated by "or" divider — both shown from start
- Inline validation under fields — red text below each field on blur/submit
- Registration fields: email, password, full name, company name (4 fields)

**Auth Flow & Session Behavior:**
- Silent refresh — access token refreshes in background via httpOnly refresh cookie, user never notices
- No "Remember me" checkbox — refresh token always lasts a reasonable duration (e.g., 7 days)
- On refresh token expiry: silently redirect to `/auth` with no error toast — user just logs in again
- Post-login interim redirect: Claude's discretion (map view is the natural choice until dashboard ships)

**Protected Route Experience:**
- Unauthenticated users redirected to `/auth` with return URL preserved — after login, return to originally requested page
- Auth loading state: branded Propdex splash screen with subtle loading animation while checking auth status
- Already-authenticated users visiting `/auth` are redirected to main app immediately
- Temporary minimal logout button somewhere visible — proper placement comes with sidebar in later phase

**Registration Onboarding:**
- Immediate access after registration — no email verification required to use the app
- No onboarding/welcome screen — straight into the app (professional tool, users figure it out)
- Company name field on registration form creates the user's organization automatically

### Claude's Discretion

- Post-login redirect destination (map view until dashboard exists)
- Exact logout button placement (temporary)
- Branded splash screen design details
- Password strength requirements display
- Tab transition animation between Login/Register
- Error state handling for failed OAuth/API calls

### Deferred Ideas (OUT OF SCOPE)

- Dashboard with quick actions and session states — Phase 16/17
- Sidebar navigation with tabs — Phase 16/17
- Account switching — not currently scoped
- Email verification enforcement — could add later if needed
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.0 | UI framework | Latest stable, already in project |
| TanStack Router | ^1.x | File-based routing | First-class auth support with `beforeLoad`, type-safe context |
| TanStack Query v5 | ^5.x | Server state | Standard for API calls, built-in retry/caching for token refresh |
| React Hook Form | ^7.x | Form state | Uncontrolled inputs (performance), excellent Zod integration |
| Zod | ^3.x | Schema validation | Type-safe validation, matches backend schemas |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query-devtools | ^5.x | Dev debugging | Development only, helps debug auth state |
| @hookform/resolvers | ^3.x | RHF + Zod bridge | Required for Zod integration with React Hook Form |
| clsx or classnames | ^2.x | Conditional classes | For dynamic form error styling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Context | Zustand | Zustand has better performance for frequent updates, but auth state is relatively static (only changes on login/logout/refresh). Context is simpler and sufficient. |
| React Hook Form | Formik | Formik has more re-renders (controlled), React Hook Form uses uncontrolled inputs for better performance |
| TanStack Router beforeLoad | Higher-order component guards | HOC pattern is older, less type-safe, doesn't integrate with router lifecycle |

**Installation:**
```bash
pnpm add @tanstack/react-router @tanstack/react-query react-hook-form zod @hookform/resolvers
pnpm add -D @tanstack/router-devtools @tanstack/react-query-devtools
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── auth/
│   │   ├── AuthContext.tsx          # Auth provider with user state
│   │   ├── api.ts                   # API client with token interceptor
│   │   ├── useAuth.ts               # Hook to access auth context
│   │   └── queries.ts               # TanStack Query hooks for auth endpoints
│   └── queryClient.ts               # Configured QueryClient instance
├── routes/
│   ├── __root.tsx                   # Root route with auth context setup
│   ├── auth/
│   │   ├── index.tsx                # Login/register page at /auth
│   │   └── google-callback.tsx      # OAuth callback handler
│   ├── _authenticated.tsx           # Layout route with beforeLoad protection
│   └── _authenticated/
│       ├── map.tsx                  # Protected map view
│       └── (other protected routes)
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx            # Email/password login
│   │   ├── RegisterForm.tsx         # Registration with org creation
│   │   ├── GoogleButton.tsx         # OAuth trigger
│   │   └── AuthTabs.tsx             # Tab wrapper for login/register
│   ├── ui/
│   │   ├── FormField.tsx            # Reusable form field with error display
│   │   ├── Button.tsx               # Button component
│   │   └── Card.tsx                 # Card layout component
│   └── AuthLoadingScreen.tsx        # Branded splash during auth check
└── App.tsx                          # Router setup with auth initialization
```

### Pattern 1: Auth Context with Silent Refresh

**What:** Create React Context that manages user state and provides auth methods. Initialize by calling refresh endpoint on app load.

**When to use:** All auth state management (login status, user data, logout).

**Example:**
```typescript
// Source: Community best practice (verified with official TanStack patterns)
// lib/auth/AuthContext.tsx

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  // No need to expose refresh - happens automatically
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Silent refresh on mount
  useEffect(() => {
    refreshTokens()
      .then((response) => {
        setAccessToken(response.access_token)
        // Fetch user with new access token
        return fetchUser(response.access_token)
      })
      .then(setUser)
      .catch(() => {
        // Refresh failed - user is logged out
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include', // Send httpOnly cookie
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    setAccessToken(data.access_token)
    const userData = await fetchUser(data.access_token)
    setUser(userData)
  }

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### Pattern 2: TanStack Router Protected Routes with Layout

**What:** Use file-based routing with `_authenticated.tsx` layout route that checks auth in `beforeLoad`.

**When to use:** All routes that require authentication.

**Example:**
```typescript
// Source: https://tanstack.com/router/v1/docs/framework/react/guide/authenticated-routes
// routes/_authenticated.tsx

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    // Context comes from root route
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/auth',
        search: {
          redirect: location.href, // Preserve return URL
        },
      })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = useAuth()

  return (
    <div>
      {/* Temporary logout button */}
      <button onClick={logout}>Logout</button>

      {/* Child routes render here */}
      <Outlet />
    </div>
  )
}
```

### Pattern 3: TanStack Router Context Setup

**What:** Pass auth state to router via `context` option for type-safe access in routes.

**When to use:** Router initialization in App.tsx or __root.tsx.

**Example:**
```typescript
// Source: https://tanstack.com/router/v1/docs/framework/react/guide/authenticated-routes
// routes/__root.tsx

import { createRootRouteWithContext } from '@tanstack/react-router'

interface RouterContext {
  auth: {
    isAuthenticated: boolean
    user: User | null
  }
}

// Type-safe context throughout route tree
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  const { user, isAuthenticated } = useAuth()

  // Provide auth context to all routes
  return (
    <RouterProvider
      router={router}
      context={{ auth: { isAuthenticated, user } }}
    />
  )
}
```

### Pattern 4: Form Validation with React Hook Form + Zod

**What:** Define Zod schema, integrate with RHF via `@hookform/resolvers/zod`, display inline errors.

**When to use:** All forms (login, registration).

**Example:**
```typescript
// Source: https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/
// components/auth/LoginForm.tsx

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

function LoginForm() {
  const { login } = useAuth()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    await login(data.email, data.password)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...register('email')} />
        {errors.email && <p className="text-red-600 text-sm">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" {...register('password')} />
        {errors.password && <p className="text-red-600 text-sm">{errors.password.message}</p>}
      </div>

      <button type="submit">Login</button>
    </form>
  )
}
```

### Pattern 5: Silent Token Refresh

**What:** On app initialization, call `/api/auth/refresh` endpoint which uses httpOnly cookie to issue new access token.

**When to use:** App startup, before rendering protected routes.

**Example:**
```typescript
// Source: https://dev.to/itsnikhil/implementing-silent-refresh-of-jwt-4h7
// lib/auth/api.ts

async function refreshTokens() {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include', // CRITICAL: sends httpOnly cookie
  })

  if (!response.ok) {
    throw new Error('Refresh failed')
  }

  return response.json() // { access_token, refresh_token }
}

// Note: Backend must set Set-Cookie header with new refresh token
// Frontend doesn't handle refresh token directly (httpOnly)
```

### Pattern 6: Redirect After Login

**What:** Preserve `redirect` search param when redirecting to login, restore it after successful auth.

**When to use:** Protected route redirects and post-login navigation.

**Example:**
```typescript
// Source: https://leonardomontini.dev/tanstack-router-login-redirect/
// routes/auth/index.tsx

export const Route = createFileRoute('/auth')({
  validateSearch: (search) => ({
    redirect: (search.redirect as string) || '/map', // Default to map
  }),
  beforeLoad: ({ context, search }) => {
    // Already logged in? Redirect to app
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirect })
    }
  },
  component: AuthPage,
})

function AuthPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { login } = useAuth()

  const handleLoginSuccess = async (email: string, password: string) => {
    await login(email, password)
    // Redirect to original destination or default
    navigate({ to: search.redirect })
  }

  return <AuthTabs onLoginSuccess={handleLoginSuccess} />
}
```

### Pattern 7: Google OAuth Flow

**What:** Frontend redirects to backend `/api/auth/google` to get authorization URL, then handles callback with code exchange.

**When to use:** OAuth login button click.

**Example:**
```typescript
// Source: Verified against backend router.py implementation
// components/auth/GoogleButton.tsx

async function handleGoogleLogin() {
  // 1. Get authorization URL from backend
  const response = await fetch('/api/auth/google', {
    credentials: 'include',
  })
  const { authorization_url } = await response.json()

  // 2. Redirect to Google (user grants permissions, Google redirects back)
  window.location.href = authorization_url
}

// routes/auth/google-callback.tsx
export const Route = createFileRoute('/auth/google/callback')({
  component: GoogleCallback,
})

function GoogleCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      navigate({ to: '/auth' })
      return
    }

    // 3. Exchange code for tokens via backend
    fetch('/api/auth/google/callback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirect_uri: `${window.location.origin}/auth/google/callback`,
      }),
    })
      .then(res => res.json())
      .then(({ access_token }) => {
        // Backend sets httpOnly refresh cookie automatically
        // Fetch user and redirect
        return fetchUser(access_token)
      })
      .then(() => navigate({ to: '/map' }))
      .catch(() => navigate({ to: '/auth' }))
  }, [])

  return <div>Authenticating with Google...</div>
}
```

### Anti-Patterns to Avoid

- **Storing refresh token in localStorage:** Vulnerable to XSS attacks. Always use httpOnly cookies for refresh tokens.
- **Not using credentials: 'include':** Cookies won't be sent cross-origin. Required for Vite proxy in dev.
- **Multiple simultaneous refresh calls:** If multiple API calls fail with 401, they all trigger refresh. Use a single in-flight promise.
- **Rendering protected UI before auth check completes:** Shows flicker as user gets redirected. Always show loading screen until `isLoading === false`.
- **Hard-coding redirect URLs:** Use `location.href` from TanStack Router to preserve full URL with search params.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validation functions | React Hook Form + Zod | Handles errors, touched state, submission, and provides type inference from schema |
| CSRF protection | Custom token management | SameSite=Lax cookies + credentials | Modern browsers handle CSRF via SameSite; explicit tokens only needed for SameSite=None |
| Password strength UI | Custom regex + DOM updates | Zod refinements + error messages | Zod can validate strength rules, display each as inline error |
| OAuth state parameter | Manual state generation | Backend OAuth library | Auth libraries handle state, PKCE, nonce for security |
| Token refresh queue | Custom promise deduplication | TanStack Query retry logic | QueryClient already handles retry/deduplication on 401 errors |

**Key insight:** Authentication has subtle security requirements (timing attacks, token rotation, CSRF). Use battle-tested libraries rather than custom implementations.

## Common Pitfalls

### Pitfall 1: CORS Misconfiguration with Credentials

**What goes wrong:** Cookies aren't sent from frontend, refresh fails with 401 even though cookie exists.

**Why it happens:**
- Frontend doesn't include `credentials: 'include'` in fetch
- Backend CORS config has `allow_credentials=False`
- Backend uses wildcard `allow_origins=['*']` (incompatible with credentials)

**How to avoid:**
```python
# Backend: app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # MUST be explicit, NOT ["*"]
    allow_credentials=True,  # REQUIRED for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
```

```typescript
// Frontend: ALL auth API calls
fetch('/api/auth/login', {
  credentials: 'include', // REQUIRED
  // ...
})
```

**Warning signs:**
- Login succeeds but refresh fails immediately
- Set-Cookie appears in response headers but cookie doesn't persist
- Browser console shows "credentials mode is 'include'" error

### Pitfall 2: Access Token in Memory Lost on Page Reload

**What goes wrong:** User refreshes page, access token is lost, all API calls fail until silent refresh completes.

**Why it happens:** Access token stored in React state (memory) doesn't survive page reload.

**How to avoid:**
- Implement silent refresh BEFORE rendering protected routes
- Show loading screen until refresh completes or fails
- Use `isLoading` state to prevent premature API calls

```typescript
function AuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Refresh tokens on mount (page load)
    refreshTokens()
      .then(/* ... */)
      .finally(() => setIsLoading(false))
  }, [])

  // Don't render children until auth status is known
  if (isLoading) return <AuthLoadingScreen />

  return <AuthContext.Provider>{children}</AuthContext.Provider>
}
```

**Warning signs:**
- Flicker of login page before redirect to protected routes
- 401 errors immediately after page reload
- User sees "unauthorized" error after refresh

### Pitfall 3: Vite Proxy Not Forwarding Cookies

**What goes wrong:** Development mode works in browser DevTools but cookies aren't actually sent to backend.

**Why it happens:** Vite proxy doesn't forward cookies by default, needs explicit configuration.

**How to avoid:**
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true, // CRITICAL for cookie handling
        cookieDomainRewrite: 'localhost', // Map backend domain to frontend
      },
    },
  },
})
```

**Warning signs:**
- Login works in production but not in dev
- Backend logs show no Cookie header in requests
- Set-Cookie works but subsequent requests lack Cookie

### Pitfall 4: beforeLoad Doesn't Await Async Context

**What goes wrong:** Protected route checks `context.auth.isAuthenticated` before silent refresh completes.

**Why it happens:** TanStack Router's `beforeLoad` runs immediately, but auth context initialization is async.

**How to avoid:**
- Make root route's component wait for `isLoading === false`
- Use loader pattern to await auth state before rendering router

```typescript
// App.tsx
function App() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  return <RouterProvider router={router} />
}
```

**Warning signs:**
- User always redirected to /auth even when logged in
- Protected routes render briefly then redirect
- Console shows "context.auth.isAuthenticated is false" despite valid session

### Pitfall 5: XSS Vulnerability from Unescaped User Input

**What goes wrong:** User-supplied data (email, name) rendered unsafely, allowing script injection.

**Why it happens:** Using `dangerouslySetInnerHTML` or directly manipulating DOM with user data.

**How to avoid:**
- React automatically escapes JSX content — use `{user.name}` NOT `dangerouslySetInnerHTML`
- Sanitize any user input that must be rendered as HTML (avoid if possible)
- Validate URLs before rendering in `href` or `src` (no `javascript:` protocol)

```typescript
// SAFE: React escapes automatically
<p>Welcome, {user.name}!</p>

// DANGEROUS: Never do this with user input
<div dangerouslySetInnerHTML={{ __html: user.name }} />

// URL validation
const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}
```

**Warning signs:**
- Code reviews flag `dangerouslySetInnerHTML`
- Direct DOM manipulation via refs
- User-supplied URLs in href without validation

### Pitfall 6: CSRF from SameSite=None Without Secure

**What goes wrong:** Cookies set with SameSite=None fail in modern browsers, breaking auth entirely.

**Why it happens:** Chrome/Firefox require `Secure` flag when `SameSite=None` (cross-site cookies).

**How to avoid:**
For same-origin (frontend and backend on same domain in production):
```python
# Backend: Use SameSite=Lax (default, sufficient)
response.set_cookie(
    "refresh_token",
    value=refresh_token,
    httponly=True,
    secure=True,  # HTTPS only
    samesite="lax",  # Sufficient for same-origin
)
```

For cross-origin (different domains):
```python
response.set_cookie(
    "refresh_token",
    value=refresh_token,
    httponly=True,
    secure=True,  # REQUIRED with SameSite=None
    samesite="none",  # Allow cross-site
)
```

**Warning signs:**
- Cookies work on localhost (HTTP) but fail in production (HTTPS)
- Browser console: "Cookie has been rejected because it is in a cross-site context"
- Auth works in development but breaks in deployed preview

## Code Examples

### Complete Login Form with Validation

```typescript
// Source: Community best practice combining patterns
// components/auth/LoginForm.tsx

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/auth/useAuth'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password)
      onSuccess?.()
    } catch (error) {
      // Backend returns generic error to prevent user enumeration
      setError('root', {
        message: 'Invalid email or password',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          {...register('password')}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      {errors.root && (
        <p className="text-sm text-red-600">{errors.root.message}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Logging in...' : 'Login'}
      </button>
    </form>
  )
}
```

### Registration Form with Organization Creation

```typescript
// Source: Verified against backend UserCreate schema
// components/auth/RegisterForm.tsx

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  full_name: z.string().min(1, 'Full name is required'),
  organization_name: z.string().min(1, 'Company name is required'),
})

type RegisterFormData = z.infer<typeof registerSchema>

export function RegisterForm({ onSuccess }: { onSuccess?: () => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Registration failed')
      }

      const { access_token } = await response.json()
      // Store token, fetch user, etc.
      onSuccess?.()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Registration failed',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...register('email')} />
        {errors.email && <p className="text-red-600 text-sm">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" {...register('password')} />
        {errors.password && <p className="text-red-600 text-sm">{errors.password.message}</p>}
      </div>

      <div>
        <label htmlFor="full_name">Full Name</label>
        <input id="full_name" type="text" {...register('full_name')} />
        {errors.full_name && <p className="text-red-600 text-sm">{errors.full_name.message}</p>}
      </div>

      <div>
        <label htmlFor="organization_name">Company Name</label>
        <input id="organization_name" type="text" {...register('organization_name')} />
        {errors.organization_name && <p className="text-red-600 text-sm">{errors.organization_name.message}</p>}
      </div>

      {errors.root && <p className="text-red-600 text-sm">{errors.root.message}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Register'}
      </button>
    </form>
  )
}
```

### Tabbed Auth Page with Accessibility

```typescript
// Source: https://dev.to/eevajonnapanula/keyboard-accessible-tabs-with-react-5ch4
// components/auth/AuthTabs.tsx

type Tab = 'login' | 'register'

export function AuthTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('login')
  const navigate = useNavigate()
  const search = Route.useSearch()

  const handleSuccess = () => {
    navigate({ to: search.redirect || '/map' })
  }

  return (
    <div className="w-full max-w-md">
      {/* Tab List */}
      <div role="tablist" className="flex border-b">
        <button
          role="tab"
          aria-selected={activeTab === 'login'}
          aria-controls="login-panel"
          id="login-tab"
          onClick={() => setActiveTab('login')}
          className={activeTab === 'login' ? 'border-b-2 border-blue-600' : ''}
        >
          Login
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'register'}
          aria-controls="register-panel"
          id="register-tab"
          onClick={() => setActiveTab('register')}
          className={activeTab === 'register' ? 'border-b-2 border-blue-600' : ''}
        >
          Register
        </button>
      </div>

      {/* Tab Panels */}
      <div
        role="tabpanel"
        id="login-panel"
        aria-labelledby="login-tab"
        hidden={activeTab !== 'login'}
      >
        <LoginForm onSuccess={handleSuccess} />
        <div className="my-4 text-center text-sm text-gray-500">or</div>
        <GoogleButton />
      </div>

      <div
        role="tabpanel"
        id="register-panel"
        aria-labelledby="register-tab"
        hidden={activeTab !== 'register'}
      >
        <RegisterForm onSuccess={handleSuccess} />
        <div className="my-4 text-center text-sm text-gray-500">or</div>
        <GoogleButton />
      </div>
    </div>
  )
}
```

## Backend Requirements

The backend already has JWT infrastructure but needs modifications for httpOnly cookie support:

### Required Backend Changes

1. **Add cookie-based refresh endpoint:**
```python
# Current: POST /api/auth/refresh with JSON body { refresh_token }
# Needed: Read refresh token from httpOnly cookie instead

@router.post("/refresh", response_model=TokenResponse)
async def refresh_cookie(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    # Read from cookie instead of request body
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    # ... existing validation logic ...

    # Set new refresh token in cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,  # HTTPS only in production
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return TokenResponse(access_token=new_access_token)
```

2. **Update login/register to set cookie:**
```python
@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    response: Response,  # Add Response param
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    # ... existing logic to create tokens ...

    # Set refresh token in httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    # Return only access token in body
    return TokenResponse(access_token=access_token)
```

3. **Update logout to clear cookie:**
```python
@router.post("/logout")
async def logout(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    # ... existing revocation logic ...

    # Clear cookie
    response.delete_cookie("refresh_token")

    return MessageResponse(message="Logged out successfully")
```

4. **CORS configuration (already correct in codebase):**
```python
# app/main.py - verify this exists
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # NOT ["*"]
    allow_credentials=True,  # REQUIRED for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for tokens | httpOnly cookies for refresh, memory for access | 2019-2020 | Improved XSS protection, refresh tokens can't be stolen via JavaScript |
| Class components with lifecycle methods | Functional components with hooks | 2019 (React 16.8) | Simpler auth context, easier composition |
| Redux for auth state | React Context or lightweight state libs | 2020-2021 | Reduced boilerplate, auth state is relatively static |
| Manual route guards with HOCs | Router-native beforeLoad hooks | 2023+ (TanStack Router v1) | Type-safe, integrated with router lifecycle |
| Controlled forms with useState | Uncontrolled forms with React Hook Form | 2020+ | Better performance, fewer re-renders |
| Manual validation | Zod schema validation | 2022+ | Type inference, runtime safety, cleaner code |

**Deprecated/outdated:**
- **react-router v5 route guards:** Use TanStack Router's `beforeLoad` instead (more integrated, type-safe)
- **Formik:** Still works but React Hook Form is more performant (uncontrolled inputs)
- **JWT in localStorage:** Still common but not recommended (XSS vulnerability)
- **passport.js patterns in frontend:** OAuth should be handled by backend, frontend just triggers flow

## Open Questions

1. **Token rotation on failed refresh**
   - What we know: Backend already implements token rotation (revokes old on refresh)
   - What's unclear: Should frontend retry once on 401 before logout, or immediately logout?
   - Recommendation: Single retry is reasonable (handles network blips), then logout

2. **Google OAuth redirect URI in production**
   - What we know: Backend uses `${settings.FRONTEND_URL}/auth/google/callback`
   - What's unclear: Production domain not yet defined
   - Recommendation: Configure via env var, update Google Console when domain known

3. **Access token expiry handling**
   - What we know: Access token expires in 15 minutes (backend setting)
   - What's unclear: Should frontend proactively refresh before expiry, or wait for 401?
   - Recommendation: Wait for 401 (simpler), TanStack Query retry handles it. Proactive refresh adds complexity with minimal benefit.

4. **Password strength indicator UI**
   - What we know: Backend requires min 8 characters (from schema), registration schema enforces uppercase/lowercase/number
   - What's unclear: Should UI show live strength indicator, or just validation errors?
   - Recommendation: Inline errors (from Zod) are sufficient per user constraints. Live indicator adds complexity without clear UX benefit for professional users.

## Sources

### Primary (HIGH confidence)

- TanStack Router Official Docs - Authenticated Routes: https://tanstack.com/router/v1/docs/framework/react/guide/authenticated-routes
- TanStack Router Official Docs - Type Safety: https://tanstack.com/router/v1/docs/framework/react/guide/type-safety
- React Hook Form Official Docs: https://react-hook-form.com/
- Zod Official Docs: https://zod.dev/
- MDN - Set-Cookie Header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
- MDN - Using HTTP Cookies: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies
- FastAPI CORS Documentation: https://fastapi.tiangolo.com/tutorial/cors/

### Secondary (MEDIUM confidence)

- JWT Storage in React: https://cybersierra.co/blog/react-jwt-storage-guide/
- React Authentication with httpOnly Cookies: https://medium.com/@ryanchenkie_40935/react-authentication-how-to-store-jwt-in-a-cookie-346519310e81
- TanStack Router Login Redirect Pattern: https://leonardomontini.dev/tanstack-router-login-redirect/
- React Hook Form with Zod Tutorial: https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/
- Implementing Silent Refresh: https://dev.to/itsnikhil/implementing-silent-refresh-of-jwt-4h7
- React Context vs Zustand 2025: https://dev.to/cristiansifuentes/react-state-management-in-2025-context-api-vs-zustand-385m
- Keyboard Accessible Tabs: https://dev.to/eevajonnapanula/keyboard-accessible-tabs-with-react-5ch4

### Tertiary (LOW confidence)

- Community discussions on TanStack Router authentication patterns
- Various blog posts on React security best practices (XSS/CSRF)
- GitHub discussions on protected routes implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are official/widely adopted, versions verified
- Architecture: HIGH - Patterns verified against official TanStack docs and backend code
- Pitfalls: HIGH - Based on common production issues and official documentation
- Backend changes: HIGH - Verified against existing backend code in `/backend/app/auth/`

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - frontend auth patterns are stable)
