import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          'h-[var(--control-height-md)] w-full min-w-0 rounded-control border border-input bg-card px-2.5 py-1 text-xs outline-none transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
