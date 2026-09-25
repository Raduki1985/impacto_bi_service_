import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchCommercialSalesDay } from './commercialRecordsSource'

/**
 * A consulta de um dia é a fonte da faixa Hoje ao vivo da Visão Geral
 * Comercial. O que estes cenários guardam: a janela vai para o serviço como
 * parâmetro, um dia sem contrato é resultado e não erro, a situação de cada
 * contrato chega como o serviço decidiu, e um registro fora do contrato
 * derruba a leitura com o motivo escrito.
 */
vi.mock('./biApiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./biApiClient')>()
  return {
    ...actual,
    fetchFromBiApi: (path: string, params?: unknown) => mockedFetch(path, params),
  }
})

let mockedFetch: (path: string, params?: unknown) => Promise<unknown> = () => Promise.resolve({})

const baseResponse = {
  generated_at: '2026-09-25T09:27:08.761050-03:00',
  source: { updated_at: '2026-09-25', sale_rule: 'activated' },
  filters: { date_from: '2026-09-25', date_to: '2026-09-25', include_queue: true, queue_from: '2026-01-01' },
  quality: {
    sales_without_team: 0,
    sellers_without_team: [],
    unmapped_team_names: [],
    unmapped_status_keys: [],
    unknown_cities: [],
  },
}

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
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchCommercialSalesDay', () => {
  it('pede ao serviço só a janela do dia e devolve os contratos com a situação decidida lá', async () => {
    const calls: { path: string; params: unknown }[] = []
    mockedFetch = (path, params) => {
      calls.push({ path, params })
      return Promise.resolve({ ...baseResponse, count: 1, records: [pendingRecord] })
    }

    const source = await fetchCommercialSalesDay('2026-09-25', { includeQueue: true })

    expect(calls).toEqual([
      {
        path: '/bi/commercial/overview/records',
        params: { date_from: '2026-09-25', date_to: '2026-09-25', include_queue: 'true' },
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
      },
    ])
    expect(source.generatedAt).toBe('2026-09-25T09:27:08.761050-03:00')
    expect(source.updatedAt).toBe('2026-09-25')
    expect(source.queueFrom).toBe('2026-01-01')
  })

  it('um dia sem contrato é resultado, não erro', async () => {
    mockedFetch = () => Promise.resolve({ ...baseResponse, count: 0, records: [] })

    const source = await fetchCommercialSalesDay('2026-09-27')

    expect(source.records).toEqual([])
    expect(source.generatedAt).toBe('2026-09-25T09:27:08.761050-03:00')
  })

  it('derruba a leitura, com o motivo, quando o serviço não decide a situação', async () => {
    const semSituacao = Object.fromEntries(
      Object.entries(pendingRecord).filter(([key]) => key !== 'stage' && key !== 'activated'),
    )
    mockedFetch = () => Promise.resolve({ ...baseResponse, count: 1, records: [semSituacao] })

    await expect(fetchCommercialSalesDay('2026-09-25')).rejects.toThrow(
      'sem a situação do contrato 1',
    )
  })

  it('recusa etapa e tipo de cliente que o portal não conhece', async () => {
    mockedFetch = () =>
      Promise.resolve({ ...baseResponse, count: 1, records: [{ ...pendingRecord, stage: 'em-analise' }] })
    await expect(fetchCommercialSalesDay('2026-09-25')).rejects.toThrow('a etapa "em-analise"')

    mockedFetch = () =>
      Promise.resolve({ ...baseResponse, count: 1, records: [{ ...pendingRecord, person_type: 'mei' }] })
    await expect(fetchCommercialSalesDay('2026-09-25')).rejects.toThrow('o tipo de cliente "mei"')
  })

  it('recusa valor mensal e datas fora do formato', async () => {
    mockedFetch = () =>
      Promise.resolve({ ...baseResponse, count: 1, records: [{ ...pendingRecord, monthly_value: '129,90' }] })
    await expect(fetchCommercialSalesDay('2026-09-25')).rejects.toThrow('o valor mensal inválido')

    mockedFetch = () =>
      Promise.resolve({ ...baseResponse, count: 1, records: [{ ...pendingRecord, contracted_on: '25/09/2026' }] })
    await expect(fetchCommercialSalesDay('2026-09-25')).rejects.toThrow('fora do formato aaaa-mm-dd')
  })

  it('sem a esteira pedida, o parâmetro nem viaja e a data da esteira fica nula', async () => {
    const calls: unknown[] = []
    mockedFetch = (_path, params) => {
      calls.push(params)
      return Promise.resolve({ ...baseResponse, filters: { date_from: '2026-09-25', date_to: '2026-09-25' }, records: [] })
    }

    const source = await fetchCommercialSalesDay('2026-09-25')

    expect(calls).toEqual([{ date_from: '2026-09-25', date_to: '2026-09-25', include_queue: null }])
    expect(source.queueFrom).toBeNull()
  })

  it('sem a lista de contratos, a resposta é erro', async () => {
    mockedFetch = () => Promise.resolve({ ...baseResponse })

    await expect(fetchCommercialSalesDay('2026-09-25')).rejects.toThrow('sem a lista de contratos')
  })
})
