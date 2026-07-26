/**
 * Layout — phone-framed app shell
 *
 * Vision: Go! is destined to be a mobile app. Even while developing in a browser,
 * we preview inside a ~430px-wide phone shell so spacing, Reels height, and the
 * bottom nav feel native. On small screens the shell goes edge-to-edge; on larger
 * screens it floats as a rounded device mockup.
 *
 * Bottom nav is hidden on Event Setup + Voting so those feel like a focused stack
 * flow (Groups → pick places → vote), not another tab.
 */

import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'

/** Paths that should hide the tab bar (immersive / stack screens). */
const hideNavPrefixes = ['/event/', '/vote']

/**
 * Wraps every route: phone chrome + scrollable main + optional bottom nav.
 * `Outlet` is where React Router renders the active page.
 */
export function Layout() {
  const { pathname } = useLocation()
  const isFeed = pathname === '/'
  const showNav = !hideNavPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  )

  return (
    <div className="flex min-h-full justify-center bg-neutral-950">
      {/* Device frame — max width mimics a modern phone */}
      <div
        className={[
          'relative flex w-full flex-col overflow-hidden bg-[var(--color-bg)]',
          'max-w-[430px]',
          'min-h-[100dvh]',
          'shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_25px_80px_rgba(0,0,0,0.45)]',
          // Desktop: capped height + rounded bezel so it reads as a phone
          'sm:my-4 sm:min-h-[min(874px,calc(100dvh-2rem))] sm:max-h-[min(874px,calc(100dvh-2rem))] sm:rounded-[2rem]',
        ].join(' ')}
      >
        <main
          className={[
            'flex min-h-0 flex-1 flex-col',
            // Feed owns its own full-bleed scrolling; other pages get padding
            isFeed
              ? 'overflow-hidden p-0'
              : showNav
                ? 'overflow-y-auto px-4 pb-24 pt-6'
                : 'overflow-y-auto px-4 pb-8 pt-6',
          ].join(' ')}
        >
          <Outlet />
        </main>
        {showNav ? <BottomNav /> : null}
      </div>
    </div>
  )
}
