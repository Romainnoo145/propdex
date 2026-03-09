export function AuthLoadingScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-aura-canvas">
      <div className="text-center">
        <h1 className="mb-6 text-5xl font-bold tracking-tight text-aura-ink">
          Propdex
        </h1>
        <div className="flex items-center justify-center gap-2">
          <div
            className="h-2 w-2 animate-pulse rounded-full bg-aura-amber"
            style={{
              animationDelay: '0ms',
              animationDuration: '1.4s',
            }}
          />
          <div
            className="h-2 w-2 animate-pulse rounded-full bg-aura-amber"
            style={{
              animationDelay: '200ms',
              animationDuration: '1.4s',
            }}
          />
          <div
            className="h-2 w-2 animate-pulse rounded-full bg-aura-amber"
            style={{
              animationDelay: '400ms',
              animationDuration: '1.4s',
            }}
          />
        </div>
      </div>
    </div>
  )
}
