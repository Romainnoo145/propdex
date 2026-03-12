# Deferred Items — Phase 107

## Pre-existing TypeScript errors (out of scope for Phase 107-01)

These errors exist in unstaged files that were modified before Phase 107 execution.
They must be fixed before the next full `npm run check`.

1. `frontend/src/components/map/panels/parcel/EigendomModal.tsx` line 67:
   - `Property 'env' does not exist on type 'ImportMeta'`
   - Cause: `import.meta.env.DEV` usage — needs `vite/client` type declaration
   - Note: MEMORY.md says "DEV_MOCK: import.meta.env.DEV flag skips confirm + shows mock data — REMOVE before production"

2. `frontend/src/components/map/panels/layers/BronnenLayer.tsx` line 416:
   - `Cannot find name 'BookOpen'`
   - Cause: Missing `BookOpen` import from lucide-react
