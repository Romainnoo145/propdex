import * as React from 'react';
import { cn } from '@/lib/utils';

export const DEFAULT_SEARCH_INPUT_PROPS = {
  autoComplete: 'new-password',
  autoCorrect: 'off',
  autoCapitalize: 'none',
  spellCheck: false,
  inputMode: 'search' as const,
  enterKeyHint: 'search' as const,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
};

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  leftIcon?: React.ReactNode;
  containerClassName?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ leftIcon, containerClassName, className, ...props }, ref) => {
    const control = (
      <input
        ref={ref}
        type="search"
        {...DEFAULT_SEARCH_INPUT_PROPS}
        {...props}
        className={cn(
          'w-full rounded-lg border border-neutral-200 bg-neutral-50 pr-3 text-sm text-aura-ink placeholder:text-neutral-500 focus:border-aura-amber/40 focus:outline-none',
          leftIcon ? 'pl-9' : 'pl-3',
          className
        )}
      />
    );

    if (!leftIcon) return control;

    return (
      <div className={cn('relative', containerClassName)}>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
          {leftIcon}
        </span>
        {control}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
