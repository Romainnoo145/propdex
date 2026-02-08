import type { PropertyReportResponse } from '@/lib/types/property';

interface PropertySummaryProps {
  data: PropertyReportResponse;
}

function PropertySummary({ data }: PropertySummaryProps) {
  const { address, building, zoning, monuments, completeness_score } = data;

  const bouwjaar = building?.bouwjaar ?? null;
  const oppervlakte = building?.oppervlakte ?? null;
  const bestemming = zoning?.primary_bestemming ?? null;
  const isMonument = monuments?.is_monument ?? false;
  const monumentStatus = monuments?.consensus_status ?? null;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Address */}
      <div className="space-y-0.5">
        <div className="text-white text-base font-semibold">
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
        <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
          <div className="text-white font-medium text-base">
            {bouwjaar ?? 'Onbekend'}
          </div>
          <div className="text-white/40 text-xs uppercase tracking-wide mt-0.5">
            Bouwjr
          </div>
        </div>
        <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
          <div className="text-white font-medium text-base">
            {oppervlakte ? `${oppervlakte}m²` : '–'}
          </div>
          <div className="text-white/40 text-xs uppercase tracking-wide mt-0.5">
            Opp.
          </div>
        </div>
        <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
          <div className="text-white font-medium text-base truncate">
            {bestemming ?? '–'}
          </div>
          <div className="text-white/40 text-xs uppercase tracking-wide mt-0.5">
            Best.
          </div>
        </div>
      </div>

      {/* Monument Badge */}
      {isMonument && monumentStatus && (
        <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-amber-400 text-base">🏛</span>
          <span className="text-amber-100 text-sm font-medium">
            {monumentStatus}
          </span>
        </div>
      )}

      {/* Completeness Score */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-white/40 text-xs uppercase tracking-wide">
            Compleetheid
          </span>
          <span className="text-white/60 text-xs font-medium">
            {Math.round(completeness_score * 100)}%
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
          <div
            className="bg-green-500 h-full transition-all duration-300"
            style={{ width: `${completeness_score * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default PropertySummary;
