import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '@/components/primitives';

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Enter address...',
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: 'Prinsengracht 263, Amsterdam',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled',
    disabled: true,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <label htmlFor="address" className="text-sm text-grey-300 font-medium">
        Adres
      </label>
      <Input id="address" placeholder="Vul adres in..." />
    </div>
  ),
};
