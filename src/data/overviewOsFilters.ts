import { formatDateBr } from '../lib/formatters'
import { isValidISODate, previousPeriodRange } from './dashboardFilters'
import { defaultPeriodFor, todayISO } from './defaultPeriod'
import {
  daysBetween,
  lastDayOfMonth,
  previousMonthStart,
  shiftISODate,
  weekdayNameOf,
  weekdayOf,
} from './isoDate'
import { periodWithinCoverage, type PeriodRange } from './periodPresets'
import {
  OVERVIEW_OS_DATE_RANGE,
  OVERVIEW_OS_DEFAULT_PERIOD,
  OVERVIEW_OS_LOCAL_CATALOG_ORDER,
  type OverviewOsCatalogOrder,
  type OverviewOsRecord,
} from './overviewOsData'

export type { OverviewOsCatalogOrder } from './overviewOsData'
// As contas de data e os atalhos de período moraram aqui até 24/09/2026 e
// saíram para `isoDate.ts` e `periodPresets.ts` ao virarem componente do
// portal. Quem já importava daqui segue funcionando.
export { lastDayOfMonth, mondayOf, shiftISODate, weekdayNameOf } from './isoDate'
export type { PeriodRange } from './periodPresets'

/**
 * Filtros da Visão Geral de OS sobre a fonte real sanitizada.
 *
 * Sete campos (Início, Fim, Equipe, Tipo de OS, Categoria, Cidade e Status),
 * com duas diferenças de comportamento em relação a `dashboardFilters.ts`:
 *
 * 1. as OPÇÕES saem dos registros realmente disponíveis no contexto, e não dos
 *    catálogos completos: valor sem dado não vira opção;
 * 2. os campos são DEPENDENTES na ordem Período → Equipe → Tipo de OS →
 *    Categoria → Cidade → Status, e uma opção marcada que deixar de existir no
 *    novo contexto sai sozinha da seleção.
 *
 * Resolução saiu do painel: o desfecho continua visível no ranking
 * `Resoluções mais frequentes`, mas não recorta mais a página. Categoria
 * entrou logo depois de Tipo de OS porque é a subdivisão dele: as 33
 * categorias reais do SGI se distribuem entre os tipos.
 */

/**
 * Campos de escolha da faixa. Desde 30/09/2026 cada um aceita VÁRIAS opções
 * (pedido do Mário): a lista guarda as marcadas, e lista vazia é o valor
 * neutro, "Todos". Entre opções do mesmo campo vale o "ou" (Manutenção ou
 * Auditoria); entre campos diferentes, o "e", como sempre foi.
 */
export type OverviewOsSelectionField =
  | 'team'
  | 'technicianId'
  | 'serviceType'
  | 'category'
  | 'city'
  | 'status'

export type OverviewOsFilters = {
  dateFrom: string
  dateTo: string
  team: readonly string[]
  /** Identificadores dos técnicos. O painel mostra o nome vindo do catálogo. */
  technicianId: readonly string[]
  serviceType: readonly string[]
  category: readonly string[]
  city: readonly string[]
  status: readonly string[]
}

