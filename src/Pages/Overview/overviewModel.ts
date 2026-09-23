import type { KpiDelta, Pair } from '../../data/dashboardTypes'
import { delta as kpiDelta, unavailableDelta } from '../../data/overviewOsAggregates'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import {
  applyOverviewOsFilters,
  applyOverviewOsPreviousFilters,
  comparisonPeriodRange,
  lastDayOfMonth,
  periodIncludesToday,
  previousOverviewOsPeriod,
  weekdayNameOf,
  type OverviewOsCoverage,
  type OverviewOsFilters,
  type OverviewPreviousPeriod,
} from '../../data/overviewOsFilters'
import { formatDateBr, formatDecimal, formatNumber, formatPercent } from '../../lib/formatters'
import { osStatusKind, type OsStatusKind } from './osStatusKind'

/**
 * Modelo analítico da Visão Geral de OS.
 *
 * A regra nasceu em 18/09/2026 numa página candidata ("Visão Geral 2"), a
 * partir da medição em produção, e em 21/09/2026 o Mário aprovou a troca: a
 * Visão Geral passou a ser ela. O que este módulo congela:
 *
 * - as OS de INFRAESTRUTURA têm outro ciclo: são encerradas à mão ou expiram
 *   em lote, e só uma em quatro chega a "concluída". Misturá-las derrubava a
 *   Taxa de Conclusão (69,6% contra 79,0% em setembro) e chegava a inverter o
 *   sentido da comparação com o período anterior. As duas taxas são
 *   calculadas sobre as OS DE CLIENTE, e a infraestrutura ganha leitura
 *   própria no destino das OS;
 * - o destino de cada OS do período é lido em quatro saídas (concluída,
 *   improdutiva, não executada, em aberto), por grupo, no lugar da lista de
 *   treze status. Encerrada e Expirada viram "não executada" porque as duas
 *   significam visita que não aconteceu; os status continuam abertos no
 *   tooltip do gráfico;
 * - Total e Concluídas seguem contando TODAS as OS, como sempre, com uma
 *   linha de detalhe dizendo quanto é de cliente e quanto é de
 *   infraestrutura. Nenhum número da página esconde a infraestrutura.
 *
 * Os gráficos de composição continuam saindo de `overviewOsAggregates`, os
 * mesmos agregados de antes, calculados pelo provedor da página: este módulo
 * não recalcula nada que já existe.
 */

export type OsOutcomeKey = 'completed' | 'unproductive' | 'notExecuted' | 'open' | 'unknown'

/** Saídas de uma OS, na ordem em que a página as apresenta. */
export const OS_OUTCOMES = [
  { key: 'completed', label: 'Concluída' },
  { key: 'unproductive', label: 'Improdutiva' },
  { key: 'notExecuted', label: 'Não executada' },
  { key: 'open', label: 'Em aberto' },
  { key: 'unknown', label: 'Sem classificação' },
] as const satisfies readonly { key: OsOutcomeKey; label: string }[]

const OUTCOME_BY_KIND: Readonly<Record<OsStatusKind, OsOutcomeKey>> = {
  completed: 'completed',
  unproductive: 'unproductive',
  'not-executed': 'notExecuted',
  'in-field': 'open',
  'to-do': 'open',
  unknown: 'unknown',
}

/** Saída de uma OS pela chave de status do SGI, nunca pelo rótulo. */
export function outcomeOf(record: Pick<OverviewOsRecord, 'statusKey'>): OsOutcomeKey {
  return OUTCOME_BY_KIND[osStatusKind(record.statusKey)]
}

export type OsGroupKey = 'customer' | 'infrastructure'

/** Os dois grupos de OS, na ordem em que o gráfico de destino os desenha. */
export const OS_GROUPS = [
  { key: 'customer', label: 'OS de cliente' },
  { key: 'infrastructure', label: 'Infraestrutura' },
] as const satisfies readonly { key: OsGroupKey; label: string }[]

