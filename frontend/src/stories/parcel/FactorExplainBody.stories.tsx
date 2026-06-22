import type { Meta, StoryObj } from '@storybook/react-vite'
import { FactorExplainBody } from '@/components/map/panels/parcel/FactorExplainBody'

const meta: Meta<typeof FactorExplainBody> = {
  title: 'Parcel/FactorExplainBody',
  component: FactorExplainBody,
}
export default meta
type Story = StoryObj<typeof FactorExplainBody>

const full = {
  categorie: 'risico' as const,
  waarde: null,
  genormaliseerde_score: 35,
  gewicht: 4,
  bijdrage: -2.8,
  toelichting_kort: 'Verhoogde parkeerdruk',
  toelichting_lang:
    'De parkeernorm voor dit gebied is 1,5 plaats per woning…',
  missing: false,
  data_bronnen: ['Nota parkeernormen Venlo', 'CBS StatLine'],
  succeskans_missing: null,
  succeskans_reason: null,
  dev_type_ruling_count: null,
  total_ruling_count: null,
  percentage_of_category: 0.18,
}

export const Full: Story = {
  args: { name: 'parkeerdruk', factor: full },
}

export const Missing: Story = {
  args: {
    name: 'optoppotentie',
    factor: {
      ...full,
      missing: true,
      toelichting_lang:
        'Geen DSO-hoogtedata beschikbaar; score op neutraal gezet.',
      data_bronnen: ['PLU WMS', '3D BAG'],
      bijdrage: 0,
      genormaliseerde_score: null,
    },
  },
}
