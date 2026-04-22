/**
 * ScoreBreakdownModal stories
 *
 * TEST-02: Balance display reflects potentieRisicoBalance prop (not hardcoded)
 * TEST-03: Factor percentage_of_category renders as "X%", not "×gewicht"
 */

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ScoreBreakdownModal } from '@/components/map/panels/parcel/ScoreBreakdownModal'

const meta: Meta<typeof ScoreBreakdownModal> = {
  title: 'Parcel/ScoreBreakdownModal',
  component: ScoreBreakdownModal,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof ScoreBreakdownModal>

/* ── Mock data ─────────────────────────────────────────────────── */

/** Factor with percentage_of_category set (post-M047 scan) */
const mockBreakdownWithPercentage = {
  vrije_grond: {
    categorie: 'potentie',
    waarde: 450,
    genormaliseerde_score: 0.8,
    gewicht: 13,
    bijdrage: 10.4,
    percentage_of_category: 0.13,
    missing: false,
    data_bronnen: ['BAG'],
    toelichting_kort: 'Groot onbebouwd perceel',
    toelichting_lang: null,
    succeskans_missing: null,
    succeskans_reason: null,
    dev_type_ruling_count: null,
    total_ruling_count: null,
  },
}

/** Factor with percentage_of_category null (pre-M047 scan) */
const mockBreakdownNullPercentage = {
  bestemming: {
    categorie: 'potentie',
    waarde: null,
    genormaliseerde_score: 0.5,
    gewicht: 12,
    bijdrage: 6.0,
    percentage_of_category: null,
    missing: false,
    data_bronnen: null,
    toelichting_kort: null,
    toelichting_lang: null,
    succeskans_missing: null,
    succeskans_reason: null,
    dev_type_ruling_count: null,
    total_ruling_count: null,
  },
}

const baseArgs = {
  score: 75,
  potentieScore: 80,
  risicScore: 40,
  address: 'Teststraat 1, Amsterdam',
  isCustomProfile: false,
  onClose: () => {},
}

/* ── TEST-02: Balance prop stories ─────────────────────────────── */

/**
 * TEST-02a: potentieRisicoBalance=0.6 → renders "60%" and "40%"
 * Verifies the balance blocks are driven by the prop, not hardcoded.
 */
export const BalanceFromProp60_40: Story = {
  args: {
    ...baseArgs,
    scoreBreakdown: mockBreakdownWithPercentage,
    potentieRisicoBalance: 0.6,
  },
  play: async () => {
    // Modal renders via createPortal into document.body — query from body
    const body = within(document.body)
    await expect(body.getByText('60%')).toBeInTheDocument()
    await expect(body.getByText('40%')).toBeInTheDocument()
  },
}

/**
 * TEST-02b: potentieRisicoBalance=0.7 → renders "70%" and "30%"
 * A different prop value must produce a different display — proves it is not hardcoded.
 */
export const BalanceFromProp70_30: Story = {
  args: {
    ...baseArgs,
    scoreBreakdown: mockBreakdownWithPercentage,
    potentieRisicoBalance: 0.7,
  },
  play: async () => {
    const body = within(document.body)
    await expect(body.getByText('70%')).toBeInTheDocument()
    await expect(body.getByText('30%')).toBeInTheDocument()
  },
}

/**
 * TEST-02c: potentieRisicoBalance=0.5 → renders "50%" and "50%"
 */
export const BalanceFromProp50_50: Story = {
  args: {
    ...baseArgs,
    scoreBreakdown: mockBreakdownWithPercentage,
    potentieRisicoBalance: 0.5,
  },
  play: async () => {
    const body = within(document.body)
    const fiftyPercent = body.getAllByText('50%')
    await expect(fiftyPercent).toHaveLength(2)
  },
}

/* ── TEST-03: percentage_of_category display stories ─────────── */

/**
 * TEST-03a: Factor with percentage_of_category=0.13 → renders "13%" label, no "×13"
 */
export const FactorPercentageDisplay: Story = {
  args: {
    ...baseArgs,
    scoreBreakdown: mockBreakdownWithPercentage,
    potentieRisicoBalance: 0.7,
  },
  play: async () => {
    const body = within(document.body)
    // Percentage label must appear
    await expect(body.getByText('13%')).toBeInTheDocument()
    // Old ×gewicht label must NOT appear
    const crossLabels = body.queryAllByText(/×\d+/)
    await expect(crossLabels).toHaveLength(0)
  },
}

/**
 * TEST-03b: Factor with percentage_of_category=null (pre-M047) → no percentage label, no ×gewicht
 */
export const FactorNullPercentage: Story = {
  args: {
    ...baseArgs,
    scoreBreakdown: mockBreakdownNullPercentage,
    potentieRisicoBalance: 0.7,
  },
  play: async () => {
    const body = within(document.body)
    // Neither old label nor new label — render nothing for the weight display
    const crossLabels = body.queryAllByText(/×\d+/)
    await expect(crossLabels).toHaveLength(0)
  },
}
