const env = (import.meta as unknown as {
  env: {
    VITE_ENABLE_SCAN_CONTROLS?: string
  }
}).env

// Scanning is now a maker-only workflow used to seed data.
// Keep controls off by default unless explicitly enabled locally.
export const scanControlsEnabled = env.VITE_ENABLE_SCAN_CONTROLS === '1'