/**
 * Rótulo do tipo de OS que identifica a infraestrutura, como o serviço o
 * traduz (`infra` no SGI). Todo outro tipo é OS de cliente: instalação,
 * câmeras, mudança de endereço, manutenção, retirada e auditoria acontecem no
 * endereço de um cliente.
 */
export const INFRASTRUCTURE_SERVICE_TYPE = 'Infraestrutura'

export function groupOf(record: Pick<OverviewOsRecord, 'serviceType'>): OsGroupKey {
  return record.serviceType === INFRASTRUCTURE_SERVICE_TYPE ? 'infrastructure' : 'customer'
}

export type OsOutcomeGroup = {
  readonly key: OsGroupKey
  readonly label: string
  readonly total: number
  readonly counts: Readonly<Record<OsOutcomeKey, number>>
  /** Status dentro de cada saída, do mais frequente ao menos: é o que o tooltip abre. */
  readonly statuses: Readonly<Record<OsOutcomeKey, readonly Pair[]>>
}

const byPtBr = (a: string, b: string) => a.localeCompare(b, 'pt-BR')

function emptyCounts(): Record<OsOutcomeKey, number> {
  return { completed: 0, unproductive: 0, notExecuted: 0, open: 0, unknown: 0 }
}

function sortedPairs(counts: Map<string, number>): Pair[] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || byPtBr(a[0], b[0]))
}

/**
 * Destino das OS recebidas, por grupo. Os dois grupos saem SEMPRE, mesmo com
 * zero OS: quem desenha decide o que fazer com um grupo vazio, e o total da
 * página continua fechando com a soma dos dois.
 */
export function buildOsOutcome(rows: readonly OverviewOsRecord[]): OsOutcomeGroup[] {
  const accumulators = OS_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    total: 0,
    counts: emptyCounts(),
    statuses: {
      completed: new Map<string, number>(),
      unproductive: new Map<string, number>(),
      notExecuted: new Map<string, number>(),
      open: new Map<string, number>(),
      unknown: new Map<string, number>(),
    } satisfies Record<OsOutcomeKey, Map<string, number>>,
  }))

  for (const row of rows) {
    const group = groupOf(row)
    const accumulator = accumulators.find((item) => item.key === group)!
    const outcome = outcomeOf(row)
    accumulator.total += 1
    accumulator.counts[outcome] += 1
    accumulator.statuses[outcome].set(row.status, (accumulator.statuses[outcome].get(row.status) ?? 0) + 1)
  }

  return accumulators.map((accumulator) => ({
    key: accumulator.key,
    label: accumulator.label,
    total: accumulator.total,
    counts: accumulator.counts,
    statuses: {
      completed: sortedPairs(accumulator.statuses.completed),
      unproductive: sortedPairs(accumulator.statuses.unproductive),
      notExecuted: sortedPairs(accumulator.statuses.notExecuted),
      open: sortedPairs(accumulator.statuses.open),
      unknown: sortedPairs(accumulator.statuses.unknown),
    },
  }))
}

/**
 * Contagens que sustentam os cards, num grupo de OS: o total e cada uma das
 * cinco saídas. As três últimas entraram em 23/09/2026 para a leitura
 * gerencial dizer, com os números do recorte, para onde foi o que não
 * concluiu; `total` é sempre a soma das cinco.
 */
export type OsGroupTotals = {
  readonly total: number
  readonly completed: number
  readonly unproductive: number
  /** Encerrada, expirada ou cancelada: a visita não aconteceu. */
  readonly notExecuted: number
  /** Em campo ou a fazer: ainda sem desfecho. */
  readonly open: number
  /** Chave de status fora do de-para: contada, nunca escondida. */
  readonly unknown: number
}

export type OsTotals = {
  readonly all: OsGroupTotals
  readonly customer: OsGroupTotals
  readonly infrastructure: OsGroupTotals
}

function emptyGroupTotals(): Record<keyof OsGroupTotals, number> {
  return { total: 0, completed: 0, unproductive: 0, notExecuted: 0, open: 0, unknown: 0 }
}

