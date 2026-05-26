/**
 * Score weight types for per-org score customization
 *
 * Mirrors backend app/schemas/score_weights.py
 */

export interface ScoreWeightsConfig {
  preset: string
  potentie_risico_balance: number // 0.0-1.0
  potentie_weights: Record<string, number> // factor -> weight 0-10
  risico_weights: Record<string, number>
  score_threshold: number // 0-100, minimum score to show on map
}

export interface ScoreWeightsResponse {
  weights: ScoreWeightsConfig
  is_custom: boolean
  job_id: string | null
}

export interface SaveScoreWeightsRequest {
  preset: string
  potentie_risico_balance: number
  potentie_weights: Record<string, number>
  risico_weights: Record<string, number>
  score_threshold: number
}

export interface RescoreJobStatus {
  status: 'queued' | 'in_progress' | 'complete' | 'failed'
  processed: number
  up_count: number
  down_count: number
  unchanged_count: number
  avg_delta: number
}

// Factor metadata for UI display
export interface FactorMeta {
  key: string
  label: string
  description: string
  categorie: 'potentie' | 'risico'
}

// All potentie factors with Dutch labels
export const POTENTIE_FACTORS: FactorMeta[] = [
  {
    key: 'vrije_grond',
    label: 'Vrije grond',
    description: 'Onbebouwd perceeloppervlak',
    categorie: 'potentie',
  },
  {
    key: 'optoppotentie',
    label: 'Optoppotentie',
    description: 'Hoogteverschil tussen bestaand en maximaal',
    categorie: 'potentie',
  },
  {
    key: 'bestemming',
    label: 'Bestemming',
    description: 'Bestemmingsplan geschiktheid',
    categorie: 'potentie',
  },
  {
    key: 'leegstand',
    label: 'Leegstand',
    description: 'Leegstandsindicatie gebouw',
    categorie: 'potentie',
  },
  {
    key: 'funda_frictie',
    label: 'Funda frictie',
    description: 'Woningmarkt spanning in het gebied',
    categorie: 'potentie',
  },
  {
    key: 'perceelgrootte',
    label: 'Perceelgrootte',
    description: 'Schaalvoordeel bij grotere percelen',
    categorie: 'potentie',
  },
  {
    key: 'demografie',
    label: 'Demografie',
    description: 'Bevolkingsgroei en huishoudenssamenstelling',
    categorie: 'potentie',
  },
  {
    key: 'vergunning_succeskans',
    label: 'Vergunning succeskans',
    description: 'Historische vergunningsslaagkans in de wijk',
    categorie: 'potentie',
  },
]

// All risico factors with Dutch labels
export const RISICO_FACTORS: FactorMeta[] = [
  {
    key: 'funderingsrisico',
    label: 'Funderingsrisico',
    description: 'Houten palen risico bij oudere panden',
    categorie: 'risico',
  },
  {
    key: 'asbest',
    label: 'Asbest',
    description: 'Asbestverdachte materialen',
    categorie: 'risico',
  },
  {
    key: 'bodemverontreiniging',
    label: 'Bodemverontreiniging',
    description: 'Bekende bodemvervuiling',
    categorie: 'risico',
  },
  {
    key: 'monument',
    label: 'Monument',
    description: 'Monumentstatus beperkingen',
    categorie: 'risico',
  },
  {
    key: 'bestemmingswijziging',
    label: 'Bestemmingswijziging',
    description: 'Noodzaak tot bestemmingsplanwijziging',
    categorie: 'risico',
  },
  {
    key: 'constructieve_staat',
    label: 'Constructieve staat',
    description: 'Bouwkundige staat van het pand',
    categorie: 'risico',
  },
  {
    key: 'juridisch_klimaat',
    label: 'Juridisch klimaat',
    description: 'Bezwaarhistorie in de gemeente',
    categorie: 'risico',
  },
  {
    key: 'criminaliteit',
    label: 'Criminaliteit',
    description: 'Veiligheidscijfers wijk',
    categorie: 'risico',
  },
  {
    key: 'max_hoogte_bereikt',
    label: 'Max hoogte bereikt',
    description: 'Bouwhoogte limiet al benut',
    categorie: 'risico',
  },
  {
    key: 'natura2000',
    label: 'Natura2000',
    description: 'Nabijheid beschermd natuurgebied',
    categorie: 'risico',
  },
  {
    key: 'overstromingsrisico',
    label: 'Overstromingsrisico',
    description: 'Ligging in overstromingsgebied',
    categorie: 'risico',
  },
  {
    key: 'geluid',
    label: 'Geluid',
    description: 'Geluidbelasting op de locatie',
    categorie: 'risico',
  },
  {
    key: 'luchtkwaliteit',
    label: 'Luchtkwaliteit',
    description: 'NO2/PM10 concentraties',
    categorie: 'risico',
  },
]

// Default weights matching backend DEFAULT_WEIGHTS
export const DEFAULT_WEIGHTS: ScoreWeightsConfig = {
  preset: 'standaard',
  potentie_risico_balance: 0.7,
  score_threshold: 50,
  potentie_weights: {
    vrije_grond: 12,
    optoppotentie: 10,
    bestemming: 12,
    leegstand: 8,
    funda_frictie: 5,
    perceelgrootte: 12,
    demografie: 8,
    vergunning_succeskans: 13,
  },
  risico_weights: {
    funderingsrisico: 15,
    asbest: 6,
    bodemverontreiniging: 7,
    monument: 5,
    bestemmingswijziging: 8,
    constructieve_staat: 7,
    juridisch_klimaat: 8,
    criminaliteit: 6,
    max_hoogte_bereikt: 5,
    natura2000: 5,
    overstromingsrisico: 6,
    geluid: 5,
    luchtkwaliteit: 4,
  },
}

