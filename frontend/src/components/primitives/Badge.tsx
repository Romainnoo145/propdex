import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-aura-glass-white/40 text-aura-ink border border-neutral-200',
        success: 'bg-success/15 text-success border border-success/25',
        error: 'bg-error/15 text-error border border-error/25',
        warning: 'bg-warning/15 text-warning border border-warning/25',
        info: 'bg-info/15 text-info border border-info/25',
        amber: 'bg-aura-amber/15 text-aura-amber border border-aura-amber/25',
        teal: 'bg-aura-green/15 text-aura-green border border-aura-green/25',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  }
);
Badge.displayName = 'Badge';

export { Badge };
