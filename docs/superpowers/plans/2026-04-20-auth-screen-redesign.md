# Auth Screen Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-card auth page with a two-panel layout (dark pitch left, form right) matching the Aura design system.

**Architecture:** Pure frontend rewrite of `frontend/src/routes/auth/index.tsx`. Existing auth logic (`useAuth`, `LoginForm`, `RegisterForm`, `GoogleButton`) is re-used as-is. One copy tweak in `AuthTabs` ("Register" → "Registreren"). Demo login handler moves from a floating pill outside the card to an inline text link inside `AuthTabs` below the Google button.

**Tech Stack:** React 18, TanStack Router file routes, Tailwind v4 with Aura tokens, Framer Motion (already present for tab switcher), Plus Jakarta Sans (already loaded globally). Propdex logo: `frontend/public/favicon.svg`.

**Reference spec:** `docs/superpowers/specs/2026-04-20-auth-screen-redesign-design.md`

**Reference mockup:** `.superpowers/brainstorm/956747-1776671510/content/auth-locked.html` (local only)

**Testing approach:** This is a visual redesign with no new business logic. TDD unit tests don't fit. Verification = typecheck passes + manual visual + functional smoke (demo login, tabs switch, log-in submits, Google button opens OAuth flow).

---

## File Structure

- **Modify** `frontend/src/routes/auth/index.tsx` — replace the page composition. Current ~99 lines → new ~150 lines. Still under 300-line CLAUDE.md ceiling.
- **Modify** `frontend/src/components/auth/AuthTabs.tsx` — accept an `onDemoLogin` + `demoLoading` + `demoError` prop, render an inline text link below `<GoogleButton />`, change "Register" label to "Registreren".
- **No new files.** No renames. No deletions.

Why a single file change plus a small prop addition: the page composition (layout, pitch, legal) is route-specific. The demo-login affordance belongs inside the tab card because it's context (auth options) that only makes sense next to the form. Everything else is already componentised and reusable.

---

## Task 1: Scaffold two-panel layout with existing form card

Goal: replace the centered-card layout with the left dark panel + right form side, keeping the existing `AuthTabs` card in place on the right. Demo pill still at old position — next task moves it. This ensures the page keeps working at every step.

**Files:**
- Modify: `frontend/src/routes/auth/index.tsx`

- [ ] **Step 1: Replace the page body with two-panel structure**

Replace the current `AuthPage` body (everything inside the `return (...)` block) with this:

```tsx
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1a1c1e] p-5">
      <div className="flex w-full h-full overflow-hidden rounded-[18px] shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        {/* LEFT · dark pitch panel */}
        <div
          className="relative flex-[1.1] flex flex-col justify-between overflow-hidden bg-[#0E1111] text-white px-16 py-14"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <div
            className="absolute w-[460px] h-[460px] rounded-full pointer-events-none"
            style={{ background: 'rgba(249,168,38,0.08)', filter: 'blur(120px)', top: '-100px', left: '-80px' }}
          />
          {/* Brand, mid, legal go here in later tasks */}
        </div>

        {/* RIGHT · form panel */}
        <div className="flex-1 flex items-center justify-center bg-aura-canvas px-12">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white border border-[#EAEFEF] p-10 shadow-[0_12px_40px_rgba(14,17,17,0.08)] flex flex-col gap-[18px]">
            <div>
              <h2
                className="text-[26px] font-black tracking-tight text-[#0E1111] leading-tight mb-1.5"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Welkom terug.
              </h2>
              <p className="text-[13px] text-[#6b7680] leading-snug">
                Log in met je e-mailadres om verder te gaan.
              </p>
            </div>
            <AuthTabs
              onLogin={login}
              onRegister={register}
              onLoginSuccess={handleSuccess}
              onRegisterSuccess={handleSuccess}
            />
          </div>
        </div>
      </div>

      {/* Demo pill — stays here for now, removed in Task 3 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={demoLoading}
          className="inline-flex items-center gap-2 rounded-full border border-[#EAEFEF] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#0E1111] hover:bg-[#F2F6F3] disabled:opacity-50 transition-colors"
        >
          <Sparkles size={14} className="text-[#F9A826]" />
          {demoLoading ? 'Bezig met inloggen…' : 'Probeer de demo'}
        </button>
        {demoError && (
          <p role="alert" className="text-[12px] text-red-500">
            {demoError}
          </p>
        )}
      </div>
    </div>
  )
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd frontend && npm run check`
Expected: no new TypeScript errors. Any pre-existing errors unchanged.

