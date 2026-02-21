/**
 * ConfidenceBadge — Color-coded confidence indicator for AI interpretations
 * Matches SourceBadge styling pattern (text-xs, inline-flex)
 */

interface ConfidenceBadgeProps {
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  label?: string;
}

const CONFIDENCE_CONFIG = {
  HIGH: {
    color: 'bg-success/15 border-success/40 text-success',
    defaultLabel: 'Hoog vertrouwen',
    title: undefined,
  },
  MEDIUM: {
    color: 'bg-warning/15 border-warning/40 text-warning',
    defaultLabel: 'Gemiddeld vertrouwen',
    title: undefined,
  },
  LOW: {
    color: 'bg-error/15 border-error/40 text-error',
    defaultLabel: 'Laag vertrouwen',
    title: 'Verifieer handmatig - AI interpretatie mogelijk onvolledig',
  },
};

export function ConfidenceBadge({ confidence, label }: ConfidenceBadgeProps) {
  const config = CONFIDENCE_CONFIG[confidence];
  const displayLabel = label ?? config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${config.color}`}
      title={config.title}
    >
      {displayLabel}
    </span>
  );
}
