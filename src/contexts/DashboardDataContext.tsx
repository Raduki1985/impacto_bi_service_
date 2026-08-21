import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { buildDashboardData } from '../data/dashboardAggregates'
import {
  applyDashboardFilters,
  applyPreviousPeriodFilters,
  buildFilterOptions,
  defaultDashboardFilters,
  updateDashboardFilter,
  type DashboardFilters,
} from '../data/dashboardFilters'
import type { ServiceOrder } from '../data/dashboardTypes'
import { orders as fallbackOrders } from '../data/mockOsData'
import { getOrders } from '../data/orderRepository'
import { DashboardDataContext, type DashboardDataContextValue } from './DashboardDataContextCore'

type DashboardDataProviderProps = {
  children: ReactNode
}

export function DashboardDataProvider({ children }: DashboardDataProviderProps) {
  const [rows, setRows] = useState<ServiceOrder[]>(fallbackOrders)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<DashboardFilters>(defaultDashboardFilters)

  useEffect(() => {
    let active = true

    getOrders()
      .then((loadedRows) => {
        if (active) setRows(loadedRows)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // As opções vêm dos catálogos normalizados, não dos dados carregados.
  const options = useMemo(() => buildFilterOptions(), [])
  const filteredRows = useMemo(() => applyDashboardFilters(rows, filters), [filters, rows])
  const previousRows = useMemo(() => applyPreviousPeriodFilters(rows, filters), [filters, rows])
  const data = useMemo(
    () => buildDashboardData(filteredRows, { previousRows }),
    [filteredRows, previousRows],
  )

  const value = useMemo<DashboardDataContextValue>(
    () => ({
      data,
      filters,
      options,
      rows,
      filteredRows,
      loading,
      setFilter: (key, value) =>
        setFilters((current) => updateDashboardFilter(current, key, value)),
      resetFilters: () => setFilters(defaultDashboardFilters),
    }),
    [data, filteredRows, filters, loading, options, rows],
  )

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}
