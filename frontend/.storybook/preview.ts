import type { Preview } from '@storybook/react-vite'
import '../src/styles/index.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'Morning Mist',
      values: [
        { name: 'Morning Mist', value: '#F2F6F3' },
        { name: 'White', value: '#FFFFFF' },
        { name: 'Obsidian', value: '#0E1111' },
      ],
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
};

export default preview;