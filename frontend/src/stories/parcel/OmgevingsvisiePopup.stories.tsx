/**
 * OmgevingsvisiePopup stories — M053/S01 beleidsalignement cascade showcase.
 *
 * Two core variants: transformatie-kansgebied match + geen match fallback.
 * Mirrors WoonvisiePopup.stories.tsx structure (Meta from @storybook/react-vite,
 * play-functions asserting minimal DOM via Storybook test helpers).
 */

import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, within, userEvent } from 'storybook/test'
import { OmgevingsvisiePopup } from '@/components/map/panels/parcel/OmgevingsvisiePopup'
import type { GebiedPolicy } from '@/components/map/panels/parcel/OmgevingsvisiePopup'

const meta: Meta<typeof OmgevingsvisiePopup> = {
  title: 'Parcel/OmgevingsvisiePopup',
  component: OmgevingsvisiePopup,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof OmgevingsvisiePopup>

/* ── Mock GebiedPolicies (matches M053/S01 Pydantic shape) ─────── */

const TRANSFORMATIE: GebiedPolicy = {
  gebied_naam: 'Transformatiegebieden',
  karakter: 'transformatie',
  woningbouwprioriteit: 'hoog',
  transformatie_kansgebied: true,
  gebonden_plaatsen: ['Middengebied', 'Veilingterrein'],
  citaat:
    'We maken hier nieuwe, klimaatadaptieve en goed functionerende stadsbuurten. Functiemenging staat centraal: wonen, werken en voorzieningen worden gecombineerd in compacte buurten op loopafstand van OV-knooppunten. Corporaties en private ontwikkelaars worden uitgenodigd om samen te investeren in een duurzaam, gemengd programma.',
  pagina: 24,
}

const CENTRAAL: GebiedPolicy = {
  gebied_naam: 'Centraal Stedelijk Gebied',
  karakter: 'centraal_stedelijk',
  woningbouwprioriteit: 'gemiddeld',
  transformatie_kansgebied: false,
  gebonden_plaatsen: ['Venlo-Centrum', 'Maasboulevard'],
  citaat:
    'Het centrumgebied is de motor van Venlo. Wij streven naar een hoge bebouwingsdichtheid en een gevarieerd woningaanbod in de hogere segmenten. Kantoor-tot-wonen transformaties hebben prioriteit. Nieuwe sociale huur wordt hier niet toegestaan.',
  pagina: 18,
}

const ALGEMEEN_CITAAT =
  'We kiezen voor de compacte stad: verdichten binnen 15 minuten fietsafstand van de stations. Wonen, werken en ontspanning komen dichter bij elkaar. We bouwen slim, duurzaam en toekomstbestendig.'

/* ── Story 1: Transformatiegebied — match (transformatie_wonen) ──── */

export const Transformatiegebied: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    tijdshorizon: 2040,
    project_type: 'transformatie_wonen',
    algemeen_citaat: ALGEMEEN_CITAAT,
    matched_policy: TRANSFORMATIE,
  },
  play: async () => {
    const body = within(document.body)
    // Gebied titel
    await expect(body.getByText('Transformatiegebieden')).toBeInTheDocument()
    // Karakter label (dot + label, not a chip)
    await expect(body.getByText('Transformatiegebied')).toBeInTheDocument()
    // Transformatie kansgebied badge
    await expect(body.getByText('transformatie-kansgebied')).toBeInTheDocument()
    // Citaat content (plain <p>)
    await expect(body.getByText(/klimaatadaptieve en goed functionerende stadsbuurten/)).toBeInTheDocument()
    // Alignment sentence (single line)
    await expect(body.getByText(/sluit aan bij de gemeentelijke richting/)).toBeInTheDocument()
  },
}

/* ── Story 2: Centraal stedelijk — misfit (nieuwbouw_wonen) ─────── */

export const CentraalStedeijkMismatch: Story = {
  name: '2. Centraal stedelijk — mismatch (nieuwbouw_wonen vs centraal_stedelijk)',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    tijdshorizon: 2040,
    project_type: 'nieuwbouw_wonen',
    algemeen_citaat: ALGEMEEN_CITAAT,
    matched_policy: CENTRAAL,
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Centraal Stedelijk Gebied')).toBeInTheDocument()
    await expect(body.getByText('Centraal stedelijk gebied')).toBeInTheDocument()
    await expect(body.getByText(/motor van Venlo/)).toBeInTheDocument()
    // nieuwbouw_wonen fit list = [transformatie, stedelijk_wonen, dorp] → centraal_stedelijk is a mismatch
    await expect(body.getByText(/wijkt af van de gemeentelijke richting/)).toBeInTheDocument()
    // Confirm no chip-design artefacts
    const html = document.body.innerHTML
    await expect(html).not.toMatch(/border-l-4 border-amber-400/)
    await expect(html).not.toMatch(/bg-emerald-100/)
  },
}

/* ── Story 3: Geen match — algemeen_citaat fallback ─────────────── */

