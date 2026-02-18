# Phase 35: Settings Page - Research

**Researched:** 2026-02-18
**Domain:** Settings page — account management, notification prefs, appearance (frontend-heavy, backend CRUD)
**Confidence:** HIGH

---

## Summary

Phase 35 replaces the `/instellingen` placeholder (currently "Binnenkort beschikbaar") with a full settings page structured into three sections: account management (name, email, password change), notification preferences (email alerts for change monitoring), and appearance settings (theme selection and map style preferences).

The frontend stack is well-established: TanStack Router file routes, TanStack Query for server state, react-hook-form + zod for form validation, the Industrial Amber design system (`bg-grey-950/900/850`, `text-grey-100/400`, `border-grey-800`, `teal-accent` focus rings, `amber-accent` primary actions), and `sonner` for toast notifications. No new frontend libraries are needed — the existing primitives (Button, Input, Select, Card, FormField) cover all requirements.

The backend requires a new `/api/users/me` PATCH endpoint for profile updates (name, email) and a separate `/api/users/me/password` PUT endpoint for password change (current password verification + Argon2id re-hash). A new `user_preferences` database table (or JSONB column on users) is needed to persist notification and appearance preferences across devices. The auth pattern (Bearer token, `get_current_active_user` dependency) is fully established.

**Primary recommendation:** Use a tabbed/sectioned layout inside `ResultsShell`, with react-hook-form for all three form sections, TanStack Query mutations for updates, and a `user_preferences` JSONB column on the `users` table (simplest approach, avoids a new migration table).

---

## Standard Stack

### Core (already installed — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.71.1 | Form state, validation, dirty tracking | Already in use (FormField component wraps it) |
| zod | ^4.3.6 | Schema validation for form data | Already in use with @hookform/resolvers |
| @hookform/resolvers | ^5.2.2 | Connects zod to react-hook-form | Already in use |
| @tanstack/react-query | ^5.90.20 | Server state, mutations, cache invalidation | Project standard for all API hooks |
| sonner | ^2.0.7 | Toast notifications for save success/error | Already used throughout (see ProjectEditModal) |
| lucide-react | ^0.564.0 | Icons (Settings, User, Bell, Palette, Key, Eye, EyeOff) | Project standard |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Password confirmation matching, email validation | Form schema (confirmPassword `.refine()`) |
| class-variance-authority | ^0.7.1 | Button/input variant props | Used in Button primitive |
| react-focus-lock | ^2.13.7 | Focus trapping | If using modal dialogs (not needed for page layout) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB on users table | Separate `user_preferences` table | Table is cleaner if prefs grow; JSONB is faster and avoids Alembic migration complexity for simple prefs |
| JSONB on users table | localStorage only | localStorage doesn't sync across devices; success criteria requires cross-device sync |
| Section tabs | Accordion sections | Tabs match the "Account / Notifications / Appearance" three-section structure better; simpler DOM |

**Installation:** No new packages required — all dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── routes/_authenticated/
│   └── instellingen.tsx          # Replace placeholder with SettingsPage
├── components/settings/
│   ├── AccountSection.tsx         # Name + email form
│   ├── PasswordSection.tsx        # Current + new + confirm password form
│   ├── NotificationsSection.tsx   # Email alert toggles
│   └── AppearanceSection.tsx      # Theme + map style selects
├── hooks/
│   └── useSettings.ts             # TanStack Query hooks for settings CRUD
└── lib/
    └── types/
        └── settings.ts            # TypeScript types for UserPreferences

backend/app/
├── users/
│   ├── __init__.py
│   └── router.py                  # PATCH /api/users/me, PUT /api/users/me/password,
│                                  # GET/PATCH /api/users/me/preferences
├── schemas/
│   └── user.py                    # UserUpdate, PasswordChange, UserPreferences schemas
└── models/
    └── user.py                    # Add preferences: Mapped[dict] JSONB column
```

### Pattern 1: Sectioned Settings Page Layout

**What:** Single route renders all settings in vertical sections separated by dividers. No tabs — sections scroll naturally in `ResultsShell`.
**When to use:** Three discrete sections with independent save actions per section (not one giant form).
**Example:**

```tsx
// routes/_authenticated/instellingen.tsx
import { createFileRoute } from '@tanstack/react-router'
import ResultsShell from '@/components/layout/ResultsShell'
import AccountSection from '@/components/settings/AccountSection'
import PasswordSection from '@/components/settings/PasswordSection'
import NotificationsSection from '@/components/settings/NotificationsSection'
import AppearanceSection from '@/components/settings/AppearanceSection'

