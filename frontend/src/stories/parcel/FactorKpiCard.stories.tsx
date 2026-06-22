import type { Meta, StoryObj } from '@storybook/react-vite'
import { FactorKpiCard } from '@/components/map/panels/parcel/FactorKpiCard'

const meta: Meta<typeof FactorKpiCard> = {
  title: 'Parcel/FactorKpiCard',
  component: FactorKpiCard,
}
export default meta
type Story = StoryObj<typeof FactorKpiCard>

export const Potentie: Story = {
  args: {
    card: {
      label: 'ONDERBENUTTING',
      value: '62% VRIJ',
      sub: '± 840 m² marge',
      pts: 17,
      factor_key: 'vrije_grond',
      bron: 'fysiek',
    },
    tone: 'potentie',
    onClick: () => {},
  },
}

export const Risico: Story = {
  args: {
    card: {
      label: 'PARKEERDRUK',
      value: 'HOOG',
      sub: 'norm 1,5 / woning',
      pts: -2.8,
      factor_key: 'parkeerdruk',
      bron: 'planologisch',
    },
    tone: 'risico',
    onClick: () => {},
  },
}

export const ComingSoon: Story = {
  args: {
    card: {
      label: 'WOONDEAL',
      value: 'Binnenkort',
      sub: 'Woondeal Limburg 2022-2030',
      pts: 0,
      factor_key: 'woondeal_boost',
      bron: 'gemeente_beleid',
    },
    tone: 'potentie',
    comingSoon: true,
  },
}