export function isOverviewOsSelectionField(
  field: keyof OverviewOsFilters,
): field is OverviewOsSelectionField {
  return field !== 'dateFrom' && field !== 'dateTo'
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

/**
 * Texto do valor neutro de cada seletor, na linguagem já aprovada do painel.
 * Desde a seleção múltipla ele não é mais um valor guardado no filtro (o
 * neutro é a lista vazia): é o que o campo escreve quando nada está marcado.
 */
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
 * do mês corrente e para em ontem. Esta constante continua servindo de base
 * para os oito valores neutros, e o período dela só coincide com o da página
 * enquanto a cobertura do arquivo local terminar no passado.
 */
export const defaultOverviewOsFilters: OverviewOsFilters = {
  dateFrom: OVERVIEW_OS_DEFAULT_PERIOD.start,
  dateTo: OVERVIEW_OS_DEFAULT_PERIOD.end,
  team: [],
  technicianId: [],
  serviceType: [],
  category: [],
  city: [],
  status: [],
}

/**
 * Mesmos filtros neutros, para uma cobertura qualquer.
 *
 * A Visão Geral de OS abre em DIAS FECHADOS: do dia 1 do mês até ONTEM
 * (decisão do Mário em 22/09/2026). As demais páginas seguem a regra única
 * "até hoje" de `defaultPeriodFor`; aqui o dia de hoje pertence à faixa Hoje
 * ao vivo, que o lê em andamento. Dentro dos cards ele entrava como "em
 * aberto" e derrubava a Taxa de Conclusão de manhã (75,0% às 9h contra 81,5%
 * sem as OS ainda a fazer), um alarme que sumia sozinho à noite. No dia 1 o
 * resultado é o mês anterior inteiro, o último fechado.
 *
 * O fim continua limitado ao que a fonte cobre: com a carga atrasada ele
 * recua para a última data com dado, e a cobertura do arquivo local, que
 * termina em 21/08/2026, segue abrindo em 01/08 a 21/08.
 *
 * `today` existe para os testes fixarem a data; no portal vale o relógio.
 */
export function defaultOverviewOsFiltersFor(
  coverage: OverviewOsCoverage,
  today: string = todayISO(),
): OverviewOsFilters {
  const period = defaultPeriodFor(
    { start: coverage.min, end: coverage.max },
    shiftISODate(today, -1),
  )

  return { ...defaultOverviewOsFilters, dateFrom: period.start, dateTo: period.end }
}

/**
 * true quando o período escolhido alcança o dia de hoje, que ainda está em
 * andamento. O padrão para em ontem justamente para não incluí-lo; quem o
 * escolhe no filtro recebe o aviso na página, porque os indicadores de um dia
 * em curso mudam até a noite.
 */
export function periodIncludesToday(
  filters: Pick<OverviewOsFilters, 'dateTo'>,
  today: string = todayISO(),
): boolean {
  return filters.dateTo >= today
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
  /** O valor em texto: a data, ou as opções marcadas separadas por vírgula. */
  value: string
  /** As opções marcadas, uma por item; nas datas, a própria data. */
  values: readonly string[]
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

  return (Object.keys(overviewOsFilterLabels) as (keyof OverviewOsFilters)[]).flatMap((field): ActiveOverviewOsFilter[] => {
    const label = overviewOsFilterLabels[field]
    if (isOverviewOsSelectionField(field)) {
      const values = filters[field]
      return values.length === 0 ? [] : [{ field, label, value: values.join(', '), values }]
    }
    const value = filters[field]
    return value === defaults[field] ? [] : [{ field, label, value, values: [value] }]
  })
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
  key: 'dateFrom' | 'dateTo',
  value: string,
  coverage: OverviewOsCoverage = OVERVIEW_OS_DATE_RANGE,
): OverviewOsFilters {
  const next = { ...current, [key]: value }

  if (
    !isValidISODate(next.dateFrom) ||
    !isValidISODate(next.dateTo) ||
    next.dateFrom > next.dateTo ||
    next.dateFrom < coverage.min ||
    next.dateTo > coverage.max
  ) {
    return current
  }

  return next
}

/**
 * Publica as opções marcadas de um campo de escolha. Repetição sai; a ordem
 * final é a da lista de opções, que a cadeia de filtros refaz logo depois.
 */
export function updateOverviewOsSelection(
  current: OverviewOsFilters,
  field: OverviewOsSelectionField,
  values: readonly string[],
): OverviewOsFilters {
  return { ...current, [field]: [...new Set(values)] }
}

function inPeriod(record: OverviewOsRecord, filters: OverviewOsFilters): boolean {
  return record.dateISO >= filters.dateFrom && record.dateISO <= filters.dateTo
}

type NonDateField = OverviewOsSelectionField

/**
 * Opção do filtro Equipe para as OS SEM EQUIPE (decisão do Mário em
 * 23/09/2026). Sem ela, essas OS sumiam em qualquer filtro de equipe, e
 * toda equipe parecia acima da empresa: em setembro/2026 eram 267 OS, 211
 * sem técnico (onde está quase toda não executada de cliente) e 56 de dois
 * técnicos sem equipe no cadastro do SGI. O nome é o mesmo que a lista de
 * Hoje ao vivo já usa para a célula vazia, e com ela toda OS cabe em alguma
 * opção do filtro. Entra no fim da lista, depois das equipes do cadastro.
 */
export const OVERVIEW_OS_NO_TEAM = 'Sem equipe'

/**
 * Um registro atende a um filtro não temporal? A regra num lugar só, para
 * a página e a faixa Hoje ao vivo não divergirem: nada marcado deixa passar
 * tudo, "Sem equipe" casa com a equipe nula, e todo outro valor com o próprio
 * texto. Com várias opções marcadas, basta casar com uma.
 */
export function matchesOverviewOsField(
  record: OverviewOsRecord,
  field: NonDateField,
  selected: readonly string[],
): boolean {
  if (selected.length === 0) return true
  if (field === 'team' && record.team === null) return selected.includes(OVERVIEW_OS_NO_TEAM)
  const value = record[field]
  return value !== null && selected.includes(value)
}

const matchesField = matchesOverviewOsField

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

/** As marcadas que ainda existem nas opções, na ordem das opções. */
function keepPresent(options: readonly string[], selected: readonly string[]): readonly string[] {
  if (selected.length === 0) return selected
  return options.filter((option) => selected.includes(option))
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
 * campos ANTERIORES e validando a seleção atual contra elas. Opção marcada
 * que ficou sem dado sai na hora, e só ela: as outras marcadas do mesmo campo
 * continuam. A avaliação segue para os campos seguintes já sem a que saiu, e
 * nenhum valor fica escondido filtrando resultados que a interface não
 * mostra. As marcadas ficam na ordem da lista de opções.
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
  // ordem de negócio no BI: alfabética pt-BR (decisão de 08/09/2026). "Sem
  // equipe" vem por último, e só quando o período tem OS sem equipe.
  const teams = [...distinct(inWindow, 'team')].sort(byPtBr)
  if (inWindow.some((record) => record.team === null)) teams.push(OVERVIEW_OS_NO_TEAM)
  filters.team = keepPresent(teams, filters.team)
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
  filters.technicianId = keepPresent(technicians, filters.technicianId)
  const afterTechnician = afterTeam.filter((record) =>
    matchesField(record, 'technicianId', filters.technicianId),
  )

  const serviceTypes = orderedByCatalog(
    distinct(afterTechnician, 'serviceType'),
    catalogOrder.serviceTypes,
  )
  filters.serviceType = keepPresent(serviceTypes, filters.serviceType)
  const afterType = afterTechnician.filter((record) =>
    matchesField(record, 'serviceType', filters.serviceType),
  )

  // As categorias não têm catálogo de negócio no bundle: são as 33 reais do
  // SGI, preservadas como estão, então a ordem é a alfabética pt-BR.
  const categories = [...distinct(afterType, 'category')].sort(byPtBr)
  filters.category = keepPresent(categories, filters.category)
  const afterCategory = afterType.filter((record) =>
    matchesField(record, 'category', filters.category),
  )

  const cities = [...distinct(afterCategory, 'city')].sort(byPtBr)
  filters.city = keepPresent(cities, filters.city)
  const afterCity = afterCategory.filter((record) => matchesField(record, 'city', filters.city))

  const statuses = orderedByCatalog(distinct(afterCity, 'status'), catalogOrder.statuses)
  filters.status = keepPresent(statuses, filters.status)

  return { filters, options: { teams, technicians, serviceTypes, categories, cities, statuses } }
}

/**
 * Se o filtro de Status ESTREITA o recorte: há status marcado e algum da
 * lista de opções ficou de fora. Com todos os status da lista marcados o
 * filtro não tira OS nenhuma e vale como nenhum (decisão do Mário em
 * 07/10/2026), a mesma régua com que o serviço calcula as taxas: a lista é
 * a dos status com OS no contexto dos demais filtros. Sem a lista (serviço
 * ainda carregando), qualquer status marcado conta como filtro.
 */
export function statusFilterNarrows(
  selected: readonly string[],
  options: readonly string[] | null | undefined,
): boolean {
  if (selected.length === 0) return false
  if (!options) return true

  return !options.every((status) => selected.includes(status))
}

/**
 * Publica Início e Fim de uma vez, com a mesma validação de
 * `updateOverviewOsFilter`. Um atalho precisa dos dois juntos: trocar uma
 * data por vez recusaria a janela sempre que a nova estivesse inteira antes
 * ou depois da atual.
 */
export function updateOverviewOsPeriod(
  current: OverviewOsFilters,
  range: PeriodRange,
  coverage: OverviewOsCoverage = OVERVIEW_OS_DATE_RANGE,
): OverviewOsFilters {
  if (
    !isValidISODate(range.dateFrom) ||
    !isValidISODate(range.dateTo) ||
    range.dateFrom > range.dateTo ||
    !periodWithinCoverage(range, coverage)
  ) {
    return current
  }

  return { ...current, dateFrom: range.dateFrom, dateTo: range.dateTo }
}

/** Natureza do recorte escolhido, que decide como a janela anterior é montada. */
export type OverviewComparisonKind = 'day' | 'week' | 'month' | 'custom'

export type OverviewComparisonRange = {
  readonly kind: OverviewComparisonKind
  readonly range: { dateFrom: string; dateTo: string }
}

/**
 * Janela anterior pela NATUREZA do recorte, regra aprovada pelo Mário em
 * 22/09/2026 no lugar da janela de mesma duração terminando na véspera:
 *
 * - um dia compara com o mesmo dia da semana anterior. A operação tem semana
 *   forte (uma segunda-feira chega a 136 OS, sábado fica perto de 44 e
 *   domingo de 5), e "ontem" comparava domingo com segunda;
 * - uma semana, de segunda-feira a algum dia da mesma semana, compara com os
 *   mesmos dias da semana anterior;
 * - um mês, do dia 1 a algum dia do mesmo mês, compara com o mês anterior até
 *   o mesmo dia (limitado ao fim dele, se for mais curto); o mês inteiro
 *   compara com o mês anterior inteiro. Era o que faltava ao padrão da
 *   página: 01 a 21/09 comparava com 10 a 31/08, que mistura semanas, cruza
 *   o mês e ninguém confere no SGI;
 * - qualquer outro recorte segue com a mesma duração terminando na véspera.
 *
 * Um recorte que é ao mesmo tempo mês e semana (dia 1 numa segunda-feira) é
 * lido como mês, que é o eixo da página. Recorte inválido devolve `null`.
 */
export function comparisonPeriodRange(
  filters: Pick<OverviewOsFilters, 'dateFrom' | 'dateTo'>,
): OverviewComparisonRange | null {
  const { dateFrom, dateTo } = filters
  if (!isValidISODate(dateFrom) || !isValidISODate(dateTo) || dateFrom > dateTo) return null

  if (dateFrom === dateTo) {
    return {
      kind: 'day',
      range: { dateFrom: shiftISODate(dateFrom, -7), dateTo: shiftISODate(dateTo, -7) },
    }
  }

  if (dateFrom.endsWith('-01') && dateFrom.slice(0, 7) === dateTo.slice(0, 7)) {
    const start = previousMonthStart(dateFrom)
    const end = lastDayOfMonth(start)
    if (dateTo === lastDayOfMonth(dateFrom)) {
      return { kind: 'month', range: { dateFrom: start, dateTo: end } }
    }
    const sameDay = `${start.slice(0, 7)}-${dateTo.slice(8)}`

    return { kind: 'month', range: { dateFrom: start, dateTo: sameDay > end ? end : sameDay } }
  }

  if (weekdayOf(dateFrom) === 1 && daysBetween(dateFrom, dateTo) <= 6) {
    return {
      kind: 'week',
      range: { dateFrom: shiftISODate(dateFrom, -7), dateTo: shiftISODate(dateTo, -7) },
    }
  }

  const range = previousPeriodRange(filters)

  return range === null ? null : { kind: 'custom', range }
}

/** Nomes dos meses como a comparação e o título do período os escrevem. */
const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

/** `2026-09-14` → `14/09`: dia e mês bastam dentro de um card. */
function dayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1)
}

