export function AuthLoadingScreen() {
  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center"
      style={{ backgroundColor: 'var(--color-surface-secondary)' }}
    >
      <div className="text-center">
        <h1
          className="mb-6 text-5xl font-bold tracking-tight"
          style={{ color: 'var(--color-text)' }}
        >
          Propdex
        </h1>
        <div className="flex items-center justify-center gap-2">
          <div
            className="h-2 w-2 animate-pulse rounded-full"
            style={{
              backgroundColor: 'var(--color-primary)',
              animationDelay: '0ms',
              animationDuration: '1.4s',
            }}
          />
          <div
            className="h-2 w-2 animate-pulse rounded-full"
            style={{
              backgroundColor: 'var(--color-primary)',
              animationDelay: '200ms',
              animationDuration: '1.4s',
            }}
          />
          <div
            className="h-2 w-2 animate-pulse rounded-full"
            style={{
              backgroundColor: 'var(--color-primary)',
              animationDelay: '400ms',
              animationDuration: '1.4s',
            }}
          />
        </div>
      </div>
    </div>
  )
}
