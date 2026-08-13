import {
  DEFAULT_COMMERCIAL_MONTH,
  addDays,
  dayOfMonth,
  daysInMonth,
  formatIsoAsBrDate,
  isCommercialMonthKey,
  isoDateInMonth,
  monthKeyOf,
  previousCommercialMonth,
} from '../../../data/commercialCalendar'
import type {
  CommercialCityId,
  CommercialDataset,
  CommercialMonthKey,
  CommercialSale,
  CommercialSaleStatus,
} from '../../../data/commercialTypes'
import { resolveGoalBasis } from '../Goals/commercialGoalsModel'

export type SalesPeriodTeam = 'comercial' | 'corporativo'
export type SalesPeriodTeamFilter = 'todos' | SalesPeriodTeam
export type SalesPeriodReturnFilter = 'todos' | 'novos' | 'retornaram'
export type SalesPeriodIndicatorFilter = 'todos' | 'sem-indicacao' | string
export type SalesPeriodStatusFilter = 'todos' | CommercialSaleStatus

export type SalesPeriodFilters = {
  readonly startDate: string
  readonly endDate: string
  readonly cityId: CommercialCityId | null
  readonly team: SalesPeriodTeamFilter
  readonly indicator: SalesPeriodIndicatorFilter
  readonly returnType: SalesPeriodReturnFilter
  readonly status: SalesPeriodStatusFilter
}

export type SalesPeriodFact = {
  readonly id: string
  readonly contractCode: string
  readonly customerLabel: string
  readonly customerCpf: string
  readonly sellerId: string
  readonly sellerName: string
  readonly cityId: CommercialCityId
  readonly cityName: string
  readonly team: SalesPeriodTeam
  readonly indicatorCpf: string | null
  readonly returnedToBase: boolean
  readonly status: CommercialSaleStatus
  readonly eventDate: string
  readonly activatedAt: string | null
  readonly monthlyValue: number
  readonly planName: string
}

export type SalesPeriodMetrics = {
  readonly totalContracts: number
  readonly activeSales: number
  readonly previousActiveSales: number | null
  readonly activeSalesChange: number | null
  readonly activeSalesChangeRate: number | null
  readonly activationRate: number | null
  readonly commercialSales: number
  readonly corporateSales: number
  readonly sellerSales: number
  readonly monthlyRevenue: number
  readonly averageTicket: number
  readonly returnedCustomers: number
  readonly indicatedSales: number
  readonly pipelineSales: number
  readonly goal: number | null
  readonly superGoal: number | null
  readonly goalAchieved: number
  readonly superGoalAchieved: number
  readonly goalAttainment: number | null
  readonly superGoalAttainment: number | null
}

export type SalesPeriodDailyPoint = {
  readonly date: string
  readonly day: number
  readonly activeSales: number
  readonly monthlyRevenue: number
}

export type SalesPeriodStatusSlice = {
  readonly status: CommercialSaleStatus
  readonly label: string
  readonly value: number
}

export type SalesPeriodSellerRank = {
  readonly position: number
  readonly sellerId: string
  readonly sellerName: string
  readonly team: SalesPeriodTeam
  readonly activeSales: number
  readonly monthlyRevenue: number
  readonly share: number
}

export type SalesPeriodSnapshot = {
  readonly filters: SalesPeriodFilters
  readonly periodLabel: string
  readonly facts: readonly SalesPeriodFact[]
  readonly tableRows: readonly SalesPeriodFact[]
  readonly metrics: SalesPeriodMetrics
  readonly daily: readonly SalesPeriodDailyPoint[]
  readonly statusDistribution: readonly SalesPeriodStatusSlice[]
  readonly topSellers: readonly SalesPeriodSellerRank[]
}

export const SALES_PERIOD_TABLE_LIMIT = 12
export const DEFAULT_SALES_PERIOD_START = isoDateInMonth(DEFAULT_COMMERCIAL_MONTH, 1)
export const DEFAULT_SALES_PERIOD_END = isoDateInMonth(
  DEFAULT_COMMERCIAL_MONTH,
  daysInMonth(DEFAULT_COMMERCIAL_MONTH),
)

export const commercialSaleStatusLabels: Record<CommercialSaleStatus, string> = {
  ativa: 'Ativada',
  pendente: 'Pendente',
  agendada: 'Agendada',
  assinada: 'Assinada',
  'aguardando-aprovacao': 'Aguardando aprovação',
  reprovada: 'Reprovada',
  cancelada: 'Cancelada',
  suspensa: 'Suspensa',
  expirada: 'Expirada',
  'bloqueio-administrativo': 'Bloqueio administrativo',
  'bloqueio-financeiro': 'Bloqueio financeiro',
  'nao-sincronizada': 'Não sincronizada',
}

