import type { PropertyReportResponse } from '@/lib/types/property';

interface PropertyQuickCardProps {
  data: PropertyReportResponse | null;
  isLoading: boolean;
  onViewDetails: () => void;
  onClose: () => void;
}

/**
 * PropertyQuickCard (Tier 1)
 * Small chip/toast at bottom-left of map showing address + "Bekijk details" link.
 * Subtle, non-intrusive — click to open the full drawer.
 */
export function PropertyQuickCard({
  data,
  isLoading,
  onViewDetails,
  onClose,
}: PropertyQuickCardProps) {
  return (
    <div
      className="absolute bottom-4 left-4 z-[var(--z-property-panel)] flex items-center gap-3 rounded-full border border-white/20 bg-black/40 py-2 pl-4 pr-2 shadow-lg backdrop-blur-md"
    >
      {isLoading && (
        <div className="flex items-center gap-2">
          <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
        </div>
      )}

      {data && !isLoading && (
        <>
          <span className="text-sm text-white/90">
            {data.address.straat} {data.address.huisnummer}
            {data.address.huisletter ?? ''}
            {data.address.toevoeging ? ` ${data.address.toevoeging}` : ''},{' '}
            <span className="text-white/50">{data.address.woonplaats}</span>
          </span>

          <button
            onClick={onViewDetails}
            className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/25"
          >
            Bekijk details
          </button>
        </>
      )}

      <button
        onClick={onClose}
        className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Sluiten"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
