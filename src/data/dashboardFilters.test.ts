import { describe, expect, it } from 'vitest'

import {
  applyDashboardFilters,
  applyPreviousPeriodFilters,
  buildFilterOptions,
  defaultDashboardFilters,
  listActiveDashboardFilters,
  previousPeriodRange,
  updateDashboardFilter,
  type DashboardFilters,
} from './dashboardFilters'
import type { ServiceOrder } from './dashboardTypes'

function order(overrides: Partial<ServiceOrder>): ServiceOrder {
  return {
    os: 'OS-1',
    subscription: 'A-1',
    customer: 'Cliente',
    dateISO: '2026-08-05',
    dayOfWeek: 3,
    period: 'Manhã',
    status: 'Concluída',
    resolution: 'Instalação Realizada',
    category: 'Fibra Instalação',
    serviceType: 'Instalação',
    city: 'Atibaia',
    technicianId: 'tec-1',
    technician: 'Técnico Um',
    team: 'Terceirizada',
    note: null,
    unproductiveReason: null,
    closingReason: null,
    durationMinutes: 90,
    leadDays: 0,
    weekKey: '2026-08-03',
    monthKey: '2026-08',
    intelligenceTopic: null,
    ...overrides,
  }
}

function filters(overrides: Partial<DashboardFilters>): DashboardFilters {
  return { ...defaultDashboardFilters, ...overrides }
}

/** Base pequena e explícita para exercitar cada um dos sete filtros. */
const rows: ServiceOrder[] = [
  order({ os: 'OS-1' }),
  order({
    os: 'OS-2',
    team: 'Câmeras',
    technicianId: 'tec-2',
    technician: 'Técnico Dois',
    serviceType: 'Instalação de Câmera',
    city: 'Piracaia',
    resolution: 'Todas as Câmeras Instaladas',
  }),
  order({
    os: 'OS-3',
    status: 'Improdutiva',
    resolution: null,
    unproductiveReason: 'Cliente Ausente',
    durationMinutes: 20,
    dateISO: '2026-08-10',
  }),
  order({
    os: 'OS-4',
    status: 'Agendada',
    resolution: null,
    technicianId: null,
    technician: null,
    team: null,
    durationMinutes: 0,
    dateISO: '2026-08-20',
  }),
  // Janela anterior: mesma forma da OS-2, mas em julho.
  order({
    os: 'OS-5',
    dateISO: '2026-07-20',
    weekKey: '2026-07-20',
    monthKey: '2026-07',
    team: 'Câmeras',
    technicianId: 'tec-2',
    technician: 'Técnico Dois',
    serviceType: 'Instalação de Câmera',
    city: 'Piracaia',
    resolution: 'Todas as Câmeras Instaladas',
  }),
  order({ os: 'OS-6', dateISO: '2026-07-15', weekKey: '2026-07-13', monthKey: '2026-07' }),
]

describe('estado inicial dos filtros', () => {
  it('abre na janela confirmada da investigação, com os demais filtros neutros', () => {
    expect(defaultDashboardFilters).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-21',
      team: 'Todas',
      serviceType: 'Todos',
      city: 'Todas',
      status: 'Todos',
      resolution: 'Todas',
    })
  })
})

describe('opções dos filtros', () => {
  const options = buildFilterOptions()

  it('publica as seis equipes oficiais, sem opção residual', () => {
    expect(options.teams).toEqual([
      'Infra',
      'Terceirizada',
      'Câmeras',
      'Suporte Técnico',
      'Suporte Lógico',
      'Retiradas',
    ])
    for (const invalid of ['Sem equipe', 'Sem técnico', 'Não classificada']) {
      expect(options.teams).not.toContain(invalid)
    }
  })

  it('publica catálogos completos e normalizados nas demais dimensões', () => {
    expect(options.serviceTypes).toHaveLength(7)
    expect(options.cities).toHaveLength(11)
    expect(options.statuses).toHaveLength(13)
    expect(options.resolutions).toHaveLength(29)
  })

  it('não duplica valores nem por caixa', () => {
    for (const list of [
      options.teams,
      options.serviceTypes,
      options.cities,
      options.statuses,
      options.resolutions,
    ]) {
      expect(new Set(list.map((value) => value.toLocaleLowerCase('pt-BR'))).size).toBe(list.length)
    }
  })

  it('não expõe valores crus do SGI', () => {
    for (const raw of ['in_progress', 'cancelled', 'Chegou', 'Checklist', 'Fechada']) {
      expect(options.statuses).not.toContain(raw)
    }
    expect(options.resolutions).not.toContain('Spliter')
    expect(options.resolutions).not.toContain('Cabo rompido')
  })
})

describe('aplicação individual dos sete filtros', () => {
  it('filtra por Início e Fim', () => {
    const result = applyDashboardFilters(rows, filters({ dateFrom: '2026-08-06', dateTo: '2026-08-21' }))

    expect(result.map((row) => row.os)).toEqual(['OS-3', 'OS-4'])
  })

  it('filtra por Equipe', () => {
    const result = applyDashboardFilters(rows, filters({ team: 'Câmeras' }))

    expect(result.map((row) => row.os)).toEqual(['OS-2'])
  })

  it('filtra por Tipo de OS', () => {
    const result = applyDashboardFilters(rows, filters({ serviceType: 'Instalação' }))

    expect(result.map((row) => row.os)).toEqual(['OS-1', 'OS-3', 'OS-4'])
  })

  it('filtra por Cidade', () => {
    const result = applyDashboardFilters(rows, filters({ city: 'Piracaia' }))

    expect(result.map((row) => row.os)).toEqual(['OS-2'])
  })

  it('filtra por Status', () => {
    const result = applyDashboardFilters(rows, filters({ status: 'Improdutiva' }))

    expect(result.map((row) => row.os)).toEqual(['OS-3'])
  })

  it('filtra por Resolução', () => {
    const result = applyDashboardFilters(rows, filters({ resolution: 'Instalação Realizada' }))

    expect(result.map((row) => row.os)).toEqual(['OS-1'])
  })

  it('Equipe filtra por equipe da OS e nunca casa com OS sem técnico', () => {
    for (const team of ['Infra', 'Suporte Lógico', 'Retiradas']) {
      expect(applyDashboardFilters(rows, filters({ team }))).toEqual([])
    }
  })
})

describe('validade do intervalo de datas', () => {
  it('aceita datas válidas e mantém os filtros não temporais', () => {
    const current = defaultDashboardFilters

    expect(updateDashboardFilter(current, 'dateFrom', '2026-08-05')).toMatchObject({
      dateFrom: '2026-08-05',
      dateTo: '2026-08-21',
    })
    expect(updateDashboardFilter(current, 'team', 'Infra').team).toBe('Infra')
  })

  it('ignora data vazia, inexistente ou que inverta o intervalo', () => {
    const current = defaultDashboardFilters

    expect(updateDashboardFilter(current, 'dateFrom', '')).toBe(current)
    expect(updateDashboardFilter(current, 'dateFrom', '2026-02-30')).toBe(current)
    expect(updateDashboardFilter(current, 'dateFrom', '2026-08-22')).toBe(current)
    expect(updateDashboardFilter(current, 'dateTo', '2026-07-31')).toBe(current)
  })

  it('protege os recortes e a janela anterior contra intervalos inválidos', () => {
    for (const invalid of [
      filters({ dateFrom: '' }),
      filters({ dateTo: '2026-02-30' }),
      filters({ dateFrom: '2026-08-22' }),
    ]) {
      expect(applyDashboardFilters(rows, invalid)).toEqual([])
      expect(previousPeriodRange(invalid)).toBeNull()
      expect(applyPreviousPeriodFilters(rows, invalid)).toEqual([])
    }
  })
})

describe('combinação dos filtros', () => {
  it('aplica Equipe, Tipo de OS, Cidade, Status e Resolução juntos', () => {
    const combined = filters({
      team: 'Câmeras',
      serviceType: 'Instalação de Câmera',
      city: 'Piracaia',
      status: 'Concluída',
      resolution: 'Todas as Câmeras Instaladas',
    })

    expect(applyDashboardFilters(rows, combined).map((row) => row.os)).toEqual(['OS-2'])
    // Basta uma dimensão divergir para o recorte esvaziar.
    expect(applyDashboardFilters(rows, { ...combined, city: 'Atibaia' })).toEqual([])
  })

  it('devolve vazio em período sem dados, sem inventar linhas', () => {
    const result = applyDashboardFilters(rows, filters({ dateFrom: '2026-09-01', dateTo: '2026-09-30' }))

    expect(result).toEqual([])
  })
})

describe('filtros ativos em relação ao padrão', () => {
  it('estado padrão não tem nenhum filtro ativo', () => {
    expect(listActiveDashboardFilters(defaultDashboardFilters)).toEqual([])
  })

  it('cada campo diferente do padrão conta um filtro ativo, incluindo datas', () => {
    expect(listActiveDashboardFilters(filters({ team: 'Infra' }))).toEqual([
      { field: 'team', label: 'Equipe', value: 'Infra' },
    ])
    expect(listActiveDashboardFilters(filters({ dateFrom: '2026-08-05' }))).toEqual([
      { field: 'dateFrom', label: 'Início', value: '2026-08-05' },
    ])
    expect(
      listActiveDashboardFilters(filters({ dateTo: '2026-08-15', status: 'Concluída' })),
    ).toHaveLength(2)
  })

  it('mantém a ordem aprovada dos sete filtros e os rótulos oficiais', () => {
    const all = listActiveDashboardFilters(
      filters({
        dateFrom: '2026-08-02',
        dateTo: '2026-08-20',
        team: 'Infra',
        serviceType: 'Instalação',
        city: 'Atibaia',
        status: 'Concluída',
        resolution: 'Instalação Realizada',
      }),
    )

    expect(all.map((active) => active.label)).toEqual([
      'Início',
      'Fim',
      'Equipe',
      'Tipo de OS',
      'Cidade',
      'Status',
      'Resolução',
    ])
  })
})

describe('janela anterior', () => {
  it('calcula a janela imediatamente anterior de mesma duração', () => {
    expect(previousPeriodRange(defaultDashboardFilters)).toEqual({
      dateFrom: '2026-07-11',
      dateTo: '2026-07-31',
    })
  })

  it('aplica também os filtros não temporais ao período anterior', () => {
    const result = applyPreviousPeriodFilters(rows, filters({ team: 'Câmeras' }))

    expect(result.map((row) => row.os)).toEqual(['OS-5'])

    const all = applyPreviousPeriodFilters(rows, defaultDashboardFilters)
    expect(all.map((row) => row.os)).toEqual(['OS-5', 'OS-6'])
  })
})
