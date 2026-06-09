/**
 * WoonvisiePopup stories — M048 Phase 3 design preview + TEST-04 play-functions
 *
 * Wave-sessie: 4 varianten naast elkaar. Phase 6 levert deze data-shapes.
 * User beslist hier of de popup + backend data-contract kloppen.
 *
 * Play-functions assert the SHIPPED minimal DOM (dot+label, plain <p> citaat,
 * single inline <p> segmentmatch). No chips, no blockquote, no ✓/✗ icons.
 */

import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, within, userEvent } from 'storybook/test'
import { WoonvisiePopup } from '@/components/map/panels/parcel/WoonvisiePopup'
import type { WijkPolicy } from '@/components/map/panels/parcel/WoonvisiePopup'

const meta: Meta<typeof WoonvisiePopup> = {
  title: 'M048/WoonvisiePopup',
  component: WoonvisiePopup,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof WoonvisiePopup>

/* ── Mock WijkPolicies (matches Phase 6 Pydantic shape) ────────── */

const BLERICK: WijkPolicy = {
  wijk_naam: 'Blerick',
  prioriteit: 'groei',
  gewenste_segmenten: ['sociaal', 'midden'],
  citaat:
    'Blerick blijft een van de drie groeikernen van Venlo. Tot 2030 voorzien wij in minimaal 400 extra woningen, waarvan tenminste 35% sociale huur (circa 140 woningen) en 25% middeldure huur. Het accent ligt op starters onder de 35 en ouderen met een zorgvraag die vanuit corporatiebezit willen doorstromen. Nieuwbouw concentreert zich rond het stationsgebied en langs de Antoniuslaan, waar wij gerichte verdichting tot maximaal vier lagen toestaan. Dure koop (> € 450.000) draagt in Blerick niet bij aan de opgave en wordt alleen bij uitzondering toegestaan wanneer dit aantoonbaar bijdraagt aan gemengde wijken. Transformatie van leegstaand vastgoed krijgt voorrang boven uitbreiding in het buitengebied. Corporatie Antares wordt als primaire uitvoeringspartner benoemd.',
  pagina: 24,
}

const VENLO_CENTRUM: WijkPolicy = {
  wijk_naam: 'Venlo-Centrum',
  prioriteit: 'neutraal',
  gewenste_segmenten: ['duur', 'gemengd'],
  citaat:
    'Venlo-Centrum wordt in deze woonvisie niet aangemerkt als groei- of krimpgebied. Wij streven naar behoud van het stedelijk-hoogwaardige karakter en zetten in op functiemenging tussen wonen, horeca en detailhandel. Nieuwe woningbouw is beperkt tot hoogwaardige appartementen in het duurdere segment en op maat gesneden transformaties van kantoor- en winkelpanden boven de plint. Uitbreiding van de sociale voorraad is in dit centrumdeel niet wenselijk, omdat de bestaande sociale concentratie reeds bovengemiddeld is en sociale cohesie onder druk staat. Wij vragen ontwikkelaars om per plan een bijdrage in de gemeentelijke kwaliteitsfonds voor openbare ruimte. Hoogteaccenten tot zes lagen zijn toegestaan langs de Parade en rondom de Keulsepoort, mits stedenbouwkundig ingepast.',
  pagina: 18,
}

const TEGELEN: WijkPolicy = {
  wijk_naam: 'Tegelen',
  prioriteit: 'herstructurering',
  gewenste_segmenten: ['sociaal', 'midden', 'gemengd'],
  citaat:
    'Tegelen kampt met een verouderd woningbestand uit de jaren \'60 en \'70, waarvan circa 1.100 portieketageflats een herstructureringsopgave vormen. In samenwerking met corporatie Woonwenz en het Rijksprogramma Volkshuisvesting wordt in de periode 2025-2030 ingezet op sloop-nieuwbouw met een een-op-een-vervanging en 20% toevoeging van middeldure huur. Het streven is een gemengde wijkopbouw (40% sociaal, 40% middenhuur, 20% betaalbare koop) om eenzijdige buurtprofielen te doorbreken en sociale cohesie te versterken. Herhuisvesting van zittende bewoners binnen Tegelen is uitgangspunt; de gemeente biedt een sociale begeleidingsregeling. Vervanging van monofunctionele blokken door gemengd wonen-zorgconcepten heeft voorrang, mede vanwege de dubbele vergrijzingsopgave in deze kern.',
  pagina: 31,
}

const ALGEMEEN_CITAAT =
  'Gemeente Venlo staat voor een aanzienlijke woningbouwopgave. Tot 2030 moeten er circa 2.800 nieuwe woningen bijkomen — een bruto groei van 6,5% op de bestaande voorraad. Wij richten ons op een evenwichtige segmentverdeling van 35% sociale huur, 30% middeldure huur, 20% betaalbare koop en 15% duurdere segmenten. De opgave wordt geconcentreerd in drie groeikernen (Blerick, Hout-Blerick en delen van Tegelen), terwijl het buitengebied en de kleine kernen een voornamelijk conserverende koers volgen. Verstedelijking binnen bestaand stedelijk gebied, verdichting rond OV-knooppunten en transformatie van leegstaand vastgoed hebben prioriteit boven uitbreiding in het landelijk gebied. Doelgroepen met voorrang zijn starters onder de 35, ouderen met zorgvraag en statushouders.'

/* ── Base args ─────────────────────────────────────────────────── */

const baseArgs = {
  isOpen: true,
  onClose: () => {},
  gemeente: 'Venlo',
  periode_start: 2024,
  periode_einde: 2030,
  algemeen_citaat: ALGEMEEN_CITAAT,
  project_type: 'nieuwbouw_wonen',
}

/* ── Variant 1: Blerick groei, project = sociaal nieuwbouw ─────── */

export const BlerickGroeiMatch: Story = {
  name: '1. Blerick — Groei + match',
  args: {
    ...baseArgs,
    matched_policy: BLERICK,
  },
  play: async () => {
    // Popup uses createPortal — query document.body
    const body = within(document.body)
    // Wijk title
    await expect(body.getByText('Blerick')).toBeInTheDocument()
    // Prioriteit label (NOT a chip — minimal dot+label version)
    await expect(body.getByText('Groeigebied')).toBeInTheDocument()
    // Citaat content (plain <p>, no blockquote)
    await expect(body.getByText(/Blerick blijft een van de drie groeikernen/)).toBeInTheDocument()
    // Segmentmatch sentence (single line, NOT chips)
    await expect(body.getByText(/Jouw project past volledig binnen/)).toBeInTheDocument()
  },
}

/* ── Variant 2: Venlo-Centrum neutraal, project = sociaal ──────── */

export const VenloCentrumMismatch: Story = {
  name: '2. Venlo-Centrum — Neutraal + mismatch',
  args: {
    ...baseArgs,
    matched_policy: VENLO_CENTRUM,
    project_type: 'nieuwbouw_wonen',
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Venlo-Centrum')).toBeInTheDocument()
    await expect(body.getByText('Neutraal')).toBeInTheDocument()
    // Mismatch sentence (single line, no chips, no ✓/✗ characters)
    await expect(body.getByText(/valt buiten/)).toBeInTheDocument()
    // Negative assertions — confirm we are NOT in the old chip-design world
    const html = document.body.innerHTML
    await expect(html).not.toMatch(/border-l-4 border-amber-400/)
    await expect(html).not.toMatch(/bg-emerald-100/)
  },
}

/* ── Variant 3: Tegelen herstructurering ───────────────────────── */

export const TegelenHerstructurering: Story = {
  name: '3. Tegelen — Herstructurering',
  args: {
    ...baseArgs,
    matched_policy: TEGELEN,
    project_type: 'transformatie_wonen',
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('Tegelen')).toBeInTheDocument()
    await expect(body.getByText('Herstructurering')).toBeInTheDocument()
    await expect(body.getByText(/verouderd woningbestand uit de jaren/)).toBeInTheDocument()
  },
}

