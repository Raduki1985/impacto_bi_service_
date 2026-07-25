import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'

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

  const value = useMemo<PreferencesContextValue>(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      theme,
      setTheme,
      toggleTheme,
    }),
    [sidebarOpen, setSidebarOpen, toggleSidebar, theme, setTheme, toggleTheme],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
