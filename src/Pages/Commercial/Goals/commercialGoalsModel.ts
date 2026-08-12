/**
 * Regras de meta e desempenho do Comercial.
 *
 * Módulo puro: sem React, sem rota, sem armazenamento e sem acesso à base
 * global. Tudo entra por parâmetro e tudo sai calculado, o que torna cada regra
 * de negócio testável isoladamente.
 *
 * As três regras que sustentam a página:
 *
 * 1. Uma venda só é contabilizada quando o contrato está `ativa` E existe data
 *    de ativação. A data de ativação é a única que atribui a venda a um dia e a
 *    um mês; criação e assinatura nunca atribuem.
 * 2. Existem dois numeradores diferentes. O realizado da meta soma Vendas
 *    Internas e Colaboradores. O realizado total, usado contra a supermeta,
 *    soma também o Corporativo.
 * 3. A supermeta de um conjunto é 110% da meta daquele conjunto, e a meta
 *    empresarial consolidada é fixa em 800, independentemente do número atual de
 *    vendedores internos.
 *
 * Deflator (contrato cujo primeiro boleto não foi pago) está fora deste bloco:
 * nenhuma fatura é consultada e o realizado não é descontado por pagamento.
 * Status ativo não é tratado aqui como prova de pagamento do primeiro boleto.
 */

import {
  COMMERCIAL_MONTHS,
  dayOfMonth,
  daysInMonth,
  isCommercialMonthKey,
  isIsoDate,
  isoDateInMonth,
  monthKeyOf,
  monthLabel,
  monthShortLabel,
  previousCommercialMonth,
} from '../../../data/commercialCalendar'
import type {
  CommercialDataset,
  CommercialGoalsFilters,
  CommercialMonthKey,
  CommercialPartner,
  CommercialSale,
  CommercialSeller,
} from '../../../data/commercialTypes'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import {
  activeSalesText,
  agreeWith,
  internalSellersText,
  pluralize,
  salesText,
} from './goalsText'

/* -------------------------------------------------------------------------- */
/* Constantes de negócio                                                      */
/* -------------------------------------------------------------------------- */

/** Meta individual mensal de cada vendedor interno. */
export const INTERNAL_SELLER_MONTHLY_GOAL = 50

/**
 * Meta empresarial mensal consolidada.
 *
 * Fixa em 800. A capacidade individual atual (15 x 50 = 750) é menor de
 * propósito: a falta de um vendedor não reduz a meta do negócio, e a diferença
 * não é ajustada silenciosamente em lugar nenhum desta página.
 */
export const CONSOLIDATED_MONTHLY_GOAL = 800

/** A supermeta é sempre 110% da meta do conjunto avaliado. */
export const SUPER_GOAL_FACTOR = 1.1

/** Supermeta de uma meta qualquer, arredondada para venda inteira. */
export function superGoalFor(goal: number): number {
  return Math.round(goal * SUPER_GOAL_FACTOR)
}

/** Supermeta empresarial mensal consolidada: 880. */
export const CONSOLIDATED_MONTHLY_SUPER_GOAL = superGoalFor(CONSOLIDATED_MONTHLY_GOAL)

/* -------------------------------------------------------------------------- */
/* Contabilização e crédito                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Crédito de uma venda.
 *
 * `unknown` é o código de indicação que não corresponde a nenhum colaborador:
 * ele nunca é aceito silenciosamente. A venda fica fora dos indicadores e a
 * inconsistência é reportada por `validateCommercialDataset`.
 */
export type CommercialSaleCredit =
  | { readonly kind: 'seller'; readonly sellerId: string }
  | { readonly kind: 'partner'; readonly partnerId: string }
  | { readonly kind: 'unknown'; readonly indicationCode: string }

/**
 * true somente quando a venda entra no realizado: contrato ativo E data de
 * ativação válida. Uma das duas condições sozinha não basta.
 */
export function isCountedSale(sale: CommercialSale): boolean {
  return sale.status === 'ativa' && isIsoDate(sale.activatedAt)
}

