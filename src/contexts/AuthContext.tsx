import { useCallback, useMemo, useState, type ReactNode } from 'react'

import type { User } from '../data/dashboardTypes'
import { users } from '../data/mockAdminData'
import { ADMIN_FULL_PERMISSION } from '../config/permissions'
import { isSettingsPath, SETTINGS_ENTRY_PATH } from '../lib/settingsNavigation'
import { AuthContext, type AuthContextValue } from './AuthContextCore'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [lastSettingsPath, setLastSettingsPath] = useState(SETTINGS_ENTRY_PATH)
  const [hasOpenedSettingsFromSidebar, setHasOpenedSettingsFromSidebar] = useState(false)

  /** Toda sessão nova começa em Preferências, sem herdar a aba da anterior. */
  const resetSettingsMemory = useCallback(() => {
    setLastSettingsPath(SETTINGS_ENTRY_PATH)
    setHasOpenedSettingsFromSidebar(false)
  }, [])

  const login = useCallback(
    (email: string) => {
      const normalized = email.trim().toLowerCase()
      const match = users.find((candidate) => candidate.email.toLowerCase() === normalized) ?? null
      setUser(match)

      // Um login inválido não mexe na memória das Configurações.
      if (match) resetSettingsMemory()

      return match !== null
    },
    [resetSettingsMemory],
  )

  const logout = useCallback(() => {
    setUser(null)
    resetSettingsMemory()
  }, [resetSettingsMemory])

  const rememberSettingsPath = useCallback((path: string) => {
    if (!isSettingsPath(path)) return
    setLastSettingsPath(path)
  }, [])

  const markSettingsOpenedFromSidebar = useCallback(() => {
    setHasOpenedSettingsFromSidebar(true)
  }, [])

  const hasPermission = useCallback(
    (permissionKey: string) => {
      if (!user) return false
      if (user.permissionKeys.includes(ADMIN_FULL_PERMISSION)) return true
      return user.permissionKeys.includes(permissionKey)
    },
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      logout,
      hasPermission,
      lastSettingsPath,
      hasOpenedSettingsFromSidebar,
      rememberSettingsPath,
      markSettingsOpenedFromSidebar,
    }),
    [
      user,
      login,
      logout,
      hasPermission,
      lastSettingsPath,
      hasOpenedSettingsFromSidebar,
      rememberSettingsPath,
      markSettingsOpenedFromSidebar,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
