import type { Meta, StoryObj } from '@storybook/react-vite'
import { FactorDetailDrawer } from '@/components/map/panels/parcel/FactorDetailDrawer'

const meta: Meta<typeof FactorDetailDrawer> = { title: 'Parcel/FactorDetailDrawer', component: FactorDetailDrawer }
export default meta
type Story = StoryObj<typeof FactorDetailDrawer>
export const Open: Story = {
  args: { isOpen: true, onClose: () => {}, children: <div className="text-sm text-slate-600">Drawer-inhoud</div> },
}