export const salesPeriodTeamLabels: Record<SalesPeriodTeam, string> = {
  comercial: 'Comercial',
  corporativo: 'Corporativo',
}

const PIPELINE_STATUSES: ReadonlySet<CommercialSaleStatus> = new Set([
  'pendente',
  'assinada',
  'agendada',
  'aguardando-aprovacao',
])

const COMMERCIAL_VALUES = [99.9, 109.9, 129.9, 159.9, 179.9] as const
const CORPORATE_VALUES = [199.9, 249.9, 299.9, 349.9] as const
const COMMERCIAL_PLANS = [
  '300 MB',
  '400 MB',
  '600 MB',
  '600 MB + serviços',
  '1 Giga',
] as const
const CORPORATE_PLANS = ['PME 300 MB', 'PME 600 MB', 'PME 1 Giga', 'Link Corporativo'] as const

function sequenceOf(saleId: string): number {
  const match = saleId.match(/(\d+)$/)
  return match ? Number(match[1]) : 0
}

function teamOf(sale: CommercialSale): SalesPeriodTeam {
  return sale.channel === 'corporativo' ? 'corporativo' : 'comercial'
}

function valueOf(sequence: number, team: SalesPeriodTeam): number {
  const values = team === 'corporativo' ? CORPORATE_VALUES : COMMERCIAL_VALUES
  return values[sequence % values.length]
}

function planOf(sequence: number, team: SalesPeriodTeam): string {
  const plans = team === 'corporativo' ? CORPORATE_PLANS : COMMERCIAL_PLANS
  return plans[sequence % plans.length]
}

function syntheticCpf(sequence: number): string {
  const middle = String(Math.floor(sequence / 1000) % 1000).padStart(3, '0')
  const end = String(sequence % 1000).padStart(3, '0')
  return `000.${middle}.${end}-00`
}

function eventDateOf(sale: CommercialSale): string {
  return sale.activatedAt ?? sale.signedAt ?? sale.createdAt
}

/**
 * Projeção analítica da mesma venda usada por Metas e Desempenho.
 *
 * Cliente, plano e valor são atributos sintéticos determinísticos para o esboço.
 * `returnedToBase` representa a regra aprovada: aquele CPF possuía uma assinatura
 * anterior cancelada e voltou com uma nova venda ativada. O histórico anterior
 * não é copiado do SGI e não identifica pessoa real alguma.
 */
export function buildSalesPeriodFacts(dataset: CommercialDataset): SalesPeriodFact[] {
  const sellers = new Map(dataset.sellers.map((seller) => [seller.id, seller]))
  const cities = new Map(dataset.cities.map((city) => [city.id, city.name]))

  return dataset.sales.map((sale) => {
    const sequence = sequenceOf(sale.id)
    const seller = sellers.get(sale.creatorId)
    const team = teamOf(sale)
    const returnedToBase = sale.status === 'ativa' && sale.activatedAt !== null && sequence % 17 === 0

    return {
      id: sale.id,
      contractCode: `#${String(1_300_000 + sequence).padStart(8, '0')}`,
      customerLabel: returnedToBase
        ? `Cliente retornado ${String(sequence).padStart(4, '0')}`
        : `Cliente ${String(sequence).padStart(4, '0')}`,
      customerCpf: syntheticCpf(sequence),
      sellerId: sale.creatorId,
      sellerName: seller?.name ?? 'Vendedor não catalogado',
      cityId: sale.cityId,
      cityName: cities.get(sale.cityId) ?? 'Cidade não catalogada',
      team,
      indicatorCpf: sale.indicationCode,
      returnedToBase,
      status: sale.status,
      eventDate: eventDateOf(sale),
      activatedAt: sale.activatedAt,
      monthlyValue: valueOf(sequence, team),
      planName: planOf(sequence, team),
    }
  })
}

export function initialSalesPeriodFilters(): SalesPeriodFilters {
  return {
    startDate: DEFAULT_SALES_PERIOD_START,
    endDate: DEFAULT_SALES_PERIOD_END,
    cityId: null,
    team: 'todos',
    indicator: 'todos',
    returnType: 'todos',
    status: 'todos',
  }
}

