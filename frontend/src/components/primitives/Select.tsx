import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  containerClassName?: string
  iconClassName?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, iconClassName, children, ...props }, ref) => {
    return (
      <div className={cn('relative', containerClassName)}>
        <select
          className={cn(
            'h-10 w-full appearance-none rounded-lg border border-neutral-200 bg-aura-glass-white/60 px-3 pr-9 text-sm text-aura-ink transition-colors',
            'hover:border-neutral-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aura-green focus-visible:border-aura-green',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500',
            iconClassName
          )}
          size={14}
          aria-hidden="true"
        />
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
