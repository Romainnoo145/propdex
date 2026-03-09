import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/primitives/Button';

interface ErrorStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
}

interface ErrorStateProps {
  message?: string;
  actions?: ErrorStateAction[];
  className?: string;
}

export function ErrorState({ message, actions, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 px-6 text-center',
        className
      )}
    >
      <AlertTriangle className="h-8 w-8 text-error" />
      <p className="text-sm text-neutral-600">{message ?? 'Er is iets misgegaan.'}</p>
      {actions && actions.length > 0 && (
        <div className="flex gap-2 mt-1">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? 'primary'}
              size="sm"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
