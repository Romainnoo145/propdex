/**
 * FreshnessIndicator
 * Shows amber warning for stale data with "Update nu" action
 * Fresh data shows nothing (Trust but Verify approach)
 */

interface FreshnessIndicatorProps {
  sectionName: string;
  ageSeconds: number | null;
  freshnessThresholdDays: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

// Freshness thresholds in days
export const FRESHNESS_THRESHOLDS = {
  kadaster: 7,
  bestemming: 30,
  monument: 180,
  bouwregels: 30,
} as const;

export function FreshnessIndicator({
  sectionName: _sectionName,
  ageSeconds,
  freshnessThresholdDays,
  onRefresh,
  isRefreshing = false,
}: FreshnessIndicatorProps) {
  // Helper to format age in human-readable format
  const formatAge = (seconds: number): string => {
    if (seconds < 60) return 'zojuist';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minuten`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} uur`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} dagen`;
    return `${Math.floor(seconds / 604800)} weken`;
  };

  // Calculate if data is stale
  const isStale = ageSeconds !== null && ageSeconds >= freshnessThresholdDays * 86400;

  // Fresh data or null age: show nothing
  if (!isStale) {
    return null;
  }

  const ageDays = Math.floor(ageSeconds! / 86400);
  const ageDisplay = formatAge(ageSeconds!);

  return (
    <div className="group relative inline-flex items-center">
      {/* Amber warning icon */}
      <svg
        className="w-4 h-4 text-aura-amber"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-label={`Data is ${ageDays} dagen oud`}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>

      {/* Hover tooltip with refresh action */}
      <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 min-w-[200px]">
        <div className="bg-aura-canvas border border-neutral-300 rounded-lg p-3 shadow-xl">
          <p className="text-aura-ink text-xs mb-2">
            Deze data is <strong>{ageDisplay}</strong> oud
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-xs text-aura-amber hover:text-aura-amber-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? 'Bezig...' : 'Update nu'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
