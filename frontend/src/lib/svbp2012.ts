/**
 * SVBP2012 hoofdgroep color mapping for bestemmingsplan zones.
 *
 * Colors approximate SVBP2012 v1.3.2 as rendered by PDOK WMS.
 * Verify with actual tiles and adjust if needed.
 *
 * These colors are used by:
 * - Legend component (Plan 22-03)
 * - Future zone identification (Plan 22-02)
 */

export interface HoofdgroepEntry {
  key: string;
  label: string;
  color: string;
}

/**
 * SVBP2012 hoofdgroep definitions.
 * Each entry represents a primary land-use category with its display color.
 */
export const SVBP2012_HOOFDGROEPEN: HoofdgroepEntry[] = [
  { key: 'wonen', label: 'Wonen', color: '#ff0000' },
  { key: 'bedrijventerrein', label: 'Bedrijventerrein', color: '#cc66ff' },
  { key: 'gemengd', label: 'Gemengd', color: '#a5508d' },
  { key: 'maatschappelijk', label: 'Maatschappelijk', color: '#ffcc00' },
  { key: 'centrum', label: 'Centrum', color: '#ff6600' },
  { key: 'detailhandel', label: 'Detailhandel', color: '#ff3399' },
  { key: 'horeca', label: 'Horeca', color: '#cc0066' },
  { key: 'kantoor', label: 'Kantoor', color: '#b2b2b2' },
  { key: 'sport', label: 'Sport', color: '#00cc00' },
  { key: 'recreatie', label: 'Recreatie', color: '#009933' },
  { key: 'groen', label: 'Groen', color: '#99cc00' },
  { key: 'agrarisch', label: 'Agrarisch', color: '#ccff00' },
  { key: 'natuur', label: 'Natuur', color: '#009966' },
  { key: 'water', label: 'Water', color: '#66ccff' },
  { key: 'verkeer', label: 'Verkeer', color: '#808080' },
  { key: 'tuin', label: 'Tuin', color: '#66ff66' },
  { key: 'overig', label: 'Overig', color: '#d9d9d9' },
];

/** Union type of all hoofdgroep keys */
export type Hoofdgroep = typeof SVBP2012_HOOFDGROEPEN[number]['key'];

/**
 * Get hoofdgroep entry by key.
 *
 * @param key - Hoofdgroep key to lookup
 * @returns Hoofdgroep entry or undefined if not found
 */
export function getHoofdgroepByKey(key: string): HoofdgroepEntry | undefined {
  return SVBP2012_HOOFDGROEPEN.find((hg) => hg.key === key);
}
