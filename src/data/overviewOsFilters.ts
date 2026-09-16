import { isValidISODate, previousPeriodRange } from './dashboardFilters'
import { defaultPeriodFor } from './defaultPeriod'
import {
  OVERVIEW_OS_DATE_RANGE,
  OVERVIEW_OS_DEFAULT_PERIOD,
  OVERVIEW_OS_LOCAL_CATALOG_ORDER,
  type OverviewOsCatalogOrder,
  type OverviewOsRecord,
} from './overviewOsData'

export type { OverviewOsCatalogOrder } from './overviewOsData'

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
  /** Identificador do técnico. O painel mostra o nome vindo do catálogo. */
  technicianId: string
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
  technicianId: 'Todos',
  serviceType: 'Todos',
  category: 'Todas',
  city: 'Todas',
  status: 'Todos',
} as const

/**
 * Recorte neutro de referência, com o período derivado da data máxima do
 * arquivo local.
 *
 * NÃO é mais o que a Visão Geral aplica ao abrir. Desde a regra única de
 * período, quem manda é `defaultOverviewOsFiltersFor`, logo abaixo, que parte
 * do mês corrente. Esta constante continua servindo de base para os oito
 * valores neutros, e o período dela só coincide com o da página enquanto a
 * cobertura do arquivo local terminar no passado.
 */
export const defaultOverviewOsFilters: OverviewOsFilters = {
  dateFrom: OVERVIEW_OS_DEFAULT_PERIOD.start,
  dateTo: OVERVIEW_OS_DEFAULT_PERIOD.end,
  team: OVERVIEW_OS_ALL.team,
  technicianId: OVERVIEW_OS_ALL.technicianId,
  serviceType: OVERVIEW_OS_ALL.serviceType,
  category: OVERVIEW_OS_ALL.category,
  city: OVERVIEW_OS_ALL.city,
  status: OVERVIEW_OS_ALL.status,
}

/**
 * Mesmos filtros neutros, para uma cobertura qualquer.
 *
 * O período sai de `defaultPeriodFor`, a mesma regra das demais páginas: do
 * dia 1 do mês corrente até hoje, sem passar do que a fonte cobre. Com o banco
 * em dia, é o mês corrente até hoje; com a carga atrasada, o fim recua para a
 * última data com dado. Com a cobertura do arquivo local, que termina em
 * 21/08/2026, o resultado é idêntico a `defaultOverviewOsFilters`.
 */
export function defaultOverviewOsFiltersFor(coverage: OverviewOsCoverage): OverviewOsFilters {
  const period = defaultPeriodFor({ start: coverage.min, end: coverage.max })

  return { ...defaultOverviewOsFilters, dateFrom: period.start, dateTo: period.end }
}

/** Rótulos de exibição dos oito filtros, na ordem aprovada. */
const overviewOsFilterLabels: Record<keyof OverviewOsFilters, string> = {
  dateFrom: 'Início',
  dateTo: 'Fim',
  team: 'Equipe',
  technicianId: 'Técnico',
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

/**
 * Campos diferentes do padrão, na ordem aprovada, para contagem e chips.
 *
 * O padrão do período depende da cobertura da fonte em uso: comparar com o do
 * arquivo local fazia a página ligada ao serviço abrir com Início e Fim
 * "alterados", e o `Limpar filtros` ficava sempre visível (apontado pelo Mário
 * em 10/09/2026). Omitida, a cobertura é a do arquivo local, e o resultado é
 * o de sempre.
 */
export function listActiveOverviewOsFilters(
  filters: OverviewOsFilters,
  coverage: OverviewOsCoverage = OVERVIEW_OS_DATE_RANGE,
): ActiveOverviewOsFilter[] {
  const defaults = defaultOverviewOsFiltersFor(coverage)

  return (Object.keys(overviewOsFilterLabels) as (keyof OverviewOsFilters)[])
    .filter((field) => filters[field] !== defaults[field])
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

type NonDateField = 'team' | 'technicianId' | 'serviceType' | 'category' | 'city' | 'status'

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
      matchesField(record, 'technicianId', filters.technicianId) &&
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
      matchesField(record, 'technicianId', filters.technicianId) &&
      matchesField(record, 'serviceType', filters.serviceType) &&
      matchesField(record, 'category', filters.category) &&
      matchesField(record, 'city', filters.city),
  )
}

/**
 * Contexto do gráfico `Composição por tipo de OS`: aplica tudo, MENOS os
 * filtros Tipo de OS e Categoria. Mesmo recurso da distribuição por status, e
 * pelo mesmo motivo: sem ele, selecionar um tipo reduzia a rosca a uma fatia
 * única de 100%, que não compara nada.
 *
 * Categoria também fica de fora porque ela é a subdivisão do tipo: como quase
 * toda categoria da fonte pertence a um único tipo, aplicá-la reproduzia a
 * mesma fatia de 100% por outro caminho. Com o contexto completo, a seleção de
 * categoria vira destaque do tipo que a contém, decidido na página.
 */
