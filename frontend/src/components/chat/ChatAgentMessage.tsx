/**
 * ChatAgentMessage — renders agent response as rich markdown with citation sources.
 *
 * Uses react-markdown + remark-gfm for GFM tables, task lists, strikethrough.
 * Citation sources appear as a "Bronnen" footer with external links.
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExternalLink } from 'lucide-react'
import type { Components } from 'react-markdown'
import type { Source } from '@/hooks/useChat'

interface ChatAgentMessageProps {
  text: string
  sources?: Source[]
}

/** Extract a short domain label from a URL for display. */
function domainLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    // Truncate long hostnames
    return host.length > 30 ? host.slice(0, 27) + '…' : host
  } catch {
    return url.slice(0, 30)
  }
}

/** Custom component overrides for Tailwind styling inside markdown. */
const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-[16px] font-bold text-aura-obsidian mt-3 mb-1.5 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-[15px] font-bold text-aura-obsidian mt-2.5 mb-1 first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-[14px] font-bold text-aura-obsidian mt-2 mb-1 first:mt-0" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-[13px] font-semibold text-aura-obsidian mt-2 mb-0.5 first:mt-0" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="text-[13px] text-slate-700 leading-relaxed mb-2 last:mb-0" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-aura-obsidian" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>{children}</em>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber-600 hover:text-amber-700 underline underline-offset-2 transition-colors"
      {...props}
    >
      {children}
    </a>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-5 mb-2 space-y-0.5 text-[13px] text-slate-700" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-5 mb-2 space-y-0.5 text-[13px] text-slate-700" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed" {...props}>{children}</li>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-2 -mx-1">
      <table className="min-w-full text-[12px] border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-slate-50" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-slate-200 px-2.5 py-1.5 text-left font-semibold text-aura-obsidian" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-slate-200 px-2.5 py-1.5 text-slate-600" {...props}>
      {children}
    </td>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-amber-300 pl-3 my-2 text-[13px] text-slate-500 italic" {...props}>
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...props }) => {
    // Inline code (no language class) vs code block
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <code className={`block bg-slate-50 rounded-lg p-3 text-[12px] text-slate-700 overflow-x-auto ${className ?? ''}`} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code className="bg-slate-100 rounded px-1 py-0.5 text-[12px] text-amber-700" {...props}>
        {children}
      </code>
    )
  },
  hr: (props) => <hr className="my-3 border-slate-200" {...props} />,
}

export function ChatAgentMessage({ text, sources }: ChatAgentMessageProps) {
  const hasSources = sources && sources.length > 0

  return (
    <div className="space-y-0">
      {/* Markdown body */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>

      {/* Citation sources */}
      {hasSources && (
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
            Bronnen
          </p>
          <div className="space-y-1">
            {sources.map((src, i) => (
              <a
                key={`${src.url}-${i}`}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 group"
              >
                <ExternalLink size={11} className="text-slate-300 group-hover:text-amber-500 shrink-0 transition-colors" />
                <span className="text-[12px] text-slate-500 group-hover:text-amber-600 truncate transition-colors">
                  {src.title || domainLabel(src.url)}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
