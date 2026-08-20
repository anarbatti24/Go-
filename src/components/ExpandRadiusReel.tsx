/**
 * End-of-feed reel — invite the user to widen their travel bubble.
 */

import { Compass, Loader2, MapPinned } from 'lucide-react'

interface ExpandRadiusReelProps {
  currentKm: number
  expandByKm: number
  nextKm: number
  extraCount: number | null
  prefetching: boolean
  atMax: boolean
  onExpand: () => void
}

export function ExpandRadiusReel({
  currentKm,
  expandByKm,
  nextKm,
  extraCount,
  prefetching,
  atMax,
  onExpand,
}: ExpandRadiusReelProps) {
  const countLabel =
    extraCount == null
      ? null
      : extraCount === 1
        ? '1 more activity'
        : `${extraCount} more activities`

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-zinc-950 via-black to-zinc-900 px-6 text-center text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,107,53,0.18),transparent_60%)]" />

      <div className="relative z-10 flex max-w-sm flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/20 text-primary ring-1 ring-primary/30">
          {atMax ? (
            <Compass className="h-8 w-8" />
          ) : (
            <MapPinned className="h-8 w-8" />
          )}
        </div>

        {atMax ? (
          <>
            <h2 className="text-2xl font-bold tracking-tight">
              That&apos;s everything nearby
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              You&apos;re already searching up to {currentKm} km — as far as
              Go! goes. Check back later or tweak your interests for a fresh
              mix.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold tracking-tight">
              That&apos;s all in this area!
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              {prefetching && extraCount == null ? (
                <>Scouting a bit farther out&hellip;</>
              ) : extraCount === 0 ? (
                <>
                  No fresh spots within +{expandByKm} km — try expanding to{' '}
                  {nextKm} km anyway, or change your location.
                </>
              ) : (
                <>
                  {countLabel ? (
                    <>
                      There {extraCount === 1 ? 'is' : 'are'}{' '}
                      <span className="font-semibold text-white">
                        {countLabel}
                      </span>{' '}
                      if you expand your travel radius by{' '}
                      <span className="font-semibold text-white">
                        {expandByKm} km
                      </span>{' '}
                      (to {nextKm} km).
                    </>
                  ) : (
                    <>
                      Expand your travel radius by{' '}
                      <span className="font-semibold text-white">
                        {expandByKm} km
                      </span>{' '}
                      (to {nextKm} km) to keep discovering.
                    </>
                  )}
                </>
              )}
            </p>

            <button
              type="button"
              onClick={onExpand}
              disabled={prefetching && extraCount == null}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"
            >
              {prefetching && extraCount == null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking farther&hellip;
                </>
              ) : (
                <>Expand to {nextKm} km</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
