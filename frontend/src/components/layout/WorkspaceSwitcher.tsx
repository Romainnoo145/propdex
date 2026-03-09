import { BriefcaseBusiness } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace/useWorkspace'
import { workspaceRoleMeta } from '@/lib/workspace/WorkspaceContext'

function getNextRoleLabel(role: keyof typeof workspaceRoleMeta): string {
  if (role === 'vastgoedontwikkelaar') {
    return workspaceRoleMeta.kwaliteitsborger.label
  }
  if (role === 'kwaliteitsborger') {
    return workspaceRoleMeta.particulier.label
  }
  return workspaceRoleMeta.vastgoedontwikkelaar.label
}

export default function WorkspaceSwitcher() {
  const { role, roleMeta, cycleRole } = useWorkspace()
  const nextRoleLabel = getNextRoleLabel(role)

  return (
    <button
      onClick={cycleRole}
      className="group relative flex h-12 w-12 flex-col items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 transition-colors hover:border-aura-amber/40 hover:bg-neutral-50 hover:text-aura-ink"
      aria-label={`Werkruimte: ${roleMeta.label}. Klik om te wisselen naar ${nextRoleLabel}`}
      title={`Werkruimte: ${roleMeta.label}`}
    >
      <BriefcaseBusiness size={14} />
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">{roleMeta.shortLabel}</span>
      <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-neutral-200 bg-aura-canvas px-2 py-1 text-xs text-aura-ink opacity-0 transition-opacity group-hover:opacity-100">
        {roleMeta.label} · klik om te wisselen
      </span>
    </button>
  )
}
