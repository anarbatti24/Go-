/**
 * Vite build config
 *
 * Vision: Go! is a React + TypeScript SPA styled with Tailwind. The rooms API
 * plugin adds joinable event rooms during `npm run dev`. `server.host: true`
 * exposes the app on your LAN so friends can open the share link from phones.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { discoveryApiPlugin } from './server/discoveryPlugin.ts'
import { roomsApiPlugin } from './server/roomsPlugin.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), roomsApiPlugin(), discoveryApiPlugin()],
  server: {
    host: true,
    port: 5173,
  },
})
