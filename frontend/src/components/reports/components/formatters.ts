/**
 * Shared formatter functions for Dutch locale display.
 *
 * formatArea  — m² display with nl-NL grouping, returns '–' for nullish.
 * formatCurrency — EUR display with nl-NL grouping, returns '–' for nullish.
 *
 * Note: S1 used "EUR 1.234", S4 used "€ 1.234". We standardise on "€ 1.234"
 * because it's shorter and more conventional in Dutch UI.
 */

export function formatArea(value: number | null | undefined): string {
  if (value == null) return '–'
  return `${Math.round(value).toLocaleString('nl-NL')} m²`
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '–'
  return `€ ${Math.round(value).toLocaleString('nl-NL')}`
}
