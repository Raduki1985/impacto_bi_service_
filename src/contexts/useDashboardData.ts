import { useContext } from 'react'

import { DashboardDataContext } from './DashboardDataContextCore'

export function useDashboardContext() {
  const context = useContext(DashboardDataContext)

  if (!context) {
    throw new Error('useDashboardContext must be used inside DashboardDataProvider')
  }

  return context
}

export function useDashboardData() {
  return useDashboardContext().data
}
