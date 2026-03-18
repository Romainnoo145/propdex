import { GemeenteModal } from './GemeenteModal'
import { JurisprudenceSection } from '@/components/projects/JurisprudenceSection'

interface JuridischKlimaatModalProps {
  gemeenteNaam: string
  gemeenteCode: string
  onClose: () => void
}

/**
 * Juridisch Klimaat modal — thin wrapper around existing JurisprudenceSection.
 * The section component handles its own data fetching via hooks.
 */
export function JuridischKlimaatModal({ gemeenteNaam, onClose }: JuridischKlimaatModalProps) {
  return (
    <GemeenteModal title={`Juridisch Klimaat · ${gemeenteNaam}`} onClose={onClose} maxWidth="max-w-5xl">
      <JurisprudenceSection gemeenteNaam={gemeenteNaam} wijkNaam={null} />
    </GemeenteModal>
  )
}
