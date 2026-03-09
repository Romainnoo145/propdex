import * as React from 'react';
import { cn } from '@/lib/utils';

type MetricChipTone = 'neutral' | 'amber' | 'info' | 'error';

const toneClasses: Record<MetricChipTone, string> = {
  neutral: 'border-neutral-200 bg-neutral-50 text-neutral-600',
  amber: 'border-aura-amber/30 bg-aura-amber/12 text-aura-amber',
  info: 'border-info/30 bg-info/12 text-info',
  error: 'border-error/30 bg-error/12 text-error',
};

export interface MetricChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: number | string;
  icon?: React.ReactNode;
  tone?: MetricChipTone;
  compact?: boolean;
  ariaLabel?: string;
  deEmphasizeZero?: boolean;
}

function isZeroValue(value: number | string): boolean {
  if (typeof value === 'number') return value === 0;
  return value.trim() === '0';
}

export function MetricChip({
  value,
  icon,
  tone = 'neutral',
  compact = false,
  ariaLabel,
  className,
  title,
  deEmphasizeZero = true,
  ...rest
}: MetricChipProps) {
  const zero = deEmphasizeZero && isZeroValue(value);
  const effectiveTone: MetricChipTone = zero ? 'neutral' : tone;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold tabular-nums leading-none',
        compact ? 'gap-1 px-1.5 py-0.5 text-[11px]' : 'gap-1.5 px-2 py-0.5 text-xs',
        toneClasses[effectiveTone],
        className
      )}
      title={title ?? (ariaLabel ? `${ariaLabel}: ${value}` : undefined)}
      aria-label={ariaLabel ? `${ariaLabel}: ${value}` : undefined}
      {...rest}
    >
      {icon ? (
        <span className="inline-flex items-center justify-center">
          {icon}
        </span>
      ) : null}
      <span>{value}</span>
    </span>
  );
}