- [ ] **Step 3: Start dev server and visually inspect**

Run: `cd frontend && npm run dev` (if not already running on 9300)
Navigate to: `http://localhost:9300/auth`
Expected:
- Two panels visible, dark panel on left (empty except amber glow blob), form card on right
- Form still fully functional: Log in / Register tabs switch, fields accept input
- Demo pill visible at bottom-center
- No console errors
- No scroll on the page

- [ ] **Step 4: Commit**

```bash
cd /home/klarifai/Documents/klarifai/clientprojects/propdex
git add frontend/src/routes/auth/index.tsx
git commit -m "$(cat <<'EOF'
auth: scaffold two-panel layout (dark pitch left, form right)

Form keeps working — pitch content and legal footer added in next tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fill the dark pitch panel (brand + eyebrow + H1 + sub + legal footer)

Goal: add Propdex brand, pitch copy (vertically centered), and legal footer to the dark panel.

**Files:**
- Modify: `frontend/src/routes/auth/index.tsx`

- [ ] **Step 1: Replace the dark panel's inner content**

Inside the dark panel `<div>` (after the glow blob div, where the comment says "Brand, mid, legal go here"), add:

```tsx
          {/* Brand */}
          <div className="relative z-[3] flex items-center gap-3.5">
            <img src="/images/propdex-logo.svg" alt="Propdex" className="w-[38px] h-[38px] rounded-[10px]" />
            <span className="font-black text-[20px] tracking-tight">Propdex</span>
          </div>

          {/* Pitch — vertically centered */}
          <div className="relative z-[3] max-w-[500px] my-auto">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/65 mb-[22px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F9A826]" />
              Voor ontwikkelaars &amp; kwaliteitsborgers
            </div>
            <h1 className="text-[46px] font-black leading-[1.03] tracking-[-0.042em] mb-5">
              Van grondpositie tot go/no-go in één platform.
            </h1>
            <p className="text-[16px] text-white/65 leading-[1.5] max-w-[420px]">
              Weet in twee minuten of een grondpositie de moeite waard is.
            </p>
          </div>

          {/* Legal footer */}
          <div className="relative z-[3] flex items-center gap-3.5 text-[12px] text-white/[0.38]">
            <span>© 2026 Propdex</span>
            <span className="text-white/20">·</span>
            <a href="#" className="text-white/55 hover:text-[#F9A826] transition-colors no-underline">
              Privacybeleid
            </a>
            <span className="text-white/20">·</span>
            <a href="#" className="text-white/55 hover:text-[#F9A826] transition-colors no-underline">
              Algemene voorwaarden
            </a>
            <span className="text-white/20">·</span>
            <a href="#" className="text-white/55 hover:text-[#F9A826] transition-colors no-underline">
              Contact
            </a>
          </div>
```

Note on `my-auto` + `justify-between`: Tailwind's `my-auto` on the middle child combined with `justify-between` on the flex parent centers the middle child vertically while brand stays at top and legal stays at bottom. This is a Tailwind arbitrary-margin idiom that maps to `margin-top:auto; margin-bottom:auto` and works predictably with `justify-content: space-between`.

- [ ] **Step 2: Verify typecheck passes**

Run: `cd frontend && npm run check`
Expected: no new errors.

- [ ] **Step 3: Visual check in dev server**

Navigate to: `http://localhost:9300/auth`
Expected:
- Dark panel shows: Propdex logo + wordmark top-left, pitch text block vertically centered (eyebrow + H1 + sub), legal footer bottom-left
- H1 "Van grondpositie tot go/no-go in één platform." wraps to 3–4 lines within 500px
- Legal links hover from white/55 → amber `#F9A826`
- Text still visible over the amber glow blob (glow stays in background via z-[3] on content)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/auth/index.tsx
git commit -m "$(cat <<'EOF'
auth: fill pitch panel — brand, H1, sub, legal footer

