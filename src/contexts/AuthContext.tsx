import { useCallback, useMemo, useState, type ReactNode } from 'react'

import type { User } from '../data/dashboardTypes'
import { users } from '../data/mockAdminData'
import { AuthContext, type AuthContextValue } from './AuthContextCore'

type AuthProviderProps = {
  children: ReactNode
}

const ADMIN_FULL = 'admin.full'

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)

  const login = useCallback((email: string) => {
    const normalized = email.trim().toLowerCase()
    const match = users.find((candidate) => candidate.email.toLowerCase() === normalized) ?? null
    setUser(match)
    return match !== null
  }, [])

  const logout = useCallback(() => setUser(null), [])

  const hasPermission = useCallback(
    (permissionKey: string) => {
      if (!user) return false
      if (user.permissionKeys.includes(ADMIN_FULL)) return true
      return user.permissionKeys.includes(permissionKey)
    },
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, logout, hasPermission }),
    [user, login, logout, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
