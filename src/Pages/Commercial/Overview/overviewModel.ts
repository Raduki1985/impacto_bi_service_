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
  CommercialSaleStatus,
} from '../../../data/commercialTypes'
import {
  buildSalesPeriodSnapshot,
  classifyCommercialInstallation,
  DEFAULT_SALES_PERIOD_END,
  DEFAULT_SALES_PERIOD_START,
  type SalesPeriodFact,
  type SalesPeriodMetrics,
  type SalesPeriodSellerRank,
  type SalesPeriodTeam,
  type SalesPeriodTeamFilter,
} from '../SalesPeriod/salesPeriodModel'

/**
 * Vendedor como o filtro precisa dele: identificador e nome.
 *
 * É de propósito menor que `CommercialSeller`: o catálogo do serviço manda só
 * estes dois campos, e o seletor não precisa de mais nada. Assim a base local
 * e a API alimentam o mesmo controle sem inventar cidade, segmento nem
 * situação para quem vem do serviço.
 */
export type CommercialSellerOption = {
  readonly id: string
  readonly name: string
}

export type CommercialOverviewFilters = {
  readonly startDate: string
  readonly endDate: string
  readonly cityId: CommercialCityId | null
  readonly team: SalesPeriodTeamFilter
  /** Vendedor selecionado. Nulo significa todos os vendedores. */
  readonly sellerId: string | null
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

/**
 * Etapas do fluxo, na ordem em que o card Status das Assinaturas as apresenta.
 *
 * Esta é a ÚNICA lista de status de fluxo da Visão Geral. Ela responde por três
 * coisas ao mesmo tempo: quais contratos entram na composição, em que ordem
 * aparecem e com que rótulo. Antes existia um `Set` só para contar; ele foi
 * substituído por esta coleção ordenada para não abrir uma segunda lista que
 * pudesse divergir da primeira.
 *
 * `aguardando-aprovacao` usa o rótulo compacto `Em aprovação` porque a grade do
 * card tem duas colunas estreitas. O rótulo oficial, `Aguardando aprovação`,
 * continua valendo em Vendas por Período e no texto da leitura gerencial.
 *
 * São etapas do fluxo, não motivos nem causas de permanência: o sistema guarda
 * o status atual do contrato, e nada aqui explica por que ele está nele.
 */
export const OVERVIEW_PIPELINE_STAGES = [
  { id: 'pendente', label: 'Pendente' },
  { id: 'assinada', label: 'Assinada' },
  { id: 'agendada', label: 'Agendada' },
  { id: 'aguardando-aprovacao', label: 'Em aprovação' },
] as const satisfies readonly { id: CommercialSaleStatus; label: string }[]

export type OverviewPipelineStageId = (typeof OVERVIEW_PIPELINE_STAGES)[number]['id']

/**
 * Os mesmos quatro status de fluxo, em forma de conjunto, para quem precisa
 * apenas perguntar se um contrato está em fluxo. Deriva da coleção oficial de
 * propósito: continua existindo uma única lista de status de fluxo na página.
 */
const PIPELINE_STAGE_IDS: ReadonlySet<CommercialSaleStatus> = new Set(
  OVERVIEW_PIPELINE_STAGES.map((stage) => stage.id),
)

export type OverviewPipelineStage = {
  readonly id: OverviewPipelineStageId
  readonly label: string
  readonly count: number
  /**
   * Participação DENTRO do fluxo, não sobre o total de contratos. É o que dá a
   * largura do segmento na barra: as quatro somam 1 sempre que existe pelo
   * menos um contrato em fluxo.
   */
  readonly share: number
}

/**
 * Contratos aguardando pagamento. INDICADOR PROVISÓRIO.
 *
 * O SGI não possui hoje um status de venda "aguardando pagamento", e o registro
 * de instalação não guarda baixa, data de recebimento nem inadimplência: nem o
 * portal nem o serviço de BI sabem se uma cobrança foi paga. Enquanto esse dado
 * não existir, o indicador é uma aproximação declarada, decidida com o Mário em
 * 01/09/2026: contrato que ainda não foi ativado, ou seja, está em uma das
 * quatro etapas do fluxo, e que tem instalação com valor final maior que zero,
 * ou seja, com cobrança em aberto.
 *
 * O que ele NÃO é: não é inadimplência, não é primeiro boleto não pago e não
 * afirma que alguém deixou de pagar. Quando o serviço entregar o campo real de
 * pagamento, esta regra é substituída, e não complementada.
 */
export type OverviewAwaitingPayment = {
  /** Contratos em fluxo com instalação a cobrar. */
  readonly contracts: number
  /**
   * Soma dos valores finais dessas instalações. É valor contratado, e não valor
   * recebido. Cobrança única, que nunca se soma ao valor mensal ativado.
   */
  readonly chargedValue: number
  /** Participação nos contratos em fluxo do recorte. */
  readonly share: number
  /**
   * Contratos em fluxo sem registro válido de instalação. Ficam fora da conta,
   * então o indicador é sempre um piso, nunca um total fechado.
   */
  readonly withoutData: number
}

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
  /**
   * Composição atual dos contratos em fluxo, sempre com as quatro etapas na
   * ordem de `OVERVIEW_PIPELINE_STAGES`, inclusive as que estão zeradas.
   *
   * É uma fotografia do estoque, não uma série. O dataset guarda o status atual
   * do contrato e não o histórico das mudanças, então nenhuma leitura temporal
   * pode ser derivada daqui.
   *
   * A soma das quantidades é sempre igual a `metrics.pipelineSales`, porque as
   * duas contagens saem dos mesmos fatos e do mesmo conjunto de status.
   */
  readonly pipelineStages: readonly OverviewPipelineStage[]
  /**
   * Contratos aguardando pagamento, calculados no portal a partir dos fatos e
   * das instalações da base.
   *
   * `null` significa que a fonte não entrega o indicador, e é o caso da rota
   * agregada do serviço de BI, cujo contrato ainda não tem a cobrança de
   * instalação em aberto. O card escreve isso na tela em vez de mostrar zero,
   * porque ausência de dado não é ausência de contrato aguardando pagamento.
   */
  readonly awaitingPayment: OverviewAwaitingPayment | null
}

