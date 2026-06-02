import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium cursor-pointer transition-all rounded-lg border border-transparent bg-clip-padding outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/30 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outline: 'border-border bg-background hover:bg-muted hover:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted hover:text-foreground',
        destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto border-none',
      },
      size: {
        default: 'h-11 sm:h-8 px-3 sm:px-2.5 text-sm',
        sm: 'h-10 sm:h-7 px-3 sm:px-2.5 text-xs rounded-md',
        lg: 'h-11 sm:h-9 px-4 sm:px-3.5 text-sm',
        icon: 'size-11 sm:size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
