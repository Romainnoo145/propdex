import type { PropertyReportResponse } from '@/lib/types/property'

// ─── Types ────────────────────────────────────────────────────────────────────

type WarningSeverity = 'blocking' | 'attention' | 'awareness'

interface ActionWarning {
  id: string
  severity: WarningSeverity
  title: string
  description: string
}

// ─── BAG statuses that warrant an attention warning ───────────────────────────

const ACTIONABLE_STATUSES = new Set([
  'Sloopvergunning verleend',
  'Bouwvergunning verleend',
  'Bouw gestart',
  'Pand buiten gebruik',
])

const STATUS_WARNING_DESCRIPTIONS: Record<string, string> = {
  'Sloopvergunning verleend':
    'Er is een vergunning afgegeven om dit pand te slopen. Herontwikkeling op deze locatie is aannemelijk.',
  'Bouwvergunning verleend':
    'Er is een bouwvergunning afgegeven. Bouw kan elk moment starten.',
  'Bouw gestart':
    'Er wordt momenteel gebouwd op deze locatie. Nieuwbouw of renovatie is gaande.',
  'Pand buiten gebruik':
    'Dit pand is niet meer in gebruik. Mogelijk leegstand — potentieel geschikt voor transformatie of herontwikkeling.',
}

// ─── Pure derivation function ─────────────────────────────────────────────────

export function computeWarnings(data: PropertyReportResponse): ActionWarning[] {
  const warnings: ActionWarning[] = []

  // 1. Wkb-plichtig (blocking / red)
  if (data.wkb_precheck?.status === 'likely_required') {
    warnings.push({
      id: 'wkb-plichtig',
      severity: 'blocking',
      title: 'Wkb-plichtig',
      description:
        'Dit pand is Wkb-plichtig. Een kwaliteitsborger is verplicht bij verbouwing.',
    })
  }

  // 2. Asbestrisico (blocking / red) — bouwjaar < 1994
  if (data.building?.bouwjaar != null && data.building.bouwjaar < 1994) {
    warnings.push({
      id: 'asbestrisico',
      severity: 'blocking',
      title: 'Asbestrisico',
      description: `Bouwjaar ${data.building.bouwjaar} — asbesthoudende materialen kunnen aanwezig zijn. Asbestinventarisatie vereist voor sloop of ingrijpende verbouwing.`,
    })
  }

  // 3. BAG status actionable (attention / amber)
  if (data.building?.status && ACTIONABLE_STATUSES.has(data.building.status)) {
    const desc =
      STATUS_WARNING_DESCRIPTIONS[data.building.status] ??
      `Status: ${data.building.status}`
    warnings.push({
      id: 'bag-status',
      severity: 'attention',
      title: data.building.status,
      description: desc,
    })
  }

  // 4. Rijksmonument (awareness / blue)
  if (data.monuments?.is_monument === true) {
    warnings.push({
      id: 'rijksmonument',
      severity: 'awareness',
      title: 'Rijksmonument',
      description:
        'Dit pand is aangewezen als rijksmonument. Verbouw- en sloopvergunning vereist bij nagenoeg alle wijzigingen.',
    })
  }

  return warnings
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function BlockingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  )
}

function AttentionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
    </svg>
  )
}

function AwarenessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
    </svg>
  )
}

// ─── Severity styling map ─────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<
  WarningSeverity,
  { iconWrap: string; titleColor: string; icon: React.ReactNode }
> = {
  blocking: {
    iconWrap: 'text-error bg-error/10',
    titleColor: 'text-error',
    icon: <BlockingIcon />,
  },
  attention: {
    iconWrap: 'text-warning bg-warning/10',
    titleColor: 'text-warning',
    icon: <AttentionIcon />,
  },
  awareness: {
    iconWrap: 'text-info bg-info/10',
    titleColor: 'text-info',
    icon: <AwarenessIcon />,
  },
}

// ─── WarningRow sub-component ─────────────────────────────────────────────────

function WarningRow({ warning }: { warning: ActionWarning }) {
  const styles = SEVERITY_STYLES[warning.severity]
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${styles.iconWrap}`}
      >
        {styles.icon}
      </div>
      <div>
        <p className={`text-sm font-semibold ${styles.titleColor}`}>{warning.title}</p>
        <p className="mt-0.5 text-sm text-grey-400">{warning.description}</p>
      </div>
    </div>
  )
}

// ─── ActieVereistSection component ────────────────────────────────────────────

interface ActieVereistSectionProps {
  data: PropertyReportResponse
}

export default function ActieVereistSection({ data }: ActieVereistSectionProps) {
  const warnings = computeWarnings(data)

  if (warnings.length === 0) return null

  return (
    <div className="actie-vereist-section section-card rounded-2xl border border-error/30 bg-error/[0.04] p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-error">
        Actie vereist
      </h2>
      <div className="space-y-3">
        {warnings.map((w) => (
          <WarningRow key={w.id} warning={w} />
        ))}
      </div>
    </div>
  )
}
