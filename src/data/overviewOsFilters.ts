import { isValidISODate, previousPeriodRange } from './dashboardFilters'
import { OS_SERVICE_TYPES, OS_STATUSES, OS_TEAMS } from './mockOsCatalog'
import {
  OVERVIEW_OS_DATE_RANGE,
  OVERVIEW_OS_DEFAULT_PERIOD,
  type OverviewOsRecord,
} from './overviewOsData'

/**
 * Filtros da Visão Geral de OS sobre a fonte real sanitizada.
 *
 * Sete campos (Início, Fim, Equipe, Tipo de OS, Categoria, Cidade e Status),
 * com duas diferenças de comportamento em relação a `dashboardFilters.ts`:
 *
 * 1. as OPÇÕES saem dos registros realmente disponíveis no contexto, e não dos
 *    catálogos completos: valor sem dado não vira opção;
 * 2. os campos são DEPENDENTES na ordem Período → Equipe → Tipo de OS →
 *    Categoria → Cidade → Status, e uma seleção que deixar de existir no novo
 *    contexto volta sozinha para o valor neutro.
 *
 * Resolução saiu do painel: o desfecho continua visível no ranking
 * `Resoluções mais frequentes`, mas não recorta mais a página. Categoria
 * entrou logo depois de Tipo de OS porque é a subdivisão dele: as 33
 * categorias reais do SGI se distribuem entre os tipos.
 */

export type OverviewOsFilters = {
  dateFrom: string
  dateTo: string
  team: string
  serviceType: string
  category: string
  city: string
  status: string
}

/**
 * Cobertura de datas da fonte em uso.
 *
 * Existe porque a fonte deixou de ser única: o arquivo local cobre 06/04/2026 a
 * 21/08/2026, e a API traz a cobertura real do banco, que muda a cada carga. As
 * funções que dependem da cobertura recebem esta janela em vez de importar a
 * constante do arquivo local, e mantêm a constante como valor padrão para que
 * o comportamento da base local siga idêntico.
 */
export type OverviewOsCoverage = {
  readonly min: string
  readonly max: string
}

/** Valores neutros de cada seletor, na linguagem já aprovada do painel. */
export const OVERVIEW_OS_ALL = {
  team: 'Todas',
  serviceType: 'Todos',
  category: 'Todas',
  city: 'Todas',
  status: 'Todos',
} as const

/**
 * Padrão da Visão Geral: o mês mais recente da base, derivado da data máxima
 * da fonte, e nunca do relógio do computador.
 */
export const defaultOverviewOsFilters: OverviewOsFilters = {
  dateFrom: OVERVIEW_OS_DEFAULT_PERIOD.start,
  dateTo: OVERVIEW_OS_DEFAULT_PERIOD.end,
  team: OVERVIEW_OS_ALL.team,
  serviceType: OVERVIEW_OS_ALL.serviceType,
  category: OVERVIEW_OS_ALL.category,
  city: OVERVIEW_OS_ALL.city,
  status: OVERVIEW_OS_ALL.status,
}

/**
 * Mesmos filtros neutros, para uma cobertura qualquer.
 *
 * A regra do período padrão é a mesma de sempre, dia 1 do mês da data máxima
 * até a própria data máxima, só que aplicada à cobertura recebida. Com a
 * cobertura do arquivo local, o resultado é idêntico a `defaultOverviewOsFilters`.
 *
 * O início nunca ultrapassa o começo da cobertura para trás: uma base que
 * comece no meio do mês, como a do ambiente de desenvolvimento, abriria a
 * página com um período que o próprio calendário recusaria.
 */
export function defaultOverviewOsFiltersFor(coverage: OverviewOsCoverage): OverviewOsFilters {
  const monthStart = `${coverage.max.slice(0, 7)}-01`

  return {
    ...defaultOverviewOsFilters,
    dateFrom: monthStart < coverage.min ? coverage.min : monthStart,
    dateTo: coverage.max,
  }
}

/** Rótulos de exibição dos sete filtros, na ordem aprovada. */
const overviewOsFilterLabels: Record<keyof OverviewOsFilters, string> = {
  dateFrom: 'Início',
  dateTo: 'Fim',
  team: 'Equipe',
  serviceType: 'Tipo de OS',
  category: 'Categoria',
  city: 'Cidade',
  status: 'Status',
}

export type ActiveOverviewOsFilter = {
  field: keyof OverviewOsFilters
  label: string
  value: string
}

