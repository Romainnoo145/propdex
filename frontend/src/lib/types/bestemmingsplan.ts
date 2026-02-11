/**
 * TypeScript types for bestemmingsplan (zoning plan) features.
 */

/**
 * Information about a bestemmingsplan zone feature.
 *
 * This represents a single zoning area (enkelbestemming) from PDOK WMS.
 * Used by Plan 22-02 for click interactions and zone detail display.
 */
export interface ZoneFeatureInfo {
  /** Name of the zoning plan */
  planNaam: string;

  /** Type of zoning designation (e.g., "Wonen", "Bedrijventerrein") */
  bestemmingType: string;

  /** Current status of the plan (e.g., "Vastgesteld", "Ontwerp") */
  planStatus: string | null;

  /** URL to the official plan document on ruimtelijkeplannen.nl */
  planLink: string | null;
}
