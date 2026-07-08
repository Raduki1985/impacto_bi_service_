import { createContext } from 'react'

import type { DashboardFilters, buildFilterOptions } from '../data/dashboardFilters'
import type { DashboardData, ServiceOrder } from '../data/dashboardTypes'

export type DashboardDataContextValue = {
  data: DashboardData
  filters: DashboardFilters
  options: ReturnType<typeof buildFilterOptions>
  rows: ServiceOrder[]
  filteredRows: ServiceOrder[]
  loading: boolean
  setFilter: <Key extends keyof DashboardFilters>(key: Key, value: DashboardFilters[Key]) => void
  resetFilters: () => void
}

export const DashboardDataContext = createContext<DashboardDataContextValue | null>(null)