/**
 * Nome do período escolhido, para a etiqueta da faixa "Resultado do período"
 * (pedido do Mário em 23/09/2026 na Visão Geral de OS, e em 25/09/2026 na
 * Comercial): o bloco dos cards vai para o projetor e para o print sem a
 * faixa de filtros, e "no período" não dizia qual.
 *
 * Mesma régua que classifica a comparação (`comparisonPeriodRange`), para o
 * título e o card fecharem a frase: "Setembro de 2026, até o dia 21 ...
 * vs. agosto até o dia 21".
 *
 * - mês inteiro: `Agosto de 2026`;
 * - mês até um dia: `Setembro de 2026, até o dia 21`;
 * - semana: `Semana de 14 a 20/09/2026`;
 * - um dia: `Segunda-feira, 21/09/2026`;
 * - recorte livre (ou datas inválidas): `03/09/2026 a 10/09/2026`.
 */
export function periodTitle(filters: Pick<OverviewOsFilters, 'dateFrom' | 'dateTo'>): string {
  const { dateFrom, dateTo } = filters
  const kind = comparisonPeriodRange(filters)?.kind ?? 'custom'

  if (kind === 'month') {
    const month = `${capitalize(MONTH_NAMES[Number(dateFrom.slice(5, 7)) - 1])} de ${dateFrom.slice(0, 4)}`

    return dateTo === lastDayOfMonth(dateFrom)
      ? month
      : `${month}, até o dia ${Number(dateTo.slice(8, 10))}`
  }
  if (kind === 'week') return `Semana de ${dayMonth(dateFrom)} a ${formatDateBr(dateTo)}`
  if (kind === 'day') return `${capitalize(weekdayNameOf(dateTo))}, ${formatDateBr(dateTo)}`

  return `${formatDateBr(dateFrom)} a ${formatDateBr(dateTo)}`
}

