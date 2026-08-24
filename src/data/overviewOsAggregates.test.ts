import { describe, expect, it } from 'vitest'

import {
  buildOverviewOsData,
  OVERVIEW_PREVIOUS_INCOMPLETE_LABEL,
} from './overviewOsAggregates'
import { OVERVIEW_OS_RECORDS } from './overviewOsData'
import { defaultOverviewOsFilters, type OverviewOsFilters } from './overviewOsFilters'

const filters = (overrides: Partial<OverviewOsFilters> = {}): OverviewOsFilters => ({
  ...defaultOverviewOsFilters,
  ...overrides,
})

const build = (overrides: Partial<OverviewOsFilters> = {}) =>
  buildOverviewOsData(OVERVIEW_OS_RECORDS, filters(overrides))

describe('indicadores do período padrão (01/08 a 21/08/2026)', () => {
  const data = build()

  it('reproduz os totais reais aprovados da fonte', () => {
    expect(data.kpis.total).toBe('1.248')
    expect(data.kpis.completed).toBe('959')
    expect(data.kpis.completionRate).toBe('76,8%')
    expect(data.kpis.unproductiveRate).toBe('10,7%')
    expect(data.kpis.activeTechnicians).toBe(33)
  })

  it('compara com a janela anterior real de mesma duração: 11/07 a 31/07', () => {
    expect(data.previousPeriod).toEqual({
      range: { dateFrom: '2026-07-11', dateTo: '2026-07-31' },
      coverage: 'complete',
      totals: { total: 1110, completed: 880, unproductive: 136, activeTechnicians: 26 },
    })

    expect(data.kpis.totalDelta).toMatchObject({ text: '+12,4%', positive: true, available: true })
    expect(data.kpis.completedDelta).toMatchObject({ text: '+9,0%', available: true })
    expect(data.kpis.completionDelta).toMatchObject({
      text: '-3,1%',
      positive: false,
      available: true,
    })
    // Improdutividade caiu: em indicador de sentido invertido, queda é favorável.
    expect(data.kpis.unproductiveDelta).toMatchObject({
      text: '-12,4%',
      positive: true,
      available: true,
    })
  })

  it('gera minigráficos com um ponto por dia COM OS, sem zeros inventados', () => {
    // Agosto tem 19 dias com OS agendada no recorte padrão.
    expect(data.kpiSparklines.total.length).toBe(19)
    expect(data.kpiSparklines.total.reduce((sum, value) => sum + value, 0)).toBe(1248)
    expect(data.kpiSparklines.completed.length).toBe(19)
    expect(data.kpiSparklines.activeTechnicians.length).toBe(19)
    expect(data.charts.overviewDay.x.length).toBe(19)
    expect(data.charts.overviewDay.total.reduce((sum, value) => sum + value, 0)).toBe(1248)
  })

  it('lista o Top 10 de categorias reais, com o empate na ordem dos artefatos', () => {
    expect(data.charts.categoryTopPairs.slice(0, 6)).toEqual([
      ['fibra instalação', 562],
      ['mudança de endereço', 187],
      ['instalação de 2 câmeras', 166],
      ['instalação de 1 câmera', 56],
      ['REPARO DE CTO', 26],
      ['instalação de 4 câmeras', 26],
    ])
    expect(data.charts.categoryTopPairs.length).toBe(10)
  })

  it('lista o Top de resoluções considerando só OS Concluídas com resolução', () => {
    expect(data.charts.resolutionTopPairs.slice(0, 5)).toEqual([
      ['Instalação Realizada', 647],
      ['Todas as Câmeras Instaladas', 226],
      ['Instalação + Segundo Ponto Executado', 39],
      ['Instalação Parcial das Câmeras, Retornar ao Local', 8],
      ['Troca de Câmeras', 7],
    ])
  })
})