/* ── Variant 4: geen wijk-match — algemeen_citaat fallback ─────── */

export const GeenMatchFallback: Story = {
  name: '4. Geen wijk-match — algemeen fallback',
  args: {
    ...baseArgs,
    matched_policy: null,
    project_type: 'nieuwbouw_wonen',
  },
  play: async () => {
    const body = within(document.body)
    // No-match: editorial layout shows "Gemeente-breed" as both eyebrow + headline.
    await expect(body.getAllByText('Gemeente-breed').length).toBeGreaterThan(0)
    // Algemeen citaat content
    await expect(body.getByText(/2\.800 nieuwe woningen/)).toBeInTheDocument()
    // No prioriteit keyline + no segmentmatch sentence on fallback (matched_policy === null)
    await expect(body.queryByText(/Kansrijk voor woningbouw/)).not.toBeInTheDocument()
    await expect(body.queryByText(/Jouw project past volledig/)).not.toBeInTheDocument()
    await expect(body.queryByText(/sluit aan/)).not.toBeInTheDocument()
  },
}

/* ── ESC dismiss (documented gap: WoonvisiePopup has no ESC listener) ── */

// NOTE: WoonvisiePopup.tsx does NOT add a keydown listener for Escape.
// Only backdrop-click dismisses. This story tests click-outside via the close
// button (aria-label="Sluiten") instead, which IS wired.
// Follow-up todo: Add ESC keydown handler to WoonvisiePopup.tsx.

