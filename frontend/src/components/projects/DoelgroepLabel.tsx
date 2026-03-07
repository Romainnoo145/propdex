import type { CbsLeeftijdsVerdeling, CbsHuishoudens } from '@/lib/types/scan'

export type Doelgroep = 'studentenwijk' | 'gezinswijk' | 'vergrijzend' | 'gemengd'

/**
 * Derive doelgroep classification from CBS age + household data.
 *
 * Rules (in priority order):
 * - studentenwijk: perc_15_24 > 20 AND eenpersoons/totaal > 0.5
 * - vergrijzend: perc_65_plus > 25
 * - gezinswijk: perc_0_14 > 20
 * - else: gemengd
 *
 * Returns null if insufficient data.
 */
export function deriveDoelgroep(
  leeftijdsverdeling: CbsLeeftijdsVerdeling,
  huishoudens: CbsHuishoudens,
): Doelgroep | null {
  const { perc_15_24, perc_65_plus, perc_0_14 } = leeftijdsverdeling
  const { totaal, eenpersoons } = huishoudens

  // Need at least some age data to classify
  if (perc_15_24 == null && perc_65_plus == null && perc_0_14 == null) return null

  // Studentenwijk: young + mostly single-person households
  if (
    perc_15_24 != null &&
    perc_15_24 > 20 &&
    totaal != null &&
    totaal > 0 &&
    eenpersoons != null &&
    eenpersoons / totaal > 0.5
  ) {
    return 'studentenwijk'
  }

  // Vergrijzend: high elderly percentage
  if (perc_65_plus != null && perc_65_plus > 25) {
    return 'vergrijzend'
  }

  // Gezinswijk: high child percentage
  if (perc_0_14 != null && perc_0_14 > 20) {
    return 'gezinswijk'
  }

  return 'gemengd'
}

const BADGE_CONFIG: Record<Doelgroep, { bg: string; label: string }> = {
  studentenwijk: {
    bg: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    label: 'Studentenwijk',
  },
  gezinswijk: {
    bg: 'bg-green-500/10 text-green-400 border border-green-500/20',
    label: 'Gezinswijk',
  },
  vergrijzend: {
    bg: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    label: 'Vergrijzend',
  },
  gemengd: {
    bg: 'bg-grey-700/50 text-grey-300 border border-grey-700',
    label: 'Gemengd',
  },
}

interface DoelgroepLabelProps {
  leeftijdsverdeling: CbsLeeftijdsVerdeling
  huishoudens: CbsHuishoudens
}

/**
 * Renders a colored doelgroep classification badge.
 * Returns null if insufficient data to classify.
 */
export function DoelgroepLabel({ leeftijdsverdeling, huishoudens }: DoelgroepLabelProps) {
  const doelgroep = deriveDoelgroep(leeftijdsverdeling, huishoudens)
  if (!doelgroep) return null

  const config = BADGE_CONFIG[doelgroep]

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg}`}
    >
      {config.label}
    </span>
  )
}
