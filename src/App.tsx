/**
 * App router — the map of Go!'s screens
 *
 * Vision: Go! is a mobile-first social discovery product. Navigation is split into:
 *   1) Bottom-tab destinations: Feed, My Roams, Groups
 *   2) Stack destinations (no bottom nav): Event Setup → Voting
 *
 * All routes render inside `Layout`, which provides the phone-sized shell so
 * desktop preview matches how the app will feel on a real device.
 *
 * Flow to keep in mind when editing routes:
 *   /  → discover (Reels)
 *   /roams → personal library of hearted places
 *   /groups → create crews
 *   /event/:groupId → pick candidates for that crew
 *   /vote → decide together
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { EventSetup } from './pages/EventSetup'
import { Feed } from './pages/Feed'
import { Groups } from './pages/Groups'
import { Roams } from './pages/Roams'
import { Voting } from './pages/Voting'

/** Root component: wires React Router to every Go! screen. */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Shared chrome (phone frame + conditional bottom nav) */}
        <Route element={<Layout />}>
          <Route index element={<Feed />} />
          <Route path="roams" element={<Roams />} />
          <Route path="groups" element={<Groups />} />
          {/* Stack: group → shortlist → vote */}
          <Route path="event/:groupId" element={<EventSetup />} />
          <Route path="vote" element={<Voting />} />
          {/* Unknown URLs fall back to discovery */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
