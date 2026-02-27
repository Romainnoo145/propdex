import { normalizeGemeenteCode } from '@/lib/geo/normalizers'

export interface ProjectenWorkspaceSearch {
  gemeente_id?: string
  gemeente_code?: string
  wijk_id?: string
  provincie_code?: string
}

function normalizeProvincieCode(code: string | null | undefined): string | undefined {
  const next = code?.trim()
  return next ? next : undefined
}

export function toProjectenRootSearch(input?: {
  provincieCode?: string | null
}): ProjectenWorkspaceSearch {
  return {
    provincie_code: normalizeProvincieCode(input?.provincieCode),
  }
}

export function toProjectenGemeenteSearch(input: {
  gemeenteCode: string
  gemeenteId?: string | null
  provincieCode?: string | null
}): ProjectenWorkspaceSearch {
  return {
    gemeente_id: input.gemeenteId ?? undefined,
    gemeente_code:
      normalizeGemeenteCode(input.gemeenteCode) ??
      input.gemeenteCode.trim().toUpperCase(),
    provincie_code: normalizeProvincieCode(input.provincieCode),
  }
}

export function toProjectenWijkSearch(input: {
  wijkId: string
  gemeenteCode: string
  gemeenteId?: string | null
  provincieCode?: string | null
}): ProjectenWorkspaceSearch {
  return {
    ...toProjectenGemeenteSearch({
      gemeenteCode: input.gemeenteCode,
      gemeenteId: input.gemeenteId,
      provincieCode: input.provincieCode,
    }),
    wijk_id: input.wijkId,
  }
}
