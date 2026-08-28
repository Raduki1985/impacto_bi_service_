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
    activation_rate: 0.78,
    commercial_sales: 795,
    corporate_sales: 88,
    indicated_sales: 64,
    seller_sales: 819,
    monthly_revenue: 132111.7,
    average_ticket: 149.62,
    pipeline_sales: 162,
    goal: 800,
    super_goal: 880,
    goal_achieved: 795,
    super_goal_achieved: 883,
  },
  previous: {
    range: { start_date: '2026-06-01', end_date: '2026-06-30' },
    active_sales: 894,
    monthly_revenue: 131850.1,
    goal_achieved: 820,
    super_goal_achieved: 894,
  },
  pipeline_stages: [
    { id: 'pendente', label: 'Pendente', count: 59 },
    { id: 'assinada', label: 'Assinada', count: 47 },
    { id: 'agendada', label: 'Agendada', count: 36 },
    { id: 'aguardando-aprovacao', label: 'Em aprovação', count: 20 },
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
    { month: '2026-07', commercial_sales: 795, corporate_sales: 88, commercial_value: 107920.5, corporate_value: 24191.2 },
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

  it('deriva a participação de cada painel sobre o próprio total comparativo', async () => {
    respondWith(respostaValida)

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.cityComparisonTotal).toBe(883)
    expect(snapshot.topCities[0].share).toBeCloseTo(463 / 883, 6)
    // Origem usa o denominador do painel de times, como na página.
    expect(snapshot.origins[0].share).toBeCloseTo(819 / 883, 6)
  })

  it('mantém as quatro etapas do fluxo na ordem oficial, mesmo zeradas', async () => {
    respondWith({ ...respostaValida, pipeline_stages: [{ id: 'pendente', label: 'Pendente', count: 59 }] })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.pipelineStages.map((etapa) => etapa.id)).toEqual([
      'pendente',
      'assinada',
      'agendada',
      'aguardando-aprovacao',
    ])
    expect(snapshot.pipelineStages[3].count).toBe(0)
  })

  it('sem período anterior, nenhuma comparação é inventada', async () => {
    respondWith({ ...respostaValida, previous: null })

    const { snapshot } = await fetchCommercialOverview(filtros)

    expect(snapshot.metrics.activeSalesChangeRate).toBeNull()
    expect(snapshot.monthlyValueChangeRate).toBeNull()
    expect(snapshot.previousGoalAchieved).toBeNull()
    expect(snapshot.previousSuperGoalAchieved).toBeNull()
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

  it('para com o motivo escrito quando o serviço traz um mês fora de 2026', async () => {
    respondWith({
      ...respostaValida,
      monthly: [{ ...respostaValida.monthly[0], month: '2026-08' }],
    })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/mês "2026-08".*ampliada/s)
  })

  it('recusa resposta sem os indicadores', async () => {
    respondWith({ ...respostaValida, metrics: undefined })

    await expect(fetchCommercialOverview(filtros)).rejects.toThrow(/sem os indicadores/)
  })
})
