import { describe, expect, it, vi } from 'vitest'

import { fetchCommercialOverview } from './commercialOverviewApi'
import { initialCommercialOverviewFilters } from './overviewModel'

/**
 * O adaptador é onde a resposta do serviço vira o modelo da tela. O que estes
 * cenários guardam: o que o contrato manda é copiado, o que é apresentação é
 * derivado aqui, e o que não existe no contrato não vira número inventado.
 */
vi.mock('../../../data/api/biApiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api/biApiClient')>()
  return { ...actual, fetchFromBiApi: (path: string, params?: unknown) => mockedFetch(path, params) }
})

let mockedFetch: (path: string, params?: unknown) => Promise<unknown> = () => Promise.resolve({})

function respondWith(payload: unknown) {
  mockedFetch = () => Promise.resolve(payload)
}

const respostaValida = {
  source: { months: ['2026-06', '2026-07'] },
  catalog: { cities: [{ id: 'atibaia', name: 'Atibaia' }] },
  metrics: {
    total_contracts: 1132,
    active_sales: 883,
    active_sales_sold_earlier: 67,
    activation_rate: 0.78,
    commercial_sales: 795,
    corporate_sales: 88,
    indicated_sales: 64,
    seller_sales: 819,
    monthly_revenue: 132111.7,
    average_ticket: 149.62,
    pipeline_sales: 162,
    sold_contracts: 1145,
    awaiting_activation: 165,
    goal: 800,
    super_goal: 880,
    goal_achieved: 795,
    super_goal_achieved: 883,
    activation_days_median: 2,
    activation_days_p90: 6,
  },
  previous: {
    range: { start_date: '2026-06-01', end_date: '2026-06-30' },
    active_sales: 894,
    monthly_revenue: 131850.1,
    goal_achieved: 820,
    super_goal_achieved: 894,
    new_customers: 700,
    activation_days_median: 3,
  },
  customers: { new: 693, expansion: 147, returning: 43 },
  activation_bands: [
    { id: 'mesmo-dia', label: 'Mesmo dia', count: 100 },
    { id: '1-dia', label: '1 dia', count: 300 },
    { id: '2-a-3-dias', label: '2 a 3 dias', count: 383 },
    { id: '4-dias-ou-mais', label: '4 dias ou mais', count: 100 },
  ],
  awaiting_stages: [
    { id: 'pendente', label: 'Pendente', count: 79, stalled: 60 },
    { id: 'assinada', label: 'Assinada', count: 47, stalled: 10 },
    { id: 'agendada', label: 'Agendada', count: 36, stalled: 20 },
    { id: 'cancelada', label: 'Cancelada', count: 3 },
  ],
  cities: {
    comparison_total: 883,
    rows: [{ id: 'atibaia', label: 'Atibaia', active_sales: 463, monthly_value: 68933.7 }],
  },
  teams: {
    comparison_total: 883,
    rows: [
      { id: 'comercial', label: 'Comercial', active_sales: 795, monthly_value: 107920.5 },
      { id: 'corporativo', label: 'Corporativo', active_sales: 88, monthly_value: 24191.2 },
    ],
  },
  origins: [
    { id: 'vendedores', label: 'Vendedores', active_sales: 819, monthly_value: 123588.1 },
    { id: 'indicacao', label: 'Indicação', active_sales: 64, monthly_value: 8523.6 },
  ],
  top_plans: [{ label: '600 MB', active_sales: 160, monthly_value: 20784 }],
  top_sellers: [
    { seller_id: 'v-1', seller_name: 'Cristina', team: 'comercial', active_sales: 60, monthly_revenue: 8194 },
  ],
  monthly: [
    {
      month: '2026-07',
      commercial_sales: 795,
      corporate_sales: 88,
      unassigned_sales: 0,
      commercial_value: 107920.5,
      corporate_value: 24191.2,
      unassigned_value: 0,
    },
  ],
  cohorts: [
    { month: '2026-07', sold: 790, activated_in_month: 675, activated_later: 66, awaiting: 49, cancelled_before: 0, other: 0 },
  ],
}

const filtros = initialCommercialOverviewFilters()

