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
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
