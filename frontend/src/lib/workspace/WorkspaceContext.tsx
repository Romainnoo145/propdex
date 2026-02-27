import { createContext, useCallback, useMemo, useState } from 'react'

export type WorkspaceRole = 'vastgoedontwikkelaar' | 'kwaliteitsborger' | 'particulier'

interface WorkspaceRoleMeta {
  label: string
  shortLabel: string
  summaryLabel: string
}

interface WorkspaceContextValue {
  role: WorkspaceRole
  roleMeta: WorkspaceRoleMeta
  setRole: (role: WorkspaceRole) => void
  cycleRole: () => void
}

const STORAGE_KEY = 'propdex-workspace-role'

const WORKSPACE_ROLE_ORDER: WorkspaceRole[] = [
  'vastgoedontwikkelaar',
  'kwaliteitsborger',
  'particulier',
]

export const workspaceRoleMeta: Record<WorkspaceRole, WorkspaceRoleMeta> = {
  vastgoedontwikkelaar: {
    label: 'Vastgoedontwikkelaar',
    shortLabel: 'VGO',
    summaryLabel: 'Ontwikkelworkspace',
  },
  kwaliteitsborger: {
    label: 'Kwaliteitsborger',
    shortLabel: 'WKB',
    summaryLabel: 'Borgingsworkspace',
  },
  particulier: {
    label: 'Particulier',
    shortLabel: 'PAR',
    summaryLabel: 'Particuliere workspace',
  },
}

function parseStoredRole(): WorkspaceRole {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value && WORKSPACE_ROLE_ORDER.includes(value as WorkspaceRole)) {
      return value as WorkspaceRole
    }
  } catch {
    // localStorage unavailable
  }
  return 'vastgoedontwikkelaar'
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<WorkspaceRole>(parseStoredRole)

  const setRole = useCallback((nextRole: WorkspaceRole) => {
    setRoleState(nextRole)
    try {
      window.localStorage.setItem(STORAGE_KEY, nextRole)
    } catch {
      // localStorage unavailable
    }
  }, [])

  const cycleRole = useCallback(() => {
    const currentIndex = WORKSPACE_ROLE_ORDER.indexOf(role)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % WORKSPACE_ROLE_ORDER.length
    setRole(WORKSPACE_ROLE_ORDER[nextIndex] ?? 'vastgoedontwikkelaar')
  }, [role, setRole])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      role,
      roleMeta: workspaceRoleMeta[role],
      setRole,
      cycleRole,
    }),
    [role, setRole, cycleRole]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}