describe('fetchCommercialOverview', () => {
  it('copia os indicadores do contrato sem recalcular nada', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.metrics.activeSales).toBe(883)
    expect(snapshot.metrics.monthlyRevenue).toBe(132111.7)
    expect(snapshot.metrics.goal).toBe(800)
    expect(snapshot.metrics.goalAchieved).toBe(795)
  })

  it('deriva a variação contra o período anterior, que o contrato não manda pronta', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.metrics.activeSalesChangeRate).toBeCloseTo((883 - 894) / 894, 6)
    expect(snapshot.monthlyValueChangeRate).toBeCloseTo((132111.7 - 131850.1) / 131850.1, 6)
    expect(snapshot.previousGoalAchieved).toBe(820)
  })

  it('nomeia a comparação pela janela que o serviço usou', async () => {
    // Julho inteiro contra junho inteiro, a janela da resposta.
    respondWith(respostaValida)
    expect((await fetchCommercialOverview(filtros)).snapshot.comparison?.label).toBe('vs. junho')

    // Mês até um dia, na régua de 25/09/2026: agosto até o mesmo dia.
    const setembro = { ...filtros, startDate: '2026-09-01', endDate: '2026-09-24' }
    respondWith({
      ...respostaValida,
      previous: { ...respostaValida.previous, range: { start_date: '2026-08-01', end_date: '2026-08-24' } },
    })
    expect((await fetchCommercialOverview(setembro)).snapshot.comparison?.label).toBe(
      'vs. agosto até o dia 24',
    )

    // Serviço antigo, com a mesma duração logo antes: o card escreve as datas.
    respondWith({
      ...respostaValida,
      previous: { ...respostaValida.previous, range: { start_date: '2026-08-08', end_date: '2026-08-31' } },
    })
    expect((await fetchCommercialOverview(setembro)).snapshot.comparison?.label).toBe(
      'vs. 08/08 a 31/08',
    )
  })

  it('sem a janela na resposta, a comparação fica sem nome e o card usa o genérico', async () => {
    respondWith({ ...respostaValida, previous: { ...respostaValida.previous, range: undefined } })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.comparison).toBeNull()
    // O número continua comparado: só o nome some.
    expect(snapshot.metrics.activeSalesChangeRate).toBeCloseTo((883 - 894) / 894, 6)
  })

  it('período comparado sem ativação chega como zero, e não como ausência', async () => {
    respondWith({ ...respostaValida, previous: { ...respostaValida.previous, active_sales: 0 } })
    const comZero = (await fetchCommercialOverview(filtros)).snapshot

    expect(comZero.previousActiveSales).toBe(0)
    expect(comZero.metrics.activeSalesChangeRate).toBeNull()
    expect(comZero.comparison?.within).toBe('em junho')

    respondWith({ ...respostaValida, previous: null })
    expect((await fetchCommercialOverview(filtros)).snapshot.previousActiveSales).toBeNull()
  })

  it('deriva a participação de cada painel sobre o próprio total comparativo', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.cityComparisonTotal).toBe(883)
    expect(snapshot.topCities[0].share).toBeCloseTo(463 / 883, 6)
    // Origem usa o denominador do painel de times, como na página.
    expect(snapshot.origins[0].share).toBeCloseTo(819 / 883, 6)
  })

  /**
   * Aguardando Ativação. Quem conta a venda pela data do contrato é o serviço,
   * porque esta rota devolve totais. O portal copia o vendido, o aguardando e
   * as etapas, deriva só a fatia de cada uma, e trata a ausência do bloco como
   * ausência de dado, como faz com Novos Clientes e Tempo até a ativação.
   */
  it('copia o vendido e o aguardando ativação, e deriva a fatia de cada etapa', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)
    const card = snapshot.awaitingActivation

    expect(card?.sold).toBe(1145)
    expect(card?.awaiting).toBe(165)
    // Régua própria: o vendido não é o total de contratos por data do evento.
    expect(card?.sold).not.toBe(snapshot.metrics.totalContracts)
    expect(card?.stages.map((etapa) => etapa.count)).toEqual([79, 47, 36, 3])
    expect(card?.stages[0].share).toBeCloseTo(79 / 165, 6)
    expect(card?.stages.reduce((sum, etapa) => sum + etapa.share, 0)).toBeCloseTo(1, 6)
  })

  it('mantém as quatro etapas na ordem oficial, mesmo zeradas', async () => {
    respondWith({
      ...respostaValida,
      metrics: { ...respostaValida.metrics, awaiting_activation: 59 },
      awaiting_stages: [{ id: 'pendente', label: 'Pendente', count: 59 }],
    })

    const { snapshot } = await fetchCommercialOverview(filtros)
    const card = snapshot.awaitingActivation

    expect(card?.stages.map((etapa) => etapa.id)).toEqual([
      'pendente',
      'assinada',
      'agendada',
      'cancelada',
    ])
    expect(card?.stages[3].count).toBe(0)
  })

  it('sem os totais por data da venda, o card fica sem dado em vez de mostrar zero', async () => {
    const { sold_contracts, awaiting_activation, ...semVendido } = respostaValida.metrics
    respondWith({ ...respostaValida, metrics: semVendido, awaiting_stages: undefined })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(sold_contracts).toBe(1145)
    expect(awaiting_activation).toBe(165)
    expect(snapshot.awaitingActivation).toBeNull()
  })

  it('soma Aguardando aprovação em Pendente quando o serviço a manda como etapa própria', async () => {
    // O vocabulário do card antigo tinha essa etapa; no card novo ela não pode
    // sumir da conta, então entra em Pendente, como no modelo da base sintética.
    respondWith({
      ...respostaValida,
      metrics: { ...respostaValida.metrics, awaiting_activation: 170 },
      awaiting_stages: [
        ...respostaValida.awaiting_stages,
        { id: 'aguardando-aprovacao', label: 'Em aprovação', count: 5, stalled: 2 },
      ],
    })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.awaitingActivation?.stages.map((etapa) => etapa.count)).toEqual([84, 47, 36, 3])
    expect(snapshot.awaitingActivation?.awaiting).toBe(170)
  })

  /**
   * O serviço manda `stalled`, os contratos além de um prazo, em cada etapa.
   * O portal ignora o campo desde 17/09/2026, decisão do Mário: a empresa não
   * tem prazo definido para as etapas, e o card não chama nada de atrasado.
   * A resposta de exemplo mantém o campo de propósito, para provar que ele
   * não derruba a carga nem vaza para o modelo.
   */
  it('ignora os parados que o serviço ainda manda', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    for (const etapa of snapshot.awaitingActivation?.stages ?? []) {
      expect(etapa).not.toHaveProperty('stalled')
    }
  })

  /**
   * Fluxo em ações por etapa (17/09/2026): com visita marcada e a reagendar.
   * Um serviço anterior a esse dado não os manda, e a etapa fica sem medida,
   * nunca em zero: zero seria afirmar que ninguém tem visita marcada.
   */
  it('copia visita marcada e a reagendar por etapa', async () => {
    const [pendente, assinada, agendada, cancelada] = respostaValida.awaiting_stages
    respondWith({
      ...respostaValida,
      awaiting_stages: [
        { ...pendente, scheduled_visit: 0, needs_reschedule: 0 },
        { ...assinada, scheduled_visit: 1, needs_reschedule: 0 },
        { ...agendada, scheduled_visit: 22, needs_reschedule: 12 },
        { ...cancelada, scheduled_visit: 0, needs_reschedule: 1 },
      ],
    })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.awaitingActivation?.stages.map((etapa) => etapa.scheduledVisit)).toEqual([
      0,
      1,
      22,
      0,
    ])
    expect(snapshot.awaitingActivation?.stages.map((etapa) => etapa.needsReschedule)).toEqual([
      0,
      0,
      12,
      1,
    ])
  })

  it('serviço sem esses números deixa a etapa sem medida', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    for (const etapa of snapshot.awaitingActivation?.stages ?? []) {
      expect(etapa.scheduledVisit).toBeNull()
      expect(etapa.needsReschedule).toBeNull()
    }
  })

  it('derruba a carga quando visita marcada e a reagendar passam da contagem', async () => {
    const [pendente, ...demais] = respostaValida.awaiting_stages
    respondWith({
      ...respostaValida,
      awaiting_stages: [{ ...pendente, scheduled_visit: 50, needs_reschedule: 30 }, ...demais],
    })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(
      /50 com visita marcada e 30 a reagendar para 79/,
    )
  })

  it('derruba a carga quando as etapas não fecham com o aguardando', async () => {
    respondWith({
      ...respostaValida,
      metrics: { ...respostaValida.metrics, awaiting_activation: 170 },
    })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/somam 165 para 170/)
  })

  it('derruba a carga com etapa que o card não conhece', async () => {
    // Ignorar a etapa faria a barra somar menos que o número em destaque.
    respondWith({
      ...respostaValida,
      metrics: { ...respostaValida.metrics, awaiting_activation: 166 },
      awaiting_stages: [
        ...respostaValida.awaiting_stages,
        { id: 'reprovada', label: 'Reprovada', count: 1 },
      ],
    })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/etapa reprovada/)
  })

  it('derruba a carga quando o aguardando passa do vendido', async () => {
    respondWith({
      ...respostaValida,
      metrics: { ...respostaValida.metrics, sold_contracts: 100 },
    })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/para 100 vendidos/)
  })

  it('meia medida do aguardando vale como ausência, e não como meio card', async () => {
    // Com o vendido mas sem o aguardando não há número para o destaque; com os
    // dois mas sem as etapas não há barra que explique o número.
    respondWith({
      ...respostaValida,
      metrics: { ...respostaValida.metrics, awaiting_activation: null },
    })
    expect((await fetchCommercialOverview(filtros)).snapshot.awaitingActivation).toBeNull()

    respondWith({ ...respostaValida, awaiting_stages: [] })
    expect((await fetchCommercialOverview(filtros)).snapshot.awaitingActivation).toBeNull()
  })

  it('sem período anterior, nenhuma comparação é inventada', async () => {
    respondWith({ ...respostaValida, previous: null })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.metrics.activeSalesChangeRate).toBeNull()
    expect(snapshot.monthlyValueChangeRate).toBeNull()
    expect(snapshot.previousGoalAchieved).toBeNull()
    expect(snapshot.previousSuperGoalAchieved).toBeNull()
    // O card de Novos Clientes continua com o número do recorte: o que some é
    // só a comparação.
    expect(snapshot.customerMix?.newCustomers).toBe(693)
    expect(snapshot.customerMix?.changeRate).toBeNull()
  })

  /**
   * Novos Clientes. Quem separa cliente novo de cliente antigo é o serviço,
   * porque esta rota devolve totais e não o histórico de cada cliente. O que
   * os cenários guardam: o portal copia as três parcelas, deriva só a
   * comparação, e trata a ausência do bloco como ausência de dado.
   */
  it('copia a composição de clientes e deriva apenas a comparação', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.customerMix?.newCustomers).toBe(693)
    expect(snapshot.customerMix?.expansion).toBe(147)
    expect(snapshot.customerMix?.returning).toBe(43)
    expect(snapshot.customerMix?.changeRate).toBeCloseTo((693 - 700) / 700, 6)
    // As três parcelas dividem as vendas ativadas do recorte, sem sobra.
    expect(693 + 147 + 43).toBe(snapshot.metrics.activeSales)
  })

  it('sem o bloco de clientes, o card fica sem dado em vez de mostrar zero', async () => {
    respondWith({ ...respostaValida, customers: undefined })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.customerMix).toBeNull()
  })

  it('derruba a carga quando a composição de clientes vem incompleta', async () => {
    respondWith({ ...respostaValida, customers: { new: 693, expansion: 147 } })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(
      /ativações de cliente que voltou/,
    )
  })

  /**
   * Tempo até a ativação. Quem mede é o serviço, sobre as vendas ativadas do
   * recorte; o portal só copia as duas leituras e a do período anterior, que é
   * o que dá a comparação do card.
   */
  it('copia o tempo até a ativação e o valor do período anterior', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.activationDays?.medianDays).toBe(2)
    expect(snapshot.previousActivationDaysMedian).toBe(3)
  })

  it('monta as faixas da espera na ordem do portal e deriva a fatia de cada uma', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)
    const bands = snapshot.activationDays?.bands ?? []

    expect(bands.map((band) => band.id)).toEqual([
      'mesmo-dia',
      '1-dia',
      '2-a-3-dias',
      '4-dias-ou-mais',
    ])
    // As quatro dividem as ativações medidas, então as fatias somam 1.
    expect(bands.reduce((sum, band) => sum + band.count, 0)).toBe(883)
    expect(bands.reduce((sum, band) => sum + band.share, 0)).toBeCloseTo(1, 6)
    expect(bands[1].share).toBeCloseTo(300 / 883, 6)
  })

  it('completa com zero a faixa que o serviço não mandou', async () => {
    respondWith({
      ...respostaValida,
      activation_bands: [{ id: 'mesmo-dia', label: 'Mesmo dia', count: 10 }],
    })

    const { snapshot } = await fetchCommercialOverview(filtros)
    const bands = snapshot.activationDays?.bands ?? []

    // Faixa zerada continua na barra: some dela e a fila deixa de ser a fila.
    expect(bands).toHaveLength(4)
    expect(bands.map((band) => band.count)).toEqual([10, 0, 0, 0])
  })

  it('sem as faixas, a medida inteira fica indisponível', async () => {
    respondWith({ ...respostaValida, activation_bands: [] })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.activationDays).toBeNull()
  })

  it('sem a medida do tempo, o card fica sem dado em vez de mostrar zero', async () => {
    const { activation_days_median, activation_days_p90, ...semTempo } = respostaValida.metrics
    respondWith({ ...respostaValida, metrics: semTempo })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(activation_days_median).toBe(2)
    expect(activation_days_p90).toBe(6)
    expect(snapshot.activationDays).toBeNull()
  })

  it('meia medida do tempo vale como ausência, e não como meio card', async () => {
    // Com as faixas mas sem o valor do meio não há número para o destaque, e
    // uma barra sozinha não diz quanto o cliente esperou.
    respondWith({
      ...respostaValida,
      metrics: { ...respostaValida.metrics, activation_days_median: null },
    })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.activationDays).toBeNull()
  })

  it('meta nula continua nula, para o card escrever Sem meta', async () => {
    respondWith({
      ...respostaValida,
      metrics: { ...respostaValida.metrics, goal: null, super_goal: null },
    })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.metrics.goal).toBeNull()
    expect(snapshot.metrics.superGoal).toBeNull()
  })

  it('vendedor sem time fica sem time, e não vira Corporativo', async () => {
    respondWith({
      ...respostaValida,
      top_sellers: [{ ...respostaValida.top_sellers[0], team: null }],
    })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.topSellers[0].team).toBeNull()
    expect(snapshot.topSellers[0].position).toBe(1)
  })

  it('soma o valor mensal do mês sem ratear entre os times', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.monthly[0].monthlyValue).toBeCloseTo(107920.5 + 24191.2, 6)
    expect(snapshot.monthly[0].label).toBe('Jul/26')
  })

  it('copia a venda sem time do mês e a soma no valor mensal', async () => {
    // Setembro/2026 em produção: 18 ativações de vendedor sem equipe no SGI.
    respondWith({
      ...respostaValida,
      monthly: [{ ...respostaValida.monthly[0], unassigned_sales: 18, unassigned_value: 2297.9 }],
    })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.monthly[0].unassignedSales).toBe(18)
    expect(snapshot.monthly[0].unassignedValue).toBe(2297.9)
    expect(snapshot.monthly[0].monthlyValue).toBeCloseTo(107920.5 + 24191.2 + 2297.9, 6)
  })

  it('para com o motivo escrito quando o mês vem sem a venda sem time', async () => {
    // Serviço anterior a 17/09/2026, ou o processo antigo ainda na porta: sem
    // a parcela, o gráfico voltaria a zerar janeiro a maio em silêncio.
    respondWith({
      ...respostaValida,
      monthly: [
        {
          month: '2026-07',
          commercial_sales: 795,
          corporate_sales: 88,
          commercial_value: 107920.5,
          corporate_value: 24191.2,
        },
      ],
    })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/sem time/)
  })

  it('copia as vendas ativadas herdadas de períodos anteriores', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.activeSalesSoldEarlier).toBe(67)
  })

  it('para com o motivo escrito quando o serviço não separa a venda herdada', async () => {
    // Serviço anterior a 17/09/2026, ou o processo antigo ainda na porta:
    // conta só o contrato ativo hoje e não manda o campo. A régua nova não
    // pode ser escrita sobre esse número.
    const metricsSemHerdadas: Record<string, unknown> = { ...respostaValida.metrics }
    delete metricsSemHerdadas.active_sales_sold_earlier
    respondWith({ ...respostaValida, metrics: metricsSemHerdadas })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/herdadas/)
  })

  it('derruba a carga quando há mais herdadas do que ativadas', async () => {
    respondWith({
      ...respostaValida,
      metrics: { ...respostaValida.metrics, active_sales_sold_earlier: 884 },
    })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/herdadas/)
  })

  it('derruba a carga com herdada negativa ou quebrada', async () => {
    // Contagem de contratos é inteira e nunca negativa: qualquer outra coisa
    // viraria "311,5 são do próprio período" na leitura do card.
    for (const valor of [-1, 67.5]) {
      respondWith({
        ...respostaValida,
        metrics: { ...respostaValida.metrics, active_sales_sold_earlier: valor },
      })

      await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/herdadas/)
    }
  })

  it('copia a safra por mês vendido com o rótulo do mês', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.cohorts).toEqual([
      { month: '2026-07', label: 'Jul/26', sold: 790, activatedInMonth: 675, activatedLater: 66, awaiting: 49, cancelledBefore: 0, other: 0 },
    ])
  })

  it('sem a safra na resposta o painel fica sem dado e a página segue', async () => {
    // Serviço anterior a 18/09/2026: o painel escreve que a fonte não separa
    // a safra, e os cinco cards continuam inteiros.
    const semSafra: Record<string, unknown> = { ...respostaValida }
    delete semSafra.cohorts
    respondWith(semSafra)

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.cohorts).toBeNull()
    expect(snapshot.metrics.activeSales).toBe(883)
  })

  it('derruba a carga quando as parcelas da safra não fecham com o vendido', async () => {
    respondWith({
      ...respostaValida,
      cohorts: [{ ...respostaValida.cohorts[0], awaiting: 50 }],
    })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/safra/)
  })

  it('aceita qualquer mês da cobertura real, e não só os da base sintética', async () => {
    respondWith({
      ...respostaValida,
      monthly: [
        { ...respostaValida.monthly[0], month: '2026-08' },
        { ...respostaValida.monthly[0], month: '2026-09' },
      ],
    })

    const { snapshot } = await fetchCommercialOverview(filtros)

    // Em 10/09/2026 o serviço já mandava janeiro a setembro; com a lista
    // fechada de janeiro a julho a página nem abria.
    expect(snapshot.monthly.map((ponto) => ponto.label)).toEqual(['Ago/26', 'Set/26'])
  })

  it('para com o motivo escrito quando o mês vem fora do formato aaaa-mm', async () => {
    respondWith({
      ...respostaValida,
      monthly: [{ ...respostaValida.monthly[0], month: '2026-13' }],
    })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/mês "2026-13".*aaaa-mm/s)
  })

  it('mantém no ranking a venda sem criador, que o serviço manda com identificador vazio', async () => {
    respondWith({
      ...respostaValida,
      top_sellers: [
        {
          seller_id: '',
          seller_name: 'Vendedor não informado',
          team: null,
          active_sales: 1574,
          monthly_revenue: 199477.51,
        },
        respostaValida.top_sellers[0],
      ],
    })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.topSellers[0]).toMatchObject({
      sellerId: '',
      sellerName: 'Vendedor não informado',
      position: 1,
    })
    expect(snapshot.topSellers[1].sellerId).toBe('v-1')
  })

  it('recusa vendedor com identificador fora de texto', async () => {
    respondWith({
      ...respostaValida,
      top_sellers: [{ ...respostaValida.top_sellers[0], seller_id: 7 }],
    })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/identificador do vendedor/)
  })

  it('recusa resposta sem os indicadores', async () => {
    respondWith({ ...respostaValida, metrics: undefined })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/sem os indicadores/)
  })
})

