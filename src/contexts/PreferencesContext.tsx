import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { PreferencesContext, type PreferencesContextValue } from './PreferencesContextCore'

const SIDEBAR_OPEN_STORAGE_KEY = 'impacto-bi.sidebar-open'

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

  const value = useMemo<PreferencesContextValue>(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
    }),
    [sidebarOpen, setSidebarOpen, toggleSidebar],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
