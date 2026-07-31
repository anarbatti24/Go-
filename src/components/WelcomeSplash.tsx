/**
 * WelcomeSplash — premium cold-start intro
 *
 * Uber / Eventbrite / Apple "Hello" energy: one full-bleed brand moment on
 * first open of a session, then a soft fade into the real app.
 */

import { useEffect, useState } from 'react'

const SESSION_KEY = 'go-splash-seen'
/** Hold on the mark, then fade out. */
const HOLD_MS = 3200
const FADE_MS = 650

interface WelcomeSplashProps {
  onDone: () => void
}

export function shouldShowWelcomeSplash(): boolean {
  if (typeof sessionStorage === 'undefined') return true
  try {
    return sessionStorage.getItem(SESSION_KEY) !== '1'
  } catch {
    return true
  }
}

export function markWelcomeSplashSeen(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* private mode / blocked storage — still dismiss for this mount */
  }
}

export function WelcomeSplash({ onDone }: WelcomeSplashProps) {
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter')

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setPhase('exit'), HOLD_MS)
    const doneTimer = window.setTimeout(() => {
      markWelcomeSplashSeen()
      onDone()
    }, HOLD_MS + FADE_MS)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div
      className={[
        'welcome-splash absolute inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden',
        phase === 'exit' ? 'welcome-splash--exit' : '',
      ].join(' ')}
      role="status"
      aria-live="polite"
      aria-label="Welcome to Go!"
    >
      <div className="welcome-splash__glow welcome-splash__glow--a" aria-hidden />
      <div className="welcome-splash__glow welcome-splash__glow--b" aria-hidden />
      <div className="welcome-splash__ring" aria-hidden />

      <h1 className="welcome-splash__mark" aria-label="Go!">
        <span className="welcome-splash__go">Go</span>
        <span className="welcome-splash__bang">!</span>
      </h1>
      <p className="welcome-splash__tag">Discover, Vote, Go!</p>
    </div>
  )
}
