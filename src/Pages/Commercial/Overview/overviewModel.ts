import {
  addDays,
  dayOfMonth,
  daysInMonth,
  formatIsoAsBrDate,
  isCommercialMonthKey,
  isoDateInMonth,
  monthKeyOf,
  monthShortLabel,
  previousCommercialMonth,
} from '../../../data/commercialCalendar'
import type {
  CommercialCityId,
  CommercialDataset,
  CommercialMonthKey,
} from '../../../data/commercialTypes'
import {
  buildSalesPeriodSnapshot,
  DEFAULT_SALES_PERIOD_END,
  DEFAULT_SALES_PERIOD_START,
  type SalesPeriodFact,
  type SalesPeriodMetrics,
  type SalesPeriodSellerRank,
  type SalesPeriodTeam,
  type SalesPeriodTeamFilter,
} from '../SalesPeriod/salesPeriodModel'

export type CommercialOverviewFilters = {
  readonly startDate: string
  readonly endDate: string
  readonly cityId: CommercialCityId | null
  readonly team: SalesPeriodTeamFilter
}

export type OverviewBreakdown = {
  readonly id: string
  readonly label: string
  readonly activeSales: number
  readonly monthlyValue: number
  readonly share: number
}

export type OverviewMonthlyPoint = {
  readonly month: CommercialMonthKey
  readonly label: string
  readonly commercialSales: number
  readonly corporateSales: number
  /** Valor mensal ativado somente pelo Comercial naquele mês. */
  readonly commercialValue: number
  /** Valor mensal ativado somente pelo Corporativo naquele mês. */
  readonly corporateValue: number
  /** Soma dos dois times. Sempre igual a `commercialValue + corporateValue`. */
  readonly monthlyValue: number
}

export type OverviewPlanRank = OverviewBreakdown & { readonly position: number }

export type CommercialOverviewSnapshot = {
  readonly periodLabel: string
  readonly metrics: SalesPeriodMetrics
  readonly previousMonthlyValue: number | null
  readonly monthlyValueChangeRate: number | null
  /**
   * Realizado da Meta Comercial no período anterior comparável, ou seja, as
   * vendas do Comercial. É o mesmo numerador de `metrics.goalAchieved`, o que
   * mantém a comparação do card sobre a mesma base do velocímetro.
   */
  readonly previousGoalAchieved: number | null
  /**
   * Realizado da Supermeta no período anterior comparável: o total ativado de
   * Comercial e Corporativo, mesmo numerador de `metrics.superGoalAchieved`.
   */
  readonly previousSuperGoalAchieved: number | null
  /**
   * Ranking comparativo de cidades. Ignora apenas `cityId`: data e time
   * continuam valendo. Selecionar uma cidade destaca a linha em vez de reduzir
   * o painel a ela.
   */
  readonly topCities: readonly OverviewBreakdown[]
  /** Total de ativações do conjunto comparativo de cidades. */
  readonly cityComparisonTotal: number
  /**
   * Comparativo dos dois times. Ignora apenas `team`: data e cidade continuam
   * valendo. `filters.team` só indica qual bloco recebe destaque.
   */
  readonly teams: readonly OverviewBreakdown[]
  /** Total de ativações do conjunto comparativo de times. */
  readonly teamComparisonTotal: number
  /**
   * Vendedores e Indicação são origens, não times. O painel mostra a
   * composição consolidada dos dois times dentro do recorte de data e cidade.
   */
  readonly origins: readonly OverviewBreakdown[]
  readonly topPlans: readonly OverviewPlanRank[]
  readonly topSellers: readonly SalesPeriodSellerRank[]
  readonly monthly: readonly OverviewMonthlyPoint[]
  readonly sparklines: {
    readonly activeSales: readonly number[]
    readonly monthlyValue: readonly number[]
    readonly goal: readonly number[]
    readonly superGoal: readonly number[]
    readonly pipeline: readonly number[]
  }
}

const PIPELINE_STATUSES = new Set([
  'pendente',
  'assinada',
  'agendada',
  'aguardando-aprovacao',
])

export function initialCommercialOverviewFilters(): CommercialOverviewFilters {
  return {
    startDate: DEFAULT_SALES_PERIOD_START,
    endDate: DEFAULT_SALES_PERIOD_END,
    cityId: null,
    team: 'todos',
  }
}

function salesPeriodFilters(filters: CommercialOverviewFilters) {
  return {
    ...filters,
    indicator: 'todos' as const,
    returnType: 'todos' as const,
    status: 'todos' as const,
  }
}

function isActive(fact: SalesPeriodFact): boolean {
  return fact.status === 'ativa' && fact.activatedAt !== null
}

