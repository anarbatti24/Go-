/**
 * Bottom navigation — primary tabs
 *
 * Vision: three pillars of Go!:
 *   Feed   → discover places (Reels)
 *   Go-Tos → your saved library (places you’d go to)
 *   Groups → plan + vote with friends
 *
 * Styled dark/translucent so it sits cleanly over the Reels feed without a hard
 * white bar interrupting immersion. Safe-area padding keeps it clear of iPhone
 * home indicators later.
 */

import { NavLink } from 'react-router-dom'
import { Compass, Heart, Users } from 'lucide-react'

/** Tab definitions — `end: true` on Feed so `/go-tos` doesn't also highlight `/`. */
const links = [
  { to: '/', label: 'Feed', icon: Compass, end: true },
  { to: '/go-tos', label: 'Go-Tos', icon: Heart, end: false },
  { to: '/groups', label: 'Groups', icon: Users, end: false },
] as const

/** Fixed-to-phone-shell tab bar rendered by `Layout` on main destinations. */
export function BottomNav() {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/80 backdrop-blur-md">
      <div className="flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-white/55 hover:text-white/85',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5" strokeWidth={2.25} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
