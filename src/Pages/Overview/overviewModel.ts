import type { KpiDelta, Pair } from '../../data/dashboardTypes'
import {
  delta as kpiDelta,
  unavailableDelta,
  type ServiceTypeSlice,
} from '../../data/overviewOsAggregates'
import {
  comparisonText,
  periodIncludesToday,
  type OverviewComparisonKind,
  type OverviewOsFilters,
} from '../../data/overviewOsFilters'
import { formatDecimal, formatNumber, formatPercent } from '../../lib/formatters'
import type { ReasonSummary } from './overviewReasonsChartOptions'

/**
 * Modelo analítico da Visão Geral de OS.
 *
 * A regra nasceu em 18/09/2026 numa página candidata ("Visão Geral 2"), a
 * partir da medição em produção, e em 21/09/2026 o Mário aprovou a troca: a
 * Visão Geral passou a ser ela. O que ela congela:
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
 * Desde 01/10/2026 (decisão do Mário: a regra num lugar só) as CONTAS
 * moram no serviço de BI (`app/services/bi/os_period.py`): a saída e o grupo
 * de cada OS, os totais, a base das taxas, a janela de comparação e o motivo
 * mais frequente chegam prontos em `OverviewOsPeriodFacts`. Este módulo
 * escreve os cards e a leitura gerencial a partir desses números, e nada
 * mais: mudar uma regra é mudar o serviço.
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

export type OsGroupKey = 'customer' | 'infrastructure'

/** Os dois grupos de OS, na ordem em que o gráfico de destino os desenha. */
export const OS_GROUPS = [
  { key: 'customer', label: 'OS de cliente' },
  { key: 'infrastructure', label: 'Infraestrutura' },
] as const satisfies readonly { key: OsGroupKey; label: string }[]

