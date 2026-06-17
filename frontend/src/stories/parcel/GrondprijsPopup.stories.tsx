/**
 * GrondprijsPopup stories — M054/S01 grondwaarde_fit cascade showcase.
 *
 * One story per key verdict state. Mirrors HuisvestingsverordeningPopup.stories.tsx
 * structure (Meta from @storybook/react-vite, play-functions asserting minimal
 * DOM via Storybook test helpers).
 */

import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, within, userEvent } from 'storybook/test'
import { GrondprijsPopup } from '@/components/map/panels/parcel/GrondprijsPopup'
import type { Randvoorwaarde } from '@/components/map/panels/parcel/OmgevingsvisiePopup'

const meta: Meta<typeof GrondprijsPopup> = {
  title: 'Parcel/GrondprijsPopup',
  component: GrondprijsPopup,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof GrondprijsPopup>

/* ── Mock randvoorwaarden (grondprijsbeleid voorwaarden) ── */

const RANDVOORWAARDEN: Randvoorwaarde[] = [
  {
    categorie: 'financieel',
    titel: 'Kostenverhaal',
    samenvatting:
      'Bij gronduitgifte wordt het kostenverhaal via een anterieure overeenkomst geregeld.',
    citaat: 'De gemeente verhaalt de kosten van grondexploitatie op de initiatiefnemer.',
    pagina: 6,
  },
  {
    categorie: 'doelgroep',
    titel: 'Sociale huur korting',
    samenvatting: 'Voor sociale huur geldt een afwijkende, lagere grondprijs.',
    citaat: null,
    pagina: 5,
  },
]

/* ── Story 1: passend — residueel grondbeleid ──────────────────── */

export const Passend: Story = {
  name: '1. Passend — residuele grondwaarde',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    verdict: 'passend',
    grondproduct: 'Bouwkavel wonen vrije sector',
    functiecategorie: 'vrij',
    prijs_per_m2_min: 450,
    prijs_per_m2_max: 650,
    prijsgrondslag: 'residueel',
    peiljaar: 2026,
    grondbeleidstype: 'actief',
    erfpacht_mogelijk: false,
    randvoorwaarden: RANDVOORWAARDEN,
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Bouwkavel wonen vrije sector')).toBeInTheDocument()
    await expect(body.getByText('Residuele grondwaarde haalbaar')).toBeInTheDocument()
    await expect(body.getByText(/volgt het ontwikkelprogramma/)).toBeInTheDocument()
    await expect(body.getByText('Randvoorwaarden')).toBeInTheDocument()
  },
}

/* ── Story 2: context — faciliterend grondbeleid ───────────────── */

export const Context: Story = {
  name: '2. Context — faciliterend grondbeleid',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    verdict: 'context',
    grondproduct: 'Sociale huurwoning',
    functiecategorie: 'sociaal',
    prijs_per_m2_min: 250,
    prijsgrondslag: 'vaste_prijs',
    peiljaar: 2026,
    grondbeleidstype: 'faciliterend',
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Sociale huurwoning')).toBeInTheDocument()
    await expect(body.getByText('Context')).toBeInTheDocument()
    await expect(body.getByText(/geen grond uit/)).toBeInTheDocument()
  },
}

/* ── Story 3: geen_match — neutraal fallback ────────────────────── */

export const GeenMatch: Story = {
  name: '3. Geen match',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    verdict: 'geen_match',
    peiljaar: 2026,
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Geen grondprijsband')).toBeInTheDocument()
    await expect(body.getByText(/sluit aan op de bestemming/)).toBeInTheDocument()
  },
}

/* ── Story 4: Close button dismisses popup ──────────────────────── */

function CloseDismissDemo() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <div data-testid="popup-state">{open ? 'open' : 'closed'}</div>
      <GrondprijsPopup
        isOpen={open}
        onClose={() => setOpen(false)}
        gemeente="Venlo"
        verdict="passend"
        grondproduct="Bouwkavel wonen vrije sector"
        functiecategorie="vrij"
        prijs_per_m2_min={450}
        prijs_per_m2_max={650}
        prijsgrondslag="residueel"
        peiljaar={2026}
        grondbeleidstype="actief"
      />
    </>
  )
}

export const CloseDismisses: Story = {
  name: '4. Close button dismisses popup',
  render: () => <CloseDismissDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await expect(body.getByText('Bouwkavel wonen vrije sector')).toBeInTheDocument()
    await expect(canvas.getByTestId('popup-state').textContent).toBe('open')
    const closeBtn = body.getByRole('button', { name: /sluiten/i })
    await userEvent.click(closeBtn)
    await expect(canvas.getByTestId('popup-state').textContent).toBe('closed')
  },
}
