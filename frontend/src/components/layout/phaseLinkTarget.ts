import type { LifecyclePhaseKey } from '@/lib/lifecycle/phases'

export interface PhaseLinkTarget {
  to: '/opgeslagen/perceel/$parcelId' | '/opgeslagen/perceel/$parcelId/$phase'
  params: { parcelId: string } | { parcelId: string; phase: LifecyclePhaseKey }
}

export function phaseLinkTarget(phaseKey: LifecyclePhaseKey, parcelId: string): PhaseLinkTarget {
  if (phaseKey === '1-onderzoek') {
    return { to: '/opgeslagen/perceel/$parcelId', params: { parcelId } }
  }
  return { to: '/opgeslagen/perceel/$parcelId/$phase', params: { parcelId, phase: phaseKey } }
}
