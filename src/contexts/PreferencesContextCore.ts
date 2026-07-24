import { createContext } from 'react'

export type PreferencesContextValue = {
  /** Preferência de sidebar aberta (true) ou recolhida (false), persistida no navegador. */
  sidebarOpen: boolean
  /** Define explicitamente a preferência da sidebar e persiste a escolha. */
  setSidebarOpen: (value: boolean) => void
  /** Inverte a preferência atual da sidebar e persiste o novo valor. */
  toggleSidebar: () => void
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