/** Campos diferentes do padrão, na ordem aprovada, para contagem e chips. */
export function listActiveOverviewOsFilters(filters: OverviewOsFilters): ActiveOverviewOsFilter[] {
  return (Object.keys(overviewOsFilterLabels) as (keyof OverviewOsFilters)[])
    .filter((field) => filters[field] !== defaultOverviewOsFilters[field])
    .map((field) => ({ field, label: overviewOsFilterLabels[field], value: filters[field] }))
}

/**
 * Publica um novo valor de filtro sem quebrar o período.
 *
 * Datas só entram válidas, ordenadas e dentro da cobertura real da fonte
 * (06/04/2026 a 21/08/2026): valor fora disso mantém o estado atual, o mesmo
 * contrato do painel anterior.
 */
export function updateOverviewOsFilter(
  current: OverviewOsFilters,
  key: keyof OverviewOsFilters,
  value: string,
  coverage: OverviewOsCoverage = OVERVIEW_OS_DATE_RANGE,
): OverviewOsFilters {
  const next = { ...current, [key]: value }

  if (key === 'dateFrom' || key === 'dateTo') {
    if (
      !isValidISODate(next.dateFrom) ||
      !isValidISODate(next.dateTo) ||
      next.dateFrom > next.dateTo ||
      next.dateFrom < coverage.min ||
      next.dateTo > coverage.max
    ) {
      return current
    }
  }

  return next
}

function inPeriod(record: OverviewOsRecord, filters: OverviewOsFilters): boolean {
  return record.dateISO >= filters.dateFrom && record.dateISO <= filters.dateTo
}

type NonDateField = 'team' | 'serviceType' | 'category' | 'city' | 'status'

function matchesField(
  record: OverviewOsRecord,
  field: NonDateField,
  selected: string,
): boolean {
  if (selected === OVERVIEW_OS_ALL[field]) return true
  return record[field] === selected
}

/** Todos os sete filtros, para indicadores e gráficos. */
export function applyOverviewOsFilters(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
): OverviewOsRecord[] {
  return records.filter(
    (record) =>
      inPeriod(record, filters) &&
      matchesField(record, 'team', filters.team) &&
      matchesField(record, 'serviceType', filters.serviceType) &&
      matchesField(record, 'category', filters.category) &&
      matchesField(record, 'city', filters.city) &&
      matchesField(record, 'status', filters.status),
  )
}

/**
 * Contexto do gráfico `Distribuição por status`: aplica tudo, MENOS o filtro
 * Status. É o que preserva as demais barras como referência comparativa quando
 * um status está selecionado.
 */
export function applyOverviewOsFiltersExceptStatus(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
): OverviewOsRecord[] {
  return records.filter(
    (record) =>
      inPeriod(record, filters) &&
      matchesField(record, 'team', filters.team) &&
      matchesField(record, 'serviceType', filters.serviceType) &&
      matchesField(record, 'category', filters.category) &&
      matchesField(record, 'city', filters.city),
  )
}

/**
 * Contexto do gráfico `Composição por tipo de OS`: aplica tudo, MENOS o filtro
 * Tipo de OS. Mesmo recurso da distribuição por status, e pelo mesmo motivo:
 * sem ele, selecionar um tipo reduzia a rosca a uma fatia única de 100%, que
 * não compara nada. Com ele, o tipo escolhido é destacado e os demais
 * permanecem como referência.
 *
 * Categoria continua sendo aplicada, e isso é deliberado: ela é a subdivisão do
 * tipo, então o contexto de uma categoria selecionada é justamente o conjunto
 * dos tipos que a contêm.
 */
export function applyOverviewOsFiltersExceptServiceType(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
): OverviewOsRecord[] {
  return records.filter(
    (record) =>
      inPeriod(record, filters) &&
      matchesField(record, 'team', filters.team) &&
      matchesField(record, 'category', filters.category) &&
      matchesField(record, 'city', filters.city) &&
      matchesField(record, 'status', filters.status),
  )
}

export type OverviewOsFilterOptions = {
  teams: string[]
  serviceTypes: string[]
  categories: string[]
  cities: string[]
  statuses: string[]
}

const byPtBr = (a: string, b: string) => a.localeCompare(b, 'pt-BR')

/**
 * Ordena valores presentes preservando a ordem de negócio do catálogo
 * aplicável; valores fora do catálogo (ex.: `Customer (legado)`) entram no
 * fim, em ordem alfabética pt-BR.
 */
function orderedByCatalog(present: ReadonlySet<string>, catalog: readonly string[]): string[] {
  const known = catalog.filter((value) => present.has(value))
  const knownSet = new Set(catalog)
  const extras = [...present].filter((value) => !knownSet.has(value)).sort(byPtBr)
  return [...known, ...extras]
}