describe('filtros aplicados aos indicadores e gráficos', () => {
  it('equipe Câmeras: 298 OS reais, sem resolução de rede no ranking', () => {
    const data = build({ team: 'Câmeras' })

    expect(data.kpis.total).toBe('298')
    const resolutions = data.charts.resolutionTopPairs.map(([resolution]) => resolution)
    expect(resolutions).not.toContain('Atenuação da Rede')
    expect(resolutions).toContain('Todas as Câmeras Instaladas')
  })

  it('status selecionado filtra indicadores e rankings normalmente', () => {
    const data = build({ status: 'Improdutiva' })

    expect(data.kpis.total).toBe('134')
    // Nenhuma OS improdutiva é concluída: o ranking de resoluções zera.
    expect(data.charts.resolutionTopPairs).toEqual([])
  })
})

describe('séries diárias do Volume diário de OS', () => {
  const data = build()
  const { overviewDay } = data.charts

  it('publica as quatro coleções com o mesmo comprimento', () => {
    expect(overviewDay.x.length).toBe(19)
    expect(overviewDay.total.length).toBe(overviewDay.x.length)
    expect(overviewDay.completed.length).toBe(overviewDay.x.length)
    expect(overviewDay.unproductiveRate.length).toBe(overviewDay.x.length)
  })

  it('soma exatamente os totais do recorte, sem dia a mais nem a menos', () => {
    expect(overviewDay.total.reduce((sum, value) => sum + value, 0)).toBe(1248)
    expect(overviewDay.completed.reduce((sum, value) => sum + value, 0)).toBe(959)
  })

  it('calcula a taxa de cada dia sobre o total DAQUELE dia', () => {
    // 01/08 tem 48 OS, 4 delas improdutivas; 21/08 tem 74 OS e 6 improdutivas.
    expect(overviewDay.x[0]).toBe('01/08')
    expect(overviewDay.unproductiveRate[0]).toBeCloseTo(4 / 48, 12)
    expect(overviewDay.x[overviewDay.x.length - 1]).toBe('21/08')
    expect(overviewDay.unproductiveRate[overviewDay.x.length - 1]).toBeCloseTo(6 / 74, 12)

    // A taxa reconstrói as 134 improdutivas do período: é a mesma contagem do
    // KPI, dia a dia, e não o percentual geral repetido em todos os pontos.
    const improdutivas = overviewDay.unproductiveRate.reduce(
      (sum, rate, index) => sum + rate * overviewDay.total[index],
      0,
    )
    expect(Math.round(improdutivas)).toBe(134)
    expect(new Set(overviewDay.unproductiveRate).size).toBeGreaterThan(1)
  })

  it('mantém a taxa como proporção de 0 a 1, sem arredondamento nem percentual', () => {
    for (const rate of overviewDay.unproductiveRate) {
      expect(Number.isFinite(rate)).toBe(true)
      expect(rate).toBeGreaterThanOrEqual(0)
      expect(rate).toBeLessThanOrEqual(1)
    }
    // Proporção crua: o valor do primeiro dia não é 8,3 nem 8.
    expect(overviewDay.unproductiveRate[0]).toBeLessThan(1)
  })

  it('publica o período INTEIRO, sem corte oculto nos últimos 45 dias', () => {
    // Recorte completo da fonte: 06/04 a 21/08, com 95 dias COM OS.
    const completo = build({ dateFrom: '2026-04-06', dateTo: '2026-08-21' })
    const serie = completo.charts.overviewDay

    expect(serie.x.length).toBe(95)
    expect(serie.x.length).toBeGreaterThan(45)
    // O primeiro e o último ponto são o primeiro e o último dia COM OS do
    // recorte, e não os 45 dias finais dele.
    expect(serie.x[0]).toBe('06/04')
    expect(serie.x[serie.x.length - 1]).toBe('21/08')
    expect(serie.total.length).toBe(95)
    expect(serie.completed.length).toBe(95)
    expect(serie.unproductiveRate.length).toBe(95)
    expect(serie.total.reduce((sum, value) => sum + value, 0)).toBe(4465)
    expect(serie.completed.reduce((sum, value) => sum + value, 0)).toBe(3432)
    // A série diária acompanha os minigráficos ponto a ponto: as duas saem do
    // mesmo mapa de dias, e nenhuma delas é fatiada.
    expect(serie.total).toEqual(completo.kpiSparklines.total)
    expect(serie.unproductiveRate).toEqual(completo.kpiSparklines.unproductiveRate)
  })

  it('recalcula as três séries quando um filtro muda o recorte', () => {
    const cameras = build({ team: 'Câmeras' })
    const serie = cameras.charts.overviewDay

    expect(serie.total.reduce((sum, value) => sum + value, 0)).toBe(298)
    expect(serie.unproductiveRate.length).toBe(serie.x.length)
    expect(serie.unproductiveRate).not.toEqual(overviewDay.unproductiveRate)
  })

  it('não sobra nenhum dia quando a combinação de filtros não tem OS', () => {
    // Câmeras não tem nenhuma OS expirada no período padrão.
    const vazio = build({ team: 'Câmeras', status: 'Expirada' })
    const serie = vazio.charts.overviewDay

    expect(serie.x).toEqual([])
    expect(serie.total).toEqual([])
    expect(serie.completed).toEqual([])
    expect(serie.unproductiveRate).toEqual([])
  })
})

