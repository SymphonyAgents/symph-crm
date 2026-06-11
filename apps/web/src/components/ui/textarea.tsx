import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        data-slot="textarea"
        className={cn(
          'flex field-sizing-content min-h-16 w-full resize-y rounded-control border border-input bg-card px-2.5 py-2 text-xs outline-none transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
