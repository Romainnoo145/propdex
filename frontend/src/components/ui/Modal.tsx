import { useId } from 'react';
import FocusLock from 'react-focus-lock';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

/**
 * Centered modal with Industrial Amber design tokens
 * - Focus trap when open
 * - Escape key to close
 * - Backdrop click to close
 * - Max height 85vh with scroll
 */
export function Modal({ isOpen, onClose, children, size = 'md', title }: ModalProps) {
  const titleId = useId();
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <FocusLock>
      <div>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-aura-canvas/60 opacity-100"
          style={{ zIndex: 'var(--z-modal)' }}
          onClick={onClose}
        />

        {/* Modal panel */}
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 'calc(var(--z-modal) + 1)' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={`${sizeClasses[size]} w-full max-h-[85vh] bg-aura-glass-white/60 rounded-lg border border-neutral-200 shadow-2xl overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {title && <span id={titleId} className="sr-only">{title}</span>}
            {children}
          </div>
        </div>
      </div>
    </FocusLock>
  );
}
