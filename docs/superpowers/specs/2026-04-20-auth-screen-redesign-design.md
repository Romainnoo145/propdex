# Auth Screen Redesign — Design Spec

**Date:** 2026-04-20
**Author:** Klarifai
**Status:** Locked, ready for implementation plan
**Scope:** Parallel work next to M046 (does not block milestone execution)

## Goal

Replace the current utilitarian auth screen (`frontend/src/routes/auth/index.tsx`) with a more professional, product-first composition that matches the Aura design system.

## Context

The existing auth screen is a single centered form card on a Morning Mist canvas. It works but feels like a throwaway login page, not the entry point to a serious SaaS. User referenced STB-Kozijnen as an inspiration for a more polished feel, but everything must stay in Propdex Aura style.

## Composition

Full-viewport two-panel screen. No scroll. Desktop only, light mode only (matches rest of product).

```
┌──────────────────────────────────────┬──────────────────────────┐
│                                      │                          │
│  [Logo] Propdex                      │                          │
│                                      │                          │
│                                      │  ┌────────────────────┐  │
│  • VOOR ONTWIKKELAARS &              │  │ Welkom terug.      │  │
│    KWALITEITSBORGERS                 │  │ Log in met je...   │  │
│                                      │  │                    │  │
│  Van grondpositie tot                │  │ [Log in][Register] │  │
│  go/no-go in één platform.           │  │                    │  │
│                                      │  │ Email              │  │
│  Weet in twee minuten of een         │  │ ┌────────────────┐ │  │
│  grondpositie de moeite waard is.    │  │ └────────────────┘ │  │
│                                      │  │ Wachtwoord         │  │
│                                      │  │ ┌────────────────┐ │  │
│                                      │  │ └────────────────┘ │  │
│                                      │  │ [    Log in    ]   │  │
│                                      │  │ ── of ──           │  │
│                                      │  │ [G] Google         │  │
│                                      │  │ Nog geen account?  │  │
│                                      │  │ Bekijk eerst demo  │  │
│                                      │  └────────────────────┘  │
│                                      │                          │
│  © 2026 Propdex · Privacy · ...      │                          │
└──────────────────────────────────────┴──────────────────────────┘
```

### Left panel (dark pitch)

- Background: `#0E1111` (Deep Obsidian) with subtle amber glow blob top-left (`rgba(249,168,38,0.08)`, 120px blur)
- Flex column, `justify-content: space-between`, padding `56px 64px`
- **Top:** brand mark (Propdex favicon SVG 38x38) + wordmark "Propdex", Plus Jakarta Sans 20px/900
- **Middle (vertically centered, `margin: auto 0`):**
  - Eyebrow: amber dot + "Voor ontwikkelaars & kwaliteitsborgers" (11px/700/uppercase, letter-spacing .18em, 65% white)
  - H1: **Van grondpositie tot go/no-go in één platform.** (46px/900, letter-spacing -.042em, line-height 1.03, max-width 500px)
  - Sub: "Weet in twee minuten of een grondpositie de moeite waard is." (16px/400, 65% white, max-width 420px)
- **Bottom (legal footer):** © 2026 Propdex · Privacybeleid · Algemene voorwaarden · Contact
  - Font 12px, 38% white for dead text, 55% white for links, hover → amber

Flex ratio: dark panel gets `flex: 1.1`, form side gets `flex: 1`.

### Right panel (form container)

- Background: `#F2F6F3` (Morning Mist)
- Centered form card:
  - White (`#fff`), border `1px solid #EAEFEF`, rounded `24px`, padding `40px`, shadow `0 12px 40px rgba(14,17,17,0.08)`
  - Max width `420px`
  - Gap 18px between internal sections
- Card sections (top to bottom):
  1. **Welcome header:** "Welkom terug." (h2 26px/900) + "Log in met je e-mailadres om verder te gaan." (13px/400, muted)
  2. **Tab pills:** "Log in" / "Registreren" in Morning Mist pill track, active tab = Obsidian `#0E1111` pill (Framer Motion `layoutId="auth-tab"`, already present)
  3. **Fields:** Email + Wachtwoord. Labels 11px/700/uppercase muted. Inputs `#F8FAF9` bg, `#EAEFEF` border, rounded 14px, 44px tall, focus ring amber
  4. **Primary CTA:** "Log in" — amber `#F9A826` bg, white text, 48px tall, rounded 14px
  5. **Divider:** horizontal line · "of" · line
  6. **Google:** "Inloggen met Google" — white bg, obsidian text, G-mark (conic-gradient) circle
  7. **Demo link:** "Nog geen account? **Bekijk eerst de demo**" — text link (12px), amber on hover. Replaces the current "Probeer de demo" pill which felt out of place.

### Viewport behaviour

- Page fills viewport exactly: `html, body { height: 100%; overflow: hidden }`, body padding `20px`
- Screen container: `width: 100%; height: 100%`, rounded 18px, flex row with two panels
- No internal scrolling — both panels are sized to fit

## What changes vs current

- **Layout:** single centered card → two-panel (dark pitch left, form right)
- **Content added:** brand wordmark, eyebrow, H1 pitch, sub line, legal footer
- **Content removed:** "Probeer de demo" pill below card (replaced by inline text link inside card)
- **Fonts & colours:** unchanged — Plus Jakarta Sans + existing Aura tokens
- **Demo login:** same auth call (`useAuth.login(DEMO_EMAIL, DEMO_PASSWORD)`), different presentation
- **Routing/auth logic:** unchanged — `AuthTabs`, `LoginForm`, `RegisterForm`, `GoogleButton`, `useAuth` all re-used

## Out of scope

- No new languages (stays NL like current)
- No dark mode (Aura is light-only per memory)
- No mobile layout (desktop-only per Aura)
- No analytics/tracking additions
- No changes to auth backend or token handling
- No changes to register flow internals (only the tab switcher frames it)
- Legal links (`Privacybeleid`, `Algemene voorwaarden`, `Contact`) point to placeholders for now — real URLs out of scope for this redesign

## Components affected

- `frontend/src/routes/auth/index.tsx` — main rewrite (new layout, demo button relocated as text link)
- `frontend/src/components/auth/AuthTabs.tsx` — stays as-is (tabs + form bodies + Google)
- `frontend/src/components/auth/LoginForm.tsx` — stays as-is
- `frontend/src/components/auth/RegisterForm.tsx` — stays as-is
- `frontend/src/components/auth/GoogleButton.tsx` — stays as-is
- Propdex logo asset `frontend/public/favicon.svg` — re-used as brand mark

## Risks / open items

- H1 "Van grondpositie tot go/no-go in één platform." at 46px may wrap to 4 lines on ~800px dark panel — fine, was designed for that
- Very narrow viewports (<1100px) might squeeze form card. Acceptable since Propdex is desktop-only. No responsive breakpoints planned

## Visual reference

Mockup HTML preserved in `.superpowers/brainstorm/956747-1776671510/content/auth-locked.html` for reference during implementation.
