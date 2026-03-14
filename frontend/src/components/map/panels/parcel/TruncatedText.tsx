import { useRef, useState, useEffect } from 'react'

export function TruncatedText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (el) setIsTruncated(el.scrollWidth > el.clientWidth)
  }, [text])

  return (
    <div className="relative group/tip min-w-0">
      <p
        ref={ref}
        className={className ?? 'text-[11px] font-bold text-slate-400 leading-tight truncate'}
      >
        {text}
      </p>
      {isTruncated && (
        <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tip:block z-20 pointer-events-none">
          <div className="bg-slate-800 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-lg max-w-[200px] leading-snug">
            {text}
          </div>
        </div>
      )}
    </div>
  )
}
