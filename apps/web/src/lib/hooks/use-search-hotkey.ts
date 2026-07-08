'use client'

import { useEffect, type RefObject } from 'react'

function hasOpenOverlayElement() {
  return Boolean(document.querySelector([
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[data-state="open"]',
    '[data-search-escape-blocker="true"]',
  ].join(',')))
}

/**
 * useSearchHotkey — Cmd/Ctrl+F focuses an in-page search input.
 *
 * Listens globally for Cmd+F (mac) / Ctrl+F (win/linux), preventDefault to
 * suppress the browser's native find dialog, and focuses + selects the
 * referenced input. Optional `onTrigger` runs alongside the focus (e.g. to
 * open a collapsed search panel before focusing). Optional `onClear` runs
 * on Escape (typically clears the search and blurs).
 *
 * Pattern lifted from Pipeline.tsx + Wiki layout + Deals.tsx — consolidated
 * here so adding a new search-bar page is one hook call away.
 *
 * Usage:
 *   const inputRef = useRef<HTMLInputElement>(null)
 *   useSearchHotkey({ inputRef })
 *   <input ref={inputRef} ... />
 *
 * With panel toggle (Pipeline-style):
 *   useSearchHotkey({
 *     inputRef,
 *     onTrigger: () => setSearchOpen(true),
 *     onClear: () => { setSearchOpen(false); setSearch('') },
 *   })
 */
export function useSearchHotkey(opts: {
  inputRef: RefObject<HTMLInputElement | null>
  /** Run before focusing — useful for opening a collapsed search UI. */
  onTrigger?: () => void
  /** Run on Escape — typically clears the search and blurs. Omit to disable. */
  onClear?: () => void
  /** Disable the hotkey conditionally (default true). */
  enabled?: boolean
  /**
   * Delay in ms before focusing the input. Defaults to 0; set to ~50 if
   * `onTrigger` mounts the input (e.g. opens a panel) and the ref isn't
   * attached on the same tick.
   */
  focusDelay?: number
}) {
  const { inputRef, onTrigger, onClear, enabled = true, focusDelay = 0 } = opts

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return

    function handleKeyDown(e: KeyboardEvent) {
      const isFindShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f'
      if (isFindShortcut) {
        e.preventDefault()
        onTrigger?.()
        if (focusDelay > 0) {
          setTimeout(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
          }, focusDelay)
        } else {
          inputRef.current?.focus()
          inputRef.current?.select()
        }
        return
      }
      if (e.key === 'Escape' && onClear) {
        if (hasOpenOverlayElement()) return
        onClear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, inputRef, onTrigger, onClear, focusDelay])
}
