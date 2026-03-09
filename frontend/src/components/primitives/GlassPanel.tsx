import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const glassPanelVariants = cva(
  'border border-white/40 transition-all duration-250',
  {
    variants: {
      blur: {
        active: 'bg-aura-glass-white/60 backdrop-blur-xl shadow-glass',
        inactive: 'bg-aura-glass-white/60 shadow-glass',
      },
      rounded: {
        default: 'rounded-2xl',
        pill: 'rounded-full',
        sheet: 'rounded-t-[48px]',
        rail: 'rounded-[40px]',
      },
    },
    defaultVariants: { blur: 'inactive', rounded: 'default' },
  }
);

export interface GlassPanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassPanelVariants> {}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, blur, rounded, ...props }, ref) => {
    return (
      <div
        className={cn(glassPanelVariants({ blur, rounded, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
GlassPanel.displayName = 'GlassPanel';

export { GlassPanel, glassPanelVariants };
