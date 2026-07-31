/**
 * Layout — phone-framed app shell
 *
 * Vision: Go! is destined to be a mobile app. Even while developing in a browser,
 * we preview inside a ~430px-wide phone shell so spacing, Reels height, and the
 * bottom nav feel native. On small screens the shell goes edge-to-edge; on larger
 * screens it floats as a rounded device mockup.
 *
 * Bottom nav is hidden on Event Setup / Join / Room so those feel like a focused
 * stack flow (Groups → start or join → vote), not another tab.
 */

import { useCallback, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { PHONE_SHELL_ID } from './Modal'
import {
  shouldShowWelcomeSplash,
  WelcomeSplash,
} from './WelcomeSplash'
import { useStore } from '../store/useStore'

/** Paths that should hide the tab bar (immersive / stack screens). */
const hideNavPrefixes = ['/event/', '/join', '/room/']

/**
 * Wraps every route: phone chrome + scrollable main + optional bottom nav.
 * `Outlet` is where React Router renders the active page.
 */
export function Layout() {
  const { pathname } = useLocation()
  const userPrefs = useStore((s) => s.userPrefs)
  const [showSplash, setShowSplash] = useState(shouldShowWelcomeSplash)
  const dismissSplash = useCallback(() => setShowSplash(false), [])
  const isFeed = pathname === '/'
  const onboardingOpen = isFeed && !userPrefs
  const showNav =
    !onboardingOpen &&
    !showSplash &&
    !hideNavPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix),
    )

  return (
    <div className="flex min-h-full justify-center bg-neutral-950">
      {/* Device frame — max width mimics a modern phone */}
      <div
        id={PHONE_SHELL_ID}
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
            // Feed / onboarding own full-bleed scrolling; other pages get padding
            isFeed || onboardingOpen
              ? 'overflow-hidden p-0'
              : showNav
                ? 'overflow-y-auto px-4 pb-24 pt-6'
                : 'overflow-y-auto px-4 pb-8 pt-6',
          ].join(' ')}
        >
          <Outlet />
        </main>
        {showNav ? <BottomNav /> : null}
        {showSplash ? <WelcomeSplash onDone={dismissSplash} /> : null}
      </div>
    </div>
  )
}
