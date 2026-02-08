import type { PropertyReportResponse } from '@/lib/types/property';
import { Drawer } from '@/components/ui/Drawer';
import PropertySummary from './PropertySummary';
import PropertySection from './PropertySection';
import { FreshnessIndicator, FRESHNESS_THRESHOLDS } from './FreshnessIndicator';
import { SourceBadge } from './SourceBadge';

interface PropertyDetailDrawerProps {
  data: PropertyReportResponse | null;
  isLoading: boolean;
  error: Error | null;
  onClose: () => void;
  onExportPDF: () => void;
  onSave: () => void;
  onRefreshSection?: (section: string) => void;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
}

/**
 * PropertyDetailDrawer (Tier 2)
 * Full-height drawer sliding in from right with all property sections
 * Uses Drawer primitive with glassmorphism styling
 */
export function PropertyDetailDrawer({
  data,
  isLoading,
  error,
  onClose,
  onExportPDF,
  onSave,
  onRefreshSection,
  onRefreshAll,
  isRefreshing = false,
}: PropertyDetailDrawerProps) {
  const isOpen = !!data || isLoading;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width="md">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
        <h2 className="text-white font-semibold text-lg">Eigendomsinformatie</h2>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Save/Bookmark button */}
          <button
            onClick={onSave}
            className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Opslaan"
            title="Opslaan"
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
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>

          {/* Export PDF button */}
          <button
            onClick={onExportPDF}
            className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Exporteren naar PDF"
            title="Exporteren naar PDF"
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Sluiten"
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
        {data && !isLoading && !error && (
          <DataState
            data={data}
            onRefreshSection={onRefreshSection}
            onRefreshAll={onRefreshAll}
            isRefreshing={isRefreshing}
          />
        )}
      </div>
    </Drawer>
  );
}

function LoadingState() {
  return (
    <div className="p-4 space-y-4">
      {/* Skeleton for address */}
      <div className="space-y-2">
        <div className="h-5 bg-white/10 animate-pulse rounded w-3/4" />
        <div className="h-4 bg-white/10 animate-pulse rounded w-1/2" />
      </div>

      {/* Skeleton for metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 bg-white/10 animate-pulse rounded-lg" />
        <div className="h-16 bg-white/10 animate-pulse rounded-lg" />
        <div className="h-16 bg-white/10 animate-pulse rounded-lg" />
      </div>

      {/* Skeleton for sections */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-white/10 animate-pulse rounded" />
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
        className="w-12 h-12 text-red-400 mb-4"
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
      <p className="text-white/70 text-sm mb-2">{errorMessage}</p>
      <p className="text-white/40 text-xs">Probeer opnieuw</p>
    </div>
  );
}

function DataState({
  data,
  onRefreshSection,
  onRefreshAll,
  isRefreshing,
}: {
  data: PropertyReportResponse;
  onRefreshSection?: (section: string) => void;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
}) {
  // Helper to find section source info
  const getSectionSource = (sectionName: string) => {
    return data.section_sources?.find(
      (s) => s.section.toLowerCase() === sectionName.toLowerCase()
    );
  };

  // Kadaster section metadata
  const kadasterSource = getSectionSource('kadaster');
  const kadasterBadge = kadasterSource?.sources?.[0] && (
    <SourceBadge
      source="Kadaster"
      cachedAt={kadasterSource.sources[0].cached_at}
    />
  );
  const kadasterFreshness = kadasterSource?.age_seconds !== undefined && (
    <FreshnessIndicator
      sectionName="Kadaster"
      ageSeconds={kadasterSource.age_seconds}
      freshnessThresholdDays={FRESHNESS_THRESHOLDS.kadaster}
      onRefresh={() => onRefreshSection?.('kadaster')}
      isRefreshing={isRefreshing}
    />
  );

  // Bestemming section metadata
  const bestemmingSource = getSectionSource('bestemming');
  const bestemmingBadge = bestemmingSource?.sources?.[0] && (
    <SourceBadge
      source="DSO / Ruimtelijkeplannen"
      cachedAt={bestemmingSource.sources[0].cached_at}
    />
  );
  const bestemmingFreshness = bestemmingSource?.age_seconds !== undefined && (
    <FreshnessIndicator
      sectionName="Bestemming"
      ageSeconds={bestemmingSource.age_seconds}
      freshnessThresholdDays={FRESHNESS_THRESHOLDS.bestemming}
      onRefresh={() => onRefreshSection?.('bestemming')}
      isRefreshing={isRefreshing}
    />
  );

  // Monument section metadata
  const monumentSource = getSectionSource('monument');
  const monumentBadge = monumentSource?.sources?.[0] && (
    <SourceBadge
      source="RCE / Erfgoedregister"
      cachedAt={monumentSource.sources[0].cached_at}
    />
  );
  const monumentFreshness = monumentSource?.age_seconds !== undefined && (
    <FreshnessIndicator
      sectionName="Monument"
      ageSeconds={monumentSource.age_seconds}
      freshnessThresholdDays={FRESHNESS_THRESHOLDS.monument}
      onRefresh={() => onRefreshSection?.('monument')}
      isRefreshing={isRefreshing}
    />
  );

  return (
    <>
      {/* Summary */}
      <PropertySummary data={data} />

      {/* Kadaster Section */}
      <PropertySection title="Kadaster" badge={kadasterFreshness}>
        <div className="space-y-3">
          {kadasterBadge}
          <KadasterContent data={data} />
        </div>
      </PropertySection>

      {/* Bestemming Section */}
      <PropertySection title="Bestemming" badge={bestemmingFreshness}>
        <div className="space-y-3">
          {bestemmingBadge}
          <BestemmingContent data={data} />
        </div>
      </PropertySection>

      {/* Monument Section */}
      <PropertySection title="Monument" badge={monumentFreshness}>
        <div className="space-y-3">
          {monumentBadge}
          <MonumentContent data={data} />
        </div>
      </PropertySection>

      {/* Bronnen Section */}
      <PropertySection title="Bronnen">
        <BronnenContent data={data} />
      </PropertySection>

      {/* Update alle bronnen button */}
      {onRefreshAll && (
        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isRefreshing ? 'Bezig met updaten...' : 'Update alle bronnen'}
          </button>
        </div>
      )}
    </>
  );
}

