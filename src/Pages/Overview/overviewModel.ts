import type { KpiDelta, Pair } from '../../data/dashboardTypes'
import { delta as kpiDelta, unavailableDelta } from '../../data/overviewOsAggregates'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import {
  OVERVIEW_OS_ALL,
  OVERVIEW_OS_NO_TEAM,
  applyOverviewOsFilters,
  applyOverviewOsPreviousFilters,
  comparisonText,
  periodIncludesToday,
  previousOverviewOsPeriod,
  type OverviewOsCoverage,
  type OverviewOsFilters,
} from '../../data/overviewOsFilters'
import { formatDecimal, formatNumber, formatPercent } from '../../lib/formatters'
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
 * Sobre que OS as duas taxas foram calculadas. Decisão delegada pelo Mário
 * e tomada em 23/09/2026, depois de duas regras testadas no mesmo dia:
 *
 * - `customer` é a regra da página: infraestrutura tem outro ciclo e fica
 *   fora das taxas;
 * - `infrastructure` só em dois casos. Sem NENHUMA OS de cliente no recorte
 *   (Tipo de OS = Infraestrutura, categoria de rede), a taxa vale para o que
 *   está na tela. Ou com uma EQUIPE ou um TÉCNICO filtrado cuja frente de
 *   trabalho é a infraestrutura, isto é, com mais OS de infraestrutura do
 *   que de cliente no recorte: a mesma leitura de frente da página de
 *   Técnicos (o serviço que a pessoa mais executou). Empate fica com o
 *   cliente.
 *
 * As duas regras anteriores caíam num caso real cada. "Cliente sempre que
 * houver uma" calculava a equipe Infra sobre 3 OS de cliente num recorte de
 * 90 (66,7%). "O grupo com mais OS" levava "Sem equipe" para a
 * infraestrutura (143 contra 124) e escondia as OS de cliente sem dono, que
 * são o motivo de a opção existir. Um corte por participação (10% de
 * cliente) falharia no histórico: a equipe Infra teve 47% de cliente em
 * junho e 16% em julho, e a base trocaria de mês para mês.
 *
 * Frente só existe para gente: "Sem equipe" não é uma equipe, e cidade,
 * categoria e período não têm frente. Nesses recortes a base é o cliente,
 * mesmo com a infraestrutura em maioria (Jarinu em setembro: 9 de 12), e a
 * leitura da infraestrutura fica no Destino das OS, logo abaixo.
 */
export type RateBase = 'customer' | 'infrastructure'

/** Base das taxas, pela regra de `RateBase`. */
export function rateBaseOf(totals: OsTotals, filters: OverviewOsFilters): RateBase {
  if (totals.customer.total === 0) {
    return totals.infrastructure.total > 0 ? 'infrastructure' : 'customer'
  }
  if (filtersTeamOrTechnician(filters) && totals.infrastructure.total > totals.customer.total) {
    return 'infrastructure'
  }

  return 'customer'
}

/**
 * Se as duas taxas têm leitura no recorte.
 *
 * - `ok`: têm;
 * - `status`: o filtro de Status deixa um status só, e a taxa seria 0% ou
 *   100% por definição, não por resultado. O card diz "Não se aplica"
 *   (decisão do Mário em 23/09/2026); Total e Concluídas seguem filtrados;
 * - `empty`: não há OS na base das taxas. O card diz "Sem OS", e não "0,0%",
 *   que se leria como resultado péssimo.
 */
export type RateState = 'ok' | 'status' | 'empty'

/** Valor das taxas quando elas não têm leitura. */
export const RATE_NOT_APPLICABLE = 'Não se aplica'
export const RATE_NO_OS = 'Sem OS'

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
  readonly rateState: RateState
  readonly totals: OsTotals
  /** Null quando não há comparação disponível: aí o card já diz o motivo. */
  readonly comparison: KpiComparison | null
}

// O nome do período da faixa "Resultado do período" mora com a régua de
// comparação desde 25/09/2026, quando a Visão Geral Comercial passou a usar
// a mesma faixa. Quem importava daqui segue funcionando.
export { periodTitle } from '../../data/overviewOsFilters'

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

/** Como a base das taxas é chamada na tela. */
function baseNoun(rateBase: RateBase): string {
  return rateBase === 'customer' ? 'OS de cliente' : 'OS de infraestrutura'
}

/**
 * Equipe ou Técnico filtrado, fora "Sem equipe". Decide duas coisas:
 *
 * - o recorte tem uma FRENTE de trabalho, que pode levar as taxas para a
 *   infraestrutura (ver `RateBase`);
 * - o recorte deixa de fora as OS SEM TÉCNICO, que não têm equipe: 58 das
 *   76 não executadas de cliente em setembro/2026. Toda equipe parece acima
 *   da empresa por isso (86,9% somadas, contra 82,3%), e o detalhe avisa
 *   (decisão do Mário em 23/09/2026).
 *
 * "Sem equipe" é justamente onde essas OS estão: nem frente, nem aviso.
 */
function filtersTeamOrTechnician(filters: OverviewOsFilters): boolean {
  const team = filters.team !== OVERVIEW_OS_ALL.team && filters.team !== OVERVIEW_OS_NO_TEAM

  return team || filters.technicianId !== OVERVIEW_OS_ALL.technicianId
}

function rateDetail(
  part: number,
  base: OsGroupTotals,
  rateBase: RateBase,
  rateState: RateState,
  filters: OverviewOsFilters,
): string {
  if (rateState === 'empty') return 'Sem OS no recorte'
  if (rateState === 'status') return 'Com um status só, a taxa seria 0% ou 100%'
  const detail = `${formatNumber(part)} de ${formatNumber(base.total)} ${baseNoun(rateBase)}`

  return filtersTeamOrTechnician(filters) ? `${detail}, sem as OS sem técnico` : detail
}

