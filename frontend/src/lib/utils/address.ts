/**
 * Address formatting utilities
 *
 * Used by meldingen.tsx and ChangeTimeline.tsx for display and navigation.
 */

/** Extract huisnummer from address string like "Straat 42, 1234AB Stad" */
export function extractHuisnummer(address: string): number | null {
  const streetPart = address.split(',')[0] ?? address
  const match = streetPart.match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}

/** Format postcode to "1234 AB" with space */
export function formatPostcode(pc: string): string {
  const clean = pc.replace(/\s/g, '')
  if (clean.length === 6) return `${clean.slice(0, 4)} ${clean.slice(4)}`
  return pc
}