function distinct(
  records: readonly OverviewOsRecord[],
  field: NonDateField,
): Set<string> {
  const values = new Set<string>()
  for (const record of records) {
    const value = record[field]
    if (value !== null) values.add(value)
  }
  return values
}

export type ResolvedOverviewOsFilters = {
  /** Filtros já saneados: nenhuma seleção sobrevive fora do próprio contexto. */
  filters: OverviewOsFilters
  /** Opções realmente disponíveis, campo a campo, no contexto dos anteriores. */
  options: OverviewOsFilterOptions
}

/**
 * Núcleo dos filtros dependentes.
 *
 * Percorre a cadeia Período → Equipe → Tipo de OS → Categoria → Cidade →
 * Status calculando, para cada campo, as opções existentes no contexto dos
 * campos ANTERIORES e validando a seleção atual contra elas. Seleção
 * incompatível volta para o valor neutro imediatamente, e a avaliação segue
 * para os campos seguintes já sem ela: nenhum valor fica escondido filtrando
 * resultados que a interface não mostra.
 */
export function resolveOverviewOsFilters(
  records: readonly OverviewOsRecord[],
  input: OverviewOsFilters,
): ResolvedOverviewOsFilters {
  const filters = { ...input }

  const inWindow = records.filter((record) => inPeriod(record, filters))

  const teams = orderedByCatalog(distinct(inWindow, 'team'), OS_TEAMS)
  if (filters.team !== OVERVIEW_OS_ALL.team && !teams.includes(filters.team)) {
    filters.team = OVERVIEW_OS_ALL.team
  }
  const afterTeam = inWindow.filter((record) => matchesField(record, 'team', filters.team))

  const serviceTypes = orderedByCatalog(distinct(afterTeam, 'serviceType'), OS_SERVICE_TYPES)
  if (
    filters.serviceType !== OVERVIEW_OS_ALL.serviceType &&
    !serviceTypes.includes(filters.serviceType)
  ) {
    filters.serviceType = OVERVIEW_OS_ALL.serviceType
  }
  const afterType = afterTeam.filter((record) =>
    matchesField(record, 'serviceType', filters.serviceType),
  )

  // As categorias não têm catálogo de negócio no bundle: são as 33 reais do
  // SGI, preservadas como estão, então a ordem é a alfabética pt-BR.
  const categories = [...distinct(afterType, 'category')].sort(byPtBr)
  if (filters.category !== OVERVIEW_OS_ALL.category && !categories.includes(filters.category)) {
    filters.category = OVERVIEW_OS_ALL.category
  }
  const afterCategory = afterType.filter((record) =>
    matchesField(record, 'category', filters.category),
  )

  const cities = [...distinct(afterCategory, 'city')].sort(byPtBr)
  if (filters.city !== OVERVIEW_OS_ALL.city && !cities.includes(filters.city)) {
    filters.city = OVERVIEW_OS_ALL.city
  }
  const afterCity = afterCategory.filter((record) => matchesField(record, 'city', filters.city))

  const statuses = orderedByCatalog(distinct(afterCity, 'status'), OS_STATUSES)
  if (filters.status !== OVERVIEW_OS_ALL.status && !statuses.includes(filters.status)) {
    filters.status = OVERVIEW_OS_ALL.status
  }

  return { filters, options: { teams, serviceTypes, categories, cities, statuses } }
}

export type OverviewPreviousPeriod = {
  range: { dateFrom: string; dateTo: string }
  /**
   * `complete` quando a janela anterior inteira cabe na cobertura da fonte.
   * `incomplete` quando ela alcança datas antes de 06/04/2026: comparar com
   * uma base parcial enganaria, então a comparação fica indisponível com o
   * aviso `Período anterior incompleto`.
   */
  coverage: 'complete' | 'incomplete'
}

/**
 * Janela anterior de MESMA duração, terminando na véspera do início atual,
 * com a checagem de cobertura da fonte.
 */
export function previousOverviewOsPeriod(
  filters: Pick<OverviewOsFilters, 'dateFrom' | 'dateTo'>,
  coverage: OverviewOsCoverage = OVERVIEW_OS_DATE_RANGE,
): OverviewPreviousPeriod | null {
  const range = previousPeriodRange(filters)
  if (!range) return null

  return {
    range,
    coverage: range.dateFrom >= coverage.min ? 'complete' : 'incomplete',
  }
}

/** Mesmos filtros não temporais da tela, aplicados à janela anterior. */
export function applyOverviewOsPreviousFilters(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
  range: { dateFrom: string; dateTo: string },
): OverviewOsRecord[] {
  return applyOverviewOsFilters(records, { ...filters, dateFrom: range.dateFrom, dateTo: range.dateTo })
}
