import { createContext } from 'react'

import type { User } from '../data/dashboardTypes'

/**
 * Por que a entrada foi recusada.
 *
 * Os quatro motivos são coisas diferentes e precisam continuar diferentes até a
 * tela: credencial errada é a pessoa conferir o que digitou, conta inativa e
 * falta de Perfil de Acesso são problemas que só um Administrador resolve, e o
 * serviço indisponível não é problema de ninguém, é a hora errada. Um texto só
 * para os quatro mandaria a pessoa procurar a causa errada.
 *
 * Os motivos são os do serviço, traduzidos em `services/auth/authSession`: o
 * portal não confere mais nada sozinho.
 */
export type LoginFailureReason =
  | 'invalid-credentials'
  | 'inactive-account'
  | 'access-profile-required'
  | 'service-unavailable'

export type LoginResult = { ok: true } | { ok: false; reason: LoginFailureReason }

export type AuthContextValue = {
  /**
   * Usuário autenticado no serviço, ou null quando deslogado.
   *
   * Enquanto a sessão gravada está sendo revalidada no serviço, o provedor não
   * renderiza as rotas: quando elas perguntam quem está autenticado, a resposta
   * já existe, e o F5 permanece na URL atual.
   */
  user: User | null
  /**
   * Entra no serviço com e-mail e senha.
   *
   * A senha vai ao serviço e não é guardada em lugar nenhum. O token devolvido
   * fica no `sessionStorage`, então fechar a aba ou o navegador pede login de
   * novo.
   */
  login: (email: string, password: string) => Promise<LoginResult>
  /** Encerra a sessão no serviço e limpa o usuário e o token da aba. */
  logout: () => void
  /** Verifica uma permissão. admin.full vale como acesso global. */
  hasPermission: (permissionKey: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
