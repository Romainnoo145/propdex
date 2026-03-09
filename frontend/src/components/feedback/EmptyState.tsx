import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/primitives/Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 px-6 text-center',
        className
      )}
    >
      {icon && <div className="text-neutral-500">{icon}</div>}
      <p className="text-sm font-medium text-neutral-600">{title}</p>
      {description && <p className="text-xs text-neutral-500">{description}</p>}
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
