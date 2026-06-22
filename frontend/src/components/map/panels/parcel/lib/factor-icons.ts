/**
 * factor-icons — maps a factor to a functional lucide icon (DESIGN.md: no
 * decorative icons; lucide-react, strokeWidth 1.5). Resolution order:
 * per-factor_key override → per-bron fallback → neutral default.
 */

import {
  Maximize2,
  MoveVertical,
  Map,
  DoorClosed,
  Users,
  Ruler,
  Building2,
  Coins,
  Home,
  Landmark,
  TrendingUp,
  Layers,
  Mountain,
  AlertTriangle,
  Hammer,
  Scale,
  ShieldAlert,
  Scissors,
  Car,
  Leaf,
  Waves,
  Volume2,
  Wind,
  Circle,
  type LucideIcon,
} from 'lucide-react'

import type { Bron } from '@/lib/factor-groups'

/** Per-factor_key icon — marquee factors get a specific, recognisable glyph. */
const BY_KEY: Record<string, LucideIcon> = {
  // Potentie
  vrije_grond: Maximize2,
  optoppotentie: MoveVertical,
  bestemming: Map,
  leegstand: DoorClosed,
  demografie: Users,
  schaal: Ruler,
  capaciteit: Building2,
  grondwaarde_fit: Coins,
  woonvisie_match: Home,
  beleidsalignement: Landmark,
  markt: TrendingUp,
  // Risico
  funderingsrisico: Layers,
  asbest: AlertTriangle,
  bodemverontreiniging: Layers,
  bodemtype: Mountain,
  monument: Landmark,
  bestemmingswijziging: Map,
  constructieve_staat: Hammer,
  juridisch_klimaat: Scale,
  criminaliteit: ShieldAlert,
  max_hoogte_bereikt: MoveVertical,
  splitsingsrisico: Scissors,
  parkeerdruk: Car,
  natura2000: Leaf,
  overstromingsrisico: Waves,
  geluid: Volume2,
  luchtkwaliteit: Wind,
}

/** Per-bron fallback when a key has no specific icon (e.g. planned cascades). */
const BY_BRON: Record<Bron, LucideIcon> = {
  gemeente_beleid: Landmark,
  markt: TrendingUp,
  fysiek: Maximize2,
  klimaat: Leaf,
  juridisch: Scale,
  planologisch: Map,
}

/** Resolve the icon for a factor: key override → bron fallback → default. */
export function iconForFactor(factorKey: string, bron: Bron): LucideIcon {
  return BY_KEY[factorKey] ?? BY_BRON[bron] ?? Circle
}
