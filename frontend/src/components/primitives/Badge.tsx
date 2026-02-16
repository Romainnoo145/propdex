import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-grey-850 text-grey-100 border border-grey-800',
        success: 'bg-success/15 text-success border border-success/25',
        error: 'bg-error/15 text-error border border-error/25',
        warning: 'bg-warning/15 text-warning border border-warning/25',
        info: 'bg-info/15 text-info border border-info/25',
        amber: 'bg-amber-accent/15 text-amber-accent border border-amber-accent/25',
        teal: 'bg-teal-accent/15 text-teal-accent border border-teal-accent/25',
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