function previousPeriod(
  dataset: CommercialDataset,
  filters: CommercialOverviewFilters,
): CommercialOverviewFilters | null {
  const startMonth = monthKeyOf(filters.startDate)
  const endMonth = monthKeyOf(filters.endDate)

  if (
    startMonth === endMonth &&
    isCommercialMonthKey(startMonth) &&
    dayOfMonth(filters.startDate) === 1 &&
    filters.endDate === isoDateInMonth(startMonth, daysInMonth(startMonth))
  ) {
    const previousMonth = previousCommercialMonth(startMonth)
    if (previousMonth === null) return null

    return {
      ...filters,
      startDate: isoDateInMonth(previousMonth, 1),
      endDate: isoDateInMonth(previousMonth, daysInMonth(previousMonth)),
    }
  }

  const dates: string[] = []
  for (let date = filters.startDate; date <= filters.endDate; date = addDays(date, 1)) {
    dates.push(date)
  }

  const endDate = addDays(filters.startDate, -1)
  const startDate = addDays(endDate, -(dates.length - 1))
  if (startDate < dataset.periodStart) return null

  return { ...filters, startDate, endDate }
}

function breakdown(
  facts: readonly SalesPeriodFact[],
  activeTotal: number,
  keyOf: (fact: SalesPeriodFact) => string,
  labelOf: (fact: SalesPeriodFact) => string,
): OverviewBreakdown[] {
  const grouped = new Map<string, Omit<OverviewBreakdown, 'share'>>()

  facts.filter(isActive).forEach((fact) => {
    const id = keyOf(fact)
    const current = grouped.get(id)
    grouped.set(id, {
      id,
      label: labelOf(fact),
      activeSales: (current?.activeSales ?? 0) + 1,
      monthlyValue: (current?.monthlyValue ?? 0) + fact.monthlyValue,
    })
  })

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      share: activeTotal === 0 ? 0 : item.activeSales / activeTotal,
    }))
    .sort(
      (a, b) =>
        b.activeSales - a.activeSales ||
        b.monthlyValue - a.monthlyValue ||
        a.label.localeCompare(b.label, 'pt-BR'),
    )
}

function buildTeams(
  facts: readonly SalesPeriodFact[],
  activeTotal: number,
): OverviewBreakdown[] {
  const labels: Record<SalesPeriodTeam, string> = {
    comercial: 'Comercial',
    corporativo: 'Corporativo',
  }
  const active = facts.filter(isActive)

  return (['comercial', 'corporativo'] as const)
    .map((team) => {
      const teamFacts = active.filter((fact) => fact.team === team)
      return {
        id: team,
        label: labels[team],
        activeSales: teamFacts.length,
        monthlyValue: teamFacts.reduce((total, fact) => total + fact.monthlyValue, 0),
        share: activeTotal === 0 ? 0 : teamFacts.length / activeTotal,
      }
    })
    .filter((item) => item.activeSales > 0)
}

function buildOrigins(
  facts: readonly SalesPeriodFact[],
  activeTotal: number,
): OverviewBreakdown[] {
  const active = facts.filter(isActive)
  const direct = active.filter((fact) => fact.indicatorCpf === null)
  const indicated = active.filter((fact) => fact.indicatorCpf !== null)

  return [
    {
      id: 'vendedores',
      label: 'Vendedores',
      activeSales: direct.length,
      monthlyValue: direct.reduce((total, fact) => total + fact.monthlyValue, 0),
      share: activeTotal === 0 ? 0 : direct.length / activeTotal,
    },
    {
      id: 'indicacao',
      label: 'Indicação',
      activeSales: indicated.length,
      monthlyValue: indicated.reduce((total, fact) => total + fact.monthlyValue, 0),
      share: activeTotal === 0 ? 0 : indicated.length / activeTotal,
    },
  ].filter((item) => item.activeSales > 0)
}

/** Valor mensal ativado por um time específico, somado fato a fato. */
function teamMonthlyValue(
  facts: readonly SalesPeriodFact[],
  team: SalesPeriodTeam,
): number {
  return facts
    .filter((fact) => isActive(fact) && fact.team === team)
    .reduce((total, fact) => total + fact.monthlyValue, 0)
}

function buildMonthly(
  dataset: CommercialDataset,
  filters: CommercialOverviewFilters,
): OverviewMonthlyPoint[] {
  return dataset.months.map((month) => {
    const snapshot = buildSalesPeriodSnapshot(
      dataset,
      salesPeriodFilters({
        ...filters,
        startDate: isoDateInMonth(month, 1),
        endDate: isoDateInMonth(month, daysInMonth(month)),
      }),
    )

    // Os dois valores saem dos mesmos fatos ativados do mês. Nada é rateado por
    // percentual: é a soma direta de cada time, para que o gráfico possa montar
    // a linha somente com as séries visíveis.
    return {
      month,
      label: monthShortLabel(month),
      commercialSales: snapshot.metrics.commercialSales,
      corporateSales: snapshot.metrics.corporateSales,
      commercialValue: teamMonthlyValue(snapshot.facts, 'comercial'),
      corporateValue: teamMonthlyValue(snapshot.facts, 'corporativo'),
      monthlyValue: snapshot.metrics.monthlyRevenue,
    }
  })
}

