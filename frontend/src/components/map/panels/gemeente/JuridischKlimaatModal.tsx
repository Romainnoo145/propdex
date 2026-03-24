import { GemeenteModal } from './GemeenteModal'
import { JuridischKlimaatModalContent } from './JuridischKlimaatModalContent'

interface JuridischKlimaatModalProps {
  gemeenteNaam: string
  gemeenteCode: string
  onClose: () => void
}

export function JuridischKlimaatModal({ gemeenteNaam, onClose }: JuridischKlimaatModalProps) {
  return (
    <GemeenteModal
      title={`Juridisch Klimaat · ${gemeenteNaam}`}
      subtitle="Winkans bezwaar, jurisprudentie en documentdetails"
      onClose={onClose}
      maxWidth="max-w-5xl"
    >
      <JuridischKlimaatModalContent gemeenteNaam={gemeenteNaam} />
    </GemeenteModal>
  )
}
