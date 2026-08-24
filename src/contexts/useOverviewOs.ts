import { useContext } from 'react'

import { OverviewOsContext } from './OverviewOsContextCore'

export function useOverviewOs() {
  const context = useContext(OverviewOsContext)

  if (!context) {
    throw new Error('useOverviewOs must be used inside OverviewOsProvider')
  }

  return context
}