/** Índice de colaboradores por código de indicação. */
export function indexPartnersByCode(
  partners: readonly CommercialPartner[],
): ReadonlyMap<string, CommercialPartner> {
  return new Map(partners.map((partner) => [partner.indicationCode, partner]))
}

export function indexSellersById(
  sellers: readonly CommercialSeller[],
): ReadonlyMap<string, CommercialSeller> {
  return new Map(sellers.map((seller) => [seller.id, seller]))
}

/**
 * Quem recebe o crédito da venda.
 *
 * Sem código de indicação, o crédito fica com o vendedor que criou a venda. Com
 * código válido, vai para o colaborador correspondente, e não para quem
 * registrou.
 */
export function resolveSaleCredit(
  sale: CommercialSale,
  partnersByCode: ReadonlyMap<string, CommercialPartner>,
): CommercialSaleCredit {
  if (sale.indicationCode === null) {
    return { kind: 'seller', sellerId: sale.creatorId }
  }

  const partner = partnersByCode.get(sale.indicationCode)

  return partner
    ? { kind: 'partner', partnerId: partner.id }
    : { kind: 'unknown', indicationCode: sale.indicationCode }
}

/* -------------------------------------------------------------------------- */
/* Base da meta                                                               */
/* -------------------------------------------------------------------------- */

/**
 * De onde a meta do recorte veio.
 *
 * - `consolidado`: sem cidade e sem vendedor, a meta empresarial fixa;
 * - `cidade`: 50 x vendedores internos alocados à cidade;
 * - `selecao`: 50 x vendedores internos elegíveis selecionados;
 * - `sem-meta`: nenhum vendedor interno elegível, então não existe meta de
 *   volume e nenhum percentual é calculado.
 */
export type CommercialGoalScope = 'consolidado' | 'cidade' | 'selecao' | 'sem-meta'

export type CommercialGoalBasis = {
  readonly scope: CommercialGoalScope
  readonly goal: number | null
  readonly superGoal: number | null
  readonly eligibleInternalSellers: readonly CommercialSeller[]
  readonly selectedCorporateSellers: readonly CommercialSeller[]
  /** Cidade e vendedor que não se cruzam: o recorte não pode ter resultado. */
  readonly incompatibleSelection: boolean
}

/**
 * Meta e supermeta do recorte atual.
 *
 * Cidade e vendedor são aplicados como interseção real. O Corporativo atravessa
 * o filtro de cidade porque atua em toda a região, e as vendas dele continuam
 * sendo recortadas pela cidade do próprio fato.
 */
export function resolveGoalBasis(
  sellers: readonly CommercialSeller[],
  filters: CommercialGoalsFilters,
): CommercialGoalBasis {
  const selectedIds = new Set(filters.sellerIds)
  const activeSellers = sellers.filter((seller) => seller.active)

  const bySelection =
    selectedIds.size === 0
      ? activeSellers
      : activeSellers.filter((seller) => selectedIds.has(seller.id))

  const inScope =
    filters.cityId === null
      ? bySelection
      : bySelection.filter((seller) => seller.cityId === null || seller.cityId === filters.cityId)

  const eligibleInternalSellers = inScope.filter((seller) => seller.segment === 'interno')
  const selectedCorporateSellers = inScope.filter((seller) => seller.segment === 'corporativo')
  const incompatibleSelection =
    filters.cityId !== null && selectedIds.size > 0 && inScope.length === 0

  if (selectedIds.size === 0 && filters.cityId === null) {
    return {
      scope: 'consolidado',
      goal: CONSOLIDATED_MONTHLY_GOAL,
      superGoal: CONSOLIDATED_MONTHLY_SUPER_GOAL,
      eligibleInternalSellers,
      selectedCorporateSellers,
      incompatibleSelection,
    }
  }

  if (eligibleInternalSellers.length === 0) {
    return {
      scope: 'sem-meta',
      goal: null,
      superGoal: null,
      eligibleInternalSellers,
      selectedCorporateSellers,
      incompatibleSelection,
    }
  }

  const goal = INTERNAL_SELLER_MONTHLY_GOAL * eligibleInternalSellers.length

  return {
    scope: selectedIds.size > 0 ? 'selecao' : 'cidade',
    goal,
    superGoal: superGoalFor(goal),
    eligibleInternalSellers,
    selectedCorporateSellers,
    incompatibleSelection,
  }
}

