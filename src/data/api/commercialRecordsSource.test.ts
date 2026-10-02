import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchCommercialMonthSales,
  fetchCommercialPeriodCount,
  fetchCommercialPeriodSales,
  fetchCommercialTodayBox,
  fetchCommercialTodayCounts,
  type CommercialSalesFilters,
} from './commercialRecordsSource'

/**
 * As consultas das listas da Visão Geral Comercial (desde 01/10/2026 o
 * serviço conta e recorta; o portal pede contagens e, no clique, os
 * contratos de uma lista). O que estes cenários guardam: os filtros da
 * página e o recorte vão para o serviço como parâmetro (o neutro não viaja),
 * as contagens e a marca de cada contrato chegam como o serviço decidiu, e
 * uma resposta fora do contrato derruba a leitura com o motivo escrito.
 */
vi.mock('./biApiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./biApiClient')>()
  return {
    ...actual,
    fetchFromBiApi: (path: string, params?: unknown) => mockedFetch(path, params),
  }
})

let mockedFetch: (path: string, params?: unknown) => Promise<unknown> = () => Promise.resolve({})

const noFilters: CommercialSalesFilters = { cityId: null, team: 'todos', sellerId: null, personType: 'todos' }

const pendingRecord = {
  id: '01757155',
  status: 'pendente',
  status_key: 'pending',
  stage: 'pendente',
  activated: false,
  contracted_on: '2026-09-25',
  signed_on: null,
  created_at: '2026-09-25T08:57:38.574928-03:00',
  started_on: null,
  started_at: null,
  monthly_value: 129.9,
  plan_name: 'res_600mb solo',
  city_id: 'atibaia',
  city_label: 'Atibaia',
  seller_id: '5dd67afa-bc97-4389-a8df-cbd14d659386',
  seller_name: 'Vendedora de Teste',
  team: 'comercial',
  teams: ['comercial'],
  indicated: false,
  customer_kind: null,
  person_type: 'pf',
  has_open_order: false,
  has_installation_order: false,
  has_unproductive_order: false,
  next_visit_on: null,
  last_visit_on: null,
  last_order_status: null,
  signal_evidence: [],
  replaced_by: null,
  late: true,
  outside_flow: null,
}

const listResponse = (records: unknown[]) => ({
  generated_at: '2026-09-25T09:27:08.761050-03:00',
  count: records.length,
  records,
})

const todayResponse = {
  generated_at: '2026-10-01T16:54:19.852967-03:00',
  source: { updated_at: '2026-10-01', sale_rule: 'activated' },
  day: '2026-10-01',
  queue_from: '2026-01-01',
  boxes: [
    { key: 'sold', count: 19, late: null, deadline_days: null, visits_today: null, sold_earlier: null },
    { key: 'pending', count: 191, late: 162, deadline_days: 2, visits_today: null, sold_earlier: null },
    { key: 'signed', count: 21, late: 12, deadline_days: 2, visits_today: null, sold_earlier: null },
    { key: 'scheduled', count: 96, late: 50, deadline_days: 1, visits_today: 5, sold_earlier: null },
    { key: 'activated', count: 21, late: null, deadline_days: null, visits_today: null, sold_earlier: 16 },
  ],
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchCommercialTodayCounts', () => {
  it('pede o dia com os filtros da página e devolve as cinco caixas contadas pelo serviço', async () => {
    const calls: { path: string; params: unknown }[] = []
    mockedFetch = (path, params) => {
      calls.push({ path, params })
      return Promise.resolve(todayResponse)
    }

    const source = await fetchCommercialTodayCounts('2026-10-01', {
      cityId: 'atibaia',
      team: 'comercial',
      sellerId: null,
      personType: 'pj',
    })

    expect(calls).toEqual([
      {
        path: '/bi/comercial/overview/today',
        params: { day: '2026-10-01', city_id: 'atibaia', team: 'comercial', seller_id: null, person_type: 'pj' },
      },
    ])
    expect(source.boxes.map((box) => [box.key, box.count, box.late, box.deadlineDays])).toEqual([
      ['sold', 19, null, null],
      ['pending', 191, 162, 2],
      ['signed', 21, 12, 2],
      ['scheduled', 96, 50, 1],
      ['activated', 21, null, null],
    ])
    expect(source.boxes[3].visitsToday).toBe(5)
    expect(source.boxes[4].soldEarlier).toBe(16)
    expect(source.queueFrom).toBe('2026-01-01')
    expect(source.generatedAt).toBe('2026-10-01T16:54:19.852967-03:00')
  })

  it('o filtro neutro não viaja', async () => {
    const calls: unknown[] = []
    mockedFetch = (_path, params) => {
      calls.push(params)
      return Promise.resolve(todayResponse)
    }

    await fetchCommercialTodayCounts('2026-10-01', noFilters)

    expect(calls).toEqual([{ day: '2026-10-01', city_id: null, team: null, seller_id: null, person_type: null }])
  })

  it('derruba a leitura sem as cinco caixas, ou com uma caixa que o portal não conhece', async () => {
    mockedFetch = () => Promise.resolve({ ...todayResponse, boxes: todayResponse.boxes.slice(1) })
    await expect(fetchCommercialTodayCounts('2026-10-01', noFilters)).rejects.toThrow('sem as cinco caixas')

    mockedFetch = () =>
      Promise.resolve({ ...todayResponse, boxes: [...todayResponse.boxes, { key: 'lost', count: 1 }] })
    await expect(fetchCommercialTodayCounts('2026-10-01', noFilters)).rejects.toThrow('a caixa "lost"')

    mockedFetch = () => Promise.resolve({ ...todayResponse, boxes: undefined })
    await expect(fetchCommercialTodayCounts('2026-10-01', noFilters)).rejects.toThrow('sem as caixas')
  })

  it('recusa contagem fora do formato', async () => {
    mockedFetch = () =>
      Promise.resolve({
        ...todayResponse,
        boxes: [{ ...todayResponse.boxes[0], count: '19' }, ...todayResponse.boxes.slice(1)],
      })
    await expect(fetchCommercialTodayCounts('2026-10-01', noFilters)).rejects.toThrow('fora do formato de contagem')
  })
})

