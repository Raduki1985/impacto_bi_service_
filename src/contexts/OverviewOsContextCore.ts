import { createContext } from 'react'

import type { OverviewOsTechnician } from '../data/api/osOverviewSource'
import type { OverviewOsData } from '../data/overviewOsAggregates'
import type { OverviewOsRecord } from '../data/overviewOsData'
import type {
  OverviewOsCoverage,
  OverviewOsFilterOptions,
  OverviewOsFilters,
} from '../data/overviewOsFilters'

/**
 * Contrato do provedor da Visão Geral de OS.
 *
 * Separado do componente pelo mesmo motivo dos outros `*ContextCore`: um
 * arquivo que exporta componente e valor juntos quebra o fast refresh.
 */

/** De onde os registros da página vieram. Aparece no rodapé da fonte. */
export type OverviewOsOrigin = 'local' | 'api'

export type OverviewOsStatus = 'loading' | 'ready' | 'error'

export type OverviewOsContextValue = {
  /** Filtros aplicados, sempre já saneados pela cadeia de dependência. */
  filters: OverviewOsFilters
  /** Opções realmente disponíveis para cada seletor, no contexto atual. */
  options: OverviewOsFilterOptions
  /**
   * Técnicos com nome, para o seletor traduzir o identificador do filtro.
   * Vazio com a base local e enquanto o serviço não mandar o catálogo, e é
   * isso que deixa o seletor desabilitado.
   */
  technicians: readonly OverviewOsTechnician[]
  /**
   * Base inteira da fonte em uso, sem filtro. A página precisa dela para a
   * janela anterior das taxas sobre OS de cliente, que `data` não calcula.
   */
  records: readonly OverviewOsRecord[]
  /** Registros do recorte com TODOS os filtros aplicados. */
  filteredRecords: OverviewOsRecord[]
  /** Agregados prontos da página: indicadores, minigráficos e gráficos. */
  data: OverviewOsData
  /** Cobertura da fonte em uso, que limita os calendários do painel. */
  coverage: OverviewOsCoverage
  origin: OverviewOsOrigin
  status: OverviewOsStatus
  /** Motivo da falha, em português, quando `status` é `error`. */
  errorMessage: string | null
  /**
   * Data da última alteração no banco (ISO `aaaa-mm-dd`), quando a fonte é a
   * API e o serviço a informa; nula na base local. É o que o selo do
   * cabeçalho exibe no lugar da data padrão da área.
   */
  updatedAt: string | null
  setFilter: (key: keyof OverviewOsFilters, value: string) => void
  resetFilters: () => void
}

export const OverviewOsContext = createContext<OverviewOsContextValue | null>(null)
