import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { isBiApiConfigured } from '../data/api/biApiClient'
import {
  fetchOverviewOsFilters,
  fetchOverviewOsPeriod,
  fetchOverviewOsWindow,
  type OverviewOsFiltersSource,
  type OverviewOsTechnician,
} from '../data/api/osOverviewSource'
import {
  OVERVIEW_OS_DATE_RANGE,
  OVERVIEW_OS_LOCAL_CATALOG_ORDER,
  OVERVIEW_OS_RECORDS,
  type OverviewOsCatalogOrder,
} from '../data/overviewOsData'
import {
  applyOverviewOsFilters,
  defaultOverviewOsFilters,
  defaultOverviewOsFiltersFor,
  previousOverviewOsPeriod,
  resolveOverviewOsFilters,
  updateOverviewOsFilter,
  updateOverviewOsPeriod,
  updateOverviewOsSelection,
  type OverviewOsCoverage,
  type OverviewOsFilterOptions,
  type OverviewOsFilters,
  type OverviewOsSelectionField,
  type PeriodRange,
} from '../data/overviewOsFilters'
import type { OverviewOsPeriodFacts } from '../Pages/Overview/overviewModel'
import {
  OverviewOsContext,
  type OverviewOsContextValue,
  type OverviewOsLoad,
  type OverviewOsStatus,
} from './OverviewOsContextCore'
import type { OverviewOsRecord } from '../data/overviewOsData'

type OverviewOsProviderProps = {
  children: ReactNode
  /** O que a página recebe: os números prontos (`summary`) ou as OS (`records`). */
  load: OverviewOsLoad
}

/** Janela de agendamento já carregada, limites inclusivos. */
type LoadedWindow = { readonly dateFrom: string; readonly dateTo: string }

/** OS carregadas no modo `records`, com a janela que elas cobrem. */
type RecordsState = {
  readonly records: readonly OverviewOsRecord[]
  /** Nula com a base local, que é a base inteira, e antes da primeira carga. */
  readonly window: LoadedWindow | null
  readonly generatedAt: string | null
}

/** Números do período no modo `summary`, com o recorte a que pertencem. */
type PeriodState = {
  readonly key: string
  readonly facts: OverviewOsPeriodFacts
  readonly generatedAt: string | null
}

/**
 * O que a faixa de filtros globais sabe sem baixar OS nenhuma: cobertura,
 * catálogo e as opções do recorte. Com o serviço vem da consulta de filtros;
 * com o arquivo local, é declarado pelo próprio módulo do arquivo.
 */
type OverviewOsMeta = {
  readonly coverage: OverviewOsCoverage
  /** Ordem de exibição de status e tipo. */
  readonly catalogOrder: OverviewOsCatalogOrder
  readonly technicians: readonly OverviewOsTechnician[]
  /** Data da última alteração no banco (ISO); nula na base local. */
  readonly updatedAt: string | null
  /** Opções do recorte, saneadas no serviço; nulas na base local, que as calcula aqui. */
  readonly options: OverviewOsFilterOptions | null
}

const localRecords: RecordsState = { records: OVERVIEW_OS_RECORDS, window: null, generatedAt: null }
const noRecords: RecordsState = { records: [], window: null, generatedAt: null }

const localMeta: OverviewOsMeta = {
  coverage: OVERVIEW_OS_DATE_RANGE,
  catalogOrder: OVERVIEW_OS_LOCAL_CATALOG_ORDER,
  // A base local não tem nome de técnico, por sanitização: sem catálogo, o
  // seletor de técnico nasce desabilitado.
  technicians: [],
  updatedAt: null,
  options: null,
}

/** Identidade de um recorte, para saber se o serviço já o saneou. */
function filtersKey(filters: OverviewOsFilters): string {
  return JSON.stringify(filters)
}

/**
 * Janela que a página precisa carregar para um recorte no modo `records`: o
 * período e a janela de comparação dele, que sempre vem antes.
 */
function requiredWindow(filters: OverviewOsFilters, coverage: OverviewOsCoverage): LoadedWindow {
  const previous = previousOverviewOsPeriod(filters, coverage)

  return {
    dateFrom: previous !== null && previous.range.dateFrom < filters.dateFrom ? previous.range.dateFrom : filters.dateFrom,
    dateTo: filters.dateTo,
  }
}

