import { useEffect } from 'react';
import FocusLock from 'react-focus-lock';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface PropertyBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * PropertyBottomSheet — Mobile-only bottom sheet for property details
 * - Slide-up animation from bottom
 * - Touch-safe scrolling (prevents map pan conflicts)
 * - FocusLock and escape-to-close
 * - Glassmorphism design
 */
export function PropertyBottomSheet({
  isOpen,
  onClose,
  children,
}: PropertyBottomSheetProps) {
  useEscapeKey(onClose, isOpen);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <FocusLock>
      <div className="fixed inset-0 md:hidden" style={{ zIndex: 'var(--z-property-panel)' }}>
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Bottom sheet panel */}
        <div
          role="dialog"
          aria-modal="true"
          className="absolute inset-x-0 bottom-0 bg-black/40 backdrop-blur-xl border-t border-white/10 rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up"
        >
          {/* Drag handle */}
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 bg-white/30 rounded-full" />
          </div>

          {/* Scrollable content */}
          <div
            className="overflow-y-auto flex-1"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    </FocusLock>
  );
}
