import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-aura-canvas disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-aura-amber text-aura-obsidian hover:bg-aura-amber-hover focus-visible:ring-aura-amber',
        command:
          'bg-aura-obsidian text-white hover:bg-aura-obsidian/90 focus-visible:ring-aura-obsidian',
        secondary:
          'bg-aura-green text-white hover:bg-aura-green-hover focus-visible:ring-aura-green',
        ghost: 'text-aura-ink hover:bg-aura-glass-white/40 focus-visible:ring-neutral-400',
        outline:
          'border border-neutral-200 bg-transparent text-aura-ink hover:bg-neutral-50 focus-visible:ring-neutral-400',
        destructive: 'bg-error text-white hover:bg-error/90 focus-visible:ring-error',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs gap-1.5',
        md: 'h-8 px-3 text-sm gap-2',
        lg: 'h-9 px-4 text-sm gap-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