/**
 * Com o que o card compara, nas duas formas que ele usa: a curta
 * (`vs. agosto até o dia 21`) e a por extenso da leitura acessível. Decisão
 * do Mário em 22/09/2026: "vs. período anterior" deixava no ar a pergunta
 * "anterior a quê?", que é a primeira de uma diretoria. Nasceu na Visão Geral
 * de OS e vale para a Comercial desde 25/09/2026.
 *
 * O texto segue a natureza da janela anterior, o mesmo critério que a montou
 * (`comparisonPeriodRange`):
 *
 * - mês: `agosto até o dia 21`, ou só `agosto` quando o mês inteiro; o ano
 *   só entra quando é outro (`dezembro de 2025`);
 * - semana: `semana anterior` quando a semana está completa; incompleta,
 *   `semana anterior até terça`, porque a comparação é dos MESMOS dias, e
 *   "semana anterior" sozinho fazia pensar na semana inteira (apontado pelo
 *   Mário em 23/09/2026). É o mesmo molde do mês, "agosto até o dia 21";
 * - dia: `segunda 14/09`, com o dia da semana, porque é ele que explica a
 *   escolha da data (mesmo dia da semana anterior);
 * - recorte livre: as duas datas, `26/08 a 04/09`.
 *
 * `within` é a mesma janela com a preposição certa, para a frase "Sem
 * ativação no domingo 13/09" (decisão do Mário em 25/09/2026): quando a
 * janela existe e ficou zerada, dizer "Sem período anterior" seria falso.
 *
 * `currentDateFrom` é o início do período escolhido, para saber se o ano do
 * mês comparado é outro.
 */