export const Route = createFileRoute('/_authenticated/instellingen')({
  component: InstellingenPage,
})

function InstellingenPage() {
  return (
    <ResultsShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-grey-100">Instellingen</h1>
        <p className="mt-1 text-grey-400">Beheer je account en voorkeuren</p>
      </div>
      <div className="space-y-8 max-w-2xl">
        <AccountSection />
        <div className="border-t border-grey-800" />
        <PasswordSection />
        <div className="border-t border-grey-800" />
        <NotificationsSection />
        <div className="border-t border-grey-800" />
        <AppearanceSection />
      </div>
    </ResultsShell>
  )
}
```

### Pattern 2: react-hook-form with Zod in a Section

**What:** Each settings section is an isolated form with its own `useForm`, dirty tracking, and mutation.
**When to use:** Independent save per section — no "Save All" pattern.
**Example:**

```tsx
// components/settings/AccountSection.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { useUpdateProfile } from '@/hooks/useSettings'
import { useAuth } from '@/lib/auth/useAuth'
import { toast } from 'sonner'

const accountSchema = z.object({
  full_name: z.string().min(1, 'Naam is verplicht').max(255),
  email: z.string().email('Ongeldig e-mailadres'),
})

type AccountFormData = z.infer<typeof accountSchema>

export default function AccountSection() {
  const { user } = useAuth()
  const updateProfile = useUpdateProfile()

  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } =
    useForm<AccountFormData>({
      resolver: zodResolver(accountSchema),
      defaultValues: {
        full_name: user?.full_name ?? '',
        email: user?.email ?? '',
      },
    })

  const onSubmit = async (data: AccountFormData) => {
    await updateProfile.mutateAsync(data, {
      onSuccess: () => toast.success('Profiel opgeslagen'),
      onError: (err) => toast.error(err.message || 'Fout bij opslaan'),
    })
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-grey-100 mb-4">Account</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name and email fields using Input primitive */}
        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>
      </form>
    </section>
  )
}
```

### Pattern 3: Password Change Form (Argon2id / pwdlib)

**What:** Separate form requiring current password + new password + confirmation. Backend verifies current password before hashing new one.
**When to use:** Password change — MUST require current password for security. OAuth users (no `hashed_password`) get this section hidden/disabled.
**Example backend:**

```python
# backend/app/users/router.py
@router.put("/api/users/me/password", response_model=MessageResponse)
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    # Block OAuth users from setting password via this endpoint
    if current_user.auth_provider != "email":
        raise HTTPException(400, "OAuth users cannot change password here")
    # Verify current password
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(400, "Huidig wachtwoord onjuist")
    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return MessageResponse(message="Wachtwoord gewijzigd")
```

### Pattern 4: User Preferences — JSONB column on users table

**What:** Add a `preferences` JSONB column to the `users` table. Fetched via GET `/api/users/me/preferences`, saved via PATCH. No separate table migration.
**When to use:** Small, bounded preference set that doesn't need its own queryable index.
**Example model addition:**

```python
# backend/app/models/user.py — add field to User:
from sqlalchemy import JSON

preferences: Mapped[dict] = mapped_column(
    JSON,
    nullable=False,
    server_default=text("'{}'::jsonb"),
    comment="User preferences: notification_email_alerts, map_style",
)
```

**Preference schema (validated in Pydantic):**

```python
class UserPreferences(BaseModel):
    notification_email_alerts: bool = True   # email alerts for change monitoring
    map_style: str = "satellite"             # "satellite" | "light"
