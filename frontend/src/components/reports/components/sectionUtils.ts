/**
 * Shared utilities for DueDiligenceDashboard section logic
 */

import type { PropertyReportResponse } from '@/lib/types/property'
import type { SectionKey } from './SectionNav'
import type { SectionStatus } from './SectionStatusBadge'

/**
 * Parse notes field: accepts JSON object, plain string, or null.
 * Plain text is migrated into { locatiegegevens: text }.
 */
export function parseNotes(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {
    // plain text migration
  }
  return { locatiegegevens: raw }
}

/**
 * Compute section completeness statuses from report data.
 */
export function computeSectionStatuses(
  data: PropertyReportResponse,
): Record<SectionKey, SectionStatus> {
  const riskFieldCount = [
    data.fysiek_risico_profiel,
    data.funderingsrisico_flags,
    data.natura2000_flags,
    data.overstromingsrisico_flags,
    data.geluid_flags,
    data.luchtkwaliteit_flags,
    data.bodem_data ?? data.bodem_flags,
    data.asbest_indicator,
  ].filter(Boolean).length

  return {
    locatiegegevens: data.address ? 'complete' : 'empty',
    kadaster:
      data.cadastral_parcels.length > 0
        ? 'complete'
        : data.brk_ownership
          ? 'partial'
          : 'empty',
    bestemmingsplan: data.zoning
      ? data.zoning.plans.length > 0
        ? 'complete'
        : 'partial'
      : 'empty',
    risicoprofiel:
      riskFieldCount >= 4 ? 'complete' : riskFieldCount > 0 ? 'partial' : 'empty',
    analyse:
      data.scores_v3 != null || data.score_breakdown_v3 != null ? 'complete' : 'empty',
    vergunningen:
      data.permit_precedents
        ? 'complete'
        : (data.vergunningen_data?.length ?? 0) > 0
          ? 'partial'
          : 'empty',
    bronnen: data.section_sources.length > 0 ? 'complete' : 'empty',
  }
}

export const EMPTY_STATUSES: Record<SectionKey, SectionStatus> = {
  locatiegegevens: 'empty',
  kadaster: 'empty',
  bestemmingsplan: 'empty',
  risicoprofiel: 'empty',
  analyse: 'empty',
  vergunningen: 'empty',
  bronnen: 'empty',
}