describe('fetchCommercialTodayBox', () => {
  it('pede só a caixa aberta e devolve os contratos com a marca decidida no serviço', async () => {
    const calls: { path: string; params: unknown }[] = []
    mockedFetch = (path, params) => {
      calls.push({ path, params })
      return Promise.resolve(listResponse([pendingRecord]))
    }

    const source = await fetchCommercialTodayBox('2026-10-01', 'pending', true, noFilters)

    expect(calls).toEqual([
      {
        path: '/bi/comercial/overview/today/records',
        params: {
          day: '2026-10-01',
          box: 'pending',
          late: 'true',
          city_id: null,
          team: null,
          seller_id: null,
          person_type: null,
        },
      },
    ])
    expect(source.records).toEqual([
      {
        id: '01757155',
        status: 'pendente',
        statusKey: 'pending',
        stage: 'pendente',
        activated: false,
        contractedOn: '2026-09-25',
        signedOn: null,
        createdAt: '2026-09-25T08:57:38.574928-03:00',
        startedOn: null,
        startedAt: null,
        monthlyValue: 129.9,
        planName: 'res_600mb solo',
        cityId: 'atibaia',
        cityLabel: 'Atibaia',
        sellerId: '5dd67afa-bc97-4389-a8df-cbd14d659386',
        sellerName: 'Vendedora de Teste',
        team: 'comercial',
        teams: ['comercial'],
        indicated: false,
        customerKind: null,
        personType: 'pf',
        hasOpenOrder: false,
        hasInstallationOrder: false,
        hasUnproductiveOrder: false,
        nextVisitOn: null,
        lastVisitOn: null,
        lastOrderStatus: null,
        signalEvidence: [],
        replacedBy: null,
        late: true,
        outsideFlow: null,
      },
    ])
    expect(source.generatedAt).toBe('2026-09-25T09:27:08.761050-03:00')
  })

  it('a caixa inteira não leva o parâmetro do fora do prazo', async () => {
    const calls: unknown[] = []
    mockedFetch = (_path, params) => {
      calls.push(params)
      return Promise.resolve(listResponse([]))
    }

    const source = await fetchCommercialTodayBox('2026-10-01', 'sold', false, noFilters)

    expect(calls).toEqual([
      { day: '2026-10-01', box: 'sold', late: null, city_id: null, team: null, seller_id: null, person_type: null },
    ])
    // Caixa sem contrato é resultado, não erro.
    expect(source.records).toEqual([])
  })

  it('traz as provas de sinal, o contrato que refez a venda e como ela saiu do fluxo', async () => {
    mockedFetch = () =>
      Promise.resolve(
        listResponse([
          {
            ...pendingRecord,
            id: 'com-sinal',
            late: false,
            outside_flow: 'signal',
            signal_evidence: ['equipment_online', 'invoice_issued'],
          },
          { ...pendingRecord, id: 'refeita', late: false, outside_flow: 'replaced', replaced_by: '01441111' },
        ]),
      )

    const source = await fetchCommercialTodayBox('2026-10-01', 'pending', false, noFilters)

    expect(
      source.records.map((record) => [record.id, record.signalEvidence, record.replacedBy, record.outsideFlow]),
    ).toEqual([
      ['com-sinal', ['equipment_online', 'invoice_issued'], null, 'signal'],
      ['refeita', [], '01441111', 'replaced'],
    ])
  })

  it('derruba a leitura sem a marca de fora do prazo, ou com saída do fluxo desconhecida', async () => {
    const semMarca = Object.fromEntries(Object.entries(pendingRecord).filter(([key]) => key !== 'late'))
    mockedFetch = () => Promise.resolve(listResponse([semMarca]))
    await expect(fetchCommercialTodayBox('2026-10-01', 'pending', false, noFilters)).rejects.toThrow(
      'o fora do prazo sem sim ou não no contrato 1',
    )

    mockedFetch = () => Promise.resolve(listResponse([{ ...pendingRecord, outside_flow: 'migrated' }]))
    await expect(fetchCommercialTodayBox('2026-10-01', 'pending', false, noFilters)).rejects.toThrow(
      'fora do fluxo "migrated"',
    )
  })

  it('derruba a leitura sem as provas de sinal, ou com uma prova que o portal não conhece', async () => {
    const semProvas = Object.fromEntries(
      Object.entries(pendingRecord).filter(([key]) => key !== 'signal_evidence'),
    )
    mockedFetch = () => Promise.resolve(listResponse([semProvas]))
    await expect(fetchCommercialTodayBox('2026-10-01', 'pending', false, noFilters)).rejects.toThrow(
      'sem as provas de sinal do contrato 1',
    )

    mockedFetch = () => Promise.resolve(listResponse([{ ...pendingRecord, signal_evidence: ['pro_rata'] }]))
    await expect(fetchCommercialTodayBox('2026-10-01', 'pending', false, noFilters)).rejects.toThrow(
      'a prova de sinal "pro_rata"',
    )
  })

  it('derruba a leitura sem o campo da venda refeita, ou com ele vazio', async () => {
    // Nulo é resposta; a chave ausente é serviço anterior.
    const semCampo = Object.fromEntries(Object.entries(pendingRecord).filter(([key]) => key !== 'replaced_by'))
    mockedFetch = () => Promise.resolve(listResponse([semCampo]))
    await expect(fetchCommercialTodayBox('2026-10-01', 'pending', false, noFilters)).rejects.toThrow(
      'sem o campo da venda refeita no contrato 1',
    )

    mockedFetch = () => Promise.resolve(listResponse([{ ...pendingRecord, replaced_by: '' }]))
    await expect(fetchCommercialTodayBox('2026-10-01', 'pending', false, noFilters)).rejects.toThrow(
      'o código do contrato substituto inválido',
    )
  })

  it('derruba a leitura, com o motivo, quando o serviço não decide a situação', async () => {
    const semSituacao = Object.fromEntries(
      Object.entries(pendingRecord).filter(([key]) => key !== 'stage' && key !== 'activated'),
    )
    mockedFetch = () => Promise.resolve(listResponse([semSituacao]))

    await expect(fetchCommercialTodayBox('2026-10-01', 'pending', false, noFilters)).rejects.toThrow(
      'sem a situação do contrato 1',
    )
  })

  it('recusa etapa, tipo de cliente, valor e data fora do contrato', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ stage: 'em-analise' }, 'a etapa "em-analise"'],
      [{ person_type: 'mei' }, 'o tipo de cliente "mei"'],
      [{ monthly_value: '129,90' }, 'o valor mensal inválido'],
      [{ contracted_on: '25/09/2026' }, 'fora do formato aaaa-mm-dd'],
    ]
    for (const [override, message] of cases) {
      mockedFetch = () => Promise.resolve(listResponse([{ ...pendingRecord, ...override }]))
      await expect(fetchCommercialTodayBox('2026-10-01', 'pending', false, noFilters)).rejects.toThrow(message)
    }
  })

  it('sem a lista de contratos, a resposta é erro', async () => {
    mockedFetch = () => Promise.resolve({ generated_at: '2026-10-01T10:00:00-03:00' })

    await expect(fetchCommercialTodayBox('2026-10-01', 'pending', false, noFilters)).rejects.toThrow(
      'sem a lista de contratos',
    )
  })
})

