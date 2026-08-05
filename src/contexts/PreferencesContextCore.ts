import { createContext } from 'react'

/** Tema visual do portal. 'light' é o padrão quando não há preferência salva. */
export type Theme = 'light' | 'dark'

export type PreferencesContextValue = {
  /** Preferência de sidebar aberta (true) ou recolhida (false), persistida no navegador. */
  sidebarOpen: boolean
  /** Define explicitamente a preferência da sidebar e persiste a escolha. */
  setSidebarOpen: (value: boolean) => void
  /** Inverte a preferência atual da sidebar e persiste o novo valor. */
  toggleSidebar: () => void
  /** Tema visual atual ('light' ou 'dark'), persistido no navegador. */
  theme: Theme
  /** Define explicitamente o tema e persiste a escolha. */
  setTheme: (value: Theme) => void
  /** Alterna entre os temas claro e escuro e persiste o novo valor. */
  toggleTheme: () => void
  /**
   * Departamento inicial escolhido por um usuário, ou null quando ele ainda não
   * escolheu nenhum.
   *
   * Indexado pelo `user.id` porque a escolha é do usuário, e não do navegador:
   * duas pessoas que usem o mesmo navegador mantêm escolhas independentes.
   *
   * Devolve exatamente o que está gravado, sem conferir catálogo nem acesso: a
   * validação contra os departamentos permitidos é de `lib/homeNavigation`, para
   * a preferência nunca virar concessão.
   */
  homeDepartmentIdFor: (userId: string) => string | null
  /** Registra o departamento inicial de um usuário e persiste a escolha. */
  setHomeDepartmentId: (userId: string, departmentId: string) => void
  /**
   * Apaga a escolha de um usuário, do estado e da persistência, preservando as
   * dos demais.
   *
   * Existe para o descarte definitivo de uma escolha que deixou de ser
   * permitida: sem ele, a preferência continuaria gravada e voltaria a valer
   * sozinha caso o departamento fosse concedido de novo. Não faz nada quando não
   * há escolha gravada para aquele usuário.
   */
  clearHomeDepartmentId: (userId: string) => void
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
