import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { User } from '../data/dashboardTypes'
import {
  authenticate,
  endSession,
  hasStoredSession,
  restoreSession,
} from '../services/auth/authSession'
import { ADMIN_FULL_PERMISSION, isAdministrativePermission } from '../config/permissions'
import { AuthContext, type AuthContextValue, type LoginResult } from './AuthContextCore'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)

  /**
   * Revalidação da sessão gravada, decidida JÁ NA PRIMEIRA RENDERIZAÇÃO.
   *
   * Com um token na aba, o serviço precisa dizer quem é a pessoa, e isso é uma
   * chamada de rede: não dá para responder no construtor do estado, como a
   * sessão mockada fazia. Enquanto a resposta não chega, o provedor NÃO renderiza
   * as rotas. É o que faz o F5 permanecer na URL atual: a proteção de rota nunca
   * vê um quadro sem usuário, então não existe redirecionamento para o login a
   * desfazer depois.
   *
   * Sem token não há nada a revalidar, e as rotas aparecem de imediato.
   */
  const [restoring, setRestoring] = useState<boolean>(() => hasStoredSession())

  useEffect(() => {
    if (!restoring) return

    // O StrictMode monta o efeito duas vezes em desenvolvimento; a primeira
    // resposta é descartada para a segunda montagem não receber um estado que
    // não é dela.
    let cancelled = false

    void restoreSession().then((restored) => {
      if (cancelled) return

      setUser(restored)
      setRestoring(false)
    })

    return () => {
      cancelled = true
    }
    // Roda uma vez, na montagem: `restoring` só muda de true para false.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Entrada real: e-mail e senha vão ao serviço, e é ele quem decide.
   *
   * As conferências (senha, situação da conta, Perfil de Acesso) acontecem no
   * serviço, e a restauração pergunta ao mesmo serviço: quem não pode entrar
   * agora também não pode voltar depois de um F5.
   *
   * Uma recusa não deixa usuário nem token para trás: uma tentativa mal
   * sucedida depois de um logout não pode ressuscitar a sessão anterior.
   */
  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const authorization = await authenticate(email, password)

    if (!authorization.ok) {
      setUser(null)

      return { ok: false, reason: authorization.reason }
    }

    setUser(authorization.user)

    return { ok: true }
  }, [])

  const logout = useCallback(() => {
    endSession()
    setUser(null)
  }, [])

  /**
   * `admin.full` cobre as permissões ADMINISTRATIVAS em bloco, e só elas.
   *
   * As permissões de departamento (`bi.*`) são sempre conferidas na lista do
   * próprio usuário, mesmo para o Administrador: elas vêm do Perfil de Acesso
   * cadastrado no serviço, e é ele que decide o que a barra lateral mostra. Ver
   * `isAdministrativePermission`.
   */
  const hasPermission = useCallback(
    (permissionKey: string) => {
      if (!user) return false

      if (
        isAdministrativePermission(permissionKey) &&
        user.permissionKeys.includes(ADMIN_FULL_PERMISSION)
      ) {
        return true
      }

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

  // Nada é desenhado enquanto o serviço não responde quem é a pessoa: ver o
  // comentário de `restoring`.
  if (restoring) return null

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
