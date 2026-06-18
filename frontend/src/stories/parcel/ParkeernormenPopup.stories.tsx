/**
 * ParkeernormenPopup stories — M054/S02 parkeerdruk cascade showcase.
 *
 * One story per key verdict state. Mirrors GrondprijsPopup.stories.tsx structure
 * (Meta from @storybook/react-vite, play-functions asserting minimal DOM via
 * Storybook test helpers).
 */

import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, within, userEvent } from 'storybook/test'
import { ParkeernormenPopup } from '@/components/map/panels/parcel/ParkeernormenPopup'
import type { Randvoorwaarde } from '@/components/map/panels/parcel/OmgevingsvisiePopup'

const meta: Meta<typeof ParkeernormenPopup> = {
  title: 'Parcel/ParkeernormenPopup',
  component: ParkeernormenPopup,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof ParkeernormenPopup>

/* ── Mock randvoorwaarden (parkeernormen voorwaarden) ── */

const RANDVOORWAARDEN: Randvoorwaarde[] = [
  {
    categorie: 'ruimtelijk',
    titel: 'Kwaliteitseisen parkeerplaats',
    samenvatting:
      'Parkeerplaatsen op eigen terrein moeten voldoen aan de minimale maatvoering uit bijlage 5.8.',
    citaat: 'Een haakse parkeerplaats meet ten minste 2,5 bij 5,0 meter.',
    pagina: 24,
  },
  {
    categorie: 'duurzaamheid',
    titel: 'Laadinfrastructuur',
    samenvatting: 'Bij nieuwbouw geldt een verplichting tot aanleg van laadinfrastructuur.',
    citaat: null,
    pagina: 21,
  },
]

/* ── Story 1: verhoogd — centrum zonder escape ──────────────────── */

export const Verhoogd: Story = {
  name: '1. Verhoogd — centrum, harde fietsnorm',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    verdict: 'verhoogd',
    functie: 'Appartement >100 m² bvo',
    functiecategorie: 'wonen',
    gebied: 'centrum',
    auto_norm_per_eenheid: 1.0,
    eenheid: 'per woning',
    fiets_norm_per_eenheid: 2.0,
    peiljaar: 2026,
    parkeerregulering_van_toepassing: true,
    openbare_ruimte_drempel_pct: 70,
    centrum_uitgesloten: true,
    fietsnorm_harde_eis: true,
    nul_norm_sociale_huur_mogelijk: true,
    mobiliteitscorrecties: [{ type: 'hov_station', max_reductie_pct: 15 }],
    randvoorwaarden: RANDVOORWAARDEN,
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Appartement >100 m² bvo')).toBeInTheDocument()
    await expect(body.getByText('Verhoogd parkeerdruk-risico')).toBeInTheDocument()
    await expect(body.getByText(/reëel ontwikkelrisico/)).toBeInTheDocument()
    await expect(body.getByText('Randvoorwaarden')).toBeInTheDocument()
  },
}

/* ── Story 2: laag — beheersbare parkeereis ─────────────────────── */

export const Laag: Story = {
  name: '2. Laag — beheersbare parkeereis',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    verdict: 'laag',
    functie: 'Grondgebonden woning',
    functiecategorie: 'wonen',
    gebied: 'rest_bebouwde_kom',
    auto_norm_per_eenheid: 0.6,
    eenheid: 'per woning',
    peiljaar: 2026,
    parkeerregulering_van_toepassing: false,
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Grondgebonden woning')).toBeInTheDocument()
    await expect(body.getByText('Beheersbare parkeereis')).toBeInTheDocument()
    await expect(body.getByText(/ruimte om de eis op te lossen/)).toBeInTheDocument()
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
    await expect(body.getByText('Geen parkeernorm')).toBeInTheDocument()
    await expect(body.getByText(/sluit aan op de bestemming/)).toBeInTheDocument()
  },
}

/* ── Story 4: Close button dismisses popup ──────────────────────── */

function CloseDismissDemo() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <div data-testid="popup-state">{open ? 'open' : 'closed'}</div>
      <ParkeernormenPopup
        isOpen={open}
        onClose={() => setOpen(false)}
        gemeente="Venlo"
        verdict="verhoogd"
        functie="Appartement >100 m² bvo"
        functiecategorie="wonen"
        gebied="centrum"
        auto_norm_per_eenheid={1.0}
        eenheid="per woning"
        fiets_norm_per_eenheid={2.0}
        peiljaar={2026}
        centrum_uitgesloten
        fietsnorm_harde_eis
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
    await expect(body.getByText('Appartement >100 m² bvo')).toBeInTheDocument()
    await expect(canvas.getByTestId('popup-state').textContent).toBe('open')
    const closeBtn = body.getByRole('button', { name: /sluiten/i })
    await userEvent.click(closeBtn)
    await expect(canvas.getByTestId('popup-state').textContent).toBe('closed')
  },
}