function totalsOf(rows: readonly OverviewOsRecord[]): OsTotals {
  const all = emptyGroupTotals()
  const customer = emptyGroupTotals()
  const infrastructure = emptyGroupTotals()

  for (const row of rows) {
    const outcome = outcomeOf(row)
    const group = groupOf(row) === 'customer' ? customer : infrastructure
    all.total += 1
    group.total += 1
    all[outcome] += 1
    group[outcome] += 1
  }

  return { all, customer, infrastructure }
}

/**
 * Sobre que OS as duas taxas foram calculadas.
 *
 * `customer` é a regra. `all` só acontece quando o recorte não tem NENHUMA OS
 * de cliente, que é o caso de filtrar Tipo de OS por Infraestrutura: aí as
 * taxas valem para o que está na tela, e a linha de detalhe diz isso, em vez
 * de dois cards zerados sem explicação.
 */
export type RateBase = 'customer' | 'all'

/**
 * Com o que os quatro cards comparam, nas duas formas que o card usa: a
 * curta (`vs. agosto até o dia 21`) e a por extenso da leitura acessível.
 * Decisão do Mário em 22/09/2026: "vs. período anterior" deixava no ar a
 * pergunta "anterior a quê?", que é a primeira de uma diretoria.
 */
export type KpiComparison = {
  readonly label: string
  readonly long: string
}

export type OverviewKpis = {
  readonly total: string
  readonly completed: string
  readonly completionRate: string
  readonly unproductiveRate: string
  readonly totalDelta: KpiDelta
  readonly completedDelta: KpiDelta
  readonly completionDelta: KpiDelta
  readonly unproductiveDelta: KpiDelta
  /** Linha de detalhe de cada card, com os números que sustentam o valor. */
  readonly details: {
    readonly total: string
    readonly completed: string
    readonly completionRate: string
    readonly unproductiveRate: string
  }
  readonly rateBase: RateBase
  readonly totals: OsTotals
  /** Null quando não há comparação disponível: aí o card já diz o motivo. */
  readonly comparison: KpiComparison | null
}

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
]

/** `2026-09-14` → `14/09`: dia e mês bastam dentro de um card. */
function dayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function monthNameOf(iso: string): string {
  return MONTH_NAMES[Number(iso.slice(5, 7)) - 1]
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1)
}

/**
 * Nome do período escolhido, para o título da faixa "Resultado do período"
 * (pedido do Mário em 23/09/2026): o bloco dos cards vai para o projetor e
 * para o print sem a faixa de filtros, e "no período" não dizia qual.
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
    const month = `${capitalize(monthNameOf(dateFrom))} de ${dateFrom.slice(0, 4)}`

    return dateTo === lastDayOfMonth(dateFrom)
      ? month
      : `${month}, até o dia ${Number(dateTo.slice(8, 10))}`
  }
  if (kind === 'week') return `Semana de ${dayMonth(dateFrom)} a ${formatDateBr(dateTo)}`
  if (kind === 'day') return `${capitalize(weekdayNameOf(dateTo))}, ${formatDateBr(dateTo)}`

  return `${formatDateBr(dateFrom)} a ${formatDateBr(dateTo)}`
}

/**
 * Texto da comparação pela natureza da janela anterior, o mesmo critério que
 * a montou (`comparisonPeriodRange`):
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
 */
function comparisonOf(previous: OverviewPreviousPeriod, filters: OverviewOsFilters): KpiComparison {
  const { dateFrom, dateTo } = previous.range
  let text: string

  if (previous.kind === 'month') {
    const month = MONTH_NAMES[Number(dateFrom.slice(5, 7)) - 1]
    text = dateTo === lastDayOfMonth(dateFrom) ? month : `${month} até o dia ${Number(dateTo.slice(8, 10))}`
    if (dateFrom.slice(0, 4) !== filters.dateFrom.slice(0, 4)) text += ` de ${dateFrom.slice(0, 4)}`
  } else if (previous.kind === 'week') {
    const lastDay = weekdayNameOf(dateTo, 'short')
    text = lastDay === 'domingo' ? 'semana anterior' : `semana anterior até ${lastDay}`
  } else if (previous.kind === 'day') {
    text = `${weekdayNameOf(dateTo, 'short')} ${dayMonth(dateTo)}`
  } else {
    text = `${dayMonth(dateFrom)} a ${dayMonth(dateTo)}`
  }

  return { label: `vs. ${text}`, long: `versus ${text}` }
}

