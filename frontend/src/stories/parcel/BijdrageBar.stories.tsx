import type { Meta, StoryObj } from '@storybook/react-vite'
import { BijdrageBar } from '@/components/map/panels/parcel/BijdrageBar'

const meta: Meta<typeof BijdrageBar> = {
  title: 'Parcel/BijdrageBar',
  component: BijdrageBar,
}
export default meta
type Story = StoryObj<typeof BijdrageBar>

const base = {
  label: 'ONDERBENUTTING',
  value: '62% VRIJ',
  sub: '± 840 m² marge',
  factor_key: 'vrije_grond',
  bron: 'fysiek' as const,
}

export const Positive: Story = {
  args: {
    card: { ...base, pts: 8.5 },
    tone: 'positive',
    maxAbs: 8.5,
    onClick: () => {},
  },
}

export const Negative: Story = {
  args: {
    card: {
      label: 'PARKEERDRUK',
      value: 'HOOG',
      sub: 'norm 1.5/woning',
      pts: -2.8,
      factor_key: 'parkeerdruk',
      bron: 'planologisch',
    },
    tone: 'negative',
    maxAbs: 8.5,
    onClick: () => {},
  },
}

export const ComingSoon: Story = {
  args: {
    card: {
      label: 'WOONDEAL',
      value: '—',
      sub: 'Woondeal Limburg',
      pts: 0,
      factor_key: 'woondeal_boost',
      bron: 'gemeente_beleid',
    },
    tone: 'positive',
    maxAbs: 8.5,
    comingSoon: true,
  },
}
