import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { buildOverviewOsData } from '../data/overviewOsAggregates'
import { OVERVIEW_OS_RECORDS } from '../data/overviewOsData'
import {
  applyOverviewOsFilters,
  defaultOverviewOsFilters,
  resolveOverviewOsFilters,
  updateOverviewOsFilter,
  type OverviewOsFilters,
} from '../data/overviewOsFilters'
import { OverviewOsContext, type OverviewOsContextValue } from './OverviewOsContextCore'

type OverviewOsProviderProps = {
  children: ReactNode
}

/**
 * Provedor de dados e filtros EXCLUSIVO da Visão Geral de OS.
 *
 * Vive dentro da própria página, e não no fluxo compartilhado do dashboard:
 * é isso que garante que os sete filtros e a fonte real sanitizada não
 * alcançam nenhuma outra página. As demais páginas de OS continuam no
 * `DashboardDataProvider`, com a simulação de `mockOsData.ts` intacta.
 *
 * Toda mudança de filtro passa por `resolveOverviewOsFilters` ANTES de virar
 * estado: uma seleção que ficou sem dados no novo contexto volta para o valor
 * neutro na mesma atualização, então nunca existe filtro escondido afetando o
 * resultado.
 */
export function OverviewOsProvider({ children }: OverviewOsProviderProps) {
  const [filters, setFilters] = useState<OverviewOsFilters>(defaultOverviewOsFilters)

  const setFilter = useCallback((key: keyof OverviewOsFilters, value: string) => {
    setFilters(
      (current) =>
        resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, updateOverviewOsFilter(current, key, value))
          .filters,
    )
  }, [])

  const resetFilters = useCallback(() => setFilters(defaultOverviewOsFilters), [])

  // O estado já entra saneado, então aqui o resolve só recalcula as opções
  // dependentes do contexto atual.
  const { options } = useMemo(() => resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, filters), [filters])
  const filteredRecords = useMemo(
    () => applyOverviewOsFilters(OVERVIEW_OS_RECORDS, filters),
    [filters],
  )
  const data = useMemo(() => buildOverviewOsData(OVERVIEW_OS_RECORDS, filters), [filters])

  const value = useMemo<OverviewOsContextValue>(
    () => ({ filters, options, filteredRecords, data, setFilter, resetFilters }),
    [data, filteredRecords, filters, options, resetFilters, setFilter],
  )

  return <OverviewOsContext.Provider value={value}>{children}</OverviewOsContext.Provider>
}
