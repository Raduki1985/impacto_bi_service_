import { createContext } from 'react'

import type { OverviewOsTechnician } from '../data/api/osOverviewSource'
import type { OverviewOsRecord } from '../data/overviewOsData'
import type {
  OverviewOsCoverage,
  OverviewOsFilterOptions,
  OverviewOsFilters,
  OverviewOsSelectionField,
  PeriodRange,
} from '../data/overviewOsFilters'
import type { OverviewOsPeriodFacts } from '../Pages/Overview/overviewModel'

/**
 * Contrato do provedor da Visão Geral de OS.
 *
 * Separado do componente pelo mesmo motivo dos outros `*ContextCore`: um
 * arquivo que exporta componente e valor juntos quebra o fast refresh.
 */

/** De onde os registros da página vieram. Aparece no rodapé da fonte. */
export type OverviewOsOrigin = 'local' | 'api'

/**
 * `unavailable`: a página só funciona ligada ao serviço de BI e o ambiente
 * não tem o endereço dele (a Visão Geral de OS, desde 01/10/2026).
 */
export type OverviewOsStatus = 'loading' | 'ready' | 'error' | 'unavailable'

/**
 * O que a página recebe do provedor (01/10/2026):
 *
 * - `summary`: só os números do período, prontos no serviço, sem nenhuma OS.
 *   É a Visão Geral de OS, que precisa do serviço;
 * - `records`: as OS do período e da janela de comparação, para a página
 *   fazer contas próprias. É a Gestão de Técnicos, que também roda na base
 *   local de estudo.
 */
export type OverviewOsLoad = 'summary' | 'records'

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
   * Registros da fonte em uso, sem filtro, só no modo `records`: com a base
   * local é a base inteira; com o serviço, a janela do período escolhido mais
   * a de comparação dele. Vazio no modo `summary`.
   */
  records: readonly OverviewOsRecord[]
  /** Registros do recorte com TODOS os filtros aplicados; vazio no modo `summary`. */
  filteredRecords: OverviewOsRecord[]
  /**
   * Os números do período, prontos no serviço, no modo `summary`; null no
   * modo `records` e enquanto o período carrega.
   */
  period: OverviewOsPeriodFacts | null
  /** Cobertura da fonte em uso, que limita os calendários do painel. */
  coverage: OverviewOsCoverage
  origin: OverviewOsOrigin
  status: OverviewOsStatus
  /**
   * O período ou um filtro mudou e os dados dele ainda estão chegando do
   * serviço. A faixa de filtros e a de hoje continuam na tela; o que depende
   * do recorte espera, em vez de mostrar número de outro recorte.
   */
  periodLoading: boolean
  /** Motivo da falha, em português, quando `status` é `error`. */
  errorMessage: string | null
  /**
   * Data da última alteração no banco (ISO `aaaa-mm-dd`), quando a fonte é a
   * API e o serviço a informa; nula na base local. É o que o selo do
   * cabeçalho exibe no lugar da data padrão da área.
   */
  updatedAt: string | null
  /**
   * Hora em que o serviço leu o banco para a carga da página (ISO com fuso),
   * nula na base local. A página carrega uma vez: é esta a hora dos números
   * na tela, e é ela que a planilha de OS escreve em "Dados lidos em"
   * (24/09/2026), porque o arquivo circula sem a tela.
   */
  generatedAt: string | null
  /** Início ou Fim. */
  setFilter: (key: 'dateFrom' | 'dateTo', value: string) => void
  /** Opções marcadas de um campo de escolha; lista vazia volta a "Todos". */
  setSelection: (field: OverviewOsSelectionField, values: readonly string[]) => void
  /**
   * Publica Início e Fim juntos, para os atalhos de período: uma data por vez
   * recusaria a janela sempre que a nova estivesse inteira antes ou depois
   * da atual.
   */
  setPeriod: (range: PeriodRange) => void
  resetFilters: () => void
}

export const OverviewOsContext = createContext<OverviewOsContextValue | null>(null)
