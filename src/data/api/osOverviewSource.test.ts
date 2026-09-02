import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchOverviewOsSource } from './osOverviewSource'

/**
 * A fonte da API é o único ponto onde uma resposta do serviço vira registro da
 * página. O que estes cenários guardam é a postura combinada: converter o que
 * está no contrato e recusar, com motivo, o que colocaria número errado na
 * tela.
 *
 * Só o transporte é substituído. `BiApiError` continua o real, porque é ele
 * que carrega a mensagem em português que a página exibe.
 */
vi.mock('./biApiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./biApiClient')>()
  return { ...actual, fetchFromBiApi: (path: string) => mockedFetch(path) }
})

let mockedFetch: (path: string) => Promise<unknown> = () => Promise.resolve({})

function respondWith(payload: unknown) {
  mockedFetch = () => Promise.resolve(payload)
}

const validRecord = {
  id: 'OS-2026-1',
  date: '2026-08-01',
  technician_id: '5c1f0f4a-0000-4000-8000-000000000001',
  team: 'Infra',
  service_type: 'Instalação',
  category: 'fibra instalação',
  city: 'Atibaia',
  status: 'Concluída',
  resolution: 'Instalação Realizada',
}

const validResponse = {
  generated_at: '2026-08-28T10:00:00-03:00',
  source: { updated_at: '2026-08-27', coverage: { min: '2026-04-06', max: '2026-08-21' } },
  count: 1,
  records: [validRecord],
  quality: {
    records_without_team: 0,
    unclassified_technician_ids: [],
    unmapped_status_keys: [],
    unmapped_service_type_keys: [],
    unknown_cities: [],
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchOverviewOsSource', () => {
  it('converte a resposta da API na projeção que a página consome', async () => {
    respondWith(validResponse)

    const source = await fetchOverviewOsSource()

    expect(source.coverage).toEqual({ min: '2026-04-06', max: '2026-08-21' })
    expect(source.updatedAt).toBe('2026-08-27')
    expect(source.records).toEqual([
      {
        id: 'OS-2026-1',
        dateISO: '2026-08-01',
        technicianId: '5c1f0f4a-0000-4000-8000-000000000001',
        team: 'Infra',
        serviceType: 'Instalação',
        category: 'fibra instalação',
        city: 'Atibaia',
        status: 'Concluída',
        resolution: 'Instalação Realizada',
      },
    ])
  })

  it('aceita o código real da OS e o identificador real do técnico', async () => {
    respondWith(validResponse)

    const source = await fetchOverviewOsSource()

    // O padrão anônimo do arquivo local (`mock-os-NNNNNN`) não vale aqui: a
    // API responde com o código do SGI e o uuid de `auth.users`.
    expect(source.records[0].id).not.toMatch(/^mock-os-/)
    expect(source.records[0].technicianId).not.toMatch(/^overview-tech-/)
  })

  it('aceita técnico ainda não classificado em nenhuma equipe do BI', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, team: null }],
    })

    const source = await fetchOverviewOsSource()

    expect(source.records[0].team).toBeNull()
    expect(source.records[0].technicianId).not.toBeNull()
  })

  it('aceita OS sem técnico e sem resolução', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, technician_id: null, team: null, resolution: null }],
    })

    const source = await fetchOverviewOsSource()

    expect(source.records[0].technicianId).toBeNull()
    expect(source.records[0].resolution).toBeNull()
  })

  it('recusa status fora do catálogo, em vez de somar um valor que o gráfico esconderia', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, status: 'checklist' }],
    })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/status "checklist"/)
  })

  it('recusa tipo de OS fora do catálogo', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, service_type: 'customer' }],
    })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/tipo de OS "customer"/)
  })

  it('recusa equipe fora das seis equipes do BI', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, team: 'TERCEIRIZADA' }],
    })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/equipe "TERCEIRIZADA"/)
  })

  it('recusa data fora do formato ISO', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, date: '01/08/2026' }],
    })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/fora do formato aaaa-mm-dd/)
  })

  it('recusa resposta sem cobertura de datas', async () => {
    respondWith({ ...validResponse, source: { updated_at: '2026-08-27' } })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/cobertura de datas/)
  })

  it('recusa resposta sem nenhuma ordem de serviço', async () => {
    respondWith({ ...validResponse, count: 0, records: [] })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/nenhuma ordem de serviço/)
  })

  it('avisa no console as pendências de classificação, sem interromper a carga', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    respondWith({
      ...validResponse,
      quality: {
        records_without_team: 3,
        unclassified_technician_ids: ['abc'],
        unmapped_status_keys: [],
        unmapped_service_type_keys: [],
        unknown_cities: ['Terra Preta'],
      },
    })

    const source = await fetchOverviewOsSource()

    expect(source.records).toHaveLength(1)
    expect(warn).toHaveBeenCalledOnce()
  })
})

/**
 * Catálogo de técnicos.
 *
 * É o que permite o filtro de técnico mostrar nome em vez de identificador. O
 * contrato ainda não tem a lista, então ausência é o estado normal de hoje e
 * não pode derrubar a página inteira.
 */
describe('catálogo de técnicos da API de OS', () => {
  it('devolve lista vazia quando o serviço não manda o catálogo', async () => {
    respondWith(validResponse)

    const source = await fetchOverviewOsSource()

    expect(source.technicians).toEqual([])
    expect(source.records).toHaveLength(1)
  })

  it('lê identificador e nome, em ordem alfabética pt-BR', async () => {
    respondWith({
      ...validResponse,
      catalog: {
        technicians: [
          { id: 'tec-2', name: 'Ícaro Nogueira' },
          { id: 'tec-1', name: 'Ana Souza' },
        ],
      },
    })

    const source = await fetchOverviewOsSource()

    // A ordem vem do portal, não do banco: o seletor não fica refém do retorno.
    expect(source.technicians).toEqual([
      { id: 'tec-1', name: 'Ana Souza' },
      { id: 'tec-2', name: 'Ícaro Nogueira' },
    ])
  })

  it('derruba a carga quando o catálogo vem malformado', async () => {
    respondWith({ ...validResponse, catalog: { technicians: [{ id: 'tec-1' }] } })

    // Técnico sem nome viraria uma opção vazia no filtro.
    await expect(fetchOverviewOsSource()).rejects.toThrow(/nome do técnico do catálogo/)
  })

  it('derruba a carga quando o catálogo não é uma lista', async () => {
    respondWith({ ...validResponse, catalog: { technicians: { 'tec-1': 'Ana Souza' } } })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/fora do formato de lista/)
  })
})