function covers(loaded: LoadedWindow | null, needed: LoadedWindow): boolean {
  return loaded !== null && loaded.dateFrom <= needed.dateFrom && loaded.dateTo >= needed.dateTo
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

function metaOf(loaded: OverviewOsFiltersSource): OverviewOsMeta {
  return {
    coverage: loaded.coverage,
    catalogOrder: loaded.catalogOrder,
    technicians: loaded.technicians,
    updatedAt: loaded.updatedAt,
    options: loaded.options,
  }
}

/**
 * Provedor de dados e filtros EXCLUSIVO da Visão Geral de OS e da Gestão de
 * Técnicos.
 *
 * Vive dentro da própria página, e não no fluxo compartilhado do dashboard:
 * é isso que garante que os filtros e a fonte real sanitizada não alcançam
 * nenhuma outra página. As demais páginas de OS continuam no
 * `DashboardDataProvider`, com a simulação de `mockOsData.ts` intacta.
 *
 * Desde 01/10/2026 (pedido do Mário para a página carregar menos, e decisão
 * dele de ter as regras num lugar só) são consultas separadas e pequenas:
 *
 * 1. FILTROS GLOBAIS, sem OS nenhuma: cobertura, catálogo e as opções de cada
 *    campo, saneadas no serviço pela cadeia dependente. A primeira, sem
 *    recorte, devolve o período com que a página abre; as seguintes saem a
 *    cada troca de filtro;
 * 2. no modo `summary` (Visão Geral), os NÚMEROS do período, prontos no
 *    serviço, pedidos depois que o recorte foi saneado. A Visão Geral não
 *    roda mais na base local: sem o serviço, ela avisa e não desenha nada;
 * 3. no modo `records` (Técnicos), as OS do período e da janela de
 *    comparação, pedidas só quando o período sai do que já está carregado.
 *    Sem o serviço, a base local de estudo, como sempre.
 *
 * Falha de API NÃO cai calada na base local. Em um portal de BI, mostrar o
 * número do arquivo de estudo com cara de número do banco é pior do que
 * mostrar o erro: a página avisa e não desenha indicador nenhum.
 *
 * Nenhum filtro fica escondido afetando o resultado: na base local toda
 * mudança passa por `resolveOverviewOsFilters` antes de virar estado; com o
 * serviço, a resposta dos filtros devolve o recorte saneado, ele substitui o
 * pedido quando difere, e só então os números do período são pedidos.
 */
export function OverviewOsProvider({ children, load }: OverviewOsProviderProps) {
  const api = isBiApiConfigured
  const summary = load === 'summary'
  const [meta, setMeta] = useState<OverviewOsMeta | null>(api || summary ? null : localMeta)
  const [recordsState, setRecordsState] = useState<RecordsState>(api || summary ? noRecords : localRecords)
  const [periodState, setPeriodState] = useState<PeriodState | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [filters, setFilters] = useState<OverviewOsFilters>(defaultOverviewOsFilters)
  // Último recorte que o serviço saneou: pedir de novo o mesmo seria repetir
  // a resposta que acabou de chegar, e os números do período só são pedidos
  // para um recorte saneado.
  const [resolvedKey, setResolvedKey] = useState<string | null>(null)

  const key = filtersKey(filters)
  const metaReady = meta !== null

  // Consulta 1: filtros globais. Toda mudança de estado acontece no retorno
  // da promessa, e não no corpo do efeito: a regra `set-state-in-effect` do
  // lint continua respeitada. O recorte entra pela `key`, que já o resume.
  useEffect(() => {
    if (!api) return
    if (metaReady && key === resolvedKey) return

    let active = true
    // A primeira consulta vai sem recorte: o período com que a página abre
    // depende da cobertura da base, que só esta resposta traz.
    void fetchOverviewOsFilters(metaReady ? filters : null)
      .then((loaded) => {
        if (!active) return
        const loadedKey = filtersKey(loaded.filters)
        setResolvedKey(loadedKey)
        setMeta(metaOf(loaded))
        setFilters((current) => (filtersKey(current) === loadedKey ? current : loaded.filters))
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (!metaReady) {
          setFatal(messageOf(cause, 'Não foi possível carregar os filtros da Visão Geral.'))
          return
        }
        // Com a página já de pé, a falha só deixa as opções da consulta
        // anterior no painel, e o recorte pedido segue sem números até a
        // próxima troca: melhor do que número de um recorte não saneado.
        console.warn('Visão Geral de OS: o serviço não devolveu as opções dos filtros.', cause)
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key, metaReady])

  // Consulta 2 (summary): os números do período, para o recorte já saneado.
  const saneKey = summary && api && resolvedKey === key ? key : null
  useEffect(() => {
    if (saneKey === null || periodState?.key === saneKey) return

    let active = true
    void fetchOverviewOsPeriod(filters)
      .then(({ facts, generatedAt }) => {
        if (active) setPeriodState({ key: saneKey, facts, generatedAt })
      })
      .catch((cause: unknown) => {
        if (active) setFatal(messageOf(cause, 'Não foi possível carregar o período da Visão Geral.'))
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saneKey])

  // Consulta 3 (records): OS do período e da janela de comparação, só quando
  // o período escolhido sai do que já está carregado.
  const needed = summary || meta === null ? null : requiredWindow(filters, meta.coverage)
  const neededFrom = needed?.dateFrom ?? null
  const neededTo = needed?.dateTo ?? null

  useEffect(() => {
    if (!api || neededFrom === null || neededTo === null) return
    if (covers(recordsState.window, { dateFrom: neededFrom, dateTo: neededTo })) return

    let active = true
    void fetchOverviewOsWindow(neededFrom, neededTo)
      .then((loaded) => {
        if (!active) return
        setRecordsState({
          records: loaded.records,
          window: { dateFrom: neededFrom, dateTo: neededTo },
          generatedAt: loaded.generatedAt,
        })
      })
      .catch((cause: unknown) => {
        if (active) setFatal(messageOf(cause, 'Não foi possível carregar as ordens de serviço.'))
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, neededFrom, neededTo])

  const { records } = recordsState
  const coverage = meta?.coverage ?? OVERVIEW_OS_DATE_RANGE
  const catalogOrder = meta?.catalogOrder ?? OVERVIEW_OS_LOCAL_CATALOG_ORDER
  // Com o serviço, o saneamento é dele (consulta 1); aqui o pedido só é
  // validado na forma, como sempre foi.
  const sanitize = useCallback(
    (next: OverviewOsFilters) =>
      api ? next : resolveOverviewOsFilters(records, next, catalogOrder).filters,
    [api, catalogOrder, records],
  )

  const setFilter = useCallback(
    (field: 'dateFrom' | 'dateTo', value: string) => {
      setFilters((current) => sanitize(updateOverviewOsFilter(current, field, value, coverage)))
    },
    [coverage, sanitize],
  )

  // Opções marcadas de um campo de escolha, pelo mesmo saneamento da cadeia.
  const setSelection = useCallback(
    (field: OverviewOsSelectionField, values: readonly string[]) => {
      setFilters((current) => sanitize(updateOverviewOsSelection(current, field, values)))
    },
    [sanitize],
  )

  // Início e Fim juntos, para os atalhos de período: passa pela mesma
  // validação e pelo mesmo saneamento da cadeia de filtros.
  const setPeriod = useCallback(
    (range: PeriodRange) => {
      setFilters((current) => sanitize(updateOverviewOsPeriod(current, range, coverage)))
    },
    [coverage, sanitize],
  )

  const resetFilters = useCallback(
    () => setFilters(defaultOverviewOsFiltersFor(coverage)),
    [coverage],
  )

  // Na base local as opções saem daqui; com o serviço, da consulta 1.
  const options = useMemo(
    () => meta?.options ?? resolveOverviewOsFilters(records, filters, catalogOrder).options,
    [catalogOrder, filters, meta, records],
  )
  const filteredRecords = useMemo(
    () => applyOverviewOsFilters(records, filters),
    [filters, records],
  )

  const periodLoading = summary
    ? periodState?.key !== key
    : api && (needed === null || !covers(recordsState.window, needed))
  const firstLoad = meta === null || (summary ? periodState === null : api && recordsState.window === null)
  const status: OverviewOsStatus =
    summary && !api ? 'unavailable' : fatal !== null ? 'error' : firstLoad ? 'loading' : 'ready'

  const value = useMemo<OverviewOsContextValue>(
    () => ({
      filters,
      options,
      records,
      filteredRecords,
      period: periodState?.facts ?? null,
      coverage,
      technicians: meta?.technicians ?? [],
      origin: api ? 'api' : 'local',
      status,
      periodLoading: status === 'ready' && periodLoading,
      errorMessage: fatal,
      updatedAt: meta?.updatedAt ?? null,
      generatedAt: summary ? (periodState?.generatedAt ?? null) : recordsState.generatedAt,
      setFilter,
      setSelection,
      setPeriod,
      resetFilters,
    }),
    [
      api,
      coverage,
      fatal,
      filteredRecords,
      filters,
      meta,
      options,
      periodLoading,
      periodState,
      records,
      recordsState.generatedAt,
      resetFilters,
      setFilter,
      setPeriod,
      setSelection,
      status,
      summary,
    ],
  )

  return <OverviewOsContext.Provider value={value}>{children}</OverviewOsContext.Provider>
}