function rate(part: number, whole: number): number {
  return part / (whole || 1)
}

/**
 * Comparação de uma TAXA em pontos, e não em variação relativa (decisão do
 * Mário em 23/09/2026). Com o número principal já em percentual, "82,3%"
 * ao lado de "▼ 2,3%" se lê como "caiu para 80%", e a taxa saiu de 84,2%:
 * a queda real é de 1,9 pontos. Improdutividade de 11,8% para 11,0% mostrava
 * "▼ 6,4%" e caiu 0,8 ponto. O volume (Total, Concluídas) segue em
 * percentual, que é a leitura natural de quantidade.
 *
 * A unidade é "p.p." (pontos percentuais), decisão do Mário em 23/09/2026: é
 * o termo da diretoria, e o texto para leitor de tela sai por extenso no
 * card. Nunca junto do "%", que diria duas unidades ao mesmo tempo. Sinal e
 * favorável seguem a mesma
 * regra de `delta`. A diferença sai das taxas exatas, então pode diferir em
 * uma casa da subtração feita à mão com os números arredondados da tela.
 */
function pointsDelta(current: number, previous: number, higherIsGood: boolean): KpiDelta {
  const points = (current - previous) * 100
  const shown = formatDecimal(Math.abs(points), 1)

  return {
    text: `${points >= 0 ? '+' : '-'}${shown} p.p.`,
    positive: higherIsGood ? points >= 0 : points < 0,
    available: true,
  }
}

function rateDetail(part: number, base: OsGroupTotals, rateBase: RateBase): string {
  if (base.total === 0) return 'Sem OS no recorte'
  const scope = rateBase === 'customer' ? 'OS de cliente' : 'OS, sem OS de cliente no recorte'

  return `${formatNumber(part)} de ${formatNumber(base.total)} ${scope}`
}

export function buildOverviewKpis(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
  coverage?: OverviewOsCoverage,
): OverviewKpis {
  const rows = applyOverviewOsFilters(records, filters)
  const totals = totalsOf(rows)
  const rateBase: RateBase = totals.customer.total > 0 ? 'customer' : 'all'
  const base = rateBase === 'customer' ? totals.customer : totals.all

  // Mesma janela anterior e mesma cobertura dos agregados: comparar com base
  // parcial ou com janela vazia continua não gerando percentual nenhum.
  const previous = previousOverviewOsPeriod(filters, coverage)
  let comparison: KpiComparison | null = null
  let deltas: Pick<
    OverviewKpis,
    'totalDelta' | 'completedDelta' | 'completionDelta' | 'unproductiveDelta'
  >

  if (previous === null) {
    const unavailable = unavailableDelta('no-data')
    deltas = {
      totalDelta: unavailable,
      completedDelta: unavailable,
      completionDelta: unavailable,
      unproductiveDelta: unavailable,
    }
  } else if (previous.coverage === 'incomplete') {
    const unavailable = unavailableDelta('incomplete')
    deltas = {
      totalDelta: unavailable,
      completedDelta: unavailable,
      completionDelta: unavailable,
      unproductiveDelta: unavailable,
    }
  } else {
    comparison = comparisonOf(previous, filters)
    const previousTotals = totalsOf(applyOverviewOsPreviousFilters(records, filters, previous.range))
    // A janela anterior é lida com a MESMA base das taxas de hoje: taxa de
    // cliente compara com taxa de cliente. Uma janela sem OS na base não gera
    // divisão nem percentual.
    const previousBase = rateBase === 'customer' ? previousTotals.customer : previousTotals.all

    deltas = {
      totalDelta:
        previousTotals.all.total === 0
          ? unavailableDelta('no-data')
          : kpiDelta(totals.all.total, previousTotals.all.total, true),
      completedDelta:
        previousTotals.all.total === 0
          ? unavailableDelta('no-data')
          : kpiDelta(totals.all.completed, previousTotals.all.completed, true),
      completionDelta:
        previousBase.total === 0
          ? unavailableDelta('no-data')
          : pointsDelta(
              rate(base.completed, base.total),
              rate(previousBase.completed, previousBase.total),
              true,
            ),
      unproductiveDelta:
        previousBase.total === 0
          ? unavailableDelta('no-data')
          : pointsDelta(
              rate(base.unproductive, base.total),
              rate(previousBase.unproductive, previousBase.total),
              false,
            ),
    }
  }

  return {
    total: formatNumber(totals.all.total),
    completed: formatNumber(totals.all.completed),
    completionRate: formatPercent(rate(base.completed, base.total)),
    unproductiveRate: formatPercent(rate(base.unproductive, base.total)),
    ...deltas,
    details: {
      total: `${formatNumber(totals.customer.total)} de cliente · ${formatNumber(totals.infrastructure.total)} de infraestrutura`,
      completed: `${formatNumber(totals.customer.completed)} de cliente · ${formatNumber(totals.infrastructure.completed)} de infraestrutura`,
      completionRate: rateDetail(base.completed, base, rateBase),
      unproductiveRate: rateDetail(base.unproductive, base, rateBase),
    },
    rateBase,
    totals,
    comparison,
  }
}