Propdex logo + wordmark top, vertically centered pitch, legal links bottom.
Matches locked spec at docs/superpowers/specs/2026-04-20-auth-screen-redesign-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Move demo login into the form card as an inline text link

Goal: remove the floating "Probeer de demo" pill at the bottom of the page. The demo affordance moves inside the form card as an understated text link below the Google button: "Nog geen account? **Bekijk eerst de demo**".

**Files:**
- Modify: `frontend/src/components/auth/AuthTabs.tsx`
- Modify: `frontend/src/routes/auth/index.tsx`

- [ ] **Step 1: Extend `AuthTabs` props to accept demo handler**

In `frontend/src/components/auth/AuthTabs.tsx`, update the `AuthTabsProps` interface to include demo-related props:

```tsx
interface AuthTabsProps {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (data: RegisterData) => Promise<void>
  onLoginSuccess: () => void
  onRegisterSuccess: () => void
  onDemoLogin: () => void | Promise<void>
  demoLoading: boolean
  demoError: string | null
}
```

Update the component signature to destructure the new props:

```tsx
export function AuthTabs({
  onLogin,
  onRegister,
  onLoginSuccess,
  onRegisterSuccess,
  onDemoLogin,
  demoLoading,
  demoError,
}: AuthTabsProps) {
```

- [ ] **Step 2: Render the demo link below the Google button in `AuthTabs`**

Still in `AuthTabs.tsx`, after the `<GoogleButton />` line (line ~79), add:

```tsx
      {/* Demo login — inline text link */}
      <div className="text-center text-[12px] text-[#6b7680]">
        Nog geen account?{' '}
        <button
          type="button"
          onClick={() => onDemoLogin()}
          disabled={demoLoading}
          className="font-bold text-[#0E1111] underline underline-offset-[3px] decoration-[1.5px] hover:text-[#F9A826] hover:decoration-[#F9A826] disabled:opacity-60 disabled:cursor-wait"
        >
          {demoLoading ? 'Bezig met inloggen…' : 'Bekijk eerst de demo'}
        </button>
      </div>
      {demoError && (
        <p role="alert" className="text-center text-[12px] text-red-500">
          {demoError}
        </p>
      )}
```

- [ ] **Step 3: Wire the new props from `AuthPage` into `AuthTabs`**

In `frontend/src/routes/auth/index.tsx`, update the `<AuthTabs ... />` invocation (added in Task 1) to pass the demo props:

```tsx
            <AuthTabs
              onLogin={login}
              onRegister={register}
              onLoginSuccess={handleSuccess}
              onRegisterSuccess={handleSuccess}
              onDemoLogin={handleDemoLogin}
              demoLoading={demoLoading}
              demoError={demoError}
            />
```

- [ ] **Step 4: Remove the now-redundant floating demo pill from `AuthPage`**

In `frontend/src/routes/auth/index.tsx`, delete the entire `<div className="fixed bottom-6 left-1/2 ..."> ... </div>` block that was added in Task 1 Step 1 (the "Demo pill — stays here for now, removed in Task 3" block).

Also delete the now-unused `Sparkles` import from `lucide-react` at the top of the file:

```tsx
// Remove this line:
import { Sparkles } from 'lucide-react'
```

- [ ] **Step 5: Verify typecheck passes**

Run: `cd frontend && npm run check`
Expected: no errors. If `Sparkles` is still referenced anywhere, the compiler will flag it.

- [ ] **Step 6: Visual + functional check in dev server**