export function initialCommercialOverviewFilters(): CommercialOverviewFilters {
  return {
    startDate: DEFAULT_SALES_PERIOD_START,
    endDate: DEFAULT_SALES_PERIOD_END,
    cityId: null,
    team: 'todos',
    sellerId: null,
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

/**
 * Composição atual dos contratos em fluxo.
 *
 * Percorre as etapas na ordem oficial, e não os fatos, para que uma etapa sem
 * nenhum contrato continue aparecendo zerada em vez de sumir do card. O
 * denominador da participação é o próprio total em fluxo: com o fluxo vazio a
 * participação é zero, sem divisão inválida.
 */
function buildPipelineStages(
  facts: readonly SalesPeriodFact[],
  pipelineTotal: number,
): OverviewPipelineStage[] {
  return OVERVIEW_PIPELINE_STAGES.map((stage) => {
    const count = facts.filter((fact) => fact.status === stage.id).length
    return {
      id: stage.id,
      label: stage.label,
      count,
      share: pipelineTotal === 0 ? 0 : count / pipelineTotal,
    }
  })
}

/**
 * Contratos em fluxo com cobrança de instalação em aberto.
 *
 * Percorre os fatos já filtrados do recorte, e não a base inteira: período,
 * cidade e time do controle superior continuam valendo, como em qualquer outro
 * card. A validação do registro de instalação é a mesma de Vendas por Período
 * (`classifyCommercialInstallation`), então uma instalação impossível fica de
 * fora das duas páginas pelo mesmo motivo, em vez de ser corrigida aqui.
 *
 * Três situações são separadas de propósito: instalação a cobrar entra na
 * conta; instalação isenta não entra, porque não há o que pagar; contrato sem
 * registro válido também não entra, e é contado à parte, porque ausência de
 * dado não é isenção.
 */
function buildAwaitingPayment(
  dataset: CommercialDataset,
  facts: readonly SalesPeriodFact[],
  pipelineTotal: number,
): OverviewAwaitingPayment {
  const installations = new Map(
    dataset.installations.map((installation) => [installation.saleId, installation]),
  )
  let contracts = 0
  let chargedValue = 0
  let withoutData = 0

  facts.forEach((fact) => {
    if (!PIPELINE_STAGE_IDS.has(fact.status)) return

    const installation = installations.get(fact.id)
    if (installation === undefined || classifyCommercialInstallation(installation) === null) {
      withoutData += 1
      return
    }
    if (installation.finalPrice <= 0) return

    contracts += 1
    chargedValue += installation.finalPrice
  })

  return {
    contracts,
    chargedValue,
    share: pipelineTotal === 0 ? 0 : contracts / pipelineTotal,
    withoutData,
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
  // Ranking de vendedores: ignora somente o filtro Vendedor, pelo mesmo motivo
  // dos painéis de cidade e de time. Com um vendedor selecionado o Top 5
  // continua sendo o Top 5 do recorte, e o painel apenas destaca a linha dele;
  // reduzir o ranking a um nome só transformaria uma comparação em um número
  // solto, e a posição dele deixaria de significar alguma coisa.
  const sellerScope = buildSalesPeriodSnapshot(
    dataset,
    salesPeriodFilters({ ...filters, sellerId: null }),
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
    topSellers: sellerScope.topSellers,
    monthly: buildMonthly(dataset, filters),
    // Sai dos mesmos fatos já filtrados por período, cidade e time, e do mesmo
    // total que alimenta o valor do card.
    pipelineStages: buildPipelineStages(snapshot.facts, snapshot.metrics.pipelineSales),
    // Mesmos fatos e mesmo denominador do card Status das Assinaturas: o número de
    // aguardando pagamento nunca pode ultrapassar o do fluxo.
    awaitingPayment: buildAwaitingPayment(
      dataset,
      snapshot.facts,
      snapshot.metrics.pipelineSales,
    ),
  }
}
