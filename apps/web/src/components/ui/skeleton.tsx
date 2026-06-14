import { cn } from '@/lib/utils'

// Base skeleton primitive. Use directly or build named skeletons on top of it.
// Rules:
// - Data loading uses skeletons.
// - Button, save, and logout actions use spinners only.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-skeleton',
        className,
      )}
    />
  )
}
