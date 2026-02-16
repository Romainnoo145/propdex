import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
} from '@/components/primitives';

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Eigendomsinformatie</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-grey-400">
            <span className="text-grey-300">Eigenaar:</span> Gemeente Amsterdam
          </p>
          <p className="text-sm text-grey-400">
            <span className="text-grey-300">Kadastrale aanduiding:</span> ASD01 A 1234
          </p>
          <p className="text-sm text-grey-400">
            <span className="text-grey-300">Oppervlakte:</span> 1,250 m²
          </p>
        </div>
      </CardContent>
    </Card>
  ),
};

export const AllElevations: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-grey-400 mb-2">Elevation: base (bg-grey-950)</p>
        <Card elevation="base">
          <CardContent>
            <p className="text-sm text-grey-300">Darkest background</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="text-xs text-grey-400 mb-2">Elevation: card (bg-grey-900) — Default</p>
        <Card elevation="card">
          <CardContent>
            <p className="text-sm text-grey-300">Standard card surface</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="text-xs text-grey-400 mb-2">Elevation: elevated (bg-grey-850)</p>
        <Card elevation="elevated">
          <CardContent>
            <p className="text-sm text-grey-300">Lightest elevated surface</p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Bestemmingsplan Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-grey-400">
            <span className="text-grey-300">Bestemming:</span> Gemengd
          </p>
          <p className="text-sm text-grey-400">
            <span className="text-grey-300">Status:</span> Onherroepelijk
          </p>
          <p className="text-sm text-grey-400">
            <span className="text-grey-300">Vastgesteld:</span> 15-03-2022
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex gap-2">
          <Button variant="primary" size="sm">
            Bekijk Plan
          </Button>
          <Button variant="ghost" size="sm">
            Download PDF
          </Button>
        </div>
      </CardFooter>
    </Card>
  ),
};