export const GeenMatch: Story = {
  name: '3. Geen match — algemeen fallback',
  args: {
    isOpen: true,
    onClose: () => {},
    gemeente: 'Venlo',
    tijdshorizon: 2040,
    project_type: 'onbepaald',
    matched_policy: null,
    algemeen_citaat: ALGEMEEN_CITAAT,
  },
  play: async () => {
    const body = within(document.body)
    // Fallback titel
    await expect(body.getByText('Gemeente-breed')).toBeInTheDocument()
    // No-match italic note
    await expect(body.getByText(/geen gebied-specifieke tekst/)).toBeInTheDocument()
    // Algemeen citaat content
    await expect(body.getByText(/compacte stad/)).toBeInTheDocument()
    // No alignment sentence when project_type is onbepaald
    await expect(body.queryByText(/sluit aan/)).not.toBeInTheDocument()
    await expect(body.queryByText(/wijkt af/)).not.toBeInTheDocument()
  },
}

/* ── Story 4: Close-button dismisses popup ───────────────────────── */

function CloseDismissDemo() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <div data-testid="popup-state">{open ? 'open' : 'closed'}</div>
      <OmgevingsvisiePopup
        isOpen={open}
        onClose={() => setOpen(false)}
        gemeente="Venlo"
        tijdshorizon={2040}
        matched_policy={TRANSFORMATIE}
        algemeen_citaat={ALGEMEEN_CITAAT}
        project_type="transformatie_wonen"
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
    // Popup is open
    await expect(body.getByText('Transformatiegebieden')).toBeInTheDocument()
    await expect(canvas.getByTestId('popup-state').textContent).toBe('open')
    // Click close button (aria-label="Sluiten")
    const closeBtn = body.getByRole('button', { name: /sluiten/i })
    await userEvent.click(closeBtn)
    await expect(canvas.getByTestId('popup-state').textContent).toBe('closed')
  },
}

/* ── Story 5: Interactive demo with scenario picker ─────────────── */

function InteractiveDemo() {
  const [open, setOpen] = useState(false)
  const [variant, setVariant] = useState<'transformatie' | 'centraal' | 'geen'>('transformatie')

  const scenarios = {
    transformatie: { policy: TRANSFORMATIE, label: 'Transformatie', projectType: 'transformatie_wonen' },
    centraal: { policy: CENTRAAL, label: 'Centraal stedelijk', projectType: 'nieuwbouw_wonen' },
    geen: { policy: null, label: 'Geen match', projectType: 'onbepaald' },
  }

  const s = scenarios[variant]

  return (
    <div className="min-h-screen bg-[#F2F6F3] p-8 font-[Plus_Jakarta_Sans]">
      <div className="max-w-xl mx-auto">
        <h1 className="text-[24px] font-black tracking-tight text-[#0E1111]">
          M053/S01 — Omgevingsvisie popup preview
        </h1>
        <p className="mt-2 text-[13px] text-[#6B7280]">
          Klik op de kaart om de popup te openen. Wissel scenario via de pillen.
        </p>

        {/* Scenario picker */}
        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(scenarios) as Array<keyof typeof scenarios>).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setVariant(key)}
              className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-all ${
                variant === key
                  ? 'bg-[#0E1111] text-white'
                  : 'bg-white/60 backdrop-blur text-[#0E1111] hover:bg-white'
              }`}
            >
              {scenarios[key].label}
            </button>
          ))}
        </div>

        {/* Clickable cascade card */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-8 w-full aspect-[3/1] bg-white border border-slate-100 rounded-[24px] p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all text-left cursor-pointer group relative"
        >
          <span className="absolute top-3 right-3 text-[#F9A826] text-[13px] leading-none">★</span>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
              OMGEVINGSVISIE
            </span>
          </div>
          <div className="flex-1 flex items-center">
            <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
              {s.policy ? s.policy.karakter.replace('_', ' ').toUpperCase() : 'GEMEENTE-BREED'}
            </span>
          </div>
          <div className="border-t border-slate-50 pt-3">
            <span className="text-[11px] font-bold text-slate-400">
              {s.policy ? s.policy.gebied_naam : 'Geen gebied-match'}
            </span>
          </div>
          <span className="absolute bottom-3 right-3 text-[9px] font-bold uppercase tracking-[0.1em] text-[#F9A826] opacity-0 group-hover:opacity-100 transition-opacity">
            klik →
          </span>
        </button>

        <p className="mt-3 text-center text-[11px] text-[#8A9590]">
          Klik kaart → popup met gemeente-specifieke beleidstekst.
        </p>

        <OmgevingsvisiePopup
          isOpen={open}
          onClose={() => setOpen(false)}
          gemeente="Venlo"
          tijdshorizon={2040}
          matched_policy={s.policy}
          algemeen_citaat={ALGEMEEN_CITAAT}
          project_type={s.projectType}
        />
      </div>
    </div>
  )
}

export const InteractiveGrid: Story = {
  name: '✦ Live — klik cascade-kaart',
  render: () => <InteractiveDemo />,
}
