import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-transparent bg-clip-padding font-medium tracking-[-0.005em] cursor-pointer outline-none select-none transition-colors duration-100 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary-ring active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        outline: 'border-border-strong bg-card hover:bg-surface-hover hover:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-surface-hover',
        ghost: 'hover:bg-surface-hover hover:text-foreground',
        destructive: 'bg-danger-dim text-danger hover:bg-danger/20',
        link: 'h-auto border-none p-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-[var(--control-height-md)] px-2.5 text-xs',
        sm: 'h-[var(--control-height-sm)] px-2 text-xxs',
        lg: 'h-[var(--control-height-lg)] px-3.5 text-ssm',
        icon: 'size-[var(--control-height-md)]',
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
