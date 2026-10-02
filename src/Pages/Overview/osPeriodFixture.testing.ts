import { parseOverviewOsPeriod } from '../../data/api/osOverviewSource'
import { defaultOverviewOsFilters, type OverviewOsFilters } from '../../data/overviewOsFilters'
import type { Pair } from '../../data/dashboardTypes'
import {
  OS_GROUPS,
  OS_OUTCOMES,
  type OsGroupKey,
  type OsOutcomeGroup,
  type OsOutcomeKey,
  type OsTotals,
  type OverviewOsPeriodFacts,
} from './overviewModel'
import type { ReasonSummary } from './overviewReasonsChartOptions'
import fixture from './osPeriodFixture.json'

/**
 * Respostas REAIS do serviço de BI para o período da Visão Geral de OS, só
 * para os testes (01/10/2026).
 *
 * Desde que as contas do período foram para o serviço, os testes da página
 * escrevem os cards e os textos a partir do que ele responde. O arquivo
 * `osPeriodFixture.json` é gerado pelo próprio serviço
 * (`tests/fixtures/export_os_period_portal_fixture.py` no impacto-bi-service)
 * sobre a base local sanitizada, e passa pelo mesmo leitor da página
 * (`parseOverviewOsPeriod`). Por isso os números de sempre ("1.248 OS",
 * "84,1%") continuam cravados nos testes: se o serviço mudar uma regra, o
 * arquivo novo derruba o teste certo.
 */

export type OsPeriodScenario = keyof typeof fixture.scenarios

/** Os números e os filtros de um cenário da base local. */
export function periodScenario(name: OsPeriodScenario): {
  readonly facts: OverviewOsPeriodFacts
  readonly filters: OverviewOsFilters
} {
  const scenario = fixture.scenarios[name]

  return {
    facts: parseOverviewOsPeriod(scenario.response),
    filters: { ...defaultOverviewOsFilters, ...scenario.filters },
  }
}

export const PERIOD_FIXTURE_COVERAGE = fixture.coverage

const ZERO = { total: 0, completed: 0, unproductive: 0, notExecuted: 0, open: 0, unknown: 0 }

/** Totais de um grupo a partir das saídas; o total é a soma delas. */
export function groupTotals(counts: Partial<Omit<OsTotals['all'], 'total'>>): OsTotals['all'] {
  const full = { ...ZERO, ...counts }

  return {
    ...full,
    total: full.completed + full.unproductive + full.notExecuted + full.open + full.unknown,
  }
}

/** Totais da página a partir dos dois grupos. */
export function totals(
  customer: Partial<Omit<OsTotals['all'], 'total'>>,
  infrastructure: Partial<Omit<OsTotals['all'], 'total'>> = {},
): OsTotals {
  const c = groupTotals(customer)
  const i = groupTotals(infrastructure)
  const sum = (key: keyof OsTotals['all']) => c[key] + i[key]

  return {
    all: {
      total: sum('total'),
      completed: sum('completed'),
      unproductive: sum('unproductive'),
      notExecuted: sum('notExecuted'),
      open: sum('open'),
      unknown: sum('unknown'),
    },
    customer: c,
    infrastructure: i,
  }
}

/**
 * Números de um recorte montados à mão, para os casos que a base local não
 * tem (equipe de infraestrutura, um dia só, motivo na fonte). As regras que
 * os produzem são do serviço e testadas lá; aqui se testa o que a página
 * escreve com eles.
 */
export function handFacts(overrides: Partial<OverviewOsPeriodFacts> = {}): OverviewOsPeriodFacts {
  const base = overrides.totals ?? totals({})

  return {
    totals: base,
    rateBase: 'customer',
    rateState: base.customer.total === 0 && base.infrastructure.total === 0 ? 'empty' : 'ok',
    withoutUnassigned: false,
    previous: null,
    daysWithOs: base.all.total === 0 ? 0 : 1,
    topReason: null,
    outcome: [],
    reasons: { total: 0, customer: 0, infrastructure: 0, hasReason: false, rows: [] },
    daily: { x: [], iso: [], total: [], completed: [], unproductive: [], notExecuted: [], open: [], unknown: [] },
    serviceTypeSlices: [],
    cityPairs: [],
    categoryTopPairs: [],
    selectedCategoryRanks: [],
    resolutionTopPairs: [],
    ...overrides,
  }
}

/** Uma OS do Destino montado à mão: grupo, saída e status. */
export type OutcomeItem = readonly [OsGroupKey, OsOutcomeKey, string]

/**
 * O Destino das OS como o serviço o devolve, montado a partir de OS soltas
 * para os testes do gráfico: os dois grupos sempre, os status de cada saída
 * do mais frequente ao menos.
 */
export function outcomeGroups(items: readonly OutcomeItem[]): OsOutcomeGroup[] {
  return OS_GROUPS.map(({ key, label }) => {
    const mine = items.filter(([group]) => group === key)
    const counts = Object.fromEntries(
      OS_OUTCOMES.map((outcome) => [outcome.key, mine.filter(([, item]) => item === outcome.key).length]),
    ) as Record<OsOutcomeKey, number>
    const statuses = Object.fromEntries(
      OS_OUTCOMES.map((outcome) => {
        const byStatus = new Map<string, number>()
        for (const [, item, status] of mine) {
          if (item === outcome.key) byStatus.set(status, (byStatus.get(status) ?? 0) + 1)
        }
        return [outcome.key, [...byStatus].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))]
      }),
    ) as Record<OsOutcomeKey, Pair[]>

    return { key, label, total: mine.length, counts, statuses }
  })
}

/** Uma improdutiva dos motivos montados à mão: o motivo (nulo sem motivo) e o grupo. */
export type ReasonItem = readonly [reason: string | null, group: OsGroupKey]

const REASON_MISSING_LABEL = 'Sem motivo registrado'
const UNCLEAR_REASON_LABELS = ['Motivo não especificado', REASON_MISSING_LABEL]

/**
 * Os motivos de improdutiva como o serviço os devolve, montados a partir de
 * improdutivas soltas para os testes do painel: motivos reais do mais
 * frequente ao menos, as barras sem motivo real no fim, na ordem fixa.
 */
export function reasonSummary(items: readonly ReasonItem[]): ReasonSummary {
  const counts = new Map<string, { customer: number; infrastructure: number }>()
  for (const [reason, group] of items) {
    const key = reason?.trim() || REASON_MISSING_LABEL
    const item = counts.get(key) ?? { customer: 0, infrastructure: 0 }
    item[group] += 1
    counts.set(key, item)
  }
  const total = items.length
  const rows = [...counts].map(([reason, item]) => ({
    reason,
    count: item.customer + item.infrastructure,
    share: total === 0 ? 0 : (item.customer + item.infrastructure) / total,
    customer: item.customer,
    infrastructure: item.infrastructure,
    unclear: UNCLEAR_REASON_LABELS.includes(reason),
  }))
  const customer = items.filter(([, group]) => group === 'customer').length

  return {
    total,
    customer,
    infrastructure: total - customer,
    hasReason: items.some(([reason]) => (reason ?? '').trim() !== ''),
    rows: [
      ...rows.filter((row) => !row.unclear).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, 'pt-BR')),
      ...UNCLEAR_REASON_LABELS.flatMap((reason) => rows.filter((row) => row.reason === reason)),
    ],
  }
}
