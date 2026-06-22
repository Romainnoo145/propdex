// frontend/src/stories/ui/PdfViewerDrawer.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PdfViewerDrawer } from '@/components/ui/PdfViewerDrawer'

const meta: Meta<typeof PdfViewerDrawer> = { title: 'UI/PdfViewerDrawer', component: PdfViewerDrawer }
export default meta
type Story = StoryObj<typeof PdfViewerDrawer>

export const SingleDoc: Story = {
  args: { url: 'about:blank', title: 'rapport.pdf', onClose: () => {} },
}
export const WithFileRail: Story = {
  args: {
    url: 'about:blank', title: 'keuring-2025.pdf', eyebrow: 'Bouwkundig · Dossier',
    activeId: 'a', onSelectFile: () => {}, onDownload: () => {}, onDelete: () => {}, onUpload: () => {},
    files: [
      { id: 'a', filename: 'keuring-2025.pdf', meta: '2 dagen geleden · 1,2 MB' },
      { id: 'b', filename: 'foto-gevel.jpg', meta: '2 dagen geleden · 480 KB' },
    ],
  },
}
