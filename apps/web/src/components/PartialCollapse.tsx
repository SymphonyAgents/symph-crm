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
  /** Extra classes forwarded to the root wrapper */
  className?: string
}

export function PartialCollapse({
  children,
  collapsedHeight = 88,
  label,
  date,
  icon,
  className,
}: PartialCollapseProps) {
  const [expanded, setExpanded] = useState(false)
  const [needsCollapse, setNeedsCollapse] = useState(false)
  const [fullHeight, setFullHeight] = useState<number>(collapsedHeight)
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!contentRef.current) return
    const h = contentRef.current.scrollHeight
    setFullHeight(h)
    setNeedsCollapse(h > collapsedHeight + 8)
  }, [children, collapsedHeight])

  const toggle = useCallback(() => setExpanded(prev => !prev), [])

  // Mask-image approach: no background color needed, works in any theme.
  // When collapsed: fade the bottom 40% of the clip area to transparent.
  // When expanded: mask covers 100% (effectively no mask).
  // Both states use the same gradient structure so browsers interpolate the stop.
  const maskCollapsed = 'linear-gradient(to bottom, black 55%, transparent 100%)'
  const maskExpanded  = 'linear-gradient(to bottom, black 100%, transparent 101%)'

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
      <div
        className="overflow-hidden"
        style={{
          maxHeight: expanded ? fullHeight : collapsedHeight,
          transition: 'max-height 300ms ease-in-out, mask-image 300ms ease-in-out, -webkit-mask-image 300ms ease-in-out',
          WebkitMaskImage: needsCollapse ? (expanded ? maskExpanded : maskCollapsed) : undefined,
          maskImage:       needsCollapse ? (expanded ? maskExpanded : maskCollapsed) : undefined,
        }}
      >
        <div ref={contentRef}>{children}</div>
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
