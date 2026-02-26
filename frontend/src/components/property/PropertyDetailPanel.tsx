import { useEffect } from 'react';
import type { PropertyReportResponse } from '@/lib/types/property';
import { splitZoningPlans } from '@/lib/zoningPlans';
import PropertySummary from './PropertySummary';
import PropertySection from './PropertySection';

interface PropertyDetailPanelProps {
  data: PropertyReportResponse | null;
  isLoading: boolean;
  error: Error | null;
  onClose: () => void;
}

function PropertyDetailPanel({
  data,
  isLoading,
  error,
  onClose,
}: PropertyDetailPanelProps) {
  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent touch events from propagating to map
  const stopPropagation = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {/* Desktop Panel - Right side */}
      <div
        className="absolute right-4 top-4 bottom-4 w-96 z-[var(--z-property-panel)] hidden md:block"
        onTouchStart={stopPropagation}
        onTouchMove={stopPropagation}
        onTouchEnd={stopPropagation}
      >
        <div className="h-full bg-grey-900 rounded-lg border border-grey-800 shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-grey-800 flex-shrink-0">
            <h2 className="text-grey-100 font-semibold">Eigendomsinformatie</h2>
            <button
              onClick={onClose}
              className="text-grey-400 hover:text-grey-100 p-1 rounded-lg hover:bg-grey-850 transition-colors"
            >
              <svg
                className="w-5 h-5"
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
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {isLoading && <LoadingState />}
            {error && <ErrorState error={error} data={data} />}
            {data && !isLoading && !error && <DataState data={data} />}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet - Slides up from bottom */}
      <div
        className="absolute left-0 right-0 bottom-0 z-[var(--z-property-panel)] md:hidden max-h-[65vh]"
        onTouchStart={stopPropagation}
        onTouchMove={stopPropagation}
        onTouchEnd={stopPropagation}
      >
        <div className="h-full bg-grey-900 rounded-t-lg border-t border-x border-grey-800 shadow-2xl overflow-hidden flex flex-col">
          {/* Header with drag handle */}
          <div className="flex flex-col flex-shrink-0">
            <div className="flex justify-center py-2">
              <div className="w-12 h-1 bg-grey-600 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b border-grey-800">
              <h2 className="text-grey-100 font-semibold text-sm">Eigendomsinformatie</h2>
              <button
                onClick={onClose}
                className="text-grey-400 hover:text-grey-100 p-1 rounded-lg hover:bg-grey-850 transition-colors"
              >
                <svg
                  className="w-5 h-5"
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
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {isLoading && <LoadingState />}
            {error && <ErrorState error={error} data={data} />}
            {data && !isLoading && !error && <DataState data={data} />}
          </div>
        </div>
      </div>
    </>
  );
}

function LoadingState() {
  return (
    <div className="p-4 space-y-4">
      {/* Skeleton for address */}
      <div className="space-y-2">
        <div className="h-5 bg-grey-800 animate-pulse rounded w-3/4" />
        <div className="h-4 bg-grey-800 animate-pulse rounded w-1/2" />
      </div>

      {/* Skeleton for metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 bg-grey-800 animate-pulse rounded-lg" />
        <div className="h-16 bg-grey-800 animate-pulse rounded-lg" />
        <div className="h-16 bg-grey-800 animate-pulse rounded-lg" />
      </div>

      {/* Skeleton for sections */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-grey-800 animate-pulse rounded" />
      ))}
    </div>
  );
}

function ErrorState({
  error,
  data,
}: {
  error: Error;
  data: PropertyReportResponse | null;
}) {
  const errorMessage =
    data?.errors && data.errors.length > 0
      ? data.errors.join(', ')
      : error.message || 'Er ging iets mis bij het ophalen van de gegevens.';

  return (
    <div className="p-4 flex flex-col items-center justify-center h-full text-center">
      <svg
        className="w-12 h-12 text-error mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <p className="text-grey-400 text-sm mb-2">{errorMessage}</p>
      <p className="text-grey-600 text-xs">Probeer opnieuw</p>
    </div>
  );
}

