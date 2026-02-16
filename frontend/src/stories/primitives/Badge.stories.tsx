import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/components/primitives';
import { Check, X, Info } from 'lucide-react';

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: 'Badge',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2 flex-wrap">
      <Badge variant="default">Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="amber">Amber</Badge>
      <Badge variant="teal">Teal</Badge>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex gap-2 flex-wrap">
      <Badge variant="success">
        <Check className="h-3 w-3" />
        Active
      </Badge>
      <Badge variant="error">
        <X className="h-3 w-3" />
        Failed
      </Badge>
      <Badge variant="info">
        <Info className="h-3 w-3" />
        Info
      </Badge>
    </div>
  ),
};