describe('planilha do período', () => {
  const range = { dateFrom: '2026-09-01', dateTo: '2026-09-30' }

  it('a contagem do botão vem sozinha, sem contrato', async () => {
    const calls: { path: string; params: unknown }[] = []
    mockedFetch = (path, params) => {
      calls.push({ path, params })
      return Promise.resolve({ generated_at: '2026-10-01T10:00:00-03:00', count: 774, sold: 707, activated: 651 })
    }

    const source = await fetchCommercialPeriodCount(range, { ...noFilters, sellerId: 'v1' })

    expect(calls).toEqual([
      {
        path: '/bi/comercial/overview/period/summary',
        params: {
          start_date: '2026-09-01',
          end_date: '2026-09-30',
          city_id: null,
          team: null,
          seller_id: 'v1',
          person_type: null,
        },
      },
    ])
    expect(source).toEqual({ count: 774, generatedAt: '2026-10-01T10:00:00-03:00' })
  })

  it('os contratos vêm no clique, com a régua por que cada um entrou', async () => {
    const calls: string[] = []
    mockedFetch = (path) => {
      calls.push(path)
      return Promise.resolve(
        listResponse([
          { ...pendingRecord, late: false, sold_in_period: true, activated_in_period: false },
        ]),
      )
    }

    const source = await fetchCommercialPeriodSales(range, noFilters)

    expect(calls).toEqual(['/bi/comercial/overview/period/records'])
    expect(source.records.map((record) => [record.id, record.soldInPeriod, record.activatedInPeriod])).toEqual([
      ['01757155', true, false],
    ])
  })

  it('derruba a planilha sem a régua de algum contrato', async () => {
    mockedFetch = () => Promise.resolve(listResponse([{ ...pendingRecord, sold_in_period: true }]))

    await expect(fetchCommercialPeriodSales(range, noFilters)).rejects.toThrow(
      'a ativação no período sem sim ou não no contrato 1',
    )
  })
})