/**
 * Leitura gerencial de um card: o título e a explicação que aparecem quando
 * ele abre. Trechos entre chaves `{...}` ganham destaque no card.
 */
export type OverviewReading = {
  readonly title: string
  readonly text: string
}

export type OverviewReadings = {
  readonly total: OverviewReading
  readonly completed: OverviewReading
  readonly completionRate: OverviewReading
  readonly unproductiveRate: OverviewReading
}

/** Sem OS não há leitura: os quatro cards dizem a mesma coisa, e o que fazer. */
const EMPTY_READING: OverviewReading = {
  title: 'Nenhuma OS no recorte.',
  text: 'Sem OS não há o que ler: amplie o período ou tire um filtro da faixa.',
}

/** Como a leitura chama a improdutiva em que o SGI não registrou motivo. */
const REASON_MISSING = 'sem motivo registrado'

/** `1 improdutiva`, `131 improdutivas`: o número formatado com a palavra certa. */
function countOf(value: number, singular: string, plural: string): string {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`
}

/**
 * Motivo mais frequente entre as improdutivas do recorte, com a fatia dele.
 *
 * Null quando não há improdutiva ou quando NENHUMA delas tem motivo
 * preenchido: aí o título não fala de motivo. É o que cobre a base local de
 * estudo, que não traz o campo, e um serviço que ainda não o mande: pela API
 * o campo ausente chega como nulo (`optionalText` do adaptador), então "sem
 * campo" e "todas em branco" não se distinguem, e afirmar "100% sem motivo
 * registrado" seria falso no primeiro caso (apontado pelo revisor de dados em
 * 23/09/2026). Havendo ao menos um motivo, o nulo ou em branco conta como
 * "sem motivo registrado", a mesma leitura da página de Técnicos: a visita
 * falhou e alguém precisa saber que o registro ficou vazio.
 *
 * O motivo entra no meio de uma frase ("43,5% por cliente ausente"), por
 * isso vai todo em minúsculas: o catálogo pode vir em "Cliente Ausente", e
 * baixar só a primeira letra deixaria "por cliente Ausente". O gráfico de
 * motivos mostra o rótulo como ele vem.
 */
function topReasonOf(rows: readonly OverviewOsRecord[]): { phrase: string; share: number } | null {
  const unproductive = rows.filter((row) => outcomeOf(row) === 'unproductive')
  if (!unproductive.some((row) => (row.unproductiveReason ?? '').trim() !== '')) return null

  const counts = new Map<string, number>()
  for (const row of unproductive) {
    const reason = row.unproductiveReason?.trim() || REASON_MISSING
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  const [reason, count] = sortedPairs(counts)[0]

  return {
    phrase: reason === REASON_MISSING ? reason : `por ${reason.toLocaleLowerCase('pt-BR')}`,
    share: count / unproductive.length,
  }
}

/**
 * Leitura gerencial dos quatro cards, calculada sobre o recorte (decisão do
 * Mário em 23/09/2026, no lugar das frases fixas de antes): o título diz o
 * que aconteceu com os números da tela, e o texto diz o que eles significam.
 * A definição do indicador fica na frente do card e não se repete aqui.
 *
 * O que cada leitura sustenta, medido no SGI de produção:
 *
 * - Total: visita que falha gera OUTRA OS para o mesmo cliente (90% das
 *   improdutivas de instalação ganham OS nova em até 7 dias), então
 *   improdutividade infla o total. Nada acumula: o SGI expira à meia-noite a
 *   OS que ninguém iniciou. A média por dia com agenda é a medida de tamanho
 *   que a página não tinha;
 * - Concluídas: o volume acompanha a agenda, e bom ou ruim é a taxa;
 * - Taxa de Conclusão: o que falta para 100% tem nome (improdutiva, não
 *   executada, em aberto), e o card diz quanto foi cada um. Em aberto com
 *   hoje no recorte é o efeito "hoje parcial": a taxa sobe até a noite;
 * - Taxa Improdutividade: o motivo mais comum, quando a fonte o traz.
 *
 * `rows` são as OS do recorte, as mesmas de `kpis`: os dias com agenda e o
 * motivo saem delas.
 */
export function buildOverviewReadings(
  rows: readonly OverviewOsRecord[],
  kpis: OverviewKpis,
  filters: Pick<OverviewOsFilters, 'dateTo'>,
  today?: string,
): OverviewReadings {
  const { all, customer, infrastructure } = kpis.totals
  if (all.total === 0) {
    return {
      total: EMPTY_READING,
      completed: EMPTY_READING,
      completionRate: EMPTY_READING,
      unproductiveRate: EMPTY_READING,
    }
  }

  const customerRates = kpis.rateBase === 'customer'
  const base = customerRates ? customer : all
  const noun = customerRates ? 'OS de cliente' : 'OS'
  const days = new Set(rows.map((row) => row.dateISO)).size

  // "1.248 OS marcadas, 65,7 por dia com agenda" (19 dias com OS, e não os
  // 21 do período); num dia só, "no dia". Uma casa decimal, como o card
  // "Concluídas por dia" da página de Técnicos: em recorte pequeno a média
  // de entregues fica abaixo de 1, e o inteiro escrevia "0 por dia".
  const volumeTitle = (value: number, singular: string, plural: string) =>
    days <= 1
      ? `${countOf(value, singular, plural)} no dia.`
      : `${countOf(value, singular, plural)}, ${formatDecimal(value / days, 1)} por dia com agenda.`

  // O número de improdutivas é o da base das taxas, o MESMO que o card Taxa
  // Improdutividade mostra ao lado: "134" aqui e "131" lá parecia conta que
  // não fecha, e a medição que sustenta a frase (improdutiva gera OS nova)
  // é de OS de cliente. Só infraestrutura no recorte: a frase perde o "mesmo
  // cliente", porque OS de rede não tem cliente no endereço.
  const sameCustomer = customerRates ? ' para o mesmo cliente' : ''
  const total: OverviewReading = {
    title: volumeTitle(all.total, 'OS marcada', 'OS marcadas'),
    text:
      base.unproductive === 0
        ? `Visita que falha gera {outra OS}${sameCustomer} e infla o total com retrabalho. Neste recorte não houve improdutiva${customerRates ? ' de cliente' : ''}.`
        : `Visita que falha gera {outra OS}${sameCustomer}: ${
            base.unproductive === 1
              ? 'a {1 improdutiva} do recorte tende'
              : `as {${formatNumber(base.unproductive)} improdutivas} do recorte tendem`
          } a voltar como OS nova e inflar o total.`,
  }

  // Três linhas no card: o "por quê" da infraestrutura fora das taxas mora na
  // leitura da Taxa de Conclusão (expira sem técnico ou é encerrada à mão).
  let completedText: string
  if (customer.total === 0) {
    completedText =
      'Só há infraestrutura no recorte: quase sempre expira ou é encerrada à mão, e as taxas ao lado valem para ela.'
  } else if (infrastructure.total === 0) {
    completedText =
      'Acompanha a agenda; bom ou ruim é a {Taxa de Conclusão}. Não há OS de infraestrutura neste recorte.'
  } else {
    completedText = `Acompanha a agenda; bom ou ruim é a {Taxa de Conclusão}. Infraestrutura conta aqui, {${formatNumber(infrastructure.completed)} de ${formatNumber(infrastructure.total)}} concluídas, não nas taxas: outro ciclo.`
  }
  const completed: OverviewReading = {
    title:
      all.completed === 0
        ? 'Nenhuma OS entregue no recorte.'
        : volumeTitle(all.completed, 'OS entregue', 'OS entregues'),
    text: completedText,
  }

  const missing = base.total - base.completed
  const parts = [
    base.unproductive > 0 ? countOf(base.unproductive, 'improdutiva', 'improdutivas') : null,
    base.notExecuted > 0 ? countOf(base.notExecuted, 'não executada', 'não executadas') : null,
    base.open > 0 ? `${formatNumber(base.open)} em aberto` : null,
    base.unknown > 0 ? `${formatNumber(base.unknown)} sem classificação` : null,
  ].filter((part) => part !== null)
  const DEFINITIONS = '{Improdutiva}: o técnico foi e não conseguiu. {Não executada}: ninguém foi'
  let completionText: string
  if (missing === 0) {
    completionText = `${DEFINITIONS}. Neste recorte não houve nenhuma das duas.`
  } else if (base.open > 0 && periodIncludesToday(filters, today)) {
    completionText = `${DEFINITIONS}. {Em aberto} ainda conclui, e a taxa sobe até o fim de hoje.`
  } else if (base.open > 0) {
    completionText = `${DEFINITIONS}. {Em aberto} ficou de dia passado, sem desfecho no aplicativo.`
  } else {
    completionText = `${DEFINITIONS}, a OS expirou sem técnico ou foi encerrada à mão.`
  }
  const completionRate: OverviewReading = {
    title:
      missing === 0
        ? base.total === 1
          ? `A única ${noun} foi entregue.`
          : `Todas as ${formatNumber(base.total)} ${noun} foram entregues.`
        : `${formatNumber(missing)} não ${missing === 1 ? 'concluiu' : 'concluíram'}: ${parts.join(', ')}.`,
    text: completionText,
  }

  const reason = topReasonOf(rows.filter((row) => !customerRates || groupOf(row) === 'customer'))
  let unproductiveTitle: string
  if (base.unproductive === 0) {
    unproductiveTitle =
      base.total === 1
        ? `Nenhuma visita improdutiva na única ${noun}.`
        : `Nenhuma visita improdutiva nas ${formatNumber(base.total)} ${noun}.`
  } else if (reason === null) {
    unproductiveTitle = `${countOf(base.unproductive, 'visita improdutiva', 'visitas improdutivas')}: ${base.unproductive === 1 ? 'ela custa' : 'cada uma custa'} duas vezes.`
  } else {
    unproductiveTitle = `${countOf(base.unproductive, 'improdutiva', 'improdutivas')}, ${formatPercent(reason.share)} ${reason.phrase}.`
  }
  const unproductiveRate: OverviewReading = {
    title: unproductiveTitle,
    text: 'Custa deslocamento e tempo do técnico sem entrega, e o cliente espera {outra visita}: na instalação, é sinal ligado mais tarde.',
  }

  return { total, completed, completionRate, unproductiveRate }
}