/** Comparação de taxa quando a taxa não tem leitura. */
function rateUnavailableDelta(rateState: Exclude<RateState, 'ok'>): KpiDelta {
  return rateState === 'status'
    ? {
        text: 'N/A',
        positive: false,
        available: false,
        unavailableLabel: 'Com Status filtrado',
        unavailableAccessibleLabel: 'comparação não se aplica com o filtro de Status',
      }
    : {
        text: 'N/A',
        positive: false,
        available: false,
        // O valor já diz "Sem OS" e o detalhe "Sem OS no recorte": a
        // comparação não repete pela terceira vez.
        unavailableLabel: 'Sem comparação',
        unavailableAccessibleLabel: 'sem OS no recorte para comparar',
      }
}

export function buildOverviewKpis(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
  coverage?: OverviewOsCoverage,
): OverviewKpis {
  const rows = applyOverviewOsFilters(records, filters)
  const totals = totalsOf(rows)
  const rateBase = rateBaseOf(totals, filters)
  const base = totals[rateBase]
  const rateState: RateState =
    base.total === 0 ? 'empty' : filters.status !== OVERVIEW_OS_ALL.status ? 'status' : 'ok'
  const rateValue = (value: number) =>
    rateState === 'ok' ? formatPercent(value) : rateState === 'status' ? RATE_NOT_APPLICABLE : RATE_NO_OS

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
    // Só as duas formas que o card de OS usa; `within` é da Comercial.
    const { label, long } = comparisonText(previous, filters.dateFrom)
    comparison = { label, long }
    const previousTotals = totalsOf(applyOverviewOsPreviousFilters(records, filters, previous.range))
    // A janela anterior é lida com a MESMA base das taxas de hoje: taxa de
    // cliente compara com taxa de cliente. Uma janela sem OS na base não gera
    // divisão nem percentual.
    const previousBase = previousTotals[rateBase]

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
    completionRate: rateValue(rate(base.completed, base.total)),
    unproductiveRate: rateValue(rate(base.unproductive, base.total)),
    ...deltas,
    // Taxa sem leitura não compara: "Não se aplica" ao lado de "▼ 82,3 p.p."
    // seria a pior combinação possível.
    ...(rateState === 'ok'
      ? {}
      : {
          completionDelta: rateUnavailableDelta(rateState),
          unproductiveDelta: rateUnavailableDelta(rateState),
        }),
    details: {
      total: `${formatNumber(totals.customer.total)} de cliente · ${formatNumber(totals.infrastructure.total)} de infraestrutura`,
      completed: `${formatNumber(totals.customer.completed)} de cliente · ${formatNumber(totals.infrastructure.completed)} de infraestrutura`,
      completionRate: rateDetail(base.completed, base, rateBase, rateState, filters),
      unproductiveRate: rateDetail(base.unproductive, base, rateBase, rateState, filters),
    },
    rateBase,
    rateState,
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

/** Leitura das duas taxas com o filtro de Status: elas não se aplicam. */
const STATUS_FILTERED_READING: OverviewReading = {
  title: 'A taxa não se aplica com o filtro de Status.',
  text: 'Com um status só, ela seria 0% ou 100% por definição, não por resultado. Tire o filtro de {Status} para ler o desempenho.',
}

/** Texto da leitura de Total e Concluídas com o filtro de Status. */
const STATUS_FILTERED_VOLUME_TEXT =
  'O filtro de {Status} deixa na tela só as OS do status escolhido: a contagem é delas, não da agenda inteira. Tire o filtro para ler o período.'

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
  const base = kpis.totals[kpis.rateBase]
  const noun = baseNoun(kpis.rateBase)
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
  // é de OS de cliente. Base de infraestrutura: a frase perde o "mesmo
  // cliente", porque OS de rede não tem cliente no endereço.
  const sameCustomer = customerRates ? ' para o mesmo cliente' : ''
  const total: OverviewReading = {
    title: volumeTitle(all.total, 'OS marcada', 'OS marcadas'),
    text:
      base.unproductive === 0
        ? `Visita que falha gera {outra OS}${sameCustomer} e infla o total com retrabalho. Neste recorte não houve improdutiva${customerRates ? ' de cliente' : ' de infraestrutura'}.`
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
  } else if (!customerRates) {
    // Equipe ou técnico de infraestrutura, com algumas OS de cliente junto:
    // é o caso da equipe Infra. As taxas são da frente, e o cliente fica fora.
    completedText = `Equipe ou técnico de infraestrutura: as taxas ao lado valem para ela, e ${
      customer.total === 1 ? 'a {1 OS de cliente} fica fora' : `as {${formatNumber(customer.total)} OS de cliente} ficam fora`
    } delas.`
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

  const reason = topReasonOf(rows.filter((row) => groupOf(row) === kpis.rateBase))
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

  // Status filtrado: as duas taxas mostram "Não se aplica", e a leitura diz
  // por quê em vez de narrar um 100% que é definição, não resultado.
  if (kpis.rateState === 'status') {
    // Os títulos continuam: as contagens são verdadeiras. O texto não pode
    // narrar o recorte como a operação inteira: com Status = Concluída ele
    // dizia "{23 de 23}" da infraestrutura e "não houve improdutiva", o 100%
    // por definição que a regra quis tirar das taxas (revisor de dados,
    // 23/09/2026).
    return {
      total: { title: total.title, text: STATUS_FILTERED_VOLUME_TEXT },
      completed: { title: completed.title, text: STATUS_FILTERED_VOLUME_TEXT },
      completionRate: STATUS_FILTERED_READING,
      unproductiveRate: STATUS_FILTERED_READING,
    }
  }

  return { total, completed, completionRate, unproductiveRate }
}
