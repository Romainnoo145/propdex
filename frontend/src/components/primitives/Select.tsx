import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            'flex h-8 w-full appearance-none rounded-md border border-grey-800 bg-grey-950 pl-3 pr-8 py-1.5 text-sm text-grey-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-accent focus-visible:border-teal-accent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-grey-400"
          size={14}
        />
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
