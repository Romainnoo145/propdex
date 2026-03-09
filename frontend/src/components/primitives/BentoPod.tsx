import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const bentoPodVariants = cva(
  'bg-aura-glass-white/40 border border-white/40 rounded-2xl shadow-sm',
  {
    variants: {
      interactive: {
        true: 'cursor-pointer aura-hover-pod',
        false: '',
      },
      size: {
        default: 'p-4',
        compact: 'p-3',
        spacious: 'p-6',
      },
    },
    defaultVariants: { interactive: false, size: 'default' },
  }
);

export interface BentoPodProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bentoPodVariants> {}

const BentoPod = React.forwardRef<HTMLDivElement, BentoPodProps>(
  ({ className, interactive, size, ...props }, ref) => {
    return (
      <div
        className={cn(bentoPodVariants({ interactive, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
BentoPod.displayName = 'BentoPod';

export { BentoPod, bentoPodVariants };