function EscDismissDemo() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <div data-testid="popup-state">{open ? 'open' : 'closed'}</div>
      <WoonvisiePopup
        isOpen={open}
        onClose={() => setOpen(false)}
        gemeente="Venlo"
        periode_start={2024}
        periode_einde={2030}
        matched_policy={BLERICK}
        algemeen_citaat={ALGEMEEN_CITAAT}
        project_type="nieuwbouw_wonen"
      />
    </>
  )
}

export const EscDismisses: Story = {
  name: '6. Close button dismisses popup',
  render: () => <EscDismissDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    // Popup is open
    await expect(body.getByText('Blerick')).toBeInTheDocument()
    await expect(canvas.getByTestId('popup-state').textContent).toBe('open')
    // Click the close button (ESC not implemented — use aria-label="Sluiten")
    const closeBtn = body.getByRole('button', { name: /sluiten/i })
    await userEvent.click(closeBtn)
    // State flipped to closed
    await expect(canvas.getByTestId('popup-state').textContent).toBe('closed')
  },
}

/* ── Click-outside (backdrop) dismisses popup ───────────────────── */

function ClickOutsideDemo() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <div data-testid="popup-state">{open ? 'open' : 'closed'}</div>
      <WoonvisiePopup
        isOpen={open}
        onClose={() => setOpen(false)}
        gemeente="Venlo"
        periode_start={2024}
        periode_einde={2030}
        matched_policy={BLERICK}
        algemeen_citaat={ALGEMEEN_CITAAT}
        project_type="nieuwbouw_wonen"
      />
    </>
  )
}

export const ClickOutsideDismisses: Story = {
  name: '7. Click-outside dismisses popup',
  render: () => <ClickOutsideDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await expect(body.getByText('Blerick')).toBeInTheDocument()
    await expect(canvas.getByTestId('popup-state').textContent).toBe('open')
    // Click backdrop (the fixed inset-0 z-[60] div)
    const backdrop = document.body.querySelector('div.fixed.inset-0') as HTMLElement | null
    await expect(backdrop).not.toBeNull()
    await userEvent.click(backdrop as HTMLElement)
    await expect(canvas.getByTestId('popup-state').textContent).toBe('closed')
  },
}

/* ── Interactive: toggle open/close via card click ──────────────── */