/* -------------------------------------------------------------------------- */
/* Agregação                                                                  */
/* -------------------------------------------------------------------------- */

export type CommercialSellerPerformance = {
  readonly seller: CommercialSeller
  readonly activeSales: number
  readonly goal: number
  readonly gap: number
  readonly attained: boolean
}

export type CommercialMonthlyPoint = {
  readonly month: CommercialMonthKey
  readonly label: string
  readonly goal: number | null
  readonly superGoal: number | null
  readonly goalAchieved: number
  readonly totalAchieved: number
  readonly selected: boolean
}

export type CommercialDailyPoint = {
  readonly day: number
  /** Acumulado do realizado da meta. `null` em dia posterior à data de atualização. */
  readonly goalAchieved: number | null
  readonly totalAchieved: number | null
  readonly goalPace: number | null
  readonly superGoalPace: number | null
}

export type CommercialGoalAlertTone = 'positivo' | 'atencao' | 'critico' | 'neutro'

export type CommercialGoalAlert = {
  readonly id: string
  readonly tone: CommercialGoalAlertTone
  readonly title: string
  readonly detail: string
}

export type CommercialGoalStory = {
  readonly title: string
  readonly text: string
  readonly watch: string
}

export type CommercialConsistencyIssue = {
  readonly id: string
  readonly message: string
  readonly occurrences: number
  readonly sampleSaleId: string
}

export type CommercialGoalsSnapshot = {
  readonly month: CommercialMonthKey
  readonly monthLabel: string
  readonly previousMonth: CommercialMonthKey | null
  readonly previousMonthLabel: string | null
  readonly daysInMonth: number

  readonly scope: CommercialGoalScope
  readonly goal: number | null
  readonly superGoal: number | null
  readonly incompatibleSelection: boolean

  /** Vendas Internas + Colaboradores. É o numerador da meta normal. */
  readonly goalAchieved: number
  /** Vendas Internas + Colaboradores + Corporativo. É o numerador da supermeta. */
  readonly totalAchieved: number
  readonly internalAchieved: number
  readonly partnerAchieved: number
  readonly corporateAchieved: number

  readonly goalAttainment: number | null
  readonly superGoalAttainment: number | null
  /** Nunca negativo: excedente aparece em `surplusOverGoal`. */
  readonly gapToGoal: number | null
  readonly surplusOverGoal: number | null
  readonly gapToSuperGoal: number | null
  readonly partnerShareOfGoalAchieved: number | null

  readonly previousGoalAchieved: number | null
  readonly goalAchievedChange: number | null

  readonly eligibleInternalSellers: readonly CommercialSeller[]
  readonly attainedSellers: readonly CommercialSellerPerformance[]
  readonly notAttainedSellers: readonly CommercialSellerPerformance[]

  readonly daily: readonly CommercialDailyPoint[]
  readonly monthly: readonly CommercialMonthlyPoint[]

  readonly alerts: readonly CommercialGoalAlert[]
  readonly story: CommercialGoalStory
  readonly hasResults: boolean
}

type MonthAggregate = {
  internal: number
  partner: number
  corporate: number
  readonly perSeller: Map<string, number>
  readonly perDayGoal: number[]
  readonly perDayTotal: number[]
}

