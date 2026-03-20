import { Scale, ShieldCheck, ShieldAlert, ShieldQuestion, type LucideIcon } from 'lucide-react'
import { VerdictHero } from './VerdictHero'
import { IntelligenceGrid, type IntelCard } from './IntelligenceGrid'
import { useGemeenteProfile, SEVERITY_COLORS } from '@/hooks/useGemeenteProfile'

interface KlimaatLayerProps {
  gemeenteNaam: string
  gemeenteCode: string
}

/* ── Score derivation ──────────────────────────────────────── */

interface KlimaatVerdict {
  score: number | null
  label: string
  color: string
  Icon: LucideIcon
  subtitle: string
}

/**
 * Derive "ontwikkelklimaat" score from gemeente profile data.
 * Combines severity, approval rate, and doorlooptijd into a single 0–100 score.
 *
 * - severity: Gunstig=40, Gemiddeld=25, Ongunstig=10, Zeer ongunstig=0
 * - approval_rate: directly maps to 0–40 (e.g. 80% → 32)
 * - doorlooptijd: <30d=20, 30–60d=15, 60–90d=10, 90–120d=5, >120d=0
 */
function deriveKlimaatScore(
  severity: string | null,
  approvalRate: number | null,
  doorlooptijd: number | null,
): number | null {
  if (!severity || severity === 'Onbekend') return null

  const severityPts: Record<string, number> = {
    'Gunstig': 40,
    'Gemiddeld': 25,
    'Ongunstig': 10,
    'Zeer ongunstig': 0,
  }

  let score = severityPts[severity] ?? 15

  if (approvalRate != null) {
    score += Math.round((approvalRate / 100) * 40)
  }

  if (doorlooptijd != null) {
    if (doorlooptijd < 30) score += 20
    else if (doorlooptijd < 60) score += 15
    else if (doorlooptijd < 90) score += 10
    else if (doorlooptijd < 120) score += 5
  }

  return Math.min(100, Math.max(0, score))
}

function deriveVerdict(score: number | null): KlimaatVerdict {
  if (score == null) {
    return {
      score: null,
      label: 'ONBEKEND',
      color: '#94a3b8',
      Icon: ShieldQuestion,
      subtitle: 'Onvoldoende data beschikbaar',
    }
  }
  if (score >= 70) {
    return {
      score,
      label: 'ONTWIKKELKANSRIJK',
      color: '#22c55e',
      Icon: ShieldCheck,
      subtitle: 'Soepel klimaat · hoge goedkeuring · korte doorlooptijd',
    }
  }
  if (score >= 40) {
    return {
      score,
      label: 'GEMIDDELD KLIMAAT',
      color: '#f59e0b',
      Icon: Scale,
      subtitle: 'Standaard vergunningstraject · let op doorlooptijd',
    }
  }
  return {
    score,
    label: 'LASTIG KLIMAAT',
    color: '#ef4444',
    Icon: ShieldAlert,
    subtitle: 'Streng beleid · langere trajecten · meer bezwaren',
  }
}

/* ── Trend direction ───────────────────────────────────────── */

function trendLabel(bek30: number, bek90: number, bek365: number): { value: string; sub: string } {
  // Annualised rate from 30d vs 365d average
  const monthly30 = bek30
  const monthly365 = bek365 / 12
  if (monthly365 === 0) return { value: '—', sub: 'Geen historisch data' }
  const ratio = monthly30 / monthly365
  if (ratio > 1.3) return { value: '↑ STIJGEND', sub: 'Meer activiteit recent' }
  if (ratio < 0.7) return { value: '↓ DALEND', sub: 'Minder activiteit recent' }
  return { value: '→ STABIEL', sub: 'Consistente activiteit' }
}

/* ── Component ─────────────────────────────────────────────── */