describe('distribuição contextual por status', () => {
  it('ignora somente o filtro Status: as demais barras permanecem', () => {
    const withStatus = build({ status: 'Improdutiva' })
    const withoutStatus = build()

    // O gráfico não vira uma barra única de 100%: o contexto fica igual ao do
    // recorte sem o filtro Status.
    expect(withStatus.charts.statusPairs).toEqual(withoutStatus.charts.statusPairs)
    expect(withStatus.charts.statusPairs.map(([status]) => status)).toEqual([
      'Pendente de Aprovação',
      'Concluída',
      'Improdutiva',
      'Encerrada',
      'Expirada',
    ])
  })

  it('aplica os demais filtros ao contexto do gráfico', () => {
    const data = build({ team: 'Câmeras', status: 'Concluída' })
    const total = data.charts.statusPairs.reduce((sum, [, value]) => sum + value, 0)

    // O contexto soma as 298 OS de Câmeras, não as 1.248 do período.
    expect(total).toBe(298)
  })
})

describe('comparação com período anterior incompleto ou vazio', () => {
  it('janela anterior fora da cobertura: sem percentual e com o aviso aprovado', () => {
    const data = build({ dateFrom: '2026-04-06', dateTo: '2026-04-30' })

    expect(data.previousPeriod?.coverage).toBe('incomplete')
    expect(data.previousPeriod?.totals).toBeNull()
    for (const delta of [
      data.kpis.totalDelta,
      data.kpis.completedDelta,
      data.kpis.completionDelta,
      data.kpis.unproductiveDelta,
    ]) {
      expect(delta.available).toBe(false)
      expect(delta.unavailableLabel).toBe(OVERVIEW_PREVIOUS_INCOMPLETE_LABEL)
    }
  })

  it('janela anterior coberta mas sem registros: comparação indisponível padrão', () => {
    // Suporte Lógico tem 5 OS em junho e nenhuma na janela anterior de mesma
    // duração (02/05 a 31/05), que está inteira dentro da cobertura da fonte.
    const data = build({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      team: 'Suporte Lógico',
    })

    expect(data.kpis.total).toBe('5')
    expect(data.previousPeriod?.coverage).toBe('complete')
    expect(data.previousPeriod?.totals?.total).toBe(0)
    expect(data.kpis.totalDelta.available).toBe(false)
    // Sem motivo específico: o card mantém o aviso padrão de sempre.
    expect(data.kpis.totalDelta.unavailableLabel).toBeUndefined()
  })
})
