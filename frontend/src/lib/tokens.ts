/**
 * Design token constants for use in inline styles and dynamic color props.
 *
 * For Tailwind classes, use the token names directly:
 *   text-aura-amber, bg-aura-amber-dark, border-aura-amber-light, etc.
 *
 * For inline styles (e.g. chart bars, SVG strokes), import from here:
 *   import { AMBER, GREEN, RED } from '@/lib/tokens'
 *
 * These values MUST match the @theme block in styles/index.css.
 * Single source of truth: index.css @theme. This file mirrors it for JS access.
 */

// ── Amber palette (informational data) ──────────────────────
export const AMBER = {
  light: '#FDE68A',   // --color-aura-amber-light
  mid: '#FBBF24',     // --color-aura-amber-mid
  base: '#F9A826',    // --color-aura-amber
  hover: '#E8971F',   // --color-aura-amber-hover
  dark: '#D4860B',    // --color-aura-amber-dark
  deep: '#92400E',    // --color-aura-amber-deep
} as const

// ── Semantic (good/bad judgments) ────────────────────────────
export const GREEN = '#22C55E'    // --color-aura-green / --color-success
export const RED = '#EF4444'      // --color-aura-red / --color-error

// ── Core palette ─────────────────────────────────────────────
export const OBSIDIAN = '#0E1111' // --color-aura-obsidian
export const INK = '#1A1C1E'      // --color-aura-ink
export const SLATE_MUTED = '#94a3b8' // neutral placeholder

/**
 * 5-step amber gradient for ordered data (e.g. age buckets, category bars).
 * Index 0 = lightest, index 4 = deepest.
 */
export const AMBER_GRADIENT = [
  AMBER.light,
  AMBER.mid,
  AMBER.base,
  AMBER.dark,
  AMBER.deep,
] as const
