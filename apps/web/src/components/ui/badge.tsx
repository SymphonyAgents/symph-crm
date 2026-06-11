import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex h-5 items-center rounded-control px-2 text-xxs font-medium leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-purple-dim text-purple-foreground',
        success: 'bg-success-dim text-success-foreground',
        danger: 'bg-danger-dim text-danger-foreground',
        warning: 'bg-warning-dim text-warning-foreground',
        info: 'bg-info-dim text-info-foreground',
        muted: 'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
