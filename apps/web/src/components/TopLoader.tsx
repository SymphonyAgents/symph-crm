'use client'

/**
 * TopLoader — Twitter/GitHub-style thin progress bar at the top of the viewport.
 *
 * Works with Next.js App Router by patching window.history.pushState so we can
 * detect navigation _start_ (not just completion). Route change completion is
 * detected via usePathname() + useSearchParams().
 *
 * Uses the app's primary color in both light and dark mode.
 *
 * Add <TopLoader /> inside <Providers> (above {children}) so it sits at the top
 * of every page without being re-mounted on navigation.
 */

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useCallback, Suspense } from 'react'

// ─── History Patch ────────────────────────────────────────────────────────────
// Patches pushState once to emit a "navigationstart" custom event so we can
// start the bar before the new page renders.

let patched = false

function patchHistory() {
  if (patched || typeof window === 'undefined') return
  patched = true

  const original = window.history.pushState.bind(window.history)
  window.history.pushState = function (...args: Parameters<typeof window.history.pushState>) {
    window.dispatchEvent(new Event('navigationstart'))
    return original(...args)
  }
}

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────

function TopLoaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [opacity, setOpacity] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressRef = useRef(0)

  const clearTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
  }, [])

  const startLoading = useCallback(() => {
    clearTimers()
    progressRef.current = 8
    // Defer state updates to avoid scheduling during useInsertionEffect
    requestAnimationFrame(() => {
      setProgress(8)
      setOpacity(1)
    })

    intervalRef.current = setInterval(() => {
      const curr = progressRef.current
      // Fast from 0→60, slow crawl from 60→85, stall near 90
      const increment = curr < 60
        ? 6 + Math.random() * 8
        : curr < 80
          ? 2 + Math.random() * 3
          : curr < 88
            ? 0.5 + Math.random() * 1
            : 0

      const next = Math.min(curr + increment, 88)
      progressRef.current = next
      setProgress(next)
    }, 250)
  }, [clearTimers])

  const completeLoading = useCallback(() => {
    clearTimers()
    progressRef.current = 100
    setProgress(100)

    // Fade out after bar reaches 100%
    hideTimerRef.current = setTimeout(() => {
      setOpacity(0)
      hideTimerRef.current = setTimeout(() => {
        setProgress(0)
        progressRef.current = 0
      }, 220)
    }, 180)
  }, [clearTimers])

  // Patch history on mount (client-only, runs once)
  useEffect(() => {
    patchHistory()

    const onStart = () => startLoading()
    const onPop = () => startLoading()

    window.addEventListener('navigationstart', onStart)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('navigationstart', onStart)
      window.removeEventListener('popstate', onPop)
    }
  }, [startLoading])

  // Complete whenever the route finishes changing
  useEffect(() => {
    // Don't fire on the very first render (no navigation happened)
    if (progressRef.current === 0) return
    completeLoading()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          opacity,
          transition: progress === 100
            ? 'width 180ms ease-out, opacity 220ms ease 180ms'
            : opacity === 1
              ? 'width 250ms ease-in-out'
              : 'none',
        }}
        className="bg-primary"
      />
    </div>
  )
}

// ─── Public export ────────────────────────────────────────────────────────────
// Wrapped in Suspense because useSearchParams() requires it in App Router.

export function TopLoader() {
  return (
    <Suspense fallback={null}>
      <TopLoaderInner />
    </Suspense>
  )
}