function DataState({ data }: { data: PropertyReportResponse }) {
  return (
    <>
      {/* Summary */}
      <PropertySummary data={data} />

      {/* Kadaster Section */}
      <PropertySection title="Kadaster">
        <KadasterContent data={data} />
      </PropertySection>

      {/* Bestemming Section */}
      <PropertySection title="Bestemming">
        <BestemmingContent data={data} />
      </PropertySection>

      {/* Monument Section */}
      <PropertySection title="Monument">
        <MonumentContent data={data} />
      </PropertySection>

      {/* Bronnen Section */}
      <PropertySection title="Bronnen">
        <BronnenContent data={data} />
      </PropertySection>
    </>
  );
}

function KadasterContent({ data }: { data: PropertyReportResponse }) {
  const parcels = data.cadastral_parcels || [];

  if (parcels.length === 0) {
    return (
      <p className="text-grey-400 italic">
        Geen kadastrale gegevens beschikbaar
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {parcels.map((parcel, idx) => (
        <div
          key={idx}
          className="bg-grey-850 rounded-md p-3 space-y-1 border border-grey-800"
        >
          {parcel.kadastrale_aanduiding && (
            <div>
              <span className="text-grey-600 text-xs uppercase tracking-wide">
                Aanduiding
              </span>
              <div className="text-grey-100 font-medium">
                {parcel.kadastrale_aanduiding}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {parcel.perceelnummer && (
              <div>
                <span className="text-grey-600 text-xs">Perceelnummer</span>
                <div className="text-grey-100 text-sm">
                  {parcel.perceelnummer}
                </div>
              </div>
            )}
            {parcel.sectie && (
              <div>
                <span className="text-grey-600 text-xs">Sectie</span>
                <div className="text-grey-100 text-sm">{parcel.sectie}</div>
              </div>
            )}
          </div>
          {parcel.oppervlakte && (
            <div className="mt-2">
              <span className="text-grey-600 text-xs">Oppervlakte</span>
              <div className="text-grey-100 text-sm">
                {parcel.oppervlakte} m²
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BestemmingContent({ data }: { data: PropertyReportResponse }) {
  const zoning = data.zoning;

  if (!zoning) {
    return (
      <p className="text-grey-400 italic">
        Geen bestemmingsplangegevens beschikbaar
      </p>
    );
  }

  const { actionablePlans, policyPlans } = splitZoningPlans(zoning.plans);

  return (
    <div className="space-y-3">
      {/* Primary bestemming */}
      {zoning.primary_bestemming && (
        <div className="bg-info/10 border border-info/30 rounded-lg p-3">
          <span className="text-grey-600 text-xs uppercase tracking-wide">
            Hoofdbestemming
          </span>
          <div className="text-grey-100 font-medium text-base">
            {zoning.primary_bestemming}
          </div>
        </div>
      )}

      {/* Building dimensions */}
      {zoning.building_dimensions && (
        <div className="space-y-2">
          <div className="text-grey-400 text-xs uppercase tracking-wide font-medium">
            Bouwregels
          </div>
          <div className="bg-grey-850 rounded-md p-3 space-y-1.5">
            {zoning.building_dimensions.max_hoogte && (
              <div className="flex justify-between">
                <span className="text-grey-600 text-xs">Max. hoogte</span>
                <span className="text-grey-100 text-sm font-medium">
                  {zoning.building_dimensions.max_hoogte} m
                </span>
              </div>
            )}
            {zoning.building_dimensions.max_goothoogte && (
              <div className="flex justify-between">
                <span className="text-grey-600 text-xs">Max. goothoogte</span>
                <span className="text-grey-100 text-sm font-medium">
                  {zoning.building_dimensions.max_goothoogte} m
                </span>
              </div>
            )}
            {zoning.building_dimensions.max_bebouwingspercentage && (
              <div className="flex justify-between">
                <span className="text-grey-600 text-xs">
                  Max. bebouwingspercentage
                </span>
                <span className="text-grey-100 text-sm font-medium">
                  {zoning.building_dimensions.max_bebouwingspercentage}%
                </span>
              </div>
            )}
            {zoning.building_dimensions.max_floor_area_ratio && (
              <div className="flex justify-between">
                <span className="text-grey-600 text-xs">Max. FSI</span>
                <span className="text-grey-100 text-sm font-medium">
                  {zoning.building_dimensions.max_floor_area_ratio}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zoning plans */}
      {actionablePlans.length > 0 && (
        <div className="space-y-2">
          <div className="text-grey-400 text-xs uppercase tracking-wide font-medium">
            Plannen op locatie ({actionablePlans.length})
          </div>
          {actionablePlans.map((plan, idx) => (
            <div
              key={idx}
              className="bg-grey-850 rounded-md p-3 space-y-2 border border-grey-800"
            >
              <div>
                <div className="text-grey-100 font-medium text-sm">
                  {plan.plan_naam}
                </div>
                {plan.plan_status && (
                  <div className="text-grey-400 text-xs mt-0.5">
                    Status: {plan.plan_status}
                  </div>
                )}
                {plan.plan_datum && (
                  <div className="text-grey-600 text-xs">
                    Datum: {new Date(plan.plan_datum).toLocaleDateString('nl-NL')}
                  </div>
                )}
              </div>
              {plan.rules && plan.rules.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-grey-800">
                  {plan.rules.map((rule, ruleIdx) => (
                    <div key={ruleIdx} className="text-xs">
                      <div className="text-grey-100 font-medium">
                        {rule.bestemming}
                      </div>
                      {rule.omschrijving && (
                        <div className="text-grey-400 mt-0.5">
                          {rule.omschrijving}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {policyPlans.length > 0 && (
        <details className="bg-grey-850 rounded-md border border-grey-800">
          <summary className="cursor-pointer px-3 py-2 text-grey-400 text-xs uppercase tracking-wide font-medium">
            Beleidskaders (niet perceelspecifiek) ({policyPlans.length})
          </summary>
          <div className="space-y-2 border-t border-grey-800 px-3 py-2">
            {policyPlans.map((plan, idx) => (
              <div key={idx} className="rounded border border-grey-800 bg-grey-900/40 px-2.5 py-2">
                <div className="text-grey-100 text-sm font-medium">{plan.plan_naam}</div>
                <div className="text-grey-500 text-xs mt-0.5">
                  {[plan.plan_status, plan.plan_type, plan.plan_datum ? new Date(plan.plan_datum).toLocaleDateString('nl-NL') : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Data gaps */}
      {zoning.data_gaps && zoning.data_gaps.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
          <div className="text-yellow-200 text-xs font-medium">
            Onvolledige gegevens
          </div>
          <ul className="text-yellow-200/70 text-xs mt-1 space-y-0.5">
            {zoning.data_gaps.map((gap, idx) => (
              <li key={idx}>• {gap}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MonumentContent({ data }: { data: PropertyReportResponse }) {
  const monuments = data.monuments;

  if (!monuments) {
    return (
      <p className="text-grey-400 italic">
        Geen monumentgegevens beschikbaar
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status badge */}
      <div
        className={`rounded-lg p-3 ${
          monuments.is_monument
            ? 'bg-amber-accent/20 border border-amber-accent/40'
            : 'bg-success/10 border border-success/30'
        }`}
      >
        <div
          className={`font-medium ${
            monuments.is_monument ? 'text-amber-accent' : 'text-success'
          }`}
        >
          {monuments.is_monument ? 'Rijksmonument' : 'Geen monument'}
        </div>
        {monuments.consensus_status && (
          <div
            className={`text-xs mt-1 ${
              monuments.is_monument ? 'text-amber-accent/70' : 'text-success/70'
            }`}
          >
            {monuments.consensus_status}
          </div>
        )}
      </div>

      {/* Conflict warning */}
      {monuments.has_conflict && monuments.conflict_note && (
        <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-3">
          <div className="text-yellow-100 text-xs font-medium">⚠ Let op</div>
          <div className="text-yellow-200/80 text-xs mt-1">
            {monuments.conflict_note}
          </div>
        </div>
      )}

      {/* Restrictions */}
      {monuments.restrictions_summary &&
        monuments.restrictions_summary.length > 0 && (
          <div className="space-y-2">
            <div className="text-grey-400 text-xs uppercase tracking-wide font-medium">
              Beperkingen
            </div>
            <div className="bg-grey-850 rounded-md p-3 border border-grey-800">
              <ul className="text-grey-400 text-xs space-y-1">
                {monuments.restrictions_summary.map((restriction, idx) => (
                  <li key={idx}>• {restriction}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

      {/* Sources */}
      {monuments.sources && monuments.sources.length > 0 && (
        <div className="space-y-1">
          <div className="text-grey-600 text-xs uppercase tracking-wide">
            Bronnen
          </div>
          {monuments.sources.map((source, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs py-1"
            >
              <span className="text-grey-400">{source.source}</span>
              <span
                className={`text-xs ${
                  source.is_monument
                    ? 'text-amber-accent'
                    : 'text-success'
                }`}
              >
                {source.is_monument ? 'Monument' : 'Geen'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BronnenContent({ data }: { data: PropertyReportResponse }) {
  const sectionSources = data.section_sources || [];

  if (sectionSources.length === 0) {
    return (
      <p className="text-grey-400 italic">Geen broninformatie beschikbaar</p>
    );
  }

  const formatAge = (ageSeconds: number | null): string => {
    if (!ageSeconds) return 'Onbekend';

    if (ageSeconds < 60) return 'Zojuist';
    if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)} min geleden`;
    if (ageSeconds < 86400)
      return `${Math.floor(ageSeconds / 3600)} uur geleden`;
    return `${Math.floor(ageSeconds / 86400)} dagen geleden`;
  };

  const getConfidenceBadge = (
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null
  ): { color: string; text: string } => {
    switch (confidence) {
      case 'HIGH':
        return { color: 'text-success', text: 'Hoog' };
      case 'MEDIUM':
        return { color: 'text-warning', text: 'Gemiddeld' };
      case 'LOW':
        return { color: 'text-error', text: 'Laag' };
      default:
        return { color: 'text-grey-600', text: 'Onbekend' };
    }
  };

  return (
    <div className="space-y-3">
      {sectionSources.map((section, idx) => (
        <div key={idx} className="space-y-2">
          <div className="text-grey-400 text-xs uppercase tracking-wide font-medium">
            {section.section}
          </div>
          <div className="space-y-1.5">
            {section.sources.map((source, sourceIdx) => (
              <div
                key={sourceIdx}
                className="bg-grey-850 rounded-md p-2.5 border border-grey-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-grey-100 text-sm font-medium">
                      {source.source}
                    </div>
                    <div className="text-grey-600 text-xs mt-0.5">
                      {formatAge(source.age_seconds)}
                    </div>
                  </div>
                  {source.confidence && (
                    <span
                      className={`text-xs font-medium ${
                        getConfidenceBadge(source.confidence).color
                      }`}
                    >
                      {getConfidenceBadge(source.confidence).text}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Overall data sources */}
      {data.data_sources && data.data_sources.length > 0 && (
        <div className="pt-2 border-t border-grey-800 space-y-1">
          <div className="text-grey-600 text-xs uppercase tracking-wide">
            Alle bronnen
          </div>
          {data.data_sources.map((source, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs py-1"
            >
              <span className="text-grey-400">{source.source}</span>
              <div className="flex items-center gap-2">
                <span className="text-grey-600">
                  {formatAge(source.age_seconds)}
                </span>
                {source.confidence && (
                  <span
                    className={`font-medium ${
                      getConfidenceBadge(source.confidence).color
                    }`}
                  >
                    {getConfidenceBadge(source.confidence).text}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PropertyDetailPanel;
