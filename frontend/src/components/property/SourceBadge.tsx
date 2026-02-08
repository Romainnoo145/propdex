/**
 * SourceBadge
 * Displays source attribution with timestamp per data section
 * Format: "Bron: {source} • {formatted date}"
 */

interface SourceBadgeProps {
  source: string;
  cachedAt: string | null;
  tooltip?: string;
}

export function SourceBadge({ source, cachedAt, tooltip }: SourceBadgeProps) {
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return formatter.format(date);
  };

  const displayText = cachedAt
    ? `Bron: ${source} • ${formatDate(cachedAt)}`
    : `Bron: ${source}`;

  return (
    <div className="text-xs text-white/40" title={tooltip}>
      {displayText}
    </div>
  );
}
