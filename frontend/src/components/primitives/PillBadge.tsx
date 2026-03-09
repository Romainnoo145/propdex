import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const pillBadgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-aura-glass-white/25 text-aura-ink border border-white/40',
        amber: 'bg-aura-amber/15 text-aura-amber',
        green: 'bg-aura-green/15 text-aura-green',
        obsidian: 'bg-aura-obsidian text-white',
        error: 'bg-error/15 text-error',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface PillBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillBadgeVariants> {}

const PillBadge = React.forwardRef<HTMLSpanElement, PillBadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <span
        className={cn(pillBadgeVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
PillBadge.displayName = 'PillBadge';

export { PillBadge, pillBadgeVariants };
