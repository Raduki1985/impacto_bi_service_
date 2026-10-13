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
  status_key: 'completed',
  resolution: 'Instalação Realizada',
}

const validResponse = {
  generated_at: '2026-08-28T10:00:00-03:00',
  source: { updatedAt: '2026-08-27', coverage: { min: '2026-04-06', max: '2026-08-21' } },
  count: 1,
  records: [validRecord],
  quality: {
    recordsWithoutTeam: 0,
    unclassifiedTechnicianIds: [],
    unmappedStatusKeys: [],
    unmappedServiceTypeKeys: [],
    unknownCities: [],
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
        statusKey: 'completed',
        category: 'fibra instalação',
        city: 'Atibaia',
        status: 'Concluída',
        resolution: 'Instalação Realizada',
        // Turno do agendamento: nulo quando o serviço ainda não manda o campo.
        period: null,
        // Execução em campo: nula quando o serviço ainda não manda os campos.
        startedAt: null,
        finishedAt: null,
        travelMinutes: null,
        difficulty: null,
        unproductiveReason: null,
        // SLA e reagendamento: nulos quando o serviço ainda não manda os campos.
        slaMinutes: null,
        rescheduledAt: null,
        rescheduledBy: null,
        rescheduledByKind: null,
        reschedulingReason: null,
        rescheduleCount: null,
      },
    ])
  })

  it('lê o SLA e o reagendamento quando o serviço os manda', async () => {
    respondWith({
      ...validResponse,
      records: [
        {
          ...validRecord,
          sla_minutes: 90,
          rescheduled_at: '2026-07-30T14:53:21-03:00',
          rescheduled_by: 'André Ricardo',
          rescheduled_by_kind: 'employee',
          rescheduling_reason: null,
          reschedule_count: 2,
        },
      ],
    })

    const source = await fetchOverviewOsSource()

    expect(source.records[0]).toMatchObject({
      slaMinutes: 90,
      rescheduledAt: '2026-07-30T14:53:21-03:00',
      rescheduledBy: 'André Ricardo',
      rescheduledByKind: 'employee',
      reschedulingReason: null,
      rescheduleCount: 2,
    })
  })

  it('recusa uma quantidade de reagendamentos que não é inteiro não negativo', async () => {
    respondWith({ ...validResponse, records: [{ ...validRecord, reschedule_count: -1 }] })

    await expect(fetchOverviewOsSource()).rejects.toThrow('a quantidade de reagendamentos')
  })

  it('lê a execução em campo quando o serviço a manda', async () => {
    respondWith({
      ...validResponse,
      records: [
        {
          ...validRecord,
          started_at: '2026-08-01T09:29:22-03:00',
          finished_at: '2026-08-01T10:44:55-03:00',
          travel_minutes: 29.5,
          difficulty: 'Média',
          unproductive_reason: null,
        },
      ],
    })

    const source = await fetchOverviewOsSource()

    expect(source.records[0]).toMatchObject({
      startedAt: '2026-08-01T09:29:22-03:00',
      finishedAt: '2026-08-01T10:44:55-03:00',
      travelMinutes: 29.5,
      difficulty: 'Média',
      unproductiveReason: null,
    })
  })

  it('lê o turno do agendamento quando o serviço o manda', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, period: 'Manhã' }, { ...validRecord, period: null }],
    })

    const source = await fetchOverviewOsSource()

    expect(source.records.map((record) => record.period)).toEqual(['Manhã', null])
  })

  it('deslocamento zero é medição válida, e não ausência', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, travel_minutes: 0 }],
    })

    const source = await fetchOverviewOsSource()

    expect(source.records[0].travelMinutes).toBe(0)
  })

  it('recusa deslocamento negativo em vez de levar o valor para a média', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, travel_minutes: -12 }],
    })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/deslocamento/)
  })

  it('recusa horário de campo que não seja texto', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, started_at: 1_724_000_000 }],
    })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/início do serviço/)
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

  it('aceita status e tipo fora do catálogo, crus, como o serviço manda', async () => {
    // Chave nova do SGI sem de-para chega crua DE PROPÓSITO (o serviço a
    // reporta em quality). Derrubar a carga esconderia a pendência; nos
    // gráficos ela entra no fim da ordenação, visível e contável.
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, status: 'waiting_parts', service_type: 'survey' }],
    })

    const source = await fetchOverviewOsSource()
    expect(source.records[0].status).toBe('waiting_parts')
    expect(source.records[0].serviceType).toBe('survey')
  })

  it('recusa status vazio', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, status: '' }],
    })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/o status/)
  })

  it('aceita equipe fora das seis do catálogo, com o nome do cadastro do SGI', async () => {
    // A equipe vem de teams/team_users (decisão de 04/09/2026): o nome que o
    // serviço mandar é o verdadeiro, como já acontece com categoria. O
    // catálogo só ordena as conhecidas.
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, team: 'Fibra Norte' }],
    })

    const source = await fetchOverviewOsSource()
    expect(source.records[0].team).toBe('Fibra Norte')
  })

  it('recusa equipe fora do formato de texto', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, team: 42 }],
    })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/a equipe/)
  })

  it('recusa data fora do formato ISO', async () => {
    respondWith({
      ...validResponse,
      records: [{ ...validRecord, date: '01/08/2026' }],
    })

    await expect(fetchOverviewOsSource()).rejects.toThrow(/fora do formato aaaa-mm-dd/)
  })

  it('recusa resposta sem cobertura de datas', async () => {
    respondWith({ ...validResponse, source: { updatedAt: '2026-08-27' } })

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
        recordsWithoutTeam: 3,
        unclassifiedTechnicianIds: ['abc'],
        unmappedStatusKeys: [],
        unmappedServiceTypeKeys: [],
        unknownCities: ['Terra Preta'],
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

  it('recusa a carga quando a API não manda a chave de status', async () => {
    const semChave: Record<string, unknown> = { ...validRecord }
    delete semChave.status_key
    respondWith({ ...validResponse, records: [semChave] })

    // Sem a chave, Concluídas mostraria zero sem erro nenhum: melhor recusar.
    await expect(fetchOverviewOsSource()).rejects.toThrow(/chave de status/)
  })

  it('aceita chave nula, que é a OS sem status', async () => {
    respondWith({ ...validResponse, records: [{ ...validRecord, status_key: null }] })

    const source = await fetchOverviewOsSource()
    expect(source.records[0].statusKey).toBeNull()
  })

  it('lê a ordem de status e tipos como o serviço mandou, e vazia quando não vem', async () => {
    respondWith({
      ...validResponse,
      catalog: {
        technicians: [],
        statuses: [
          { label: 'Pendente', order: 1 },
          { label: 'Concluída', order: 8 },
          { label: 'waiting_parts', order: null },
        ],
        serviceTypes: [{ label: 'Instalação', order: 1 }],
      },
    })

    const comOrdem = await fetchOverviewOsSource()
    expect(comOrdem.catalogOrder).toEqual({
      statuses: ['Pendente', 'Concluída', 'waiting_parts'],
      serviceTypes: ['Instalação'],
    })

    respondWith(validResponse)
    const semOrdem = await fetchOverviewOsSource()
    expect(semOrdem.catalogOrder).toEqual({ statuses: [], serviceTypes: [] })
  })

  it('derruba a carga quando a ordem vem malformada', async () => {
    respondWith({ ...validResponse, catalog: { statuses: [{ order: 1 }] } })
    await expect(fetchOverviewOsSource()).rejects.toThrow(/rótulo do catálogo de status/)

    respondWith({ ...validResponse, catalog: { serviceTypes: 'Instalação' } })
    await expect(fetchOverviewOsSource()).rejects.toThrow(/tipos de OS fora do formato de lista/)
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
