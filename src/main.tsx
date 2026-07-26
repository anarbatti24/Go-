/**
 * App entry — mounts React into `#root`.
 *
 * Vision: keep this file tiny. All product logic lives in `App.tsx`, pages,
 * components, and the Zustand store. StrictMode helps catch accidental side
 * effects while we prototype.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
