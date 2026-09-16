import {
  addDays,
  COMMERCIAL_PERIOD_END,
  COMMERCIAL_PERIOD_START,
  dayOfMonth,
  daysInMonth,
  formatIsoAsBrDate,
  isCommercialMonthKey,
  isoDateInMonth,
  monthKeyOf,
  monthShortLabel,
  previousCommercialMonth,
} from '../../../data/commercialCalendar'
import { defaultPeriodFor, type SourcePeriod } from '../../../data/defaultPeriod'
import type {
  CommercialCityId,
  CommercialDataset,
  CommercialSaleStatus,
} from '../../../data/commercialTypes'
import {
  buildSalesPeriodSnapshot,
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
  /**
   * Mês `AAAA-MM`. Texto, e não `CommercialMonthKey`, de propósito: a lista
   * fechada de meses é da base sintética, enquanto o serviço de BI manda os
   * meses da cobertura real do banco (janeiro a setembro em 10/09/2026, e um a
   * mais a cada mês). O adaptador da API valida a forma; a base local continua
   * entregando os meses da lista.
   */
  readonly month: string
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
 * Composição de clientes das vendas ativadas do recorte.
 *
 * Regra decidida com o Mário em 15/09/2026: cliente é quem comprou, então o
 * indicador nasce da venda e não do cadastro. Cliente novo é aquele cuja venda
 * ativada no recorte é a PRIMEIRA ativação dele na base inteira, medida desde
 * 2019 e não apenas no ano corrente.
 *
 * As três parcelas dividem as mesmas vendas ativadas do recorte e não se
 * sobrepõem, então somam `metrics.activeSales`.
 *
 * Por que a data de cadastro do cliente ficou de fora: ela nasce junto da
 * venda em 91% dos casos, mas erra na virada do mês. Quem foi cadastrado em
 * julho e ligou a internet em agosto é cliente novo de agosto para a página e
 * cliente de julho para o cadastro; em agosto/2026 isso separava 516 de 576
 * clientes. Além disso o cadastro só tem vendedor em 23% dos registros de
 * 2026, o que deixaria o card cego ao filtro de vendedor.
 */
export type OverviewCustomerMix = {
  /** Ativações de quem nunca teve contrato antes. É o número do card. */
  readonly newCustomers: number
  /**
   * Ativações de cliente que já tinha outro contrato ativo na data. É venda
   * dentro da carteira: aumenta receita, não aumenta a base de clientes.
   */
  readonly expansion: number
  /** Ativações de quem já foi cliente, cancelou e voltou. */
  readonly returning: number
  /**
   * Variação dos clientes novos frente ao período anterior comparável. Nula
   * quando não há base anterior, como em qualquer outra comparação da página.
   */
  readonly changeRate: number | null
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
   * Composição de clientes do recorte, sempre vinda da fonte.
   *
   * `null` significa que a fonte não separa cliente novo de cliente antigo, e
   * é o caso da base sintética: ela gera um CPF por venda, então todo cliente
   * apareceria como novo. O card escreve isso na tela em vez de mostrar um
   * número que o dado não sustenta.
   *
   * O portal também não tem como derivar isso sozinho quando está ligado ao
   * serviço: dizer que alguém nunca comprou exige varrer o histórico inteiro
   * do cliente, e esta página recebe apenas os totais já somados do recorte.
   */
  readonly customerMix: OverviewCustomerMix | null
  /**
   * Tempo até a ativação das vendas ativadas do recorte.
   *
   * `null` significa que a fonte não traz a data em que o contrato foi
   * fechado, e é o caso da base sintética: ela guarda a data do evento e a da
   * ativação, nunca as duas pontas da espera. O card avisa isso na tela, do
   * mesmo jeito que Novos Clientes já faz.
   */
  readonly activationDays: OverviewActivationDays | null
  /**
   * Valor do meio do mesmo tempo no período anterior comparável, que é o que
   * dá a comparação do card. Nulo sem período anterior ou sem a medida nele.
   */
  readonly previousActivationDaysMedian: number | null
}

/**
 * Faixas da espera até a ativação, na ordem em que o card as apresenta.
 *
 * Esta é a lista oficial do portal, como `OVERVIEW_PIPELINE_STAGES` é a do
 * fluxo: o serviço manda as contagens e a ordem sai daqui, então faixa vazia
 * continua aparecendo no card.
 *
 * São quatro, e não cinco, porque a grade do card tem duas colunas estreitas.
 * Elas cobrem a fila inteira sem se sobrepor, e é isso que responde a pergunta
 * que o valor do meio sozinho deixava no ar: quanto esperou a maior parte dos
 * clientes, e não só o meio e a cauda.
 *
 * A última usa o rótulo compacto `4 dias ou +` pelo mesmo motivo que a etapa
 * `Em aprovação` do fluxo: nas telas largas, com os cinco cards lado a lado, a
 * coluna encolhe e a forma por extenso quebra em duas linhas. O rótulo inteiro
 * continua valendo na leitura gerencial, que tem a largura do card todo.
 */
export const OVERVIEW_ACTIVATION_BANDS = [
  { id: 'mesmo-dia', label: 'Mesmo dia' },
  { id: '1-dia', label: '1 dia' },
  { id: '2-a-3-dias', label: '2 a 3 dias' },
  { id: '4-dias-ou-mais', label: '4 dias ou +' },
] as const

export type OverviewActivationBandId = (typeof OVERVIEW_ACTIVATION_BANDS)[number]['id']

export type OverviewActivationBand = {
  readonly id: OverviewActivationBandId
  readonly label: string
  readonly count: number
  /** Fatia da faixa dentro do total medido: as quatro somam 1. */
  readonly share: number
}

/**
 * Tempo entre o contrato fechado e o sinal ligado, em dias.
 *
 * Quem mede é o serviço, sobre as vendas ativadas do recorte, porque esta
 * página recebe totais e não os contratos um a um.
 *
 * Nenhuma das leituras é a média: contrato antigo religado depois de mais de
 * dois anos existe na base e deslocaria a média sem representar o dia a dia.
 */
export type OverviewActivationDays = {
  /** Valor do meio: metade das ativações esperou menos que isso. */
  readonly medianDays: number
  /** A fila inteira dividida em faixas, o que o card desenha na barra. */
  readonly bands: readonly OverviewActivationBand[]
}

/**
 * Recorte de abertura da página para uma cobertura qualquer.
 *
 * O período sai de `defaultPeriodFor`, a mesma regra da Visão Geral de OS: do
 * dia 1 do mês corrente até hoje, sem passar do que a fonte cobre. Ligada ao
 * serviço, a cobertura é a do banco e a página abre no mês corrente; na base
 * sintética, que termina em 31/07/2026, o resultado é o de sempre, julho
 * inteiro.
 */
export function initialCommercialOverviewFiltersFor(
  coverage: SourcePeriod,
): CommercialOverviewFilters {
  const period = defaultPeriodFor(coverage)

  return {
    startDate: period.start,
    endDate: period.end,
    cityId: null,
    team: 'todos',
    sellerId: null,
  }
}

/** Recorte de abertura da base sintética, a cobertura de janeiro a julho. */
export function initialCommercialOverviewFilters(): CommercialOverviewFilters {
  return initialCommercialOverviewFiltersFor({
    start: COMMERCIAL_PERIOD_START,
    end: COMMERCIAL_PERIOD_END,
  })
}

/**
 * Correção do período quando a cobertura da fonte finalmente é conhecida.
 *
 * A página abre no recorte da base sintética porque a cobertura do banco só
 * chega junto da primeira resposta. Esta função diz qual é o recorte certo
 * depois dessa descoberta, mantendo cidade, time e vendedor como estão.
 *
 * `null` quer dizer que não há nada a corrigir, ou seja, o período em uso já é
 * o de abertura da cobertura recebida. Quem chama decide QUANDO perguntar: a
 * correção vale uma vez só, antes de a pessoa escolher o próprio período.
 */
export function openingPeriodCorrection(
  current: CommercialOverviewFilters,
  coverage: SourcePeriod,
): CommercialOverviewFilters | null {
  const opening = initialCommercialOverviewFiltersFor(coverage)

  if (current.startDate === opening.startDate && current.endDate === opening.endDate) {
    return null
  }

  return { ...current, startDate: opening.startDate, endDate: opening.endDate }
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
    // A base sintética dá um CPF diferente para cada venda, então ela não tem
    // como dizer quem já era cliente: todo mundo apareceria como novo. O card
    // avisa isso na tela, e o número real vem do serviço de BI.
    customerMix: null,
    // Mesma situação no tempo até a ativação: a base sintética guarda a data do
    // evento e a da ativação, e nunca a data em que o contrato foi fechado.
    // Sem as duas pontas não existe espera para medir.
    activationDays: null,
    previousActivationDaysMedian: null,
  }
}