Navigate to: `http://localhost:9300/auth`
Expected:
- No floating pill at the bottom of the page
- Inside the form card, below the Google button, a line reading "Nog geen account? **Bekijk eerst de demo**" with the demo phrase as an underlined black link
- Hover: link underline and text turn amber `#F9A826`
- Click: triggers demo login (same handler as before). On success → redirects to `/map`. On failure → red error line appears below the link
- Loading state: link text becomes "Bezig met inloggen…"
- Layout has no scroll

- [ ] **Step 7: Commit**

```bash
git add frontend/src/routes/auth/index.tsx frontend/src/components/auth/AuthTabs.tsx
git commit -m "$(cat <<'EOF'
auth: move demo login to inline text link inside card

Replaces bottom-centered pill with 'Nog geen account? Bekijk eerst de demo'
below the Google button. Same handler, less visual noise.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Translate "Register" tab label to "Registreren"

Goal: small NL consistency fix. The rest of the page is Dutch; the tab should match.

**Files:**
- Modify: `frontend/src/components/auth/AuthTabs.tsx`

- [ ] **Step 1: Update the tab label rendering**

In `frontend/src/components/auth/AuthTabs.tsx`, find the span that renders the tab label:

```tsx
              <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>
                {tab === 'login' ? 'Log in' : 'Register'}
              </span>
```

Change `'Register'` to `'Registreren'`:

```tsx
              <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>
                {tab === 'login' ? 'Log in' : 'Registreren'}
              </span>
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd frontend && npm run check`
Expected: no errors.

- [ ] **Step 3: Visual check**

Navigate to: `http://localhost:9300/auth`
Expected:
- Right tab reads "Registreren"
- Clicking it still switches to the register form
- The obsidian pill animation (Framer Motion `layoutId="auth-tab"`) still slides smoothly between tabs

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/auth/AuthTabs.tsx
git commit -m "$(cat <<'EOF'
auth: translate Register tab to Registreren

Single-word NL consistency fix alongside auth redesign.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Final verification (functional smoke + `/gsd:verify-work` if CLAUDE.md requires)

Goal: prove the page works end-to-end before declaring done.

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `cd frontend && npm run check`
Expected: no errors introduced by this branch.

- [ ] **Step 2: Full smoke flow**

With dev server on `http://localhost:9300`:

1. Navigate to `/auth` (force via logout if needed). Page renders with two panels, no scroll, no console errors.
2. Click the "Bekijk eerst de demo" text link. Expected: redirects to `/map` with demo account logged in.
3. Logout. Navigate back to `/auth`.
4. Fill in a real email + password and click "Log in". Expected: redirects to `/map` on success. Bad credentials show inline API error above the Email field.
5. Click "Registreren" tab. Expected: pill animates right, form swaps to the register form with Full Name + Company Name fields.
6. Click "Inloggen met Google". Expected: redirects to Google OAuth URL (or surfaces a 501 error message if OAuth is not configured).
7. Narrow the browser window to ~1100px. Expected: layout still fits, no scrollbars.

- [ ] **Step 3: Screenshot the final result and save for reference**

Run (from project root with the browse skill):
```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto http://localhost:9300/auth
$B wait --load
$B screenshot /tmp/propdex-auth-final.png
```

Read the screenshot with the Read tool to confirm it matches the mockup visually.

- [ ] **Step 4: Declare done**

If all checks pass, the feature is complete on this branch. No additional commit needed — the verification step produces no file changes.

---

## Out-of-scope reminders

Do NOT do any of the following in this plan:
- Change copy inside `LoginForm` or `RegisterForm` field labels ("Email", "Password", placeholders) — spec explicitly keeps them as-is.
- Add responsive (mobile) styling — Aura is desktop-only per `MEMORY.md`.
- Wire real URLs into the legal links — they stay as `href="#"` until URLs exist.
- Replace the Google button's SVG — it already has the real multi-color SVG in `GoogleButton.tsx`, the mockup's gradient was a stand-in.
- Touch `M046` slices or any non-auth files.
