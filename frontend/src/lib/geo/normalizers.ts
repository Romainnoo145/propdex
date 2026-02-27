export function normalizeAreaName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[’']/g, '')
    .trim()
}

export function normalizeGemeenteCode(value: string): string
export function normalizeGemeenteCode(value: string | null | undefined): string | null
export function normalizeGemeenteCode(value: string | null | undefined): string | null {
  if (!value) return null

  const code = value.trim().toUpperCase()
  if (!code) return null
  if (/^GM\d{4}$/.test(code)) return code

  const digits = code.startsWith('GM') ? code.slice(2) : code
  if (/^\d{4}$/.test(digits)) return `GM${digits}`

  return code
}
