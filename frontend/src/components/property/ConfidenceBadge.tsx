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
    color: 'bg-green-500/20 border-green-500/40 text-green-100',
    defaultLabel: 'Hoog vertrouwen',
    title: undefined,
  },
  MEDIUM: {
    color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-100',
    defaultLabel: 'Gemiddeld vertrouwen',
    title: undefined,
  },
  LOW: {
    color: 'bg-red-500/20 border-red-500/40 text-red-100',
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