function KadasterContent({ data }: { data: PropertyReportResponse }) {
  const parcels = data.cadastral_parcels || [];

  if (parcels.length === 0) {
    return (
      <p className="text-white/50 italic">
        Geen kadastrale gegevens beschikbaar
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {parcels.map((parcel, idx) => (
        <div
          key={idx}
          className="bg-white/5 rounded-lg p-3 space-y-1 border border-white/10"
        >
          {parcel.kadastrale_aanduiding && (
            <div>
              <span className="text-white/40 text-xs uppercase tracking-wide">
                Aanduiding
              </span>
              <div className="text-white/90 font-medium">
                {parcel.kadastrale_aanduiding}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {parcel.perceelnummer && (
              <div>
                <span className="text-white/40 text-xs">Perceelnummer</span>
                <div className="text-white/80 text-sm">
                  {parcel.perceelnummer}
                </div>
              </div>
            )}
            {parcel.sectie && (
              <div>
                <span className="text-white/40 text-xs">Sectie</span>
                <div className="text-white/80 text-sm">{parcel.sectie}</div>
              </div>
            )}
          </div>
          {parcel.oppervlakte && (
            <div className="mt-2">
              <span className="text-white/40 text-xs">Oppervlakte</span>
              <div className="text-white/80 text-sm">
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
      <p className="text-white/50 italic">
        Geen bestemmingsplangegevens beschikbaar
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Primary bestemming */}
      {zoning.primary_bestemming && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <span className="text-white/40 text-xs uppercase tracking-wide">
            Hoofdbestemming
          </span>
          <div className="text-white/90 font-medium text-base">
            {zoning.primary_bestemming}
          </div>
        </div>
      )}

      {/* Building dimensions */}
      {zoning.building_dimensions && (
        <div className="space-y-2">
          <div className="text-white/60 text-xs uppercase tracking-wide font-medium">
            Bouwregels
          </div>
          <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
            {zoning.building_dimensions.max_hoogte && (
              <div className="flex justify-between">
                <span className="text-white/40 text-xs">Max. hoogte</span>
                <span className="text-white/80 text-sm font-medium">
                  {zoning.building_dimensions.max_hoogte} m
                </span>
              </div>
            )}
            {zoning.building_dimensions.max_goothoogte && (
              <div className="flex justify-between">
                <span className="text-white/40 text-xs">Max. goothoogte</span>
                <span className="text-white/80 text-sm font-medium">
                  {zoning.building_dimensions.max_goothoogte} m
                </span>
              </div>
            )}
            {zoning.building_dimensions.max_bebouwingspercentage && (
              <div className="flex justify-between">
                <span className="text-white/40 text-xs">
                  Max. bebouwingspercentage
                </span>
                <span className="text-white/80 text-sm font-medium">
                  {zoning.building_dimensions.max_bebouwingspercentage}%
                </span>
              </div>
            )}
            {zoning.building_dimensions.max_floor_area_ratio && (
              <div className="flex justify-between">
                <span className="text-white/40 text-xs">Max. FSI</span>
                <span className="text-white/80 text-sm font-medium">
                  {zoning.building_dimensions.max_floor_area_ratio}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zoning plans */}
      {zoning.plans && zoning.plans.length > 0 && (
        <div className="space-y-2">
          <div className="text-white/60 text-xs uppercase tracking-wide font-medium">
            Bestemmingsplannen
          </div>
          {zoning.plans.map((plan, idx) => (
            <div
              key={idx}
              className="bg-white/5 rounded-lg p-3 space-y-2 border border-white/10"
            >
              <div>
                <div className="text-white/90 font-medium text-sm">
                  {plan.plan_naam}
                </div>
                {plan.plan_status && (
                  <div className="text-white/50 text-xs mt-0.5">
                    Status: {plan.plan_status}
                  </div>
                )}
                {plan.plan_datum && (
                  <div className="text-white/40 text-xs">
                    Datum: {new Date(plan.plan_datum).toLocaleDateString('nl-NL')}
                  </div>
                )}
              </div>
              {plan.rules && plan.rules.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  {plan.rules.map((rule, ruleIdx) => (
                    <div key={ruleIdx} className="text-xs">
                      <div className="text-white/80 font-medium">
                        {rule.bestemming}
                      </div>
                      {rule.omschrijving && (
                        <div className="text-white/50 mt-0.5">
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
      <p className="text-white/50 italic">
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
            ? 'bg-amber-500/20 border border-amber-500/40'
            : 'bg-green-500/10 border border-green-500/30'
        }`}
      >
        <div
          className={`font-medium ${
            monuments.is_monument ? 'text-amber-100' : 'text-green-100'
          }`}
        >
          {monuments.is_monument ? 'Rijksmonument' : 'Geen monument'}
        </div>
        {monuments.consensus_status && (
          <div
            className={`text-xs mt-1 ${
              monuments.is_monument ? 'text-amber-200/70' : 'text-green-200/70'
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
            <div className="text-white/60 text-xs uppercase tracking-wide font-medium">
              Beperkingen
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <ul className="text-white/70 text-xs space-y-1">
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
          <div className="text-white/40 text-xs uppercase tracking-wide">
            Bronnen
          </div>
          {monuments.sources.map((source, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs py-1"
            >
              <span className="text-white/60">{source.source}</span>
              <span
                className={`text-xs ${
                  source.is_monument
                    ? 'text-amber-400'
                    : 'text-green-400'
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
      <p className="text-white/50 italic">Geen broninformatie beschikbaar</p>
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
        return { color: 'text-green-400', text: 'Hoog' };
      case 'MEDIUM':
        return { color: 'text-yellow-400', text: 'Gemiddeld' };
      case 'LOW':
        return { color: 'text-red-400', text: 'Laag' };
      default:
        return { color: 'text-white/40', text: 'Onbekend' };
    }
  };

  return (
    <div className="space-y-3">
      {sectionSources.map((section, idx) => (
        <div key={idx} className="space-y-2">
          <div className="text-white/60 text-xs uppercase tracking-wide font-medium">
            {section.section}
          </div>
          <div className="space-y-1.5">
            {section.sources.map((source, sourceIdx) => (
              <div
                key={sourceIdx}
                className="bg-white/5 rounded-lg p-2.5 border border-white/10"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-white/80 text-sm font-medium">
                      {source.source}
                    </div>
                    <div className="text-white/40 text-xs mt-0.5">
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
        <div className="pt-2 border-t border-white/10 space-y-1">
          <div className="text-white/40 text-xs uppercase tracking-wide">
            Alle bronnen
          </div>
          {data.data_sources.map((source, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs py-1"
            >
              <span className="text-white/60">{source.source}</span>
              <div className="flex items-center gap-2">
                <span className="text-white/40">
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