// Preset definitions
export interface PresetDef {
  id: string
  name: string
  description: string
  config: ScoreWeightsConfig
}

// Project-type-driven startprofielen.
// Preset id == ProjectType enum value (zie lib/types/projectType.ts). Mirror van
// backend M047 FACTOR_REGISTRY.weight_by_projecttype — niet identiek (frontend mist
// woonvisie_match + 3 BRK-factoren) maar reflecteert dezelfde intent per type.
// Risk-appetite (Agressief..Conservatief) blijft een orthogonale tweak in RiskAppetite.tsx.
// prettier-ignore
export const PRESETS: PresetDef[] = [
  {
    id: 'nieuwbouw_wonen', name: 'Nieuwbouw', description: 'Greenfield ontwikkeling — vrije grond + vergunning bepalend',
    config: {
      preset: 'nieuwbouw_wonen', potentie_risico_balance: 0.7, score_threshold: 50,
      potentie_weights: { vrije_grond: 15, optoppotentie: 5, bestemming: 14, leegstand: 7, funda_frictie: 8, perceelgrootte: 16, demografie: 10, vergunning_succeskans: 18 },
      risico_weights: { funderingsrisico: 10, asbest: 6, bodemverontreiniging: 10, monument: 4, bestemmingswijziging: 10, constructieve_staat: 5, juridisch_klimaat: 8, criminaliteit: 6, max_hoogte_bereikt: 5, natura2000: 8, overstromingsrisico: 7, geluid: 5, luchtkwaliteit: 4 },
    },
  },
  {
    id: 'transformatie_wonen', name: 'Transformatie', description: 'Herbestemmen bestaand vastgoed — leegstand + bestemmingswijziging centraal',
    config: {
      preset: 'transformatie_wonen', potentie_risico_balance: 0.5, score_threshold: 50,
      potentie_weights: { vrije_grond: 8, optoppotentie: 10, bestemming: 18, leegstand: 18, funda_frictie: 8, perceelgrootte: 10, demografie: 10, vergunning_succeskans: 15 },
      risico_weights: { funderingsrisico: 12, asbest: 14, bodemverontreiniging: 10, monument: 8, bestemmingswijziging: 18, constructieve_staat: 14, juridisch_klimaat: 10, criminaliteit: 4, max_hoogte_bereikt: 3, natura2000: 3, overstromingsrisico: 4, geluid: 4, luchtkwaliteit: 3 },
    },
  },
  {
    id: 'optoppen', name: 'Optoppen', description: 'Extra lagen op bestaand pand — optoppotentie + draagkracht beslissend',
    config: {
      preset: 'optoppen', potentie_risico_balance: 0.4, score_threshold: 50,
      potentie_weights: { vrije_grond: 8, optoppotentie: 20, bestemming: 12, leegstand: 4, funda_frictie: 6, perceelgrootte: 10, demografie: 8, vergunning_succeskans: 14 },
      risico_weights: { funderingsrisico: 18, asbest: 10, bodemverontreiniging: 4, monument: 10, bestemmingswijziging: 6, constructieve_staat: 18, juridisch_klimaat: 8, criminaliteit: 4, max_hoogte_bereikt: 14, natura2000: 2, overstromingsrisico: 2, geluid: 4, luchtkwaliteit: 3 },
    },
  },
  {
    id: 'splitsen', name: 'Splitsen', description: 'Woning splitsen in meerdere units — vergunning + bestemming kritisch',
    config: {
      preset: 'splitsen', potentie_risico_balance: 0.55, score_threshold: 50,
      potentie_weights: { vrije_grond: 6, optoppotentie: 8, bestemming: 14, leegstand: 10, funda_frictie: 10, perceelgrootte: 14, demografie: 10, vergunning_succeskans: 18 },
      risico_weights: { funderingsrisico: 10, asbest: 10, bodemverontreiniging: 4, monument: 10, bestemmingswijziging: 14, constructieve_staat: 12, juridisch_klimaat: 10, criminaliteit: 5, max_hoogte_bereikt: 4, natura2000: 3, overstromingsrisico: 4, geluid: 5, luchtkwaliteit: 4 },
    },
  },
  {
    id: 'commercieel_naar_wonen', name: 'Commercieel → wonen', description: 'Kantoor/winkel naar woonbestemming — leegstand + bestemmingswijziging dominant',
    config: {
      preset: 'commercieel_naar_wonen', potentie_risico_balance: 0.55, score_threshold: 50,
      potentie_weights: { vrije_grond: 6, optoppotentie: 10, bestemming: 20, leegstand: 18, funda_frictie: 8, perceelgrootte: 10, demografie: 10, vergunning_succeskans: 14 },
      risico_weights: { funderingsrisico: 8, asbest: 10, bodemverontreiniging: 10, monument: 6, bestemmingswijziging: 20, constructieve_staat: 10, juridisch_klimaat: 10, criminaliteit: 5, max_hoogte_bereikt: 3, natura2000: 3, overstromingsrisico: 4, geluid: 8, luchtkwaliteit: 6 },
    },
  },
]

// ── Use-case scoring types ──────────────────────────────────────

export interface UseCaseScore {
  use_case: string
  label: string
  score: number
  category: 'Hoog' | 'Gemiddeld' | 'Laag'
  top_factors: string[]
  description: string
}

export type UseCaseScores = Record<'optoppen' | 'splitsen' | 'transformatie' | 'nieuwbouw', UseCaseScore>

/** Colors per use case for UI consistency */
export const USE_CASE_COLORS: Record<string, string> = {
  optoppen: '#8b5cf6',      // violet
  splitsen: '#0ea5e9',      // sky
  transformatie: '#f59e0b',  // amber
  nieuwbouw: '#22c55e',     // green
}
