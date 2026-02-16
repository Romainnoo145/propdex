import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-grey-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-amber-accent text-grey-950 hover:bg-amber-accent-hover focus-visible:ring-amber-accent',
        secondary:
          'bg-teal-accent text-white hover:bg-teal-accent-hover focus-visible:ring-teal-accent',
        ghost: 'text-grey-100 hover:bg-grey-850 focus-visible:ring-grey-800',
        outline:
          'border border-grey-800 bg-transparent text-grey-100 hover:bg-grey-900 focus-visible:ring-grey-800',
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
