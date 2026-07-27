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
  /** Última aba de Configurações fechada pela chavinha; vive só nesta sessão. */
  lastSettingsPath: string
  /** Marca se a sidebar já abriu as Configurações depois do login. */
  hasOpenedSettingsFromSidebar: boolean
  /** Guarda a aba atual. Ignora caminhos fora do contexto de Configurações. */
  rememberSettingsPath: (path: string) => void
  /** Registra que a primeira abertura pela sidebar já aconteceu. */
  markSettingsOpenedFromSidebar: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
