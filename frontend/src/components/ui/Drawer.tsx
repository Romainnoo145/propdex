import { useEffect, useRef } from 'react';
import FocusLock from 'react-focus-lock';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const widthClasses = {
  sm: 'max-w-md', // ~28rem
  md: 'max-w-2xl', // ~42rem (~45% screen)
  lg: 'max-w-4xl', // ~56rem
};

/**
 * Right-sliding drawer with glassmorphism styling
 * - Focus trap when open
 * - Escape key to close
 * - Backdrop click to close
 * - CSS slide-in animation
 */
export function Drawer({ isOpen, onClose, children, width = 'md' }: DrawerProps) {
  const isAnimatingRef = useRef(false);

  useEscapeKey(onClose, isOpen);

  // Start animation after mount
  useEffect(() => {
    if (isOpen) {
      const timer = requestAnimationFrame(() => {
        isAnimatingRef.current = true;
      });
      return () => cancelAnimationFrame(timer);
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <FocusLock>
      <div>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 opacity-100"
          style={{ zIndex: 'var(--z-property-panel)' }}
          onClick={onClose}
        />

        {/* Drawer panel */}
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed right-0 top-0 bottom-0 ${widthClasses[width]} w-full bg-black/40 backdrop-blur-xl border-l border-white/15 shadow-2xl flex flex-col transition-transform duration-300 ease-out translate-x-0`}
          style={{ zIndex: 'calc(var(--z-property-panel) + 1)' }}
        >
          {children}
        </div>
      </div>
    </FocusLock>
  );
}