```

### Pattern 5: Appearance Settings — Map Style

**What:** The map currently hardcodes `CARTO_LIGHT_TILES` + `ESRI_SATELLITE_TILES` in `MapView.tsx`. The `carto-light-layer` has its own opacity. A map style preference would select which base layer is foregrounded.
**When to use:** User selects "Satelliet" or "Licht" map style preference.
**Implementation note (IMPORTANT):** The `MapView` is always mounted (never unmounts — from Phase 28). Changing base layer requires `map.setPaintProperty()` or swapping layer visibility, NOT reinitializing the map. This is a runtime operation on the existing map instance via `mapRef`.

### Anti-Patterns to Avoid

- **One giant form for all settings:** Don't combine account + password + notifications + appearance into a single form. Each section saves independently.
- **Reinitializing MapView for style changes:** The map is permanently mounted in `_authenticated.tsx`. Never trigger a map re-init. Use `mapRef.current.setPaintProperty()` or layer visibility toggle.
- **Email change without re-verification:** Changing email should send a new verification email (or at least flag `email_verified = False`). The backend already has `send_verification_email` + `create_email_verification_token` infrastructure.
- **Storing preferences in localStorage only:** Success criteria requires cross-device persistence. localStorage alone doesn't satisfy this.
- **White/light modal theme for forms:** The `ProjectEditModal` uses white theme — this is inconsistent with the design system. Settings sections should use dark Industrial Amber tokens (`bg-grey-900`, `border-grey-800`) matching `ResultsShell`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form dirty-state tracking | Custom change detection | react-hook-form `isDirty` | Handles defaultValues comparison automatically |
| Password confirm matching | Custom comparison logic | zod `.refine()` cross-field validation | Built-in, type-safe |
| Email format validation | Custom regex | zod `z.string().email()` | RFC-compliant |
| Password hashing | Custom bcrypt/SHA | `hash_password()` / `verify_password()` from `app.auth.password` | pwdlib + Argon2id already available |
| Toast notifications | Custom alert UI | `sonner` `toast.success()` / `toast.error()` | Already wired in project |
| Toggle switches | Custom checkbox styling | Native `<input type="checkbox">` with Tailwind | No UI library needed for simple toggles |

**Key insight:** Every utility needed already exists in the codebase. This phase is pure composition of existing patterns.

---

## Common Pitfalls

### Pitfall 1: Email Change Without Re-verification
**What goes wrong:** User changes email, backend updates it, but `email_verified` stays `true`. The new email is unverified.
**Why it happens:** Simple PATCH overwrites email without resetting verification state.
**How to avoid:** When email changes, set `email_verified = False`, `email_verified_at = None`, and send a new verification email via `send_verification_email` background task. The auth middleware already enforces the 48h grace period.
**Warning signs:** Backend test for `email_verified` state after email update.

### Pitfall 2: OAuth Users Seeing Password Change Form
**What goes wrong:** Google OAuth users (`auth_provider = "google"`, `hashed_password = None`) see and submit the password change form. `verify_password()` returns `False` for `None` hashed password.
**Why it happens:** Form rendered unconditionally.
**How to avoid:** Check `user.auth_provider === 'email'` in the `PasswordSection` component. Show "Password set via Google — change in Google account" for OAuth users. Backend also blocks with 400 as defense-in-depth.
**Warning signs:** `auth_provider` field is available on `User` type from `useAuth()`.

### Pitfall 3: Map Style Change Triggers Map Reinit
**What goes wrong:** Saving map style preference causes MapView to remount, destroying all loaded tiles and layer state (scan results, bestemmingsplan layer, parcel highlights).
**Why it happens:** Map style preference stored in state that MapView depends on, passed as `style` prop.
**How to avoid:** Store `map_style` preference in user preferences (backend). Apply style change imperatively via `mapRef.current` after map is ready. Never change the `style` prop of MapView (it's created once in `useEffect`). Use `map.setPaintProperty('carto-light-layer', 'raster-opacity', ...)` or `map.setLayoutProperty(layerId, 'visibility', ...)`.

### Pitfall 4: Stale User Context After Profile Update
**What goes wrong:** User updates name/email successfully, but the `user` object from `useAuth()` still shows the old values. The SideRailNav (if it displays user info) doesn't update.
**Why it happens:** `AuthContext` sets user once from `/api/auth/me` on login/refresh. Profile PATCH updates the DB but not `AuthContext.user`.
**How to avoid:** After a successful profile PATCH, call `fetchUserApi(accessToken)` and update `AuthContext` user state, OR expose an `updateUser` function from `AuthContext`. The simplest approach: add an `updateUser(user: User) => void` to `AuthContextValue` and `AuthProvider`.

### Pitfall 5: Preferences Not Loaded Before Form Renders
**What goes wrong:** AppearanceSection renders with default values before preferences are fetched from backend. User sees "Satelliet" selected even if they saved "Licht", then the select updates — jarring.
**Why it happens:** TanStack Query async data not awaited before form defaultValues.
**How to avoid:** Use `useForm` with `defaultValues` from the query result. Pass them via `reset()` in a `useEffect` when `data` arrives, OR use `enabled` state to not render the form until preferences load. Show `Skeleton` component while loading.

### Pitfall 6: Password Section Leaking Current Password to TanStack Query Cache
**What goes wrong:** Password change form data (including current + new password) gets stored in a query cache key.
**Why it happens:** Using `useQuery` for form submission instead of `useMutation`.
**How to avoid:** Password change MUST use `useMutation`, never `useQuery`. Clear form on success. Do not log or cache form values.

---

## Code Examples

### TanStack Query Hook for Settings

```typescript
// hooks/useSettings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type { UserPreferences, UserProfileUpdate } from '@/lib/types/settings'

