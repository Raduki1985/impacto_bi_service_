import type { KpiDelta, Pair } from '../../data/dashboardTypes'
import { delta as kpiDelta, unavailableDelta } from '../../data/overviewOsAggregates'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import {
  applyOverviewOsFilters,
  applyOverviewOsPreviousFilters,
  previousOverviewOsPeriod,
  type OverviewOsCoverage,
  type OverviewOsFilters,
} from '../../data/overviewOsFilters'
import { formatNumber, formatPercent } from '../../lib/formatters'
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

/** Contagens que sustentam os cards, num grupo de OS. */
export type OsGroupTotals = {
  readonly total: number
  readonly completed: number
  readonly unproductive: number
}

export type OsTotals = {
  readonly all: OsGroupTotals
  readonly customer: OsGroupTotals
  readonly infrastructure: OsGroupTotals
}

function totalsOf(rows: readonly OverviewOsRecord[]): OsTotals {
  const all = { total: 0, completed: 0, unproductive: 0 }
  const customer = { total: 0, completed: 0, unproductive: 0 }
  const infrastructure = { total: 0, completed: 0, unproductive: 0 }

  for (const row of rows) {
    const kind = osStatusKind(row.statusKey)
    const group = groupOf(row) === 'customer' ? customer : infrastructure
    all.total += 1
    group.total += 1
    if (kind === 'completed') {
      all.completed += 1
      group.completed += 1
    } else if (kind === 'unproductive') {
      all.unproductive += 1
      group.unproductive += 1
    }
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
}

function rate(part: number, whole: number): number {
  return part / (whole || 1)
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
          : kpiDelta(
              rate(base.completed, base.total),
              rate(previousBase.completed, previousBase.total),
              true,
            ),
      unproductiveDelta:
        previousBase.total === 0
          ? unavailableDelta('no-data')
          : kpiDelta(
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
  }
}
