/**
 * WinnerReveal — full-screen celebration when voting resolves
 *
 * Same energy as the tie / picking overlays: green takeover, “Winner is”,
 * place image + name fade in, confetti. Auto-dismisses (or tap to skip).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Dices, Trophy } from 'lucide-react'
import { PHONE_SHELL_ID } from './Modal'
import type { Place, WinnerResolution } from '../types'

const HOLD_MS = 4800
const FADE_MS = 550
const CONFETTI_COUNT = 36

interface WinnerRevealProps {
  place: Place
  resolvedBy: WinnerResolution | null
  onDone: () => void
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const left = ((i * 37) % 100) + (i % 5) * 0.4
        const delay = (i % 12) * 0.12
        const duration = 2.4 + (i % 7) * 0.18
        const size = 6 + (i % 5) * 2
        const colors = [
          '#ffe566',
          '#ffffff',
          '#86efac',
          '#bbf7d0',
          '#fde68a',
          '#fca5a5',
          '#93c5fd',
        ]
        return {
          id: i,
          left: `${left}%`,
          delay: `${delay}s`,
          duration: `${duration}s`,
          size,
          color: colors[i % colors.length]!,
          rotate: `${(i * 47) % 360}deg`,
          round: i % 3 === 0,
        }
      }),
    [],
  )

  return (
    <div className="winner-reveal__confetti" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={[
            'winner-reveal__piece',
            p.round ? 'winner-reveal__piece--round' : '',
          ].join(' ')}
          style={{
            left: p.left,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            ['--piece-rot' as string]: p.rotate,
          }}
        />
      ))}
    </div>
  )
}

export function WinnerReveal({ place, resolvedBy, onDone }: WinnerRevealProps) {
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter')
  const [mountNode] = useState(() =>
    typeof document !== 'undefined'
      ? document.getElementById(PHONE_SHELL_ID)
      : null,
  )
  const doneRef = useState(() => ({ called: false }))[0]
  const isRandom = resolvedBy === 'random'

  const finish = useCallback(() => {
    if (doneRef.called) return
    doneRef.called = true
    onDone()
  }, [doneRef, onDone])

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setPhase('exit'), HOLD_MS)
    const doneTimer = window.setTimeout(() => finish(), HOLD_MS + FADE_MS)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(doneTimer)
    }
  }, [finish])

  if (!mountNode) return null

  const dismissEarly = () => {
    if (doneRef.called) return
    setPhase('exit')
    window.setTimeout(() => finish(), FADE_MS)
  }

  return createPortal(
    <button
      type="button"
      className={[
        'winner-reveal absolute inset-0 z-[150] flex flex-col items-center justify-center overflow-hidden px-6 text-center',
        phase === 'exit' ? 'winner-reveal--exit' : '',
      ].join(' ')}
      onClick={dismissEarly}
      aria-label={`Winner is ${place.name}. Tap to continue.`}
    >
      <Confetti />
      <div className="winner-reveal__glow" aria-hidden />

      <div className="winner-reveal__badge mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.28em] text-white backdrop-blur-sm">
        {isRandom ? (
          <Dices className="h-3.5 w-3.5" />
        ) : (
          <Trophy className="h-3.5 w-3.5" />
        )}
        {isRandom ? 'Lucky pick' : 'Group decides'}
      </div>

      <p className="winner-reveal__eyebrow text-sm font-semibold uppercase tracking-[0.3em] text-white/85">
        Winner is
      </p>

      <div className="winner-reveal__card mt-5 w-full max-w-[17rem] overflow-hidden rounded-3xl bg-white/95 shadow-2xl ring-1 ring-white/40">
        <div className="aspect-[4/3] overflow-hidden bg-emerald-100">
          <img
            src={place.image}
            alt=""
            className="winner-reveal__image h-full w-full object-cover"
          />
        </div>
        <div className="px-4 py-4">
          <h2 className="winner-reveal__name font-bold tracking-tight text-gray-900">
            {place.name}
          </h2>
          <p className="mt-1 text-xs text-muted">Tap anywhere to continue</p>
        </div>
      </div>
    </button>,
    mountNode,
  )
}