/**
 * Catálogo de vendedores, o parâmetro do filtro e o denominador do Top 5.
 *
 * O serviço manda os três desde 14/09/2026. Um serviço anterior não manda, e
 * aí a página segue igual, com o seletor de vendedor desabilitado por falta
 * de lista.
 */
describe('catálogo de vendedores', () => {
  it('devolve lista vazia quando o serviço não manda o catálogo', async () => {
    respondWith(respostaValida)

    const resultado = await fetchCommercialOverview(initialCommercialOverviewFilters())

    // Ausência não é erro: é o estado de hoje, e o painel desabilita o seletor.
    expect(resultado.sellers).toEqual([])
    expect(resultado.cities).toHaveLength(1)
  })

  it('lê identificador e nome quando o catálogo chega', async () => {
    respondWith({
      ...respostaValida,
      catalog: {
        cities: respostaValida.catalog.cities,
        sellers: [
          { id: 'sel-1', name: 'Ana Maria dos Santos' },
          { id: 'sel-2', name: 'Bruna Raquelini Rodrigues Silva' },
        ],
      },
    })

    const resultado = await fetchCommercialOverview(initialCommercialOverviewFilters())

    expect(resultado.sellers).toEqual([
      { id: 'sel-1', name: 'Ana Maria dos Santos' },
      { id: 'sel-2', name: 'Bruna Raquelini Rodrigues Silva' },
    ])
  })

  it('derruba a carga quando o catálogo vem malformado', async () => {
    respondWith({
      ...respostaValida,
      catalog: { cities: respostaValida.catalog.cities, sellers: [{ id: 'sel-1' }] },
    })

    // Vendedor sem nome viraria uma opção vazia que filtra alguma coisa.
    await expect(fetchCommercialOverview(initialCommercialOverviewFilters())).rejects.toThrow(
      /nome do vendedor/,
    )
  })

  it('manda o vendedor selecionado na consulta', async () => {
    let recebido: unknown = null
    mockedFetch = (_path, params) => {
      recebido = params
      return Promise.resolve(respostaValida)
    }

    await fetchCommercialOverview({
      ...initialCommercialOverviewFilters(),
      sellerId: 'sel-1',
    })

    expect(recebido).toMatchObject({ seller_id: 'sel-1' })
  })

  it('manda vendedor nulo quando nenhum está selecionado', async () => {
    let recebido: unknown = null
    mockedFetch = (_path, params) => {
      recebido = params
      return Promise.resolve(respostaValida)
    }

    await fetchCommercialOverview(initialCommercialOverviewFilters())

    expect(recebido).toMatchObject({ seller_id: null })
  })

  it('lê os tipos de cliente do catálogo e ignora id fora de pf e pj', async () => {
    respondWith({
      ...respostaValida,
      catalog: {
        cities: respostaValida.catalog.cities,
        person_types: [
          { id: 'pf', name: 'Pessoa física' },
          { id: 'pj', name: 'Pessoa jurídica' },
          { id: 'mei', name: 'Microempreendedor' },
        ],
      },
    })

    const resultado = await fetchCommercialOverview(initialCommercialOverviewFilters())

    // Id que o portal não sabe filtrar não vira opção do seletor.
    expect(resultado.personTypes).toEqual([
      { id: 'pf', name: 'Pessoa física' },
      { id: 'pj', name: 'Pessoa jurídica' },
    ])
  })

  it('devolve tipos de cliente vazios quando o serviço não os manda', async () => {
    respondWith(respostaValida)

    const resultado = await fetchCommercialOverview(initialCommercialOverviewFilters())

    expect(resultado.personTypes).toEqual([])
  })

  it('manda o tipo de cliente só quando há seleção', async () => {
    let recebido: unknown = null
    mockedFetch = (_path, params) => {
      recebido = params
      return Promise.resolve(respostaValida)
    }

    await fetchCommercialOverview(initialCommercialOverviewFilters())
    expect(recebido).toMatchObject({ person_type: null })

    await fetchCommercialOverview({ ...initialCommercialOverviewFilters(), personType: 'pj' })
    expect(recebido).toMatchObject({ person_type: 'pj' })
  })

  it('usa o total de vendas próprias do serviço como denominador do Top 5', async () => {
    respondWith({ ...respostaValida, top_sellers_total: 819 })

    const { snapshot } = await fetchCommercialOverview(initialCommercialOverviewFilters())

    // 60 de 819 próprias, e não de 883 ativadas: o ranking conta só a venda
    // sem indicação e ignora o filtro de vendedor, então o total de ativadas do
    // recorte não serve de denominador.
    expect(snapshot.topSellers[0].share).toBeCloseTo(60 / 819, 6)
  })

  it('sem o total do ranking, cai no total de ativadas, como antes do filtro', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(initialCommercialOverviewFilters())

    expect(snapshot.topSellers[0].share).toBeCloseTo(60 / 883, 6)
  })

  it('derruba a carga quando o total do ranking vem fora de número', async () => {
    respondWith({ ...respostaValida, top_sellers_total: 'muitos' })

    await expect(fetchCommercialOverview(initialCommercialOverviewFilters())).rejects.toThrow(
      /total do ranking de vendedores/,
    )
  })
})

