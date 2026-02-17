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
 * Right-sliding drawer with Industrial Amber design tokens
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
          className="fixed inset-0 bg-grey-950/40 transition-opacity duration-300 opacity-100"
          style={{ zIndex: 'var(--z-property-panel)' }}
          onClick={onClose}
        />

        {/* Drawer panel - bottom sheet on mobile, right drawer on desktop */}
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh] border-t border-grey-800 bg-grey-900 shadow-2xl flex flex-col md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:rounded-none md:max-h-none md:border-t-0 md:border-l md:border-grey-800 ${widthClasses[width]} md:w-full transition-transform duration-300 ease-out translate-x-0`}
          style={{ zIndex: 'calc(var(--z-property-panel) + 1)' }}
        >
          {/* Drag handle - mobile only */}
          <div className="flex justify-center py-2 md:hidden flex-shrink-0">
            <div className="w-10 h-1 bg-grey-700 rounded-full" />
          </div>

          {/* Scrollable content with touch-safe events */}
          <div
            className="flex-1 overflow-y-auto flex flex-col"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    </FocusLock>
  );
}
