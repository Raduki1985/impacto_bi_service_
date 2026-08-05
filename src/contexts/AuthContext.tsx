import { useCallback, useMemo, useState, type ReactNode } from 'react'

import type { User } from '../data/dashboardTypes'
import { findUserByEmail } from '../services/users/userRepository'
import { ADMIN_FULL_PERMISSION } from '../config/permissions'
import { AuthContext, type AuthContextValue } from './AuthContextCore'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)

  const login = useCallback((email: string) => {
    const match = findUserByEmail(email)

    // Inexistente ou inativo não entra.
    if (!match || match.status !== 'Ativo') {
      setUser(null)
      return false
    }

    setUser(match)

    return true
  }, [])

  const logout = useCallback(() => {
    setUser(null)
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
    }),
    [user, login, logout, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