function matchesFilters(fact: SalesPeriodFact, filters: SalesPeriodFilters): boolean {
  if (fact.eventDate < filters.startDate || fact.eventDate > filters.endDate) return false
  if (filters.cityId !== null && fact.cityId !== filters.cityId) return false
  if (filters.team !== 'todos' && fact.team !== filters.team) return false
  if (filters.status !== 'todos' && fact.status !== filters.status) return false

  if (filters.indicator === 'sem-indicacao' && fact.indicatorCpf !== null) return false
  if (
    filters.indicator !== 'todos' &&
    filters.indicator !== 'sem-indicacao' &&
    fact.indicatorCpf !== filters.indicator
  ) {
    return false
  }

  if (filters.returnType === 'novos' && fact.returnedToBase) return false
  if (filters.returnType === 'retornaram' && !fact.returnedToBase) return false

  return true
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function inclusiveDays(startDate: string, endDate: string): number {
  let count = 0
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) count += 1
  return count
}

/**
 * Mês fechado compara com o mês fechado anterior. Para qualquer outro intervalo,
 * a comparação usa imediatamente a mesma quantidade de dias anteriores.
 */
function previousPeriodFilters(
  dataset: CommercialDataset,
  filters: SalesPeriodFilters,
): SalesPeriodFilters | null {
  const startMonth = monthKeyOf(filters.startDate)
  const endMonth = monthKeyOf(filters.endDate)

  if (startMonth === endMonth && isCommercialMonthKey(startMonth)) {
    const isWholeMonth =
      dayOfMonth(filters.startDate) === 1 &&
      filters.endDate === isoDateInMonth(startMonth, daysInMonth(startMonth))

    if (isWholeMonth) {
      const previousMonth = previousCommercialMonth(startMonth)
      if (previousMonth === null) return null

      return {
        ...filters,
        startDate: isoDateInMonth(previousMonth, 1),
        endDate: isoDateInMonth(previousMonth, daysInMonth(previousMonth)),
      }
    }
  }

  const days = inclusiveDays(filters.startDate, filters.endDate)
  const endDate = addDays(filters.startDate, -1)
  const startDate = addDays(endDate, -(days - 1))

  if (startDate < dataset.periodStart) return null
  return { ...filters, startDate, endDate }
}

function selectedDaysInMonth(
  month: CommercialMonthKey,
  startDate: string,
  endDate: string,
): number {
  const monthStart = isoDateInMonth(month, 1)
  const monthEnd = isoDateInMonth(month, daysInMonth(month))
  const selectedStart = startDate > monthStart ? startDate : monthStart
  const selectedEnd = endDate < monthEnd ? endDate : monthEnd

  if (selectedStart > selectedEnd) return 0

  let count = 0
  for (let date = selectedStart; date <= selectedEnd; date = addDays(date, 1)) count += 1
  return count
}

function buildProportionalGoals(
  dataset: CommercialDataset,
  filters: SalesPeriodFilters,
): { goal: number | null; superGoal: number | null } {
  // O Corporativo participa do realizado total da supermeta consolidada, mas não
  // possui meta própria de volume. Um recorte exclusivo dele não recebe meta inventada.
  if (filters.team === 'corporativo') return { goal: null, superGoal: null }

  const basis = resolveGoalBasis(dataset.sellers, {
    month: DEFAULT_COMMERCIAL_MONTH,
    cityId: filters.cityId,
    sellerIds: [],
  })

  if (basis.goal === null || basis.superGoal === null) return { goal: null, superGoal: null }

  const monthlyGoal = basis.goal
  const monthlySuperGoal = basis.superGoal
  let goal = 0
  let superGoal = 0

  dataset.months.forEach((month) => {
    const selectedDays = selectedDaysInMonth(month, filters.startDate, filters.endDate)
    if (selectedDays === 0) return

    const fraction = selectedDays / daysInMonth(month)
    goal += monthlyGoal * fraction
    superGoal += monthlySuperGoal * fraction
  })

  return { goal: round1(goal), superGoal: round1(superGoal) }
}

