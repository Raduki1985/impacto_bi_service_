import { useCallback, useMemo, useState, type ReactNode } from 'react'

import type { User } from '../data/dashboardTypes'
import { findUserByEmail } from '../services/users/userRepository'
import {
  resolveAccessProfileAssignment,
  storedAccessProfileId,
} from '../services/accessProfiles/accessProfileAssignment'
import { ADMIN_FULL_PERMISSION } from '../config/permissions'
import { AuthContext, type AuthContextValue, type LoginResult } from './AuthContextCore'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)

  /**
   * Entrada mockada em duas conferências, nesta ordem.
   *
   * A primeira é o cadastro: quem não existe ou está inativo não entra, como
   * antes.
   *
   * A segunda é o Perfil de Acesso, e é a que passou a existir. Ela não olha o
   * campo gravado isoladamente: o vínculo é confrontado com a coleção real de
   * Perfis de Acesso, e só autoriza quando o perfil existe, está ativo e serve ao
   * Perfil do Sistema do usuário. Com isso, propriedade ausente, `null`, id
   * inválido, perfil desativado, destino incompatível e Administrador fora do
   * `Acesso do Sistema` recusam a entrada pelo mesmo caminho, sem nenhum deles
   * precisar de uma verificação própria.
   *
   * Nenhuma senha é verificada: o portal continua mockado, e este bloco não
   * implementa autenticação real.
   */
  const login = useCallback((email: string): LoginResult => {
    const match = findUserByEmail(email)

    // Inexistente ou inativo não entra.
    if (!match || match.status !== 'Ativo') {
      setUser(null)
      return { ok: false, reason: 'invalid-credentials' }
    }

    const assignment = resolveAccessProfileAssignment(storedAccessProfileId(match), match.profile)

    if (!assignment.ok) {
      setUser(null)

      return {
        ok: false,
        reason:
          assignment.reason === 'access-profile-unavailable'
            ? 'access-profile-unavailable'
            : 'access-profile-required',
      }
    }

    setUser(match)

    return { ok: true }
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
