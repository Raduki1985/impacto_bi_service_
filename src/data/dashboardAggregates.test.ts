import { describe, expect, it } from 'vitest'

import { buildDashboardData } from './dashboardAggregates'
import type { ServiceOrder } from './dashboardTypes'

/**
 * Séries diárias dos minigráficos dos cards executivos de OS.
 *
 * Elas precisam sair exclusivamente das linhas filtradas, com um ponto por dia
 * com OS e sem zero inventado: um dia sem OS concluída não tem tempo médio, e
 * a série marca a lacuna com `null` em vez de fingir queda a zero.
 */
function order(overrides: Partial<ServiceOrder>): ServiceOrder {
  return {
    os: 'OS-1',
    subscription: 'A-1',
    customer: 'Cliente',
    dateISO: '2026-04-01',
    dayOfWeek: 3,
    period: 'Manhã',
    status: 'Concluída',
    resolution: null,
    category: 'Suporte Técnico',
    technician: 'Técnico Um',
    technicianIndex: 0,
    note: null,
    unproductiveReason: null,
    closingReason: null,
    durationMinutes: 60,
    leadDays: 1,
    weekKey: '2026-03-30',
    monthKey: '2026-04',
    intelligenceTopic: null,
    ...overrides,
  }
}

describe('kpiSparklines', () => {
  const rows: ServiceOrder[] = [
    // Dia 1: duas OS, uma concluída em 60 min e uma improdutiva, dois técnicos.
    order({ os: 'OS-1', dateISO: '2026-04-01', status: 'Concluída', durationMinutes: 60, technicianIndex: 0 }),
    order({ os: 'OS-2', dateISO: '2026-04-01', status: 'Improdutiva', durationMinutes: 30, technicianIndex: 1 }),
    // Dia 2: uma OS em andamento; sem concluída, o tempo médio não tem base.
    order({ os: 'OS-3', dateISO: '2026-04-02', status: 'Em Andamento', durationMinutes: 45, technicianIndex: 0 }),
    // Dia 3: duas concluídas pelo MESMO técnico; média de 90 e 30 = 60 min.
    order({ os: 'OS-4', dateISO: '2026-04-03', status: 'Concluída', durationMinutes: 90, technicianIndex: 2 }),
    order({ os: 'OS-5', dateISO: '2026-04-03', status: 'Concluída', durationMinutes: 30, technicianIndex: 2 }),
  ]

  it('deriva as seis séries por dia, exclusivamente das linhas filtradas', () => {
    const { kpiSparklines } = buildDashboardData(rows)

    expect(kpiSparklines.total).toEqual([2, 1, 2])
    expect(kpiSparklines.completed).toEqual([1, 0, 2])
    expect(kpiSparklines.completionRate).toEqual([0.5, 0, 1])
    expect(kpiSparklines.unproductiveRate).toEqual([0.5, 0, 0])
    expect(kpiSparklines.averageTime).toEqual([60, null, 60])
    expect(kpiSparklines.activeTechnicians).toEqual([2, 1, 1])
  })

  it('mantém as seis séries alinhadas, com um ponto por dia com OS', () => {
    const { kpiSparklines } = buildDashboardData(rows)
    const lengths = [
      kpiSparklines.total.length,
      kpiSparklines.completed.length,
      kpiSparklines.completionRate.length,
      kpiSparklines.unproductiveRate.length,
      kpiSparklines.averageTime.length,
      kpiSparklines.activeTechnicians.length,
    ]

    expect(lengths).toEqual([3, 3, 3, 3, 3, 3])
  })

  it('marca lacuna com null em vez de zero no tempo médio', () => {
    const { kpiSparklines } = buildDashboardData(rows)

    // O dia 2 tem OS (não é ausência de dado do dia), mas não tem concluída:
    // zero significaria atendimento instantâneo, então o ponto é lacuna.
    expect(kpiSparklines.averageTime[1]).toBeNull()
    expect(kpiSparklines.averageTime[1]).not.toBe(0)
  })

  it('fica vazio em recorte sem OS, sem inventar pontos', () => {
    const { kpiSparklines } = buildDashboardData([])

    expect(kpiSparklines.total).toEqual([])
    expect(kpiSparklines.completed).toEqual([])
    expect(kpiSparklines.completionRate).toEqual([])
    expect(kpiSparklines.unproductiveRate).toEqual([])
    expect(kpiSparklines.averageTime).toEqual([])
    expect(kpiSparklines.activeTechnicians).toEqual([])
  })
})
