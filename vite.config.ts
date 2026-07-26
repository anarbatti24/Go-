/**
 * Vite build config
 *
 * Vision: Go! is a React + TypeScript SPA styled with Tailwind. These plugins
 * give us Fast Refresh for React and Tailwind v4's Vite integration (no separate
 * PostCSS config needed).
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
