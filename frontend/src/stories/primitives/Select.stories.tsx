import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from '@/components/primitives';

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <option value="">Selecteer gemeente</option>
      <option value="amsterdam">Amsterdam</option>
      <option value="rotterdam">Rotterdam</option>
      <option value="utrecht">Utrecht</option>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <option value="">Selecteer gemeente</option>
      <option value="amsterdam">Amsterdam</option>
      <option value="rotterdam">Rotterdam</option>
      <option value="utrecht">Utrecht</option>
    </Select>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <label htmlFor="gemeente" className="text-sm text-neutral-700 font-medium">
        Gemeente
      </label>
      <Select id="gemeente">
        <option value="">Selecteer gemeente</option>
        <option value="amsterdam">Amsterdam</option>
        <option value="rotterdam">Rotterdam</option>
        <option value="utrecht">Utrecht</option>
      </Select>
    </div>
  ),
};