function buildMetrics(
  dataset: CommercialDataset,
  facts: readonly SalesPeriodFact[],
  previousFacts: readonly SalesPeriodFact[] | null,
  filters: SalesPeriodFilters,
): SalesPeriodMetrics {
  const active = facts.filter((fact) => fact.status === 'ativa' && fact.activatedAt !== null)
  const previousActive =
    previousFacts?.filter((fact) => fact.status === 'ativa' && fact.activatedAt !== null) ?? null
  const monthlyRevenue = active.reduce((total, fact) => total + fact.monthlyValue, 0)
  const commercialSales = active.filter((fact) => fact.team === 'comercial').length
  const corporateSales = active.filter((fact) => fact.team === 'corporativo').length
  const indicatedSales = active.filter((fact) => fact.indicatorCpf !== null).length
  const sellerSales = active.length - indicatedSales
  const targets = buildProportionalGoals(dataset, filters)
  const goalAchieved = commercialSales
  const superGoalAchieved = active.length

  return {
    totalContracts: facts.length,
    activeSales: active.length,
    previousActiveSales: previousActive?.length ?? null,
    activeSalesChange: previousActive === null ? null : active.length - previousActive.length,
    activeSalesChangeRate:
      previousActive === null || previousActive.length === 0
        ? null
        : (active.length - previousActive.length) / previousActive.length,
    activationRate: facts.length === 0 ? null : active.length / facts.length,
    commercialSales,
    corporateSales,
    sellerSales,
    monthlyRevenue,
    averageTicket: active.length === 0 ? 0 : monthlyRevenue / active.length,
    returnedCustomers: active.filter((fact) => fact.returnedToBase).length,
    indicatedSales,
    pipelineSales: facts.filter((fact) => PIPELINE_STATUSES.has(fact.status)).length,
    goal: targets.goal,
    superGoal: targets.superGoal,
    goalAchieved,
    superGoalAchieved,
    goalAttainment:
      targets.goal === null || targets.goal === 0 ? null : goalAchieved / targets.goal,
    superGoalAttainment:
      targets.superGoal === null || targets.superGoal === 0
        ? null
        : superGoalAchieved / targets.superGoal,
  }
}

function buildDaily(
  startDate: string,
  endDate: string,
  facts: readonly SalesPeriodFact[],
): SalesPeriodDailyPoint[] {
  const active = facts.filter((fact) => fact.status === 'ativa' && fact.activatedAt !== null)
  const dates: string[] = []

  for (let date = startDate; date <= endDate; date = addDays(date, 1)) dates.push(date)

  return dates.map((date) => {
    const current = active.filter((fact) => fact.eventDate === date)

    return {
      date,
      day: dayOfMonth(date),
      activeSales: current.length,
      monthlyRevenue: current.reduce((total, fact) => total + fact.monthlyValue, 0),
    }
  })
}

function buildStatusDistribution(
  facts: readonly SalesPeriodFact[],
): SalesPeriodStatusSlice[] {
  const counts = new Map<CommercialSaleStatus, number>()

  facts.forEach((fact) => counts.set(fact.status, (counts.get(fact.status) ?? 0) + 1))

  return Object.keys(commercialSaleStatusLabels)
    .map((status) => ({
      status: status as CommercialSaleStatus,
      label: commercialSaleStatusLabels[status as CommercialSaleStatus],
      value: counts.get(status as CommercialSaleStatus) ?? 0,
    }))
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value)
}

function buildTopSellers(facts: readonly SalesPeriodFact[]): SalesPeriodSellerRank[] {
  const active = facts.filter((fact) => fact.status === 'ativa' && fact.activatedAt !== null)
  const bySeller = new Map<
    string,
    Omit<SalesPeriodSellerRank, 'position' | 'share'>
  >()

  active.forEach((fact) => {
    const current = bySeller.get(fact.sellerId)

    bySeller.set(fact.sellerId, {
      sellerId: fact.sellerId,
      sellerName: fact.sellerName,
      team: fact.team,
      activeSales: (current?.activeSales ?? 0) + 1,
      monthlyRevenue: (current?.monthlyRevenue ?? 0) + fact.monthlyValue,
    })
  })

  return [...bySeller.values()]
    .sort(
      (a, b) =>
        b.activeSales - a.activeSales ||
        b.monthlyRevenue - a.monthlyRevenue ||
        a.sellerName.localeCompare(b.sellerName, 'pt-BR'),
    )
    .slice(0, 5)
    .map((seller, index) => ({
      ...seller,
      position: index + 1,
      share: active.length === 0 ? 0 : seller.activeSales / active.length,
    }))
}

export function buildSalesPeriodSnapshot(
  dataset: CommercialDataset,
  filters: SalesPeriodFilters,
): SalesPeriodSnapshot {
  const allFacts = buildSalesPeriodFacts(dataset)
  const facts = allFacts.filter((fact) => matchesFilters(fact, filters))
  const previousFilters = previousPeriodFilters(dataset, filters)
  const previousFacts =
    previousFilters === null
      ? null
      : allFacts.filter((fact) => matchesFilters(fact, previousFilters))
  const tableRows = [...facts]
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.id.localeCompare(a.id))
    .slice(0, SALES_PERIOD_TABLE_LIMIT)

  return {
    filters,
    periodLabel: `${formatIsoAsBrDate(filters.startDate)} a ${formatIsoAsBrDate(filters.endDate)}`,
    facts,
    tableRows,
    metrics: buildMetrics(dataset, facts, previousFacts, filters),
    daily: buildDaily(filters.startDate, filters.endDate, facts),
    statusDistribution: buildStatusDistribution(facts),
    topSellers: buildTopSellers(facts),
  }
}
