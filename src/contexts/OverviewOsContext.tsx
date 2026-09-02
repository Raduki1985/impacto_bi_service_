import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { isBiApiConfigured } from '../data/api/biApiClient'
import { fetchOverviewOsSource, type OverviewOsTechnician } from '../data/api/osOverviewSource'
import { buildOverviewOsData } from '../data/overviewOsAggregates'
import { OVERVIEW_OS_DATE_RANGE, OVERVIEW_OS_RECORDS } from '../data/overviewOsData'
import {
  applyOverviewOsFilters,
  defaultOverviewOsFilters,
  defaultOverviewOsFiltersFor,
  resolveOverviewOsFilters,
  updateOverviewOsFilter,
  type OverviewOsCoverage,
  type OverviewOsFilters,
} from '../data/overviewOsFilters'
import {
  OverviewOsContext,
  type OverviewOsContextValue,
  type OverviewOsOrigin,
  type OverviewOsStatus,
} from './OverviewOsContextCore'
import type { OverviewOsRecord } from '../data/overviewOsData'

type OverviewOsProviderProps = {
  children: ReactNode
}

type OverviewOsSourceState = {
  readonly records: readonly OverviewOsRecord[]
  readonly coverage: OverviewOsCoverage
  readonly origin: OverviewOsOrigin
  readonly status: OverviewOsStatus
  readonly errorMessage: string | null
  readonly technicians: readonly OverviewOsTechnician[]
}

/**
 * Estado inicial da fonte.
 *
 * Sem `VITE_BI_API_URL`, a página abre pronta na base local, sem nenhum
 * intervalo de carregamento: é o mesmo comportamento que ela sempre teve.
 * Com a variável configurada, abre carregando e espera a API.
 */
const localSource: OverviewOsSourceState = {
  records: OVERVIEW_OS_RECORDS,
  coverage: OVERVIEW_OS_DATE_RANGE,
  origin: 'local',
  status: 'ready',
  errorMessage: null,
  // A base local não tem nome de técnico, por sanitização: sem catálogo, o
  // seletor de técnico nasce desabilitado.
  technicians: [],
}

const loadingSource: OverviewOsSourceState = {
  ...localSource,
  origin: 'api',
  status: 'loading',
}

/**
 * Provedor de dados e filtros EXCLUSIVO da Visão Geral de OS.
 *
 * Vive dentro da própria página, e não no fluxo compartilhado do dashboard:
 * é isso que garante que os sete filtros e a fonte real sanitizada não
 * alcançam nenhuma outra página. As demais páginas de OS continuam no
 * `DashboardDataProvider`, com a simulação de `mockOsData.ts` intacta.
 *
 * A origem dos registros é decidida uma única vez, aqui: a API quando o
 * ambiente tem endereço configurado, o arquivo local caso contrário. Nada
 * abaixo deste ponto sabe de onde a linha veio, e por isso os filtros
 * dependentes, o período anterior e os seis gráficos seguem sendo o mesmo
 * código já testado.
 *
 * Falha de API NÃO cai calada na base local. Em um portal de BI, mostrar o
 * número do arquivo de estudo com cara de número do banco é pior do que
 * mostrar o erro: a página avisa e não desenha indicador nenhum.
 *
 * Toda mudança de filtro passa por `resolveOverviewOsFilters` ANTES de virar
 * estado: uma seleção que ficou sem dados no novo contexto volta para o valor
 * neutro na mesma atualização, então nunca existe filtro escondido afetando o
 * resultado.
 */
export function OverviewOsProvider({ children }: OverviewOsProviderProps) {
  const [source, setSource] = useState<OverviewOsSourceState>(
    isBiApiConfigured ? loadingSource : localSource,
  )
  const [filters, setFilters] = useState<OverviewOsFilters>(defaultOverviewOsFilters)

  // A busca acontece uma vez por montagem da página. O `setState` mora no
  // retorno da promessa, e não no corpo do efeito, então a regra
  // `set-state-in-effect` do lint continua respeitada.
  useEffect(() => {
    if (!isBiApiConfigured) return

    let active = true
    void fetchOverviewOsSource()
      .then((loaded) => {
        if (!active) return
        setSource({
          records: loaded.records,
          coverage: loaded.coverage,
          origin: 'api',
          status: 'ready',
          errorMessage: null,
          technicians: loaded.technicians,
        })
        // A cobertura do banco não é a do arquivo local, então o período
        // padrão precisa ser recalculado sobre ela. Sem isso a página abriria
        // num mês que a base pode nem cobrir.
        setFilters(defaultOverviewOsFiltersFor(loaded.coverage))
      })
      .catch((cause: unknown) => {
        if (!active) return
        setSource({
          records: [],
          coverage: OVERVIEW_OS_DATE_RANGE,
          origin: 'api',
          status: 'error',
          errorMessage:
            cause instanceof Error
              ? cause.message
              : 'Não foi possível carregar as ordens de serviço.',
          technicians: [],
        })
      })

    return () => {
      active = false
    }
  }, [])

  const { records, coverage } = source

  const setFilter = useCallback(
    (key: keyof OverviewOsFilters, value: string) => {
      setFilters(
        (current) =>
          resolveOverviewOsFilters(
            records,
            updateOverviewOsFilter(current, key, value, coverage),
          ).filters,
      )
    },
    [coverage, records],
  )

  const resetFilters = useCallback(
    () => setFilters(defaultOverviewOsFiltersFor(coverage)),
    [coverage],
  )

  // O estado já entra saneado, então aqui o resolve só recalcula as opções
  // dependentes do contexto atual.
  const { options } = useMemo(
    () => resolveOverviewOsFilters(records, filters),
    [filters, records],
  )
  const filteredRecords = useMemo(
    () => applyOverviewOsFilters(records, filters),
    [filters, records],
  )
  const data = useMemo(
    () => buildOverviewOsData(records, filters, coverage),
    [coverage, filters, records],
  )

  const value = useMemo<OverviewOsContextValue>(
    () => ({
      filters,
      options,
      filteredRecords,
      data,
      coverage,
      technicians: source.technicians,
      origin: source.origin,
      status: source.status,
      errorMessage: source.errorMessage,
      setFilter,
      resetFilters,
    }),
    [
      coverage,
      data,
      filteredRecords,
      filters,
      options,
      resetFilters,
      setFilter,
      source.errorMessage,
      source.origin,
      source.technicians,
      source.status,
    ],
  )

  return <OverviewOsContext.Provider value={value}>{children}</OverviewOsContext.Provider>
}