function emptyAggregate(month: CommercialMonthKey): MonthAggregate {
  const days = daysInMonth(month)

  return {
    internal: 0,
    partner: 0,
    corporate: 0,
    perSeller: new Map<string, number>(),
    perDayGoal: new Array<number>(days).fill(0),
    perDayTotal: new Array<number>(days).fill(0),
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Percorre os fatos uma única vez e acumula cada mês do período.
 *
 * Filtros aplicados aqui, e nesta ordem:
 *
 * - contabilização (ativa + data de ativação);
 * - cidade, sempre pela cidade do fato;
 * - crédito desconhecido, que não entra em indicador nenhum;
 * - vendedor, sempre por quem recebeu o crédito. Venda creditada a colaborador
 *   não pertence a nenhum vendedor e some quando o filtro Vendedor está ativo.
 */
function aggregateMonths(
  dataset: CommercialDataset,
  filters: CommercialGoalsFilters,
  partnersByCode: ReadonlyMap<string, CommercialPartner>,
  sellersById: ReadonlyMap<string, CommercialSeller>,
): Map<CommercialMonthKey, MonthAggregate> {
  const aggregates = new Map<CommercialMonthKey, MonthAggregate>(
    dataset.months.map((month) => [month, emptyAggregate(month)]),
  )
  const selectedIds = new Set(filters.sellerIds)

  for (const sale of dataset.sales) {
    const activatedAt = sale.activatedAt
    if (activatedAt === null || !isCountedSale(sale)) continue

    const monthKey = monthKeyOf(activatedAt)
    if (!isCommercialMonthKey(monthKey)) continue

    const aggregate = aggregates.get(monthKey)
    if (!aggregate) continue

    if (filters.cityId !== null && sale.cityId !== filters.cityId) continue

    const credit = resolveSaleCredit(sale, partnersByCode)
    if (credit.kind === 'unknown') continue

    if (selectedIds.size > 0 && (credit.kind !== 'seller' || !selectedIds.has(credit.sellerId))) {
      continue
    }

    const seller = credit.kind === 'seller' ? sellersById.get(credit.sellerId) : null
    if (credit.kind === 'seller' && !seller) continue

    const day = dayOfMonth(activatedAt)
    const countsForGoal = credit.kind === 'partner' || seller?.segment === 'interno'

    aggregate.perDayTotal[day - 1] += 1

    if (credit.kind === 'partner') {
      aggregate.partner += 1
    } else if (seller?.segment === 'interno') {
      aggregate.internal += 1
      aggregate.perSeller.set(seller.id, (aggregate.perSeller.get(seller.id) ?? 0) + 1)
    } else {
      aggregate.corporate += 1
    }

    if (countsForGoal) aggregate.perDayGoal[day - 1] += 1
  }

  return aggregates
}

function cumulative(values: readonly number[]): number[] {
  let running = 0

  return values.map((value) => {
    running += value

    return running
  })
}

/**
 * Evolução diária acumulada do mês selecionado.
 *
 * O ritmo esperado é distribuído por dias corridos, e não por dias úteis: é o
 * critério deste primeiro bloco. Dia posterior à data de atualização da base
 * fica sem realizado (`null`), para a linha não desabar até zero no futuro.
 */
function buildDailyPoints(
  month: CommercialMonthKey,
  aggregate: MonthAggregate,
  goal: number | null,
  superGoal: number | null,
  referenceDate: string,
): CommercialDailyPoint[] {
  const days = daysInMonth(month)
  const goalCumulative = cumulative(aggregate.perDayGoal)
  const totalCumulative = cumulative(aggregate.perDayTotal)

  return Array.from({ length: days }, (_unused, index) => {
    const day = index + 1
    const inFuture = isoDateInMonth(month, day) > referenceDate

    return {
      day,
      goalAchieved: inFuture ? null : goalCumulative[index],
      totalAchieved: inFuture ? null : totalCumulative[index],
      goalPace: goal === null ? null : round1((goal * day) / days),
      superGoalPace: superGoal === null ? null : round1((superGoal * day) / days),
    }
  })
}

function buildSellerPerformance(
  sellers: readonly CommercialSeller[],
  aggregate: MonthAggregate,
): CommercialSellerPerformance[] {
  return sellers
    .map((seller) => {
      const activeSales = aggregate.perSeller.get(seller.id) ?? 0

      return {
        seller,
        activeSales,
        goal: INTERNAL_SELLER_MONTHLY_GOAL,
        gap: Math.max(INTERNAL_SELLER_MONTHLY_GOAL - activeSales, 0),
        attained: activeSales >= INTERNAL_SELLER_MONTHLY_GOAL,
      }
    })
    .sort((a, b) => b.activeSales - a.activeSales || a.seller.name.localeCompare(b.seller.name, 'pt-BR'))
}

/* -------------------------------------------------------------------------- */
/* Alertas e leitura                                                          */
/* -------------------------------------------------------------------------- */

type SnapshotCore = Omit<CommercialGoalsSnapshot, 'alerts' | 'story'>

/**
 * Alertas determinísticos, derivados apenas dos indicadores já calculados.
 * Nenhuma causa é atribuída, nenhum texto é gerado por IA.
 */
function buildAlerts(core: SnapshotCore): CommercialGoalAlert[] {
  const alerts: CommercialGoalAlert[] = []

  if (core.incompatibleSelection) {
    alerts.push({
      id: 'selecao-incompativel',
      tone: 'neutro',
      title: 'Cidade e vendedor não se cruzam',
      detail:
        'Nenhum vendedor selecionado atua na cidade escolhida, então o recorte não tem meta nem realizado.',
    })

    return alerts
  }

  if (!core.hasResults) {
    alerts.push({
      id: 'sem-realizado',
      tone: 'neutro',
      title: 'Sem vendas ativas no recorte',
      detail: `Nenhuma venda ativa com data de ativação em ${core.monthLabel} atende aos filtros aplicados.`,
    })
  }

  if (core.goal === null) {
    alerts.push({
      id: 'sem-meta',
      tone: 'neutro',
      title: 'Sem meta individual de volume',
      detail:
        core.eligibleInternalSellers.length === 0 && core.corporateAchieved > 0
          ? `O recorte tem ${activeSalesText(core.totalAchieved)} e nenhum vendedor interno elegível, então não existe meta de volume para comparar.`
          : 'O recorte não tem vendedor interno elegível, então não existe meta de volume para comparar.',
    })
  } else if (core.goalAchieved >= core.goal) {
    const surplus = core.surplusOverGoal ?? 0

    alerts.push({
      id: 'meta-atingida',
      tone: 'positivo',
      title: 'Meta atingida',
      detail: `Realizado da meta de ${salesText(core.goalAchieved)}, ${salesText(surplus)} acima da meta de ${formatNumber(core.goal)}.`,
    })
  } else {
    const attainment = core.goalAttainment ?? 0
    const gap = core.gapToGoal ?? 0

    alerts.push({
      id: 'meta-nao-atingida',
      tone: attainment < 0.9 ? 'critico' : 'atencao',
      title: 'Meta não atingida',
      detail: `${agreeWith(gap, 'Falta', 'Faltam')} ${salesText(gap)} para a meta de ${formatNumber(core.goal)}. Atingimento de ${formatPercent(attainment)}.`,
    })
  }

  if (core.superGoal !== null) {
    const reached = core.totalAchieved >= core.superGoal
    const gap = core.gapToSuperGoal ?? 0

    alerts.push({
      id: reached ? 'supermeta-atingida' : 'supermeta-nao-atingida',
      tone: reached ? 'positivo' : 'neutro',
      title: reached ? 'Supermeta atingida' : 'Supermeta não atingida',
      detail: reached
        ? `Realizado total de ${salesText(core.totalAchieved)} contra supermeta de ${formatNumber(core.superGoal)}.`
        : `${agreeWith(gap, 'Falta', 'Faltam')} ${salesText(gap)} no realizado total para a supermeta de ${formatNumber(core.superGoal)}.`,
    })
  }

  if (core.previousMonthLabel !== null && core.goalAchievedChange !== null) {
    const change = core.goalAchievedChange

    alerts.push({
      id: change < 0 ? 'queda-mes-anterior' : change > 0 ? 'alta-mes-anterior' : 'estavel-mes-anterior',
      tone: change < 0 ? 'atencao' : change > 0 ? 'positivo' : 'neutro',
      title:
        change < 0
          ? `Queda em relação a ${core.previousMonthLabel}`
          : change > 0
            ? `Alta em relação a ${core.previousMonthLabel}`
            : `Estável em relação a ${core.previousMonthLabel}`,
      detail:
        change === 0
          ? `O realizado da meta repetiu o volume do mês anterior, ${salesText(core.goalAchieved)}.`
          : `O realizado da meta variou ${change > 0 ? '+' : '-'}${salesText(Math.abs(change))} contra ${formatNumber(core.previousGoalAchieved ?? 0)} do mês anterior.`,
    })
  }

  if (core.eligibleInternalSellers.length > 0) {
    const attained = core.attainedSellers.length
    const total = core.eligibleInternalSellers.length
    const missed = core.notAttainedSellers.length

    alerts.push({
      id: 'vendedores-na-meta',
      tone: attained * 2 >= total ? 'positivo' : 'atencao',
      title: `${formatNumber(attained)} de ${internalSellersText(total)} na meta`,
      detail: `A meta individual é de ${formatNumber(INTERNAL_SELLER_MONTHLY_GOAL)} vendas ativas por mês. ${pluralize(missed, 'vendedor ficou', 'vendedores ficaram')} abaixo dela no recorte.`,
    })
  }

  if (core.corporateAchieved > 0) {
    alerts.push({
      id: 'corporativo-supermeta',
      tone: 'neutro',
      title: 'Corporativo contribuiu somente para a supermeta',
      detail: `${activeSalesText(core.corporateAchieved)} do Corporativo ${agreeWith(core.corporateAchieved, 'entrou', 'entraram')} no realizado total usado contra a supermeta e ${agreeWith(core.corporateAchieved, 'ficou', 'ficaram')} fora do realizado da meta normal.`,
    })
  }

  return alerts
}

/**
 * Leitura determinística do período.
 *
 * Descreve o que os números mostram e explica a diferença entre os dois
 * numeradores. Não atribui causa a equipe, mercado ou operação: nenhum dado
 * desta página sustenta esse tipo de afirmação.
 */
function buildStory(core: SnapshotCore): CommercialGoalStory {
  if (core.incompatibleSelection) {
    return {
      title: `Sem recorte válido em ${core.monthLabel}.`,
      text: 'Os filtros de cidade e vendedor não se cruzam: nenhum vendedor selecionado atua na cidade escolhida. Ajuste um dos dois para ver meta e realizado.',
      watch: 'Cidade e vendedor são aplicados juntos, nunca um no lugar do outro.',
    }
  }

  const partnerPart =
    core.partnerAchieved > 0
      ? `Colaboradores responderam por ${activeSalesText(core.partnerAchieved)} do realizado da meta${core.partnerShareOfGoalAchieved === null ? '' : `, ou ${formatPercent(core.partnerShareOfGoalAchieved)} dele`}, e não possuem meta própria.`
      : 'Nenhuma venda ativa do recorte foi creditada a Colaboradores.'

  const corporatePart =
    core.corporateAchieved > 0
      ? ` O Corporativo somou ${activeSalesText(core.corporateAchieved)}, e esse volume entra apenas no realizado total usado contra a supermeta.`
      : ''

  const watch =
    core.previousMonthLabel === null || core.goalAchievedChange === null
      ? 'Janeiro é o primeiro mês da base, então não há mês anterior para comparar.'
      : core.goalAchievedChange === 0
        ? `O realizado da meta repetiu o volume de ${core.previousMonthLabel}.`
        : `Contra ${core.previousMonthLabel}, o realizado da meta ${core.goalAchievedChange > 0 ? 'subiu' : 'caiu'} ${salesText(Math.abs(core.goalAchievedChange))}.`

  if (core.goal === null) {
    return {
      title: `${core.monthLabel}: ${activeSalesText(core.totalAchieved)}, sem meta de volume no recorte.`,
      text: `O recorte não tem vendedor interno elegível, então meta, gap e atingimento não são calculados. ${partnerPart}${corporatePart}`,
      watch,
    }
  }

  const attainment = core.goalAttainment ?? 0
  const superGoal = core.superGoal ?? superGoalFor(core.goal)
  const reachedGoal = core.goalAchieved >= core.goal
  const reachedSuperGoal = core.totalAchieved >= superGoal

  const goalSentence = reachedGoal
    ? `O realizado da meta chegou a ${activeSalesText(core.goalAchieved)}, ${salesText(core.surplusOverGoal ?? 0)} acima da meta de ${formatNumber(core.goal)}.`
    : `O realizado da meta ficou em ${activeSalesText(core.goalAchieved)}, ${salesText(core.gapToGoal ?? 0)} abaixo da meta de ${formatNumber(core.goal)}.`

  const superGoalSentence = `A supermeta usa outro numerador, o realizado total de ${salesText(core.totalAchieved)}, e ficou em ${formatPercent(core.superGoalAttainment ?? 0)} de ${formatNumber(superGoal)}${reachedSuperGoal ? ', portanto atingida' : ''}.`

  return {
    title: `${core.monthLabel}: meta em ${formatPercent(attainment)} e supermeta em ${formatPercent(core.superGoalAttainment ?? 0)}.`,
    text: `${goalSentence} Esse numerador soma Vendas Internas e Colaboradores, e não inclui o Corporativo. ${superGoalSentence} ${partnerPart}${corporatePart}`,
    watch,
  }
}

/* -------------------------------------------------------------------------- */
/* Snapshot                                                                   */
/* -------------------------------------------------------------------------- */

/** Todos os indicadores da página, a partir dos fatos e dos filtros. */
export function buildCommercialGoalsSnapshot(
  dataset: CommercialDataset,
  filters: CommercialGoalsFilters,
): CommercialGoalsSnapshot {
  const partnersByCode = indexPartnersByCode(dataset.partners)
  const sellersById = indexSellersById(dataset.sellers)
  const basis = resolveGoalBasis(dataset.sellers, filters)
  const aggregates = aggregateMonths(dataset, filters, partnersByCode, sellersById)

  const aggregate = aggregates.get(filters.month) ?? emptyAggregate(filters.month)
  const goalAchieved = aggregate.internal + aggregate.partner
  const totalAchieved = goalAchieved + aggregate.corporate

  const previousMonth = previousCommercialMonth(filters.month)
  const previousAggregate = previousMonth === null ? null : (aggregates.get(previousMonth) ?? null)
  const previousGoalAchieved =
    previousAggregate === null ? null : previousAggregate.internal + previousAggregate.partner

  const performance = buildSellerPerformance(basis.eligibleInternalSellers, aggregate)

  const monthly: CommercialMonthlyPoint[] = dataset.months.map((month) => {
    const monthAggregate = aggregates.get(month) ?? emptyAggregate(month)
    const monthGoalAchieved = monthAggregate.internal + monthAggregate.partner

    return {
      month,
      label: monthShortLabel(month),
      goal: basis.goal,
      superGoal: basis.superGoal,
      goalAchieved: monthGoalAchieved,
      totalAchieved: monthGoalAchieved + monthAggregate.corporate,
      selected: month === filters.month,
    }
  })

  const core: SnapshotCore = {
    month: filters.month,
    monthLabel: monthLabel(filters.month),
    previousMonth,
    previousMonthLabel: previousMonth === null ? null : monthLabel(previousMonth),
    daysInMonth: daysInMonth(filters.month),

    scope: basis.scope,
    goal: basis.goal,
    superGoal: basis.superGoal,
    incompatibleSelection: basis.incompatibleSelection,

    goalAchieved,
    totalAchieved,
    internalAchieved: aggregate.internal,
    partnerAchieved: aggregate.partner,
    corporateAchieved: aggregate.corporate,

    goalAttainment: basis.goal === null || basis.goal === 0 ? null : goalAchieved / basis.goal,
    superGoalAttainment:
      basis.superGoal === null || basis.superGoal === 0 ? null : totalAchieved / basis.superGoal,
    gapToGoal: basis.goal === null ? null : Math.max(basis.goal - goalAchieved, 0),
    surplusOverGoal: basis.goal === null ? null : Math.max(goalAchieved - basis.goal, 0),
    gapToSuperGoal: basis.superGoal === null ? null : Math.max(basis.superGoal - totalAchieved, 0),
    partnerShareOfGoalAchieved: goalAchieved === 0 ? null : aggregate.partner / goalAchieved,

    previousGoalAchieved,
    goalAchievedChange: previousGoalAchieved === null ? null : goalAchieved - previousGoalAchieved,

    eligibleInternalSellers: basis.eligibleInternalSellers,
    attainedSellers: performance.filter((item) => item.attained),
    notAttainedSellers: performance.filter((item) => !item.attained),

    daily: buildDailyPoints(
      filters.month,
      aggregate,
      basis.goal,
      basis.superGoal,
      dataset.referenceDate,
    ),
    monthly,

    hasResults: totalAchieved > 0,
  }

  return { ...core, alerts: buildAlerts(core), story: buildStory(core) }
}

/* -------------------------------------------------------------------------- */
/* Consistência da base                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Inconsistências da base mockada.
 *
 * Existe para que nada seja aceito silenciosamente: código de indicação sem
 * colaborador, contrato ativo sem data de ativação, criador ou cidade fora do
 * catálogo e ativação fora do período são reportados à interface em vez de
 * sumirem dentro de uma soma.
 */
export function validateCommercialDataset(
  dataset: CommercialDataset,
): CommercialConsistencyIssue[] {
  const partnersByCode = indexPartnersByCode(dataset.partners)
  const sellerIds = new Set(dataset.sellers.map((seller) => seller.id))
  const cityIds = new Set(dataset.cities.map((city) => city.id))
  const found = new Map<string, { message: string; occurrences: number; sampleSaleId: string }>()

  const register = (id: string, message: string, saleId: string): void => {
    const current = found.get(id)

    if (current) {
      current.occurrences += 1

      return
    }

    found.set(id, { message, occurrences: 1, sampleSaleId: saleId })
  }

  for (const sale of dataset.sales) {
    if (sale.status === 'ativa' && !isIsoDate(sale.activatedAt)) {
      register(
        'ativa-sem-ativacao',
        'Venda com status ativo e sem data de ativação válida. Ela fica fora do realizado.',
        sale.id,
      )
    }

    if (sale.indicationCode !== null && !partnersByCode.has(sale.indicationCode)) {
      register(
        'indicacao-desconhecida',
        'Código de indicação sem colaborador correspondente. O crédito não é atribuído e a venda fica fora do realizado.',
        sale.id,
      )
    }

    if (!sellerIds.has(sale.creatorId)) {
      register('criador-desconhecido', 'Venda criada por um vendedor fora do catálogo.', sale.id)
    }

    if (!cityIds.has(sale.cityId)) {
      register('cidade-desconhecida', 'Venda em uma cidade fora do catálogo da base.', sale.id)
    }

    if (
      isIsoDate(sale.activatedAt) &&
      (sale.activatedAt < dataset.periodStart || sale.activatedAt > dataset.periodEnd)
    ) {
      register(
        'ativacao-fora-do-periodo',
        'Venda com data de ativação fora do período coberto pela base.',
        sale.id,
      )
    }
  }

  return [...found.entries()].map(([id, issue]) => ({ id, ...issue }))
}

/** Filtros iniciais da página: julho de 2026, todas as cidades, todos os vendedores. */
export function initialCommercialGoalsFilters(month: CommercialMonthKey): CommercialGoalsFilters {
  return { month, cityId: null, sellerIds: [] }
}

/** Meses do período, para o seletor de mês. */
export const commercialGoalMonths = COMMERCIAL_MONTHS
