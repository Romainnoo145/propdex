import type { Meta, StoryObj } from '@storybook/react-vite'
import { Banknote } from 'lucide-react'
import { DossierSlotCard } from '@/components/map/panels/parcel/DossierSlotCard'

const meta: Meta<typeof DossierSlotCard> = { title: 'Parcel/DossierSlotCard', component: DossierSlotCard }
export default meta
type Story = StoryObj<typeof DossierSlotCard>

const base = { key: 'woz', label: 'WOZ', Icon: Banknote, sub: 'WOZ-waarde', documents: [] as never[] }
export const Data: Story = { args: { card: { ...base, value: '€ 420.000', filled: true }, onClick: () => {} } }
export const Empty: Story = { args: { card: { ...base, value: 'LEEG', filled: false }, onClick: () => {} } }
export const Docs: Story = { args: { card: { ...base, value: 'LEEG', filled: true, documents: [{ id: '1' }, { id: '2' }] as never }, onClick: () => {} } }