describe('fetchCommercialMonthSales', () => {
  it('pede a barra clicada e traz a contagem de cada barra do mês', async () => {
    const calls: { path: string; params: unknown }[] = []
    mockedFetch = (path, params) => {
      calls.push({ path, params })
      return Promise.resolve({
        ...listResponse([pendingRecord]),
        chips: [
          { slice: null, count: 790 },
          { slice: 'activated_in_month', count: 664 },
          { slice: 'awaiting', count: 49 },
        ],
      })
    }

    const source = await fetchCommercialMonthSales('cohort', '2026-07', 'awaiting', noFilters)

    expect(calls).toEqual([
      {
        path: '/bi/comercial/overview/month/records',
        params: {
          panel: 'cohort',
          month: '2026-07',
          slice: 'awaiting',
          city_id: null,
          team: null,
          seller_id: null,
          person_type: null,
        },
      },
    ])
    expect(source.chips).toEqual([
      { slice: null, count: 790 },
      { slice: 'activated_in_month', count: 664 },
      { slice: 'awaiting', count: 49 },
    ])
    expect(source.records.map((record) => record.id)).toEqual(['01757155'])
  })

  it('recusa barra de outro painel e resposta sem atalhos', async () => {
    mockedFetch = () => Promise.resolve({ ...listResponse([]), chips: [{ slice: 'awaiting', count: 1 }] })
    await expect(fetchCommercialMonthSales('monthly', '2026-07', null, noFilters)).rejects.toThrow(
      'a barra "awaiting"',
    )

    mockedFetch = () => Promise.resolve(listResponse([]))
    await expect(fetchCommercialMonthSales('cohort', '2026-07', null, noFilters)).rejects.toThrow('sem os atalhos')
  })
})
