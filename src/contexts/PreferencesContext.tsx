import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'

import {
  readStoredHomeDepartments,
  withoutHomeDepartment,
  writeStoredHomeDepartments,
  type HomeDepartmentPreferences,
} from '../services/preferences/homeDepartmentStorage'
import {
  PreferencesContext,
  type PreferencesContextValue,
  type Theme,
} from './PreferencesContextCore'

const SIDEBAR_OPEN_STORAGE_KEY = 'impacto-bi.sidebar-open'
const THEME_STORAGE_KEY = 'impacto-bi.theme'

/** Lê o tema salvo; valores ausentes ou inválidos retornam 'light'. */
function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'

  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function persistTheme(value: Theme) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value)
  } catch {
    // A preferência continua válida durante a sessão mesmo sem persistência.
  }
}

type PreferencesProviderProps = {
  children: ReactNode
}

export function PreferencesProvider({ children }: PreferencesProviderProps) {
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true

    try {
      const storedValue = window.localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY)

      if (storedValue === 'false') return false
      if (storedValue === 'true') return true

      return true
    } catch {
      return true
    }
  })

  const setSidebarOpen = useCallback((value: boolean) => {
    setSidebarOpenState(value)

    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(value))
    } catch {
      // A preferência continua válida durante a sessão mesmo sem persistência.
    }
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpenState((currentValue) => {
      const nextValue = !currentValue

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(nextValue))
        } catch {
          // A preferência continua válida durante a sessão.
        }
      }

      return nextValue
    })
  }, [])

  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  // Aplica o tema no elemento raiz antes da pintura, evitando piscada entre temas.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return

    document.documentElement.dataset.theme = theme
  }, [theme])

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value)
    persistTheme(value)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((currentValue) => {
      const nextValue: Theme = currentValue === 'dark' ? 'light' : 'dark'

      persistTheme(nextValue)

      return nextValue
    })
  }, [])

  /**
   * Escolhas de departamento inicial de todos os usuários deste navegador, lidas
   * uma única vez na montagem. O estado é a fonte durante a sessão, e o
   * armazenamento acompanha: se a gravação falhar, a escolha continua valendo
   * até o fim da sessão, como já acontece com o tema e com a sidebar.
   */
  const [homeDepartments, setHomeDepartments] =
    useState<HomeDepartmentPreferences>(readStoredHomeDepartments)

  const homeDepartmentIdFor = useCallback(
    (userId: string) => homeDepartments[userId] ?? null,
    [homeDepartments],
  )

  const setHomeDepartmentId = useCallback(
    (userId: string, departmentId: string) => {
      const next = { ...homeDepartments, [userId]: departmentId }

      setHomeDepartments(next)
      // A gravação fica fora da atualização de estado de propósito: um efeito
      // colateral dentro do atualizador seria executado duas vezes no modo
      // estrito do React. Falha de gravação não interrompe nada.
      writeStoredHomeDepartments(next)
    },
    [homeDepartments],
  )

  const clearHomeDepartmentId = useCallback(
    (userId: string) => {
      const next = withoutHomeDepartment(homeDepartments, userId)

      // Mesma referência significa que não havia escolha gravada para este
      // usuário: nada a atualizar e nada a gravar. É o que garante que uma
      // remoção disparada por efeito não vire ciclo de renderização.
      if (next === homeDepartments) return

      setHomeDepartments(next)
      // O estado é a fonte durante a sessão: a remoção continua valendo mesmo se
      // a gravação falhar, como no restante das preferências do portal.
      writeStoredHomeDepartments(next)
    },
    [homeDepartments],
  )

  const value = useMemo<PreferencesContextValue>(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      theme,
      setTheme,
      toggleTheme,
      homeDepartmentIdFor,
      setHomeDepartmentId,
      clearHomeDepartmentId,
    }),
    [
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      theme,
      setTheme,
      toggleTheme,
      homeDepartmentIdFor,
      setHomeDepartmentId,
      clearHomeDepartmentId,
    ],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