function InteractiveDemo() {
  const [open, setOpen] = useState(false)
  const [variant, setVariant] = useState<'blerick' | 'centrum' | 'tegelen' | 'geen'>('blerick')

  const scenarios = {
    blerick: { policy: BLERICK, label: 'Blerick', projectType: 'nieuwbouw_wonen' },
    centrum: { policy: VENLO_CENTRUM, label: 'Venlo-Centrum', projectType: 'nieuwbouw_wonen' },
    tegelen: { policy: TEGELEN, label: 'Tegelen', projectType: 'transformatie_wonen' },
    geen: { policy: null, label: 'Onbekende-wijk', projectType: 'nieuwbouw_wonen' },
  }

  const s = scenarios[variant]

  return (
    <div className="min-h-screen bg-[#F2F6F3] p-8 font-[Plus_Jakarta_Sans]">
      <div className="max-w-xl mx-auto">
        <h1 className="text-[24px] font-black tracking-tight text-[#0E1111]">
          M048 Phase 3 — Woonvisie popup preview
        </h1>
        <p className="mt-2 text-[13px] text-[#6B7280]">
          Klik op kaart 10 rechtsonder om popup te openen. Wissel scenario via de pillen.
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

        {/* Phase 7 layout: 6 cards per page, pinned synth-page met ⭐ */}
        <div className="mt-8 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FDF6E8] text-[#92400E]">
            <span className="text-[13px]">★</span> Gepind
          </span>
          <span>· page 1 / 4 · top 6 voor jou</span>
        </div>

        <div className="mt-3 grid grid-cols-3 grid-rows-2 gap-1.5">
          {[
            { label: 'ONDERBENUTTING', value: '42% VRIJ', sub: '± 380 m² marge', pts: '+8.2' },
            { label: 'HEADROOM', value: '+2 LAGEN', sub: 'Max 12m toegestaan', pts: '+6.1' },
            { label: 'BESTEMMING', value: 'WONEN', sub: 'FAR 1.2 · 70% bebouwing', pts: '+7.0' },
            { label: 'ACQUISITIE', value: 'LEEG', sub: 'Funda frictie 6mnd+', pts: '+5.5' },
            { label: 'LEGAL', value: '72% SUCCES', sub: 'Vergunningsklimaat', pts: '+4.5' },
          ].map((card) => (
            <div
              key={card.label}
              className="aspect-square bg-white border border-slate-100 rounded-[24px] p-6 flex flex-col justify-between shadow-sm relative"
            >
              <span className="absolute top-3 right-3 text-[#F9A826] text-[13px] leading-none">★</span>
              <div className="flex justify-between items-start gap-1 pr-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-tight truncate">
                  {card.label}
                </span>
                <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-black shrink-0">
                  {card.pts}
                </span>
              </div>
              <div className="flex-1 flex items-center min-w-0">
                <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none truncate">
                  {card.value}
                </span>
              </div>
              <div className="border-t border-slate-50 pt-3 min-w-0">
                <span className="text-[11px] font-bold text-slate-400 leading-tight truncate block">
                  {card.sub}
                </span>
              </div>
            </div>
          ))}

          {/* WOONVISIE — clickable, pinned, same styling as others */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="aspect-square bg-white border border-slate-100 rounded-[24px] p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all text-left cursor-pointer group relative"
          >
            <span className="absolute top-3 right-3 text-[#F9A826] text-[13px] leading-none">★</span>
            <div className="flex justify-between items-start gap-1 pr-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-tight truncate">
                WOONVISIE
              </span>
              <span className="text-[#F9A826] bg-[#FDF6E8] px-2 py-0.5 rounded-full text-[10px] font-black shrink-0">
                {s.policy ? (s.policy.prioriteit === 'groei' ? '+5.0' : s.policy.prioriteit === 'herstructurering' ? '+2.5' : '—') : '—'}
              </span>
            </div>
            <div className="flex-1 flex items-center min-w-0">
              <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none truncate">
                {s.policy ? (s.policy.prioriteit === 'groei' ? 'PRIORITEIT' : s.policy.prioriteit === 'herstructurering' ? 'HERSTR.' : 'NEUTRAAL') : 'GEEN DATA'}
              </span>
            </div>
            <div className="border-t border-slate-50 pt-3 min-w-0">
              <span className="text-[11px] font-bold text-slate-400 leading-tight truncate block">
                {s.policy ? s.policy.wijk_naam : 'Geen wijk-match'}
              </span>
            </div>
            {/* Click indicator */}
            <span className="absolute bottom-3 right-3 text-[9px] font-bold uppercase tracking-[0.1em] text-[#F9A826] opacity-0 group-hover:opacity-100 transition-opacity">
              klik →
            </span>
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-[#8A9590]">
          6 gepinde factoren (Phase 7). Klik WOONVISIE → popup met wijk-specifieke beleidstekst.
        </p>

        <WoonvisiePopup
          isOpen={open}
          onClose={() => setOpen(false)}
          gemeente="Venlo"
          periode_start={2024}
          periode_einde={2030}
          matched_policy={s.policy}
          algemeen_citaat={ALGEMEEN_CITAAT}
          project_type={s.projectType}
        />
      </div>
    </div>
  )
}

export const InteractiveGrid: Story = {
  name: '✦ Live — klik kaart 10',
  render: () => <InteractiveDemo />,
}
