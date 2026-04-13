'use client'

import { useRef, useState, useLayoutEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface PartialCollapseProps {
  /** Text or node to display */
  children: React.ReactNode
  /** Collapsed height in px. Defaults to 88 (~4–5 lines at text-xs/leading-relaxed) */
  collapsedHeight?: number
  /** Label shown in the card header */
  label?: string
  /** Date string shown on the right of the header */
  date?: string
  /** Optional icon placed before the label */
  icon?: React.ReactNode
  /**
   * CSS color for the gradient fade bottom edge — must match the card's background.
   * Pass a light-mode value here and a dark-mode value in `gradientFromDark`.
   * Defaults to white / #1e1e21 (standard CRM card bg).
   */
  gradientFrom?: string
  gradientFromDark?: string
  /** Extra classes forwarded to the root wrapper */
  className?: string
}

export function PartialCollapse({
  children,
  collapsedHeight = 88,
  label,
  date,
  icon,
  gradientFrom = '#ffffff',
  gradientFromDark = '#1e1e21',
  className,
}: PartialCollapseProps) {
  const [expanded, setExpanded] = useState(false)
  const [needsCollapse, setNeedsCollapse] = useState(false)
  const [fullHeight, setFullHeight] = useState<number>(collapsedHeight)
  const contentRef = useRef<HTMLDivElement>(null)

  // Measure the real content height after mount / children change
  useLayoutEffect(() => {
    if (!contentRef.current) return
    const h = contentRef.current.scrollHeight
    setFullHeight(h)
    setNeedsCollapse(h > collapsedHeight + 8) // 8px tolerance
  }, [children, collapsedHeight])

  const toggle = useCallback(() => setExpanded(prev => !prev), [])

  return (
    <div className={cn('flex flex-col', className)}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      {(icon || label || date) && (
        <div className="flex items-center gap-2 mb-2">
          {icon && <span className="shrink-0 text-primary">{icon}</span>}
          {label && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-primary">
              {label}
            </span>
          )}
          {date && (
            <span className="text-[10px] text-slate-400 ml-auto tabular-nums">
              {date}
            </span>
          )}
        </div>
      )}

      {/* ── Animated clip wrapper ────────────────────────────────────── */}
      <div className="relative">
        <div
          className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
          style={{ maxHeight: expanded ? fullHeight : collapsedHeight }}
        >
          <div ref={contentRef}>{children}</div>
        </div>

        {/* Gradient fade overlay */}
        {needsCollapse && (
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute bottom-0 left-0 right-0 h-12',
              'transition-opacity duration-300',
              expanded ? 'opacity-0' : 'opacity-100',
            )}
            style={{
              background: `linear-gradient(to top, ${gradientFrom}, transparent)`,
            }}
          >
            {/* Dark-mode gradient — rendered as a sibling layer via a CSS trick */}
            <span
              className="absolute inset-0 hidden dark:block"
              style={{
                background: `linear-gradient(to top, ${gradientFromDark}, transparent)`,
              }}
            />
          </div>
        )}
      </div>

      {/* ── Toggle button ────────────────────────────────────────────── */}
      {needsCollapse && (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'mt-2 self-start flex items-center gap-1',
            'text-[11px] font-semibold text-primary hover:text-[#5b52e8]',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded',
            'active:scale-[0.98]',
          )}
        >
          <span>{expanded ? 'Show less' : 'Show more'}</span>
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              'transition-transform duration-300',
              expanded ? 'rotate-180' : 'rotate-0',
            )}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  )
}
