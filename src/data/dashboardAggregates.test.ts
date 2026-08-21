import { describe, expect, it } from 'vitest'

import { buildDashboardData } from './dashboardAggregates'
import type { ServiceOrder } from './dashboardTypes'
import { OS_RESOLUTIONS } from './mockOsCatalog'

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
    dateISO: '2026-08-03',
    dayOfWeek: 1,
    period: 'Manhã',
    status: 'Concluída',
    resolution: null,
    category: 'Suporte Técnico',
    serviceType: 'Manutenção',
    city: 'Atibaia',
    technicianId: 'tec-1',
    technician: 'Técnico Um',
    team: 'Suporte Técnico',
    note: null,
    unproductiveReason: null,
    closingReason: null,
    durationMinutes: 60,
    leadDays: 1,
    weekKey: '2026-08-03',
    monthKey: '2026-08',
    intelligenceTopic: null,
    ...overrides,
  }
}

describe('kpiSparklines', () => {
  const rows: ServiceOrder[] = [
    // Dia 1: duas OS, uma concluída em 60 min e uma improdutiva, dois técnicos.
    order({ os: 'OS-1', dateISO: '2026-08-03', status: 'Concluída', durationMinutes: 60, technicianId: 'tec-1', technician: 'Técnico Um' }),
    order({ os: 'OS-2', dateISO: '2026-08-03', status: 'Improdutiva', durationMinutes: 30, technicianId: 'tec-2', technician: 'Técnico Dois' }),
    // Dia 2: uma OS em andamento; sem concluída, o tempo médio não tem base.
    order({ os: 'OS-3', dateISO: '2026-08-04', status: 'Em Andamento', durationMinutes: 45, technicianId: 'tec-1', technician: 'Técnico Um' }),
    // Dia 3: duas concluídas pelo MESMO técnico; média de 90 e 30 = 60 min.
    order({ os: 'OS-4', dateISO: '2026-08-05', status: 'Concluída', durationMinutes: 90, technicianId: 'tec-3', technician: 'Técnico Três' }),
    order({ os: 'OS-5', dateISO: '2026-08-05', status: 'Concluída', durationMinutes: 30, technicianId: 'tec-3', technician: 'Técnico Três' }),
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

/**
 * OS sem técnico atribuído: entram nos totais, mas nunca no ranking, nos
 * heatmaps de técnico nem na contagem de técnicos ativos.
 */
describe('OS sem técnico', () => {
  const semTecnico = { technicianId: null, technician: null, team: null } as const
  const rows: ServiceOrder[] = [
    order({ os: 'OS-1', status: 'Concluída', technicianId: 'tec-1', technician: 'Técnico Um' }),
    order({ os: 'OS-2', status: 'Concluída', technicianId: 'tec-1', technician: 'Técnico Um' }),
    order({ os: 'OS-3', status: 'Agendada', durationMinutes: 0, ...semTecnico }),
    order({ os: 'OS-4', status: 'Expirada', durationMinutes: 0, ...semTecnico }),
  ]

  it('conta as OS no total, mas ignora OS sem técnico nos técnicos ativos', () => {
    const data = buildDashboardData(rows)

    expect(data.kpis.total).toBe('4')
    expect(data.kpis.activeTechnicians).toBe(1)
  })

  it('não cria linha de ranking nem série diária para o técnico nulo', () => {
    const data = buildDashboardData(rows)

    expect(data.technicianRanking).toHaveLength(1)
    expect(data.technicianRanking[0].name).toBe('Técnico Um')
    // Dia inteiro sem técnico atuando conta zero, e não um técnico fantasma.
    expect(data.kpiSparklines.activeTechnicians).toEqual([1])
  })
})

/**
 * Projeções visuais de resolução: o catálogo (29 valores) e os dados completos
 * do recorte ficam intactos; os gráficos recebem o Top 10 e, quando sobra
 * volume, a agregação visual `Outras`, sempre recalculados do recorte.
 */
describe('projeções de resolução (Top 10 + Outras)', () => {
  /** `count` OS concluídas por resolução, na categoria pedida. */
  function resolvedRows(
    spec: { resolution: string; count: number; category?: string }[],
  ): ServiceOrder[] {
    return spec.flatMap(({ resolution, count, category = 'Reparo' }, specIndex) =>
      Array.from({ length: count }, (_, index) =>
        order({
          os: `OS-${specIndex}-${index}`,
          status: 'Concluída',
          resolution,
          category,
        }),
      ),
    )
  }

  // As 12 primeiras resoluções do catálogo, com contagens decrescentes
  // (12, 11, ..., 1): o Top 10 é determinístico e `Outras` soma 2 + 1 = 3.
  const twelve = OS_RESOLUTIONS.slice(0, 12).map((resolution, index) => ({
    resolution,
    count: 12 - index,
  }))

  it('seleciona as 10 mais frequentes em ordem decrescente, sem tocar nos dados completos', () => {
    const { charts } = buildDashboardData(resolvedRows(twelve))

    expect(charts.resolutionTopPairs).toHaveLength(10)
    expect(charts.resolutionTopPairs.map(([label]) => label)).toEqual(
      twelve.slice(0, 10).map((item) => item.resolution),
    )
    expect(charts.resolutionTopPairs.map(([, value]) => value)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
    ])
    // Dados completos: as 12 resoluções continuam disponíveis, sem `Outras`.
    expect(charts.resolutionPairs).toHaveLength(12)
    expect(charts.resolutionPairs.map(([label]) => label)).not.toContain('Outras')
  })

  it('soma em Outras exatamente o que ficou fora do Top 10', () => {
    const { charts } = buildDashboardData(resolvedRows(twelve))
    const total = charts.resolutionPairs.reduce((sum, [, value]) => sum + value, 0)
    const projectedTotal = charts.resolutionTopWithOthers.reduce((sum, [, value]) => sum + value, 0)

    expect(charts.resolutionTopWithOthers.at(-1)).toEqual(['Outras', 3])
    // Nenhum total se perde: Top 10 + Outras = total completo do recorte.
    expect(projectedTotal).toBe(total)
  })

  it('desempata pela ordem do catálogo oficial', () => {
    // Onze resoluções empatadas em 1, entregues em ordem INVERSA à do
    // catálogo: o Top 10 ainda sai na ordem do catálogo, e a excluída é a de
    // maior posição nele.
    const eleven = OS_RESOLUTIONS.slice(0, 11)
    const tied = [...eleven].reverse().map((resolution) => ({ resolution, count: 1 }))
    const { charts } = buildDashboardData(resolvedRows(tied))

    expect(charts.resolutionTopPairs.map(([label]) => label)).toEqual(eleven.slice(0, 10))
    expect(charts.resolutionTopWithOthers.at(-1)).toEqual(['Outras', 1])
  })

  it('não inventa Outras quando há dez ou menos resoluções no recorte', () => {
    const three = OS_RESOLUTIONS.slice(0, 3).map((resolution) => ({ resolution, count: 2 }))
    const { charts } = buildDashboardData(resolvedRows(three))

    expect(charts.resolutionTopPairs).toHaveLength(3)
    expect(charts.resolutionTopWithOthers).toEqual(charts.resolutionTopPairs)
    expect(charts.resolutionCategoryTop.x).not.toContain('Outras')
    expect(charts.categoryResolution.x).not.toContain('Outras')
  })

  it('agrega Outras por categoria preservando o total de cada uma', () => {
    const rows = [
      ...resolvedRows(twelve.map((item) => ({ ...item, category: 'Reparo' }))),
      // A segunda categoria usa uma 13ª resolução com volume baixo, que fica
      // fora do Top 10 combinado: o volume dela precisa aparecer em `Outras`.
      ...resolvedRows([{ resolution: OS_RESOLUTIONS[12], count: 2, category: 'Suporte Técnico' }]),
    ]
    const { charts } = buildDashboardData(rows)
    const { x, series } = charts.resolutionCategoryTop
    const sumOf = (name: string) =>
      series.find((item) => item.name === name)!.data.reduce((sum, value) => sum + value, 0)

    expect(x.at(-1)).toBe('Outras')
    expect(sumOf('Reparo')).toBe(78)
    expect(sumOf('Suporte Técnico')).toBe(2)

    // O `Outras` de cada categoria é calculado separadamente: Reparo soma as
    // duas resoluções que ficaram de fora (2 + 1) e Suporte Técnico soma as
    // próprias 2 OS, sem misturar linhas.
    const othersIndex = x.indexOf('Outras')
    expect(series.find((item) => item.name === 'Reparo')!.data[othersIndex]).toBe(3)
    expect(series.find((item) => item.name === 'Suporte Técnico')!.data[othersIndex]).toBe(2)

    // A matriz de calor preserva os mesmos totais por linha de categoria.
    const yReparo = charts.categoryResolution.y.indexOf('Reparo')
    const reparoTotal = charts.categoryResolution.data
      .filter(([, yIndex]) => yIndex === yReparo)
      .reduce((sum, [, , value]) => sum + value, 0)
    expect(reparoTotal).toBe(78)
  })

  it('recalcula a projeção para cada recorte filtrado', () => {
    const full = buildDashboardData(resolvedRows(twelve)).charts
    // Outro recorte (como após um filtro): a última resolução domina.
    const subset = buildDashboardData(
      resolvedRows([{ resolution: OS_RESOLUTIONS[11], count: 9 }]),
    ).charts

    expect(full.resolutionTopPairs[0][0]).toBe(OS_RESOLUTIONS[0])
    expect(subset.resolutionTopPairs).toEqual([[OS_RESOLUTIONS[11], 9]])
    expect(subset.resolutionTopWithOthers).toEqual([[OS_RESOLUTIONS[11], 9]])
  })
})

describe('status normalizados nos agregados', () => {
  it('conta o fechamento por Encerrada e Cancelada, sem o rótulo Fechada', () => {
    const rows: ServiceOrder[] = [
      order({ os: 'OS-1', status: 'Encerrada', durationMinutes: 0, closingReason: 'Duplicidade' }),
      order({ os: 'OS-2', status: 'Cancelada', durationMinutes: 0, closingReason: 'Cancelamento' }),
      order({ os: 'OS-3', status: 'Concluída' }),
    ]
    const data = buildDashboardData(rows)

    expect(data.kpis.closed).toBe('1')
    // Empate mantém a ordem de negócio dos motivos (sort estável).
    expect(data.charts.closingReason).toEqual([
      ['Duplicidade', 1],
      ['Cancelamento', 1],
    ])
    expect(data.charts.statusPairs.map(([status]) => status)).not.toContain('Fechada')
  })

  it('dá cor própria a cada um dos treze status normalizados', () => {
    const { charts } = buildDashboardData([])
    const statuses = [
      'Pendente',
      'Agendada',
      'Reagendada',
      'Em Deslocamento',
      'Técnico no Local',
      'Em Andamento',
      'Pendente de Aprovação',
      'Concluída',
      'Cancelada',
      'Improdutiva',
      'Encerrada',
      'Expirada',
      'Provisionamento',
    ]

    for (const status of statuses) {
      expect(charts.statusColors[status]).toMatch(/^#[0-9a-f]{6}$/i)
    }
    // Cores distintas: a cor é identidade do status.
    expect(new Set(statuses.map((status) => charts.statusColors[status])).size).toBe(statuses.length)
    expect(charts.statusColors.Fechada).toBeUndefined()
  })
})
