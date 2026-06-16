/**
 * HuisvestingsverordeningPopup stories — M053/S12 splitsingsrisico cascade showcase.
 *
 * One story per key verdict state. Mirrors OmgevingsvisiePopup.stories.tsx
 * structure (Meta from @storybook/react-vite, play-functions asserting minimal
 * DOM via Storybook test helpers).
 */

import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, within, userEvent } from 'storybook/test'
import { HuisvestingsverordeningPopup } from '@/components/map/panels/parcel/HuisvestingsverordeningPopup'
import type { Randvoorwaarde } from '@/components/map/panels/parcel/OmgevingsvisiePopup'

const meta: Meta<typeof HuisvestingsverordeningPopup> = {
  title: 'Parcel/HuisvestingsverordeningPopup',
  component: HuisvestingsverordeningPopup,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof HuisvestingsverordeningPopup>

/* ── Mock randvoorwaarden (huisvestingsverordening toetsingsregels) ── */

const RANDVOORWAARDEN: Randvoorwaarde[] = [
  {
    categorie: 'proces',
    titel: 'Opkoopbescherming-vergunning',
    samenvatting:
      'Verhuur binnen de beschermingstermijn vereist een vergunning; alleen toegestaan bij aangewezen uitzonderingen.',
    citaat: 'Het is verboden een woonruimte zonder vergunning in gebruik te geven',
    pagina: 7,
  },
  {
    categorie: 'overig',
    titel: 'Uitzonderingen',
    samenvatting: 'Verhuur aan eerstegraads familie of tijdelijke verhuur tot 12 maanden is uitgezonderd.',
    citaat: null,
    pagina: 8,
  },
]

/* ── Story 1: van_toepassing — opkoopbescherming actief ─────────── */

export const VanToepassing: Story = {
  name: '1. Van toepassing — verhuurverbod',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    verdict: 'van_toepassing',
    buurt_naam: 'Q4',
    woz_grens_eur: 355000,
    duur_jaren: 4,
    vergunningplichten: [],
    randvoorwaarden: RANDVOORWAARDEN,
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Q4')).toBeInTheDocument()
    await expect(body.getByText('Opkoopbescherming')).toBeInTheDocument()
    await expect(body.getByText(/Verhuurverbod 4 jaar na aankoop/)).toBeInTheDocument()
    await expect(body.getByText(/355\.000/)).toBeInTheDocument()
    await expect(body.getByText('Randvoorwaarden')).toBeInTheDocument()
  },
}

/* ── Story 2: mogelijk_van_toepassing — WOZ onbekend ────────────── */

export const MogelijkVanToepassing: Story = {
  name: '2. Mogelijk van toepassing — WOZ onbekend',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    verdict: 'mogelijk_van_toepassing',
    buurt_naam: 'Craneveld',
    woz_grens_eur: 355000,
    duur_jaren: 4,
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Craneveld')).toBeInTheDocument()
    await expect(body.getByText(/WOZ-waarde is onbekend/)).toBeInTheDocument()
  },
}

/* ── Story 3: vergunningstelsel_voorraad ────────────────────────── */

export const VergunningstelselVoorraad: Story = {
  name: '3. Woonruimtevoorraad — vergunningplicht',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    verdict: 'vergunningstelsel_voorraad',
    vergunningplichten: ['splitsen', 'omzetten'],
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Woonruimtevoorraad')).toBeInTheDocument()
    await expect(body.getByText(/Vergunningplicht voor splitsen\/omzetten/)).toBeInTheDocument()
    await expect(body.getByText(/procesrisico, geen verbod/)).toBeInTheDocument()
  },
}

/* ── Story 4: boven_woz_grens — neutraal ────────────────────────── */

export const BovenWozGrens: Story = {
  name: '4. Boven WOZ-grens — niet van toepassing',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    verdict: 'boven_woz_grens',
    woz_grens_eur: 355000,
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Boven de opkoopgrens')).toBeInTheDocument()
    await expect(body.getByText(/opkoopbescherming niet van toepassing/)).toBeInTheDocument()
  },
}

/* ── Story 5: buiten_beschermd_gebied — neutraal ────────────────── */

export const BuitenBeschermdGebied: Story = {
  name: '5. Buiten beschermd gebied',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    verdict: 'buiten_beschermd_gebied',
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Buiten beschermd gebied')).toBeInTheDocument()
    await expect(body.getByText(/Buiten de aangewezen opkoopbeschermings-buurten/)).toBeInTheDocument()
  },
}

/* ── Story 6: geen_regeling — neutraal fallback ─────────────────── */

export const GeenRegeling: Story = {
  name: '6. Geen regeling',
  args: {
    isOpen: true,
    onClose: () => {},
    verdict: 'geen_regeling',
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Geen regeling')).toBeInTheDocument()
    await expect(body.getByText(/Geen opkoopbescherming in deze gemeente/)).toBeInTheDocument()
  },
}

/* ── Story 7: Close button dismisses popup ──────────────────────── */

function CloseDismissDemo() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <div data-testid="popup-state">{open ? 'open' : 'closed'}</div>
      <HuisvestingsverordeningPopup
        isOpen={open}
        onClose={() => setOpen(false)}
        gemeente="Venlo"
        verdict="van_toepassing"
        buurt_naam="Q4"
        woz_grens_eur={355000}
        duur_jaren={4}
      />
    </>
  )
}

export const CloseDismisses: Story = {
  name: '7. Close button dismisses popup',
  render: () => <CloseDismissDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await expect(body.getByText('Q4')).toBeInTheDocument()
    await expect(canvas.getByTestId('popup-state').textContent).toBe('open')
    const closeBtn = body.getByRole('button', { name: /sluiten/i })
    await userEvent.click(closeBtn)
    await expect(canvas.getByTestId('popup-state').textContent).toBe('closed')
  },
}
