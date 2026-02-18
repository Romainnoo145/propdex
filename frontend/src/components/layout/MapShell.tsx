interface MapShellProps {
  children: React.ReactNode
}

/**
 * Full-viewport layout shell for the /map route.
 *
 * Provides absolute positioning context for all floating map UI:
 * search bar, layer toggle, inspector panel, property cards, overlays.
 *
 * Note: h-full not h-screen — parent (_authenticated.tsx) already owns full height.
 * The persistent MapView lives in the parent; MapShell wraps controls rendered on top.
 */
export default function MapShell({ children }: MapShellProps) {
  return (
    <div className="relative w-full h-full overflow-hidden pointer-events-none [&>*]:pointer-events-auto">
      {children}
    </div>
  )
}
