export type ProjectType =
  | 'nieuwbouw_wonen'
  | 'transformatie_wonen'
  | 'optoppen'
  | 'splitsen'
  | 'commercieel_naar_wonen'
  | 'onbepaald'

export const PROJECT_TYPE_VALUES: readonly ProjectType[] = [
  'nieuwbouw_wonen',
  'transformatie_wonen',
  'optoppen',
  'splitsen',
  'commercieel_naar_wonen',
  'onbepaald',
] as const

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  nieuwbouw_wonen: 'Nieuwbouw wonen',
  transformatie_wonen: 'Transformatie wonen',
  optoppen: 'Optoppen',
  splitsen: 'Splitsen',
  commercieel_naar_wonen: 'Commercieel \u2192 wonen',
  onbepaald: 'Onbepaald',
}

export interface ProjectTypeResponse {
  parcel_id: string
  project_type: ProjectType
  set_at: string | null // ISO timestamp or null (default response)
  set_by_user_id: string | null
}
