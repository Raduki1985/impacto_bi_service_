import { createContext } from 'react'

import type { User } from '../data/dashboardTypes'

export type AuthContextValue = {
  /** Usuário autenticado da sessão mockada, ou null quando deslogado. */
  user: User | null
  /** Resolve o usuário pelo e-mail no mock. Retorna true quando autentica. */
  login: (email: string) => boolean
  /** Limpa a sessão do usuário autenticado. */
  logout: () => void
  /** Verifica uma permissão. admin.full vale como acesso global. */
  hasPermission: (permissionKey: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