export function comparisonText(
  previous: OverviewComparisonRange,
  currentDateFrom: string,
): PeriodComparisonText {
  const { dateFrom, dateTo } = previous.range
  let text: string
  let within: string

  if (previous.kind === 'month') {
    const month = MONTH_NAMES[Number(dateFrom.slice(5, 7)) - 1]
    text = dateTo === lastDayOfMonth(dateFrom) ? month : `${month} até o dia ${Number(dateTo.slice(8, 10))}`
    if (dateFrom.slice(0, 4) !== currentDateFrom.slice(0, 4)) text += ` de ${dateFrom.slice(0, 4)}`
    within = `em ${text}`
  } else if (previous.kind === 'week') {
    const lastDay = weekdayNameOf(dateTo, 'short')
    text = lastDay === 'domingo' ? 'semana anterior' : `semana anterior até ${lastDay}`
    within = `na ${text}`
  } else if (previous.kind === 'day') {
    const weekday = weekdayNameOf(dateTo, 'short')
    text = `${weekday} ${dayMonth(dateTo)}`
    // Sábado e domingo são masculinos; os outros dias, femininos.
    within = `${weekday === 'sábado' || weekday === 'domingo' ? 'no' : 'na'} ${text}`
  } else {
    text = `${dayMonth(dateFrom)} a ${dayMonth(dateTo)}`
    within = `de ${text}`
  }

  return { label: `vs. ${text}`, long: `versus ${text}`, within }
}

/** O nome da janela anterior nas três formas que a tela usa (`comparisonText`). */
export type PeriodComparisonText = {
  /** Curta, na frente do card: `vs. agosto até o dia 24`. */
  readonly label: string
  /** Por extenso, na leitura acessível: `versus agosto até o dia 24`. */
  readonly long: string
  /** Com a preposição, para dizer o que houve nela: `no domingo 13/09`. */
  readonly within: string
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
  /** Natureza do recorte que montou a janela, para o card poder dizer com o que compara. */
  kind: OverviewComparisonKind
}

/**
 * Janela anterior pela natureza do recorte (`comparisonPeriodRange`), com a
 * checagem de cobertura da fonte.
 */
export function previousOverviewOsPeriod(
  filters: Pick<OverviewOsFilters, 'dateFrom' | 'dateTo'>,
  coverage: OverviewOsCoverage = OVERVIEW_OS_DATE_RANGE,
): OverviewPreviousPeriod | null {
  const comparison = comparisonPeriodRange(filters)
  if (comparison === null) return null

  return {
    range: comparison.range,
    coverage: comparison.range.dateFrom >= coverage.min ? 'complete' : 'incomplete',
    kind: comparison.kind,
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
