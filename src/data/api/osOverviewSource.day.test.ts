import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchOverviewOsDay, fetchOverviewOsSource } from './osOverviewSource'

/**
 * A consulta de um dia é a fonte da faixa "Hoje ao vivo" da Visão Geral.
 * O que estes cenários guardam: a janela vai para o serviço como parâmetro,
 * um dia sem OS é resultado e não erro, e a hora em que o serviço leu o
 * banco chega inteira ao portal.
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
  generated_at: '2026-09-18T16:16:01.077760-03:00',
  source: { updatedAt: '2026-09-18', coverage: { min: '2026-04-06', max: '2026-10-05' } },
  quality: {
    recordsWithoutTeam: 0,
    unclassifiedTechnicianIds: [],
    unmappedStatusKeys: [],
    unmappedServiceTypeKeys: [],
    unknownCities: [],
  },
}

const todayRecord = {
  id: 'OS-2026-5393',
  date: '2026-09-18',
  technician_id: null,
  team: null,
  service_type: 'Instalação de Câmeras',
  category: 'instalação de 2 câmeras',
  city: 'Piracaia',
  status: 'Reagendada',
  status_key: 'rescheduled',
  resolution: null,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchOverviewOsDay', () => {
  it('pede ao serviço só a janela do dia e devolve a hora da leitura', async () => {
    const calls: { path: string; params: unknown }[] = []
    mockedFetch = (path, params) => {
      calls.push({ path, params })
      return Promise.resolve({ ...baseResponse, count: 1, records: [todayRecord] })
    }

    const source = await fetchOverviewOsDay('2026-09-18')

    expect(calls).toEqual([
      {
        path: 'v1/bi/os/overview/records',
        params: { date_from: '2026-09-18', date_to: '2026-09-18' },
      },
    ])
    expect(source.records).toHaveLength(1)
    expect(source.records[0]).toMatchObject({ id: 'OS-2026-5393', statusKey: 'rescheduled' })
    expect(source.generatedAt).toBe('2026-09-18T16:16:01.077760-03:00')
    expect(source.coverage).toEqual({ min: '2026-04-06', max: '2026-10-05' })
  })

  it('um dia sem OS é resultado, não erro', async () => {
    mockedFetch = () => Promise.resolve({ ...baseResponse, count: 0, records: [] })

    const source = await fetchOverviewOsDay('2026-09-20')

    expect(source.records).toEqual([])
    expect(source.generatedAt).toBe('2026-09-18T16:16:01.077760-03:00')
  })

  it('a base inteira continua recusando a lista vazia', async () => {
    mockedFetch = () => Promise.resolve({ ...baseResponse, count: 0, records: [] })

    await expect(fetchOverviewOsSource()).rejects.toThrow(
      'A API respondeu sem nenhuma ordem de serviço para o período coberto.',
    )
  })

  it('sem a hora da leitura na resposta, o campo fica nulo em vez de inventado', async () => {
    const { generated_at: _ignored, ...withoutGeneratedAt } = baseResponse
    void _ignored
    mockedFetch = () => Promise.resolve({ ...withoutGeneratedAt, count: 1, records: [todayRecord] })

    const source = await fetchOverviewOsDay('2026-09-18')

    expect(source.generatedAt).toBeNull()
  })
})
