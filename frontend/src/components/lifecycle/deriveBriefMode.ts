/**
 * deriveBriefMode — M052/S04 pure mode-derivatie voor de BriefCard.
 *
 * 'auto'  → rechtspersoon/overheid-BRK-record aanwezig (NAW auto-gevuld).
 * 'manual'→ geen record (particulier of niet-gepersisteerd): NAW handmatig.
 */
export type BriefMode = 'auto' | 'manual'

export function deriveBriefMode(input: { hasBrkRecord: boolean }): BriefMode {
  return input.hasBrkRecord ? 'auto' : 'manual'
}