const USERS_BASE = '/api/users'

export function useUserPreferences() {
  const { accessToken } = useAuth()
  return useQuery<UserPreferences, Error>({
    queryKey: ['user', 'preferences'],
    queryFn: () => apiFetch<UserPreferences>(`${USERS_BASE}/me/preferences`, {
      accessToken,
      method: 'GET',
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!accessToken,
  })
}

export function useUpdatePreferences() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation<UserPreferences, Error, Partial<UserPreferences>>({
    mutationFn: (data) => apiFetch<UserPreferences>(`${USERS_BASE}/me/preferences`, {
      accessToken,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: (data) => {
      queryClient.setQueryData(['user', 'preferences'], data)
    },
  })
}

export function useUpdateProfile() {
  const { accessToken } = useAuth()
  return useMutation<void, Error, UserProfileUpdate>({
    mutationFn: (data) => apiFetch(`${USERS_BASE}/me`, {
      accessToken,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  })
}

export function useChangePassword() {
  const { accessToken } = useAuth()
  return useMutation<void, Error, { current_password: string; new_password: string }>({
    mutationFn: (data) => apiFetch(`${USERS_BASE}/me/password`, {
      accessToken,
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  })
}
```

### Backend Router Pattern (new users router)

```python
# backend/app/users/router.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import get_current_active_user
from app.auth.password import hash_password, verify_password
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/api/users", tags=["users"])

@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: UserProfileUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.email is not None and data.email != current_user.email:
        # Email change: reset verification state
        current_user.email = data.email
        current_user.email_verified = False
        current_user.email_verified_at = None
        token = create_email_verification_token(str(current_user.id), data.email)
        background_tasks.add_task(send_verification_email, data.email, token)
    await db.commit()
    return UserResponse.model_validate(current_user)

@router.put("/me/password", response_model=MessageResponse)
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    if current_user.auth_provider != "email":
        raise HTTPException(400, "Gebruik Google-account om wachtwoord te wijzigen")
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(400, "Huidig wachtwoord onjuist")
    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return MessageResponse(message="Wachtwoord gewijzigd")

@router.get("/me/preferences", response_model=UserPreferences)
async def get_preferences(
    current_user: User = Depends(get_current_active_user),
) -> UserPreferences:
    prefs = current_user.preferences or {}
    return UserPreferences(**prefs)

@router.patch("/me/preferences", response_model=UserPreferences)
async def update_preferences(
    data: UserPreferencesUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferences:
    current_prefs = current_user.preferences or {}
    update_data = data.model_dump(exclude_unset=True)
    current_user.preferences = {**current_prefs, **update_data}
    await db.commit()
    return UserPreferences(**current_user.preferences)
```

### Password Form Zod Schema (Frontend)

```typescript
// Zod schema for password change form
const passwordSchema = z.object({
  current_password: z.string().min(1, 'Vul het huidige wachtwoord in'),
  new_password: z.string().min(8, 'Minimaal 8 tekens'),
  confirm_password: z.string().min(1, 'Bevestig het wachtwoord'),
}).refine(
  (data) => data.new_password === data.confirm_password,
  { message: 'Wachtwoorden komen niet overeen', path: ['confirm_password'] }
)
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Separate settings table per preference type | JSONB column on users table | Simpler schema, one migration, no joins |
| One settings form (save all) | Per-section forms with independent save | Better UX — no accidental overwrites |
| Password reset via email only | In-page password change (requires current) | Better UX for known-password change |

**Deprecated/outdated:**
- The `FormField` component uses old CSS variable tokens (`--color-text`, `--color-border`) that don't exist in the Tailwind v4 `@theme` block. This is a pre-migration artifact. Settings forms should use the `Input` primitive instead of `FormField` — `Input` uses the correct `grey-*` tokens.

---

## Open Questions

1. **Email uniqueness enforcement during email change**
   - What we know: `email` is `unique=True` globally on the users table. The `/auth/register` check uses `func.lower(User.email)` comparison.
   - What's unclear: The `update_profile` endpoint needs to check for email conflicts before updating, or catch the DB unique constraint violation gracefully.
   - Recommendation: Add an explicit uniqueness check in `update_profile` (same pattern as in `/auth/register`) before updating, returning HTTP 400 "E-mailadres al in gebruik" rather than letting the DB constraint fire a 500.

2. **Map style preference application scope**
   - What we know: `MapView` initializes once, `mapRef` is accessible from `_authenticated.tsx` and via `MapContext`.
   - What's unclear: Whether map style change should apply immediately when preference is saved, or only on next map visit.
   - Recommendation: Apply immediately via `mapRef.current.setLayoutProperty()` for a responsive UX. The `AppearanceSection` can access the `MapContext` to get `mapRef`.

3. **`AuthContext.user` update after profile PATCH**
   - What we know: `AuthContextValue` currently has no `updateUser` method. `user` is set from `fetchUserApi` on login/refresh.
   - What's unclear: Whether to add `updateUser` to AuthContext or re-fetch `/api/auth/me` after profile save.
   - Recommendation: Add `updateUser: (user: User) => void` to `AuthContextValue` and `AuthProvider`. This avoids an unnecessary API round-trip.

4. **Notification preferences scope**
   - What we know: Change monitoring (Phase 26) already has backend infrastructure. The `notification_email_alerts` preference is the only mentioned notification setting.
   - What's unclear: Whether the backend change monitoring worker currently sends emails (or only stores changes in DB). If no email sending exists yet, the toggle becomes a "future" preference.
   - Recommendation: Implement the preference toggle regardless. The backend can respect it when email sending is implemented. Store in `user.preferences` JSONB from day one.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `frontend/src/components/primitives/` (Button, Input, Select, Card)
- Codebase direct read — `frontend/src/components/ui/FormField.tsx`, `Modal.tsx`
- Codebase direct read — `frontend/src/hooks/useProjects.ts` (TanStack Query mutation pattern)
- Codebase direct read — `frontend/src/lib/auth/AuthContext.tsx`, `types.ts`, `api.ts`
- Codebase direct read — `backend/app/auth/router.py`, `password.py`, `schemas.py`
- Codebase direct read — `backend/app/models/user.py`, `base.py`, `organization.py`
- Codebase direct read — `frontend/src/styles/index.css` (Tailwind v4 `@theme` tokens)
- Codebase direct read — `frontend/src/components/map/MapView.tsx`, `lib/pdok.ts`

### Secondary (MEDIUM confidence)
- Codebase direct read — `frontend/src/routes/_authenticated/instellingen.tsx` (placeholder)
- Codebase direct read — `frontend/src/components/layout/SideRailNav.tsx` (Settings nav link confirmed)
- Codebase direct read — `frontend/src/routes/_authenticated.tsx` (MapContext + MapView always-mounted pattern)

---

## Key Findings Summary

1. **Zero new npm packages needed** — react-hook-form, zod, @hookform/resolvers, TanStack Query, sonner, lucide-react all already installed.

2. **The `FormField` component uses stale CSS variables** (`--color-text`, `--color-border`) from before the Tailwind v4 migration. Settings forms MUST use the `Input` primitive (`border-grey-800`, `text-grey-100`, `focus-visible:ring-teal-accent`) not `FormField`.

3. **SideRailNav already links to `/instellingen`** — navigation is wired. BottomTabNav does NOT include a settings link on mobile; this should be added for the mobile case.

4. **MapView MUST NOT be re-initialized for style changes** — it's permanently mounted. Apply style changes via `mapRef.current` imperatively.

5. **Backend needs a new `users` router** — currently `/api/auth/me` only supports GET. Profile PATCH and password PUT go in a new `/api/users/` module following the same pattern as `projects/router.py`.

6. **JSONB `preferences` column on `users` table** — cleanest approach for persisting small, bounded preferences. Requires one Alembic migration. Default: `'{}'::jsonb` (server-side).

7. **Email change requires re-verification** — infrastructure exists (`send_verification_email`, `create_email_verification_token`). Set `email_verified = False` on email change.

8. **OAuth users have no password** — `auth_provider = "google"`, `hashed_password = None`. `PasswordSection` must check `user.auth_provider` and hide/disable accordingly.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified from package.json and existing component code
- Architecture: HIGH — established patterns from projects/monitoring/auth routers + hooks
- Pitfalls: HIGH — verified from actual model fields (auth_provider, hashed_password, email_verified), MapView mounting strategy, AuthContext structure
- Open questions: MEDIUM — implementation decisions, not blockers

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (stable dependencies, 30-day window)
