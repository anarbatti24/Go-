/**
 * DramaticMoment — full-screen tie / random-pick suspense overlay
 *
 * Covers the phone shell so a tie or second-tie feels like an event, not a
 * quiet banner. Countdown is driven by server timestamps so every client syncs.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Dices, Swords } from 'lucide-react'
import { PHONE_SHELL_ID } from './Modal'

export type DramaticMomentKind = 'tie' | 'picking'

interface DramaticMomentProps {
  kind: DramaticMomentKind
  /** Place names still in contention. */
  names: string[]
  /** Whole seconds remaining (already ceil'd by the parent). */
  secondsLeft: number
}

function formatNames(names: string[]): string {
  if (names.length === 0) return 'these places'
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`
}

export function DramaticMoment({
  kind,
  names,
  secondsLeft,
}: DramaticMomentProps) {
  const [mountNode] = useState(() =>
    typeof document !== 'undefined'
      ? document.getElementById(PHONE_SHELL_ID)
      : null,
  )

  if (!mountNode) return null

  const isTie = kind === 'tie'
  const headline = isTie ? 'It’s a Tie!' : 'Tied Again!'
  const between = formatNames(names)
  const action = isTie ? 'Revoting in' : 'Choosing randomly in'
  const Icon = isTie ? Swords : Dices

  return createPortal(
    <div
      className={[
        'dramatic-moment absolute inset-0 z-[150] flex flex-col items-center justify-center overflow-hidden px-6 text-center',
        isTie ? 'dramatic-moment--tie' : 'dramatic-moment--picking',
      ].join(' ')}
      role="alert"
      aria-live="assertive"
    >
      <div className="dramatic-moment__burst" aria-hidden />
      <div className="dramatic-moment__burst dramatic-moment__burst--delayed" aria-hidden />

      <div
        className={[
          'dramatic-moment__icon mb-5 flex h-16 w-16 items-center justify-center rounded-full',
          isTie ? 'bg-white/20' : 'bg-white/15',
        ].join(' ')}
      >
        <Icon className="h-8 w-8 text-white dramatic-moment__icon-spin" />
      </div>

      <p className="text-xs font-bold uppercase tracking-[0.35em] text-white/80">
        {isTie ? 'Dead even' : 'Still deadlocked'}
      </p>
      <h2 className="dramatic-moment__headline mt-3 font-bold tracking-tight text-white">
        {headline}
      </h2>
      <p className="mt-4 max-w-[18rem] text-base font-medium leading-snug text-white/90">
        {isTie ? (
          <>
            Tie between <span className="font-bold text-white">{between}</span>
          </>
        ) : (
          <>
            Tied again between{' '}
            <span className="font-bold text-white">{between}</span>!
          </>
        )}
      </p>

      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-white/75">
        {action}
      </p>
      <p
        key={secondsLeft}
        className="dramatic-moment__count mt-2 font-mono text-7xl font-bold tabular-nums leading-none text-white"
      >
        {Math.max(0, secondsLeft)}
      </p>
      <p className="mt-4 text-sm text-white/70">
        {isTie
          ? 'Only the tied spots survive this round.'
          : 'Fate is rolling — hang tight.'}
      </p>
    </div>,
    mountNode,
  )
}
