import { useRef, useState, useEffect, memo } from 'react'
import { createPortal } from 'react-dom'

/**
 * TruncatedText — ellipses text with portaled hover-tooltip.
 *
 * Tooltip is rendered in document.body via portal om stacking-context en
 * overflow-clip van ouder-kaarten te ontwijken (v.a. M046/S06: ParcelDetailPanel
 * cards clippen anders de tooltip door rounded-[20px] + overflow-hidden).
 */
export const TruncatedText = memo(function TruncatedText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const [hover, setHover] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (el) setIsTruncated(el.scrollWidth > el.clientWidth)
  }, [text])

  const handleEnter = () => {
    if (!isTruncated) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ top: rect.top - 8, left: rect.left })
    setHover(true)
  }

  const handleLeave = () => setHover(false)

  return (
    <div
      className="relative min-w-0"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <p
        ref={ref}
        className={className ?? 'text-[11px] font-bold text-slate-400 leading-tight truncate'}
      >
        {text}
      </p>
      {hover && pos && createPortal(
        <div
          className="fixed z-[2147483647] pointer-events-none"
          style={{ top: pos.top, left: pos.left, transform: 'translateY(-100%)' }}
        >
          <div className="bg-slate-800 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-lg max-w-[240px] leading-snug">
            {text}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
})