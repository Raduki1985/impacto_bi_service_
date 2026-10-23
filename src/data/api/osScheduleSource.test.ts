import { describe, expect, it } from 'vitest'

import { BiApiError } from './biApiClient'
import { parseOsSchedule, parseOsScheduleCategory, scheduleQueryParams } from './osScheduleSource'

/**
 * Teste espelho da fonte da Agenda e capacidade: a resposta do serviço vira
 * a projeção da página, os nulos previstos passam, e um campo fora do
 * formato derruba a leitura com a mensagem em português.
 */

function gauge(technicians: number | null = 3, capacity: number | null = 19.2, occupation: number | null = 0.5) {
  return { technicians, capacity_hours: capacity, occupation }
}

function period(key: string, label: string) {
  return {
    period_key: key,
    period: label,
    scheduled: 5,
    consumed_hours: 7.5,
    scheduler: gauge(),
    operation: gauge(2, 6.4, 1.17),
  }
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    generated_at: '2026-10-16T14:32:00-03:00',
    today: '2026-10-16',
    date_from: '2026-10-09',
    date_to: '2026-10-22',
    history_days: 28,
    parameters: {
      period_duration_hours: 4,
      efficiency: 0.8,
      hours_per_technician_period: 3.2,
      weekend_scheduling_enabled: true,
      active_technicians: 42,
      available_now: 35,
      periods: [
        { key: 'morning', label: 'Manhã', start_hour: 8, limit_hour: 11 },
        { key: 'afternoon', label: 'Tarde', start_hour: null, limit_hour: null },
      ],
    },
    days: [
      {
        day: '2026-10-17',
        kind: 'future',
        closed: false,
        closed_teams: ['Infra'],
        closures: [{ name: 'BARRAMENTO', group: 'BARRAMENTO', teams: ['Infra'] }, { name: null, group: 'Fixos', teams: [] }],
        scheduled: 8,
        without_period: 0,
        orders_without_sla: 1,
        consumed_hours: 11,
        scheduler: gauge(),
        operation: gauge(null, null, null),
        presence_basis: null,
        periods: [period('morning', 'Manhã'), period('afternoon', 'Tarde')],
        categories: [
          {
            id: 'cat-1',
            name: 'Instalação',
            service_type: 'Instalação',
            sla_hours: 1.5,
            apt_technicians: 2,
            scheduled: 4,
            consumed_hours: 9,
            capacity_hours: 12.8,
            occupation: 0.7031,
            full_periods: 1,
            periods: [
              {
                period_key: 'morning',
                period: 'Manhã',
                scheduled: 3,
                consumed_hours: 5.5,
                capacity_hours: 6.4,
                occupation: 0.8594,
                full: true,
              },
            ],
          },
        ],
      },
      {
        day: '2026-10-18',
        kind: 'future',
        closed: true,
        closed_teams: [],
        scheduled: 0,
        without_period: 0,
        orders_without_sla: 0,
        consumed_hours: 0,
        scheduler: gauge(3, 19.2, 0),
        operation: gauge(1, 6.4, 0),
        presence_basis: 'typical_weekday',
        periods: [],
        categories: [],
      },
    ],
    registry: [
      {
        id: 'cat-2',
        name: 'Câmera Offline',
        service_type: 'Manutenção',
        sla_hours: null,
        apt_technicians: 1,
        executed_by: 8,
        executed_without_capability: 7,
        orders: 145,
        technicians: [
          { id: 'u-1', name: 'Ana', teams: ['Campo'], active: true, orders: 9 },
          { id: 'u-2', name: 'Bruno', teams: [], active: false, orders: 2 },
        ],
      },
      {
        id: 'cat-3',
        name: 'Fibra Instalação',
        service_type: 'Instalação',
        sla_hours: 1.5,
        apt_technicians: 12,
        executed_by: 12,
        executed_without_capability: 0,
        orders: 783,
      },
    ],
    availability: [
      {
        id: 'cat-3',
        name: 'Fibra Instalação',
        service_type: 'Instalação',
        sla_hours: 1.5,
        apt_technicians: 12,
        always_available: false,
        next: { day: '2026-10-17', period_key: 'afternoon', period: 'Tarde', consumed_hours: 20, capacity_hours: 38.4 },
        full_before: 1,
        closed_before: 2,
        scheduled_ahead: 34,
      },
      {
        id: 'cat-2',
        name: 'Câmera Offline',
        service_type: 'Manutenção',
        sla_hours: null,
        apt_technicians: 0,
        always_available: false,
        next: null,
        full_before: 10,
        closed_before: 2,
        scheduled_ahead: 0,
      },
    ],
    ...overrides,
  }
}

describe('parseOsSchedule', () => {
  it('converte a resposta inteira, com os nulos previstos', () => {
    const source = parseOsSchedule(response())

    expect(source.today).toBe('2026-10-16')
    expect(source.parameters.hoursPerTechnicianPeriod).toBe(3.2)
    expect(source.parameters.periods[1]).toEqual({ key: 'afternoon', label: 'Tarde', startHour: null, limitHour: null })
    const [amanha, domingo] = source.days
    expect(amanha.closedTeams).toEqual(['Infra'])
    expect(amanha.closures).toEqual([
      { name: 'BARRAMENTO', group: 'BARRAMENTO', teams: ['Infra'] },
      { name: '', group: 'Fixos', teams: [] },
    ])
    // Resposta antiga, sem os feriados do dia: lista vazia, sem derrubar a leitura.
    expect(parseOsSchedule(response()).days[1].closures).toEqual([])
    expect(amanha.operation).toEqual({ technicians: null, capacityHours: null, occupation: null })
    expect(amanha.presenceBasis).toBeNull()
    expect(amanha.ordersWithoutSla).toBe(1)
    expect(amanha.categories[0].periods[0].full).toBe(true)
    expect(amanha.categories[0].serviceType).toBe('Instalação')
    expect(domingo.closed).toBe(true)
    expect(domingo.periods).toEqual([])
    expect(domingo.categories).toEqual([])
    expect(domingo.presenceBasis).toBe('typical_weekday')
    expect(source.registry[0].slaHours).toBeNull()
    expect(source.registry[0].executedWithoutCapability).toBe(7)
    expect(source.registry[0].technicians).toEqual([
      { id: 'u-1', name: 'Ana', teams: ['Campo'], active: true, orders: 9 },
      { id: 'u-2', name: 'Bruno', teams: [], active: false, orders: 2 },
    ])
    // Resposta sem a lista (serviço anterior a 19/10/2026): vazia, não erro.
    expect(source.registry[1].technicians).toEqual([])
    // A próxima agenda por categoria (22/10/2026): com e sem turno.
    expect(source.availability[0]).toEqual({
      id: 'cat-3',
      name: 'Fibra Instalação',
      serviceType: 'Instalação',
      slaHours: 1.5,
      aptTechnicians: 12,
      alwaysAvailable: false,
      next: { day: '2026-10-17', periodKey: 'afternoon', period: 'Tarde', consumedHours: 20, capacityHours: 38.4 },
    })
    expect(source.availability[1].next).toBeNull()
    expect(source.availability[1].slaHours).toBeNull()
  })

  it('aceita a janela sem dia nenhum', () => {
    const source = parseOsSchedule(response({ days: [], registry: [] }))

    expect(source.days).toEqual([])
    expect(source.registry).toEqual([])
  })

  it('resposta de serviço anterior a 22/10/2026, sem a próxima agenda, lê com a lista vazia', () => {
    expect(parseOsSchedule(response({ availability: undefined })).availability).toEqual([])
    expect(parseOsSchedule(response({ availability: null })).availability).toEqual([])
  })

  it.each([
    ['a data de um dia', { days: [{ ...response().days[1], day: '18/10/2026' }] }, 'aaaa-mm-dd'],
    ['a natureza do dia', { days: [{ ...response().days[1], kind: 'ontem' }] }, 'fora dos valores previstos'],
    ['uma contagem', { days: [{ ...response().days[1], scheduled: -1 }] }, 'contagem válida'],
    ['um número', { days: [{ ...response().days[1], consumed_hours: 'oito' }] }, 'número válido'],
    ['um valor lógico', { days: [{ ...response().days[1], closed: 'sim' }] }, 'valor lógico'],
    [
      'o cheio de uma categoria',
      {
        days: [
          {
            ...response().days[0],
            categories: [
              {
                ...response().days[0].categories[0],
                periods: [{ ...response().days[0].categories[0].periods[0], full: 'sim' }],
              },
            ],
          },
        ],
      },
      'valor lógico',
    ],
    ['a base de presença', { days: [{ ...response().days[1], presence_basis: 'ontem' }] }, 'fora dos valores previstos'],
    [
      'o dia da próxima agenda',
      { availability: [{ ...response().availability[0], next: { ...response().availability[0].next, day: '17/10' } }] },
      'aaaa-mm-dd',
    ],
    ['a próxima agenda', { availability: 'nenhuma' }, 'formato de lista'],
    ['a lista de dias', { days: 'nenhum' }, 'formato de lista'],
    ['os parâmetros', { parameters: null }, 'fora do formato esperado'],
  ])('derruba a leitura com mensagem em português quando %s vem fora do formato', (_campo, overrides, trecho) => {
    expect(() => parseOsSchedule(response(overrides))).toThrow(BiApiError)
    expect(() => parseOsSchedule(response(overrides))).toThrow(trecho)
  })
})

describe('scheduleQueryParams', () => {
  it('sem janela não manda parâmetro; com janela manda o primeiro e o último dia', () => {
    expect(scheduleQueryParams()).toBeUndefined()
    expect(scheduleQueryParams({ from: '2026-10-12', to: '2026-11-08' })).toEqual({
      date_from: '2026-10-12',
      date_to: '2026-11-08',
    })
  })
})

describe('parseOsScheduleCategory', () => {
  function categoryResponse(overrides: Record<string, unknown> = {}) {
    return {
      generated_at: '2026-10-22T16:01:00-03:00',
      today: '2026-10-22',
      date_from: '2026-10-19',
      date_to: '2026-11-29',
      category: {
        id: 'cat-2cam',
        name: 'Instalação de 2 Câmeras',
        service_type: 'Instalação de Câmeras',
        sla_hours: 1.33,
        always_available: false,
      },
      days: [
        {
          day: '2026-10-23',
          kind: 'future',
          closed: false,
          apt_technicians: 4,
          periods: [
            {
              period_key: 'morning',
              period: 'Manhã',
              scheduled: 6,
              consumed_hours: 12.6667,
              capacity_hours: 12.8,
              occupation: 0.9896,
              full: true,
              fits: 0,
              weekend_closed: false,
            },
            {
              period_key: 'afternoon',
              period: 'Tarde',
              scheduled: 0,
              consumed_hours: 0,
              capacity_hours: 0,
              occupation: null,
              full: true,
              fits: null,
              weekend_closed: false,
            },
          ],
        },
      ],
      ...overrides,
    }
  }

  it('converte a resposta, com os nulos previstos', () => {
    const view = parseOsScheduleCategory(categoryResponse())

    expect(view.category).toEqual({
      id: 'cat-2cam',
      name: 'Instalação de 2 Câmeras',
      serviceType: 'Instalação de Câmeras',
      slaHours: 1.33,
      alwaysAvailable: false,
    })
    const [sexta] = view.days
    expect([sexta.day, sexta.kind, sexta.closed, sexta.aptTechnicians]).toEqual(['2026-10-23', 'future', false, 4])
    expect(sexta.periods[0]).toEqual({
      periodKey: 'morning',
      period: 'Manhã',
      scheduled: 6,
      consumedHours: 12.6667,
      capacityHours: 12.8,
      occupation: 0.9896,
      full: true,
      fits: 0,
      weekendClosed: false,
    })
    expect([sexta.periods[1].occupation, sexta.periods[1].fits]).toEqual([null, null])
  })

  it.each([
    ['a categoria', { category: null }, 'fora do formato esperado'],
    ['as vagas', { days: [{ ...categoryResponse().days[0], periods: [{ ...categoryResponse().days[0].periods[0], fits: -1 }] }] }, 'contagem válida'],
    ['o fim de semana', { days: [{ ...categoryResponse().days[0], periods: [{ ...categoryResponse().days[0].periods[0], weekend_closed: 'não' }] }] }, 'valor lógico'],
  ])('derruba a leitura com mensagem em português quando %s vem fora do formato', (_campo, overrides, trecho) => {
    expect(() => parseOsScheduleCategory(categoryResponse(overrides))).toThrow(BiApiError)
    expect(() => parseOsScheduleCategory(categoryResponse(overrides))).toThrow(trecho)
  })
})
