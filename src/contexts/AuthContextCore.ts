import { createContext } from 'react'

import type { User } from '../data/dashboardTypes'

/**
 * Por que a entrada foi recusada.
 *
 * Os três motivos são coisas diferentes e precisam continuar diferentes até a
 * tela: quem não existe ou está inativo tem um problema de cadastro, quem está
 * sem Perfil de Acesso válido tem um problema de permissão que só um
 * Administrador resolve, e uma coleção de perfis ilegível não é problema de
 * ninguém, é o navegador. Um texto só para os três mandaria a pessoa procurar a
 * causa errada.
 *
 * `access-profile-required` cobre todas as formas de vínculo que não autorizam a
 * entrada: propriedade ausente, `null`, id inexistente, perfil desativado,
 * destino incompatível com o Perfil do Sistema e Administrador que não está no
 * `Acesso do Sistema`.
 */
export type LoginFailureReason =
  | 'invalid-credentials'
  | 'access-profile-required'
  | 'access-profile-unavailable'

export type LoginResult = { ok: true } | { ok: false; reason: LoginFailureReason }

export type AuthContextValue = {
  /** Usuário autenticado da sessão mockada, ou null quando deslogado. */
  user: User | null
  /** Resolve o usuário pelo e-mail no mock e confere o Perfil de Acesso dele. */
  login: (email: string) => LoginResult
  /** Limpa a sessão do usuário autenticado. */
  logout: () => void
  /** Verifica uma permissão. admin.full vale como acesso global. */
  hasPermission: (permissionKey: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
