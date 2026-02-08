import type { PropertyReportResponse } from '@/lib/types/property';

interface PropertyQuickCardProps {
  data: PropertyReportResponse | null;
  isLoading: boolean;
  onViewDetails: () => void;
  onClose: () => void;
}

/**
 * PropertyQuickCard (Tier 1)
 * Small floating card showing address + key metrics
 * Positioned at bottom-center of map, above map controls
 */
export function PropertyQuickCard({
  data,
  isLoading,
  onViewDetails,
  onClose,
}: PropertyQuickCardProps) {
  return (
    <div
      className="absolute bottom-24 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-80 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl p-4"
      style={{ zIndex: 'var(--z-property-panel)' }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Sluiten"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {isLoading && <LoadingState />}
      {data && !isLoading && <DataState data={data} onViewDetails={onViewDetails} />}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {/* Address skeleton */}
      <div className="space-y-1.5">
        <div className="h-5 bg-white/10 animate-pulse rounded w-3/4" />
        <div className="h-4 bg-white/10 animate-pulse rounded w-1/2" />
      </div>

      {/* Metrics skeleton */}
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 bg-white/10 animate-pulse rounded-lg" />
        <div className="h-16 bg-white/10 animate-pulse rounded-lg" />
        <div className="h-16 bg-white/10 animate-pulse rounded-lg" />
      </div>

      {/* Button skeleton */}
      <div className="h-10 bg-white/10 animate-pulse rounded-lg" />
    </div>
  );
}

function DataState({
  data,
  onViewDetails,
}: {
  data: PropertyReportResponse;
  onViewDetails: () => void;
}) {
  const { address, building, zoning } = data;
  const bouwjaar = building?.bouwjaar ?? null;
  const oppervlakte = building?.oppervlakte ?? null;
  const bestemming = zoning?.primary_bestemming ?? null;

  return (
    <div className="space-y-3">
      {/* Address */}
      <div className="space-y-0.5 pr-6">
        <div className="text-white text-base font-bold">
          {address.straat} {address.huisnummer}
          {address.huisletter && address.huisletter}
          {address.toevoeging && address.toevoeging}
        </div>
        <div className="text-white/60 text-sm">
          {address.postcode}, {address.woonplaats}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/15 rounded-lg px-2 py-2 text-center">
          <div className="text-white font-semibold text-base">
            {bouwjaar ?? '–'}
          </div>
          <div className="text-white/40 text-xs uppercase tracking-wide mt-0.5">
            Bouwjr
          </div>
        </div>
        <div className="bg-white/15 rounded-lg px-2 py-2 text-center">
          <div className="text-white font-semibold text-base">
            {oppervlakte ? `${oppervlakte}m²` : '–'}
          </div>
          <div className="text-white/40 text-xs uppercase tracking-wide mt-0.5">
            Opp.
          </div>
        </div>
        <div className="bg-white/15 rounded-lg px-2 py-2 text-center">
          <div className="text-white font-semibold text-base truncate">
            {bestemming ?? '–'}
          </div>
          <div className="text-white/40 text-xs uppercase tracking-wide mt-0.5">
            Status
          </div>
        </div>
      </div>

      {/* View Details Button */}
      <button
        onClick={onViewDetails}
        className="w-full bg-white/15 hover:bg-white/25 text-white rounded-lg px-4 py-2.5 font-medium text-sm transition-colors flex items-center justify-center gap-2"
      >
        Bekijk volledige details
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
