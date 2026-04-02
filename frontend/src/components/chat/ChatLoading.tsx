/**
 * ChatLoading — typing indicator shown while waiting for API response.
 *
 * Optionally shows Dutch tool-name progress text when tools are executing.
 */

import { motion, AnimatePresence } from 'framer-motion'

/** Dutch display names for agent tools. */
const TOOL_NAME_MAP: Record<string, string> = {
  list_reports: 'Rapporten ophalen…',
  list_favorites: 'Favorieten bekijken…',
  get_report: 'Rapport analyseren…',
  search_reports: 'Rapporten doorzoeken…',
  get_favorite: 'Favoriet ophalen…',
  list_scans: 'Scans bekijken…',
  get_scan_results: 'Scanresultaten ophalen…',
}

/** Fallback: generate a readable Dutch label from a snake_case tool name. */
function fallbackToolLabel(tool: string): string {
  return tool.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) + '…'
}

interface ChatLoadingProps {
  tools?: string[]
}

export function ChatLoading({ tools }: ChatLoadingProps) {
  const activeTools = tools && tools.length > 0 ? tools : null

  return (
    <div className="flex flex-col gap-1.5">
      {/* Bouncing dots */}
      <div className="flex items-center gap-1.5 px-3 py-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-amber-400"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>

      {/* Tool progress text */}
      <AnimatePresence mode="popLayout">
        {activeTools && activeTools.map((tool) => (
          <motion.p
            key={tool}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="px-3 text-[12px] text-amber-600 font-medium"
          >
            {TOOL_NAME_MAP[tool] ?? fallbackToolLabel(tool)}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  )
}
