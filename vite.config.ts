/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(dirname, 'frontend');

// Root vite config — mirrors frontend/vite.config.ts but sets root to frontend/
export default defineConfig({
  root: frontendDir,
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: false }),
    react(),
    tailwindcss(),
    ...(process.env.ANALYZE ? [visualizer({ open: false, filename: 'dist/stats.html' })] : []),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        })]
      : []),
  ],
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(frontendDir, 'src')
    }
  },
});
