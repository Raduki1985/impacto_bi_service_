import { useCallback, useMemo, useState, type ReactNode } from 'react'

import type { User } from '../data/dashboardTypes'
import {
  authorizeUserByEmail,
  clearStoredAuthUserId,
  restoreAuthenticatedUser,
  writeStoredAuthUserId,
} from '../services/auth/authSession'
import { ADMIN_FULL_PERMISSION } from '../config/permissions'
import { AuthContext, type AuthContextValue, type LoginResult } from './AuthContextCore'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  /**
   * Sessão restaurada JÁ NA PRIMEIRA RENDERIZAÇÃO, e não em efeito.
   *
   * É o que faz o F5 permanecer na URL atual. O provedor renderiza antes das
   * rotas, então quando a proteção de rota pergunta quem está autenticado a
   * resposta já existe: não há um quadro inicial sem usuário, e por isso não há
   * redirecionamento para o login a desfazer depois nem necessidade de um estado
   * de hidratação para segurar a navegação.
   *
   * A restauração é a mesma pergunta da entrada, respondida pela mesma regra:
   * usuário consultado de novo, precisa existir, estar ativo e ter um Perfil de
   * Acesso válido e compatível. Uma sessão que não vale devolve null e é apagada
   * dos dois armazenamentos pelo próprio serviço, e a pessoa fica no login.
   */
  const [user, setUser] = useState<User | null>(() => restoreAuthenticatedUser())

  /**
   * Entrada mockada: o e-mail resolve a pessoa e a autorização decide.
   *
   * As duas conferências (cadastro e Perfil de Acesso) vivem em
   * `services/auth/authSession`, junto da restauração, porque são a mesma
   * pergunta: quem não pode entrar agora também não pode voltar depois de um F5.
   *
   * `remember` escolhe apenas ONDE o identificador é gravado. Nenhuma senha é
   * verificada e nenhuma senha é persistida: o portal continua mockado, e este
   * bloco não implementa autenticação real.
   */
  const login = useCallback((email: string, remember: boolean): LoginResult => {
    const authorization = authorizeUserByEmail(email)

    if (!authorization.ok) {
      // Recusa não deixa sessão gravada para trás: uma tentativa mal sucedida
      // depois de um logout não pode ressuscitar o usuário anterior no F5.
      clearStoredAuthUserId()
      setUser(null)

      return { ok: false, reason: authorization.reason }
    }

    // Somente o identificador. A gravação pode falhar (modo privado, quota) e o
    // retorno é ignorado de propósito: a sessão vale nesta aba de qualquer forma,
    // e avisar sobre persistência de conveniência seria ruído na entrada.
    writeStoredAuthUserId(authorization.user.id, remember)
    setUser(authorization.user)

    return { ok: true }
  }, [])

  const logout = useCallback(() => {
    clearStoredAuthUserId()
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