export function applyOverviewOsFiltersExceptServiceTypeAndCategory(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
): OverviewOsRecord[] {
  return records.filter(
    (record) =>
      inPeriod(record, filters) &&
      matchesField(record, 'team', filters.team) &&
      matchesField(record, 'technicianId', filters.technicianId) &&
      matchesField(record, 'city', filters.city) &&
      matchesField(record, 'status', filters.status),
  )
}

/**
 * Contexto do ranking `Volume por categoria`: aplica tudo, MENOS o filtro
 * Categoria. Sem ele, selecionar uma categoria reduzia o ranking a uma barra
 * única; com ele, a categoria escolhida é destacada entre as demais.
 */
export function applyOverviewOsFiltersExceptCategory(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
): OverviewOsRecord[] {
  return records.filter(
    (record) =>
      inPeriod(record, filters) &&
      matchesField(record, 'team', filters.team) &&
      matchesField(record, 'technicianId', filters.technicianId) &&
      matchesField(record, 'serviceType', filters.serviceType) &&
      matchesField(record, 'city', filters.city) &&
      matchesField(record, 'status', filters.status),
  )
}

/**
 * Contexto do ranking `Volume por cidade`: aplica tudo, MENOS o filtro Cidade,
 * pela mesma razão dos demais contextos: a cidade escolhida vira destaque, e
 * as outras permanecem como referência comparativa do recorte.
 */
export function applyOverviewOsFiltersExceptCity(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
): OverviewOsRecord[] {
  return records.filter(
    (record) =>
      inPeriod(record, filters) &&
      matchesField(record, 'team', filters.team) &&
      matchesField(record, 'technicianId', filters.technicianId) &&
      matchesField(record, 'serviceType', filters.serviceType) &&
      matchesField(record, 'category', filters.category) &&
      matchesField(record, 'status', filters.status),
  )
}

export type OverviewOsFilterOptions = {
  teams: string[]
  /** Identificadores dos técnicos presentes; o nome vem do catálogo do serviço. */
  technicians: string[]
  serviceTypes: string[]
  categories: string[]
  cities: string[]
  statuses: string[]
}

const byPtBr = (a: string, b: string) => a.localeCompare(b, 'pt-BR')

/**
 * Ordena valores presentes preservando a ordem de negócio recebida da fonte;
 * valores fora dela (ex.: `Customer (legado)`, ou uma chave crua do SGI)
 * entram no fim, em ordem alfabética pt-BR, visíveis em vez de escondidos.
 * Com a ordem vazia, tudo sai alfabético.
 */
export function orderedByCatalog(
  present: ReadonlySet<string>,
  catalog: readonly string[],
): string[] {
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
  /**
   * Ordem de status e tipo da fonte em uso. Omitida, vale a do arquivo local,
   * para a base local seguir idêntica; com a API, vem do contrato.
   */
  catalogOrder: OverviewOsCatalogOrder = OVERVIEW_OS_LOCAL_CATALOG_ORDER,
): ResolvedOverviewOsFilters {
  const filters = { ...input }

  const inWindow = records.filter((record) => inPeriod(record, filters))

  // Equipe é o cadastro do SGI, com o nome exato de `teams.name`, e não tem
  // ordem de negócio no BI: alfabética pt-BR (decisão de 08/09/2026).
  const teams = [...distinct(inWindow, 'team')].sort(byPtBr)
  if (filters.team !== OVERVIEW_OS_ALL.team && !teams.includes(filters.team)) {
    filters.team = OVERVIEW_OS_ALL.team
  }
  const afterTeam = inWindow.filter((record) => matchesField(record, 'team', filters.team))

  // Técnicos presentes no contexto, como identificadores. O nome de cada um
  // vem do catálogo do serviço, e é o painel que faz essa tradução: aqui o
  // filtro trabalha com a chave, que é o que a OS carrega.
  //
  // A lista sai dos registros já filtrados por equipe, então escolher uma
  // equipe deixa na lista quem realmente tem OS nela. Isso não é o vínculo
  // catálogo de equipe por técnico, que ficou de fora por decisão do Mário: é
  // a mesma dependência por presença que os demais seletores já têm.
  const technicians = [...distinct(afterTeam, 'technicianId')].sort(byPtBr)
  if (
    filters.technicianId !== OVERVIEW_OS_ALL.technicianId &&
    !technicians.includes(filters.technicianId)
  ) {
    filters.technicianId = OVERVIEW_OS_ALL.technicianId
  }
  const afterTechnician = afterTeam.filter((record) =>
    matchesField(record, 'technicianId', filters.technicianId),
  )

  const serviceTypes = orderedByCatalog(
    distinct(afterTechnician, 'serviceType'),
    catalogOrder.serviceTypes,
  )
  if (
    filters.serviceType !== OVERVIEW_OS_ALL.serviceType &&
    !serviceTypes.includes(filters.serviceType)
  ) {
    filters.serviceType = OVERVIEW_OS_ALL.serviceType
  }
  const afterType = afterTechnician.filter((record) =>
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

  const statuses = orderedByCatalog(distinct(afterCity, 'status'), catalogOrder.statuses)
  if (filters.status !== OVERVIEW_OS_ALL.status && !statuses.includes(filters.status)) {
    filters.status = OVERVIEW_OS_ALL.status
  }

  return { filters, options: { teams, technicians, serviceTypes, categories, cities, statuses } }
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