export function KlimaatLayer({ gemeenteNaam }: KlimaatLayerProps) {
  const { data: profile, isLoading } = useGemeenteProfile(gemeenteNaam)

  const klimaatScore = profile
    ? deriveKlimaatScore(profile.severity_label, profile.approval_rate_pct, profile.avg_doorlooptijd_days)
    : null

  const verdict = deriveVerdict(klimaatScore)

  // Build 9 intelligence cards
  const trend = profile
    ? trendLabel(profile.bekendmakingen_30d, profile.bekendmakingen_90d, profile.bekendmakingen_365d)
    : { value: '—', sub: 'Laden...' }

  // Get top permit type
  const topPermitType = profile?.permit_type_distribution
    ? Object.entries(profile.permit_type_distribution).sort((a, b) => b[1] - a[1])[0]
    : null

  const cards: IntelCard[] = [
    {
      key: 'klimaat',
      label: 'KLIMAAT',
      value: isLoading ? '...' : (profile?.severity_label ?? '—'),
      sub: 'Vergunning-klimaat',
      badge: profile?.data_coverage ?? undefined,
      accentColor: profile?.severity_label ? (SEVERITY_COLORS[profile.severity_label] ?? '#94a3b8') : undefined,
    },
    {
      key: 'verleend',
      label: 'VERLEEND',
      value: profile?.approval_rate_pct != null ? `${Math.round(profile.approval_rate_pct)}%` : '—',
      sub: 'Goedkeuringsgraad',
      badge: profile?.sample_size ? `n=${profile.sample_size}` : undefined,
      accentColor: profile?.approval_rate_pct != null
        ? profile.approval_rate_pct >= 80 ? '#22c55e' : profile.approval_rate_pct >= 50 ? '#f59e0b' : '#ef4444'
        : undefined,
    },
    {
      key: 'geweigerd',
      label: 'GEWEIGERD',
      value: profile?.rejection_rate_pct != null ? `${Math.round(profile.rejection_rate_pct)}%` : '—',
      sub: 'Afwijzingspercentage',
      accentColor: profile?.rejection_rate_pct != null
        ? profile.rejection_rate_pct <= 10 ? '#22c55e' : profile.rejection_rate_pct <= 25 ? '#f59e0b' : '#ef4444'
        : undefined,
    },
    {
      key: 'doorlooptijd',
      label: 'DOORLOOPTIJD',
      value: profile?.avg_doorlooptijd_days != null ? `~${profile.avg_doorlooptijd_days}D` : '—',
      sub: 'Gemiddelde afhandeling',
      accentColor: profile?.avg_doorlooptijd_days != null
        ? profile.avg_doorlooptijd_days <= 30 ? '#22c55e' : profile.avg_doorlooptijd_days <= 90 ? '#f59e0b' : '#ef4444'
        : undefined,
    },
    {
      key: 'bekendmakingen',
      label: 'BEKENDMAKINGEN',
      value: profile ? String(profile.bekendmakingen_365d) : '—',
      sub: 'Afgelopen 12 maanden',
      badge: profile ? `${profile.bekendmakingen_90d} (90d)` : undefined,
    },
    {
      key: 'trend',
      label: 'TREND',
      value: trend.value,
      sub: trend.sub,
      accentColor: trend.value.includes('↑') ? '#22c55e' : trend.value.includes('↓') ? '#ef4444' : '#94a3b8',
    },
    {
      key: 'type',
      label: 'TOP TYPE',
      value: topPermitType ? topPermitType[0].slice(0, 14).toUpperCase() : '—',
      sub: topPermitType ? `${topPermitType[1]} aanvragen` : 'Geen data',
      badge: topPermitType ? String(topPermitType[1]) : undefined,
      accentColor: '#6366f1',
    },
    {
      key: 'bekendm-30d',
      label: 'RECENT',
      value: profile ? String(profile.bekendmakingen_30d) : '—',
      sub: 'Afgelopen 30 dagen',
      accentColor: '#0ea5e9',
    },
    {
      key: 'dekking',
      label: 'DATA DEKKING',
      value: isLoading ? '...' : (profile?.data_coverage?.toUpperCase() ?? '—'),
      sub: profile?.sample_size ? `${profile.sample_size} bekendmakingen geanalyseerd` : 'Geen steekproef',
      accentColor: profile?.data_coverage === 'high' ? '#22c55e' : profile?.data_coverage === 'medium' ? '#f59e0b' : '#94a3b8',
    },
  ]

  return (
    <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
      <VerdictHero
        score={verdict.score}
        label={verdict.label}
        subtitle={verdict.subtitle}
        color={verdict.color}
        icon={<verdict.Icon className="size-6 text-white" strokeWidth={2.5} />}
      />
      <IntelligenceGrid cards={cards} />
    </div>
  )
}
