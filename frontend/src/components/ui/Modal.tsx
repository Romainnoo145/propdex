import FocusLock from 'react-focus-lock';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

/**
 * Centered modal with glassmorphism styling
 * - Focus trap when open
 * - Escape key to close
 * - Backdrop click to close
 * - Max height 85vh with scroll
 */
export function Modal({ isOpen, onClose, children, size = 'md' }: ModalProps) {
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <FocusLock>
      <div>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm opacity-100"
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
            className={`${sizeClasses[size]} w-full max-h-[85vh] bg-black/60 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    </FocusLock>
  );
}
