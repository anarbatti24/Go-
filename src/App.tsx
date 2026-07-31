/**
 * App router — the map of Go!'s screens
 *
 * Vision: Go! is a mobile-first social discovery product. Navigation is split into:
 *   1) Bottom-tab destinations: Feed, Go-Tos, Groups
 *   2) Stack destinations (no bottom nav): Event Setup → Room, or Join → Room
 *
 * All routes render inside `Layout`, which provides the phone-sized shell so
 * desktop preview matches how the app will feel on a real device.
 *
 * Flow to keep in mind when editing routes:
 *   /  → discover (Reels)
 *   /go-tos → personal library of hearted places
 *   /groups → create groups
 *   /event/:groupId → seed candidates, create room
 *   /join(/:code) → enter a friend's room
 *   /room/:code → share, add spots, vote together
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { EventSetup } from './pages/EventSetup'
import { Feed } from './pages/Feed'
import { Groups } from './pages/Groups'
import { Join } from './pages/Join'
import { Roams } from './pages/Roams'
import { Room } from './pages/Room'

/** Root component: wires React Router to every Go! screen. */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Feed />} />
          <Route path="go-tos" element={<Roams />} />
          <Route path="groups" element={<Groups />} />
          {/* Legacy paths */}
          <Route path="roams" element={<Navigate to="/go-tos" replace />} />
          <Route path="crews" element={<Navigate to="/groups" replace />} />
          <Route path="event/:groupId" element={<EventSetup />} />
          <Route path="join" element={<Join />} />
          <Route path="join/:code" element={<Join />} />
          <Route path="room/:code" element={<Room />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