export type OsOutcomeGroup = {
  readonly key: OsGroupKey
  readonly label: string
  readonly total: number
  readonly counts: Readonly<Record<OsOutcomeKey, number>>
  /** Status dentro de cada saída, do mais frequente ao menos: é o que o tooltip abre. */
  readonly statuses: Readonly<Record<OsOutcomeKey, readonly Pair[]>>
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

/**
 * Sobre que OS as duas taxas foram calculadas. A regra (decisão delegada
 * pelo Mário e tomada em 23/09/2026) é do serviço: `customer` por padrão, e
 * `infrastructure` sem nenhuma OS de cliente no recorte, ou com equipe ou
 * técnico filtrado cuja frente é a infraestrutura.
 */
export type RateBase = 'customer' | 'infrastructure'

/**
 * Se as duas taxas têm leitura no recorte.
 *
 * - `ok`: têm;
 * - `status`: o filtro de Status deixa um status só, e a taxa seria 0% ou
 *   100% por definição, não por resultado. O card diz "Não se aplica"
 *   (decisão do Mário em 23/09/2026); Total e Concluídas seguem filtrados.
 *   Com vários status marcados (30/09/2026) a regra é a mesma: a base da
 *   taxa perde os status que ficaram de fora, e o número não se compara com
 *   o do recorte sem filtro;
 * - `empty`: não há OS na base das taxas. O card diz "Sem OS", e não "0,0%",
 *   que se leria como resultado péssimo.
 */
export type RateState = 'ok' | 'status' | 'empty'

/** Valor das taxas quando elas não têm leitura. */
export const RATE_NOT_APPLICABLE = 'Não se aplica'
export const RATE_NO_OS = 'Sem OS'

/** Volume diário: um ponto por dia COM OS, nas posições paralelas que o gráfico lê. */
export type OverviewDaily = {
  readonly x: readonly string[]
  readonly iso: readonly string[]
  readonly total: readonly number[]
  readonly completed: readonly number[]
  readonly unproductive: readonly number[]
  readonly notExecuted: readonly number[]
  readonly open: readonly number[]
  readonly unknown: readonly number[]
}

/**
 * O período como o serviço o devolve (`GET /bi/os/overview/period`): só
 * números, com as regras já aplicadas lá. É tudo o que o "Resultado do
 * período" e a "Composição do período" desenham.
 */
export type OverviewOsPeriodFacts = {
  readonly totals: OsTotals
  readonly rateBase: RateBase
  readonly rateState: RateState
  /**
   * Equipe ou técnico filtrado (fora "Sem equipe"): o recorte deixa de fora
   * as OS SEM TÉCNICO, que não têm equipe (58 das 76 não executadas de
   * cliente em setembro/2026). Toda equipe parece acima da empresa por isso,
   * e o detalhe das taxas avisa (decisão do Mário em 23/09/2026).
   */
  readonly withoutUnassigned: boolean
  /** Janela de comparação; null com recorte inválido. */
  readonly previous: {
    readonly range: { readonly dateFrom: string; readonly dateTo: string }
    readonly kind: OverviewComparisonKind
    readonly coverage: 'complete' | 'incomplete'
    /** Null quando a janela sai da cobertura da base. */
    readonly totals: OsTotals | null
  } | null
  /** Dias com OS no recorte, para a média por dia com agenda. */
  readonly daysWithOs: number
  /**
   * Motivo mais frequente das improdutivas da base das taxas; `reason` nulo
   * quando o mais frequente é a improdutiva sem motivo. Null quando nenhuma
   * improdutiva tem motivo: aí a leitura não fala de motivo, porque "100% sem
   * motivo registrado" poderia ser só a fonte sem o campo.
   */
  readonly topReason: { readonly reason: string | null; readonly count: number; readonly of: number } | null
  readonly outcome: readonly OsOutcomeGroup[]
  readonly reasons: ReasonSummary
  readonly daily: OverviewDaily
  readonly serviceTypeSlices: readonly ServiceTypeSlice[]
  readonly cityPairs: readonly Pair[]
  readonly categoryTopPairs: readonly Pair[]
  readonly selectedCategoryRanks: readonly number[]
  readonly resolutionTopPairs: readonly Pair[]
}

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

function rateDetail(
  part: number,
  base: OsGroupTotals,
  rateBase: RateBase,
  rateState: RateState,
  filters: Pick<OverviewOsFilters, 'status'>,
  withoutUnassigned: boolean,
): string {
  if (rateState === 'empty') return 'Sem OS no recorte'
  if (rateState === 'status') {
    return filters.status.length === 1
      ? 'Com um status só, a taxa seria 0% ou 100%'
      : 'Com Status filtrado, a taxa perde parte da base'
  }
  const detail = `${formatNumber(part)} de ${formatNumber(base.total)} ${baseNoun(rateBase)}`

  return withoutUnassigned ? `${detail}, sem as OS sem técnico` : detail
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

/** Os quatro cards, escritos a partir dos números do serviço. */
export function buildOverviewKpis(
  facts: OverviewOsPeriodFacts,
  filters: OverviewOsFilters,
): OverviewKpis {
  const { totals, rateBase, rateState, previous, withoutUnassigned } = facts
  const base = totals[rateBase]
  const rateValue = (value: number) =>
    rateState === 'ok' ? formatPercent(value) : rateState === 'status' ? RATE_NOT_APPLICABLE : RATE_NO_OS

  // Comparar com base parcial ou com janela vazia não gera percentual nenhum.
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
  } else if (previous.coverage === 'incomplete' || previous.totals === null) {
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
    const previousTotals = previous.totals
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
      completionRate: rateDetail(base.completed, base, rateBase, rateState, filters, withoutUnassigned),
      unproductiveRate: rateDetail(base.unproductive, base, rateBase, rateState, filters, withoutUnassigned),
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
 * O motivo mais frequente na frase da leitura ("43,5% por cliente ausente"):
 * todo em minúsculas, porque entra no meio da frase e o catálogo pode vir em
 * "Cliente Ausente", e baixar só a primeira letra deixaria "por cliente
 * Ausente". O gráfico de motivos mostra o rótulo como ele vem.
 */
function topReasonPhrase(
  topReason: OverviewOsPeriodFacts['topReason'],
): { phrase: string; share: number } | null {
  if (topReason === null || topReason.of === 0) return null

  return {
    phrase: topReason.reason === null ? REASON_MISSING : `por ${topReason.reason.toLocaleLowerCase('pt-BR')}`,
    share: topReason.count / topReason.of,
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
 * Os dias com agenda e o motivo mais frequente vêm do serviço, com os
 * mesmos filtros de `kpis`.
 */
export function buildOverviewReadings(
  facts: Pick<OverviewOsPeriodFacts, 'daysWithOs' | 'topReason'>,
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
  const days = facts.daysWithOs

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

  const reason = topReasonPhrase(facts.topReason)
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
