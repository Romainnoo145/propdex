interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Full-page layout wrapper for the Propdex map interface.
 *
 * Provides a full-viewport container with proper z-index structure
 * for the map canvas and floating UI elements (search bar, sidebar, panels).
 */
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <main className="relative w-full h-screen overflow-hidden">
      {children}
    </main>
  );
}
