interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Full-page layout wrapper for the Propdex map interface.
 *
 * Provides a full-viewport container with proper z-index structure
 * for the map canvas and floating UI elements (search bar, sidebar, panels).
 *
 * Note: h-full instead of h-screen since parent _authenticated.tsx already
 * handles full height and includes the side-rail.
 */
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <main className="relative w-full h-full overflow-hidden">
      {children}
    </main>
  );
}
