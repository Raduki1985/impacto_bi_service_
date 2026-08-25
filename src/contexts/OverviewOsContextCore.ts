import { createContext } from 'react'

import type { OverviewOsData } from '../data/overviewOsAggregates'
import type { OverviewOsRecord } from '../data/overviewOsData'
import type { OverviewOsFilterOptions, OverviewOsFilters } from '../data/overviewOsFilters'

/**
 * Contrato do provedor da Visão Geral de OS.
 *
 * Separado do componente pelo mesmo motivo dos outros `*ContextCore`: um
 * arquivo que exporta componente e valor juntos quebra o fast refresh.
 */
export type OverviewOsContextValue = {
  /** Filtros aplicados, sempre já saneados pela cadeia de dependência. */
  filters: OverviewOsFilters
  /** Opções realmente disponíveis para cada seletor, no contexto atual. */
  options: OverviewOsFilterOptions
  /** Registros do recorte com TODOS os filtros aplicados. */
  filteredRecords: OverviewOsRecord[]
  /** Agregados prontos da página: indicadores, minigráficos e gráficos. */
  data: OverviewOsData
  setFilter: (key: keyof OverviewOsFilters, value: string) => void
  resetFilters: () => void
}

export const OverviewOsContext = createContext<OverviewOsContextValue | null>(null)