function buildSparklines(
  facts: readonly SalesPeriodFact[],
  filters: CommercialOverviewFilters,
  metrics: SalesPeriodMetrics,
) {
  const dates: string[] = []
  for (let date = filters.startDate; date <= filters.endDate; date = addDays(date, 1)) {
    dates.push(date)
  }

  const bucketCount = Math.min(10, Math.max(dates.length, 1))
  const buckets = Array.from({ length: bucketCount }, () => ({
    activeSales: 0,
    monthlyValue: 0,
    commercialSales: 0,
    pipeline: 0,
  }))

  facts.forEach((fact) => {
    const dateIndex = dates.indexOf(fact.eventDate)
    if (dateIndex < 0) return
    const bucketIndex = Math.min(
      Math.floor((dateIndex / Math.max(dates.length, 1)) * bucketCount),
      bucketCount - 1,
    )
    const bucket = buckets[bucketIndex]

    if (isActive(fact)) {
      bucket.activeSales += 1
      bucket.monthlyValue += fact.monthlyValue
      if (fact.team === 'comercial') bucket.commercialSales += 1
    }
    if (PIPELINE_STATUSES.has(fact.status)) bucket.pipeline += 1
  })

  let cumulativeGoal = 0
  let cumulativeTotal = 0
  const goal = buckets.map((bucket) => {
    cumulativeGoal += bucket.commercialSales
    return metrics.goal === null || metrics.goal === 0 ? 0 : cumulativeGoal / metrics.goal
  })
  const superGoal = buckets.map((bucket) => {
    cumulativeTotal += bucket.activeSales
    return metrics.superGoal === null || metrics.superGoal === 0
      ? 0
      : cumulativeTotal / metrics.superGoal
  })

  return {
    activeSales: buckets.map((bucket) => bucket.activeSales),
    monthlyValue: buckets.map((bucket) => bucket.monthlyValue),
    goal,
    superGoal,
    pipeline: buckets.map((bucket) => bucket.pipeline),
  }
}

export function buildCommercialOverviewSnapshot(
  dataset: CommercialDataset,
  filters: CommercialOverviewFilters,
): CommercialOverviewSnapshot {
  const snapshot = buildSalesPeriodSnapshot(dataset, salesPeriodFilters(filters))
  const previousFilters = previousPeriod(dataset, filters)
  const previousSnapshot =
    previousFilters === null
      ? null
      : buildSalesPeriodSnapshot(dataset, salesPeriodFilters(previousFilters))
  const activeTotal = snapshot.metrics.activeSales
  const monthlyValueChangeRate =
    previousSnapshot === null || previousSnapshot.metrics.monthlyRevenue === 0
      ? null
      : (snapshot.metrics.monthlyRevenue - previousSnapshot.metrics.monthlyRevenue) /
        previousSnapshot.metrics.monthlyRevenue
  const topPlans = breakdown(
    snapshot.facts,
    activeTotal,
    (fact) => fact.planName,
    (fact) => fact.planName,
  )
    .slice(0, 5)
    .map((plan, index) => ({ ...plan, position: index + 1 }))

  // Painéis comparativos. Cada um ignora somente o filtro da própria dimensão,
  // para continuar mostrando a comparação completa enquanto o controle superior
  // apenas marca a seleção. Os demais filtros seguem valendo.
  const cityScope = buildSalesPeriodSnapshot(
    dataset,
    salesPeriodFilters({ ...filters, cityId: null }),
  )
  const teamScope = buildSalesPeriodSnapshot(
    dataset,
    salesPeriodFilters({ ...filters, team: 'todos' }),
  )
  const cityComparisonTotal = cityScope.metrics.activeSales
  const teamComparisonTotal = teamScope.metrics.activeSales

  return {
    periodLabel: `${formatIsoAsBrDate(filters.startDate)} a ${formatIsoAsBrDate(filters.endDate)}`,
    metrics: snapshot.metrics,
    previousMonthlyValue: previousSnapshot?.metrics.monthlyRevenue ?? null,
    monthlyValueChangeRate,
    // Os dois realizados anteriores saem do mesmo snapshot de período anterior
    // já usado pelo valor mensal. Nenhuma janela de comparação nova é criada.
    previousGoalAchieved: previousSnapshot?.metrics.goalAchieved ?? null,
    previousSuperGoalAchieved: previousSnapshot?.metrics.superGoalAchieved ?? null,
    topCities: breakdown(
      cityScope.facts,
      cityComparisonTotal,
      (fact) => fact.cityId,
      (fact) => fact.cityName,
    ),
    cityComparisonTotal,
    teams: buildTeams(teamScope.facts, teamComparisonTotal),
    teamComparisonTotal,
    // Origem responde a data e cidade, nunca ao time: Vendedores e Indicação
    // não são times, e cruzar as duas dimensões criaria um vínculo inexistente.
    origins: buildOrigins(teamScope.facts, teamComparisonTotal),
    topPlans,
    topSellers: snapshot.topSellers,
    monthly: buildMonthly(dataset, filters),
    sparklines: buildSparklines(snapshot.facts, filters, snapshot.metrics),
  }
}