/**
 * Fonte, cobertura e pendências.
 *
 * O que o serviço diz sobre a base inteira: a data da última alteração (selo
 * do cabeçalho), a cobertura (calendários dos filtros) e as pendências de
 * cadastro (console). Nada disso muda número na tela.
 */
describe('fonte, cobertura e pendências', () => {
  it('lê a data de atualização e a cobertura da base quando o serviço as manda', async () => {
    respondWith({
      ...respostaValida,
      source: {
        ...respostaValida.source,
        updated_at: '2026-09-09',
        period: { start: '2026-01-01', end: '2026-09-09' },
      },
    })

    const resultado = await fetchCommercialOverview(filtros)

    expect(resultado.updatedAt).toBe('2026-09-09')
    expect(resultado.period).toEqual({ start: '2026-01-01', end: '2026-09-09' })
  })

  it('sem data nem cobertura, devolve nulo em vez de inventar', async () => {
    respondWith(respostaValida)

    const resultado = await fetchCommercialOverview(filtros)

    expect(resultado.updatedAt).toBeNull()
    expect(resultado.period).toBeNull()
  })

  it('cobertura pela metade vale como ausente, e invertida derruba a carga', async () => {
    respondWith({
      ...respostaValida,
      source: { months: [], period: { start: '2026-01-01', end: null } },
    })
    expect((await fetchCommercialOverview(filtros)).period).toBeNull()

    respondWith({
      ...respostaValida,
      source: { months: [], period: { start: '2026-09-09', end: '2026-01-01' } },
    })
    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/cobertura de datas invertida/)
  })

  it('avisa no console as pendências de cadastro que a API reporta', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    respondWith({
      ...respostaValida,
      quality: {
        sales_without_team: 2285,
        sellers_without_team: ['u-1', 'u-2'],
        unmapped_team_names: ['Equipe teste'],
        unmapped_status_keys: [],
        unknown_cities: ['Campo Limpo Paulista', 'Jundiaí'],
      },
    })

    await fetchCommercialOverview(filtros)

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('pendências de cadastro'),
      expect.objectContaining({
        vendasSemTime: 2285,
        vendedoresSemTime: 2,
        equipesSemDePara: ['Equipe teste'],
        cidadesDesconhecidas: ['Campo Limpo Paulista', 'Jundiaí'],
      }),
    )
    warn.mockRestore()
  })

  it('fica em silêncio sem pendência nenhuma e sem o bloco de qualidade', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    respondWith({
      ...respostaValida,
      quality: {
        sales_without_team: 0,
        sellers_without_team: [],
        unmapped_team_names: [],
        unmapped_status_keys: [],
        unknown_cities: [],
      },
    })
    await fetchCommercialOverview(filtros)
    respondWith(respostaValida)
    await fetchCommercialOverview(filtros)

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
