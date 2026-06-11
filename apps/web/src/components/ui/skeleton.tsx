import { cn } from '@/lib/utils'

/**
 * Base skeleton primitive. Use directly or build named skeletons on top of it.
 *
 * Rules:
 *  - Data loading → skeleton (this component)
 *  - Button/save/logout → spinner only
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-secondary',
        className,
      )}
    />
  )
}
