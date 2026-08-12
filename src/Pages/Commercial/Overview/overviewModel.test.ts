import { describe, expect, it } from 'vitest'

import { getCommercialDataset } from '../../../data/mockCommercialData'
import {
  buildCommercialOverviewSnapshot,
  initialCommercialOverviewFilters,
} from './overviewModel'

const dataset = getCommercialDataset()

describe('overviewModel', () => {
  it('resume julho com as mesmas regras de vendas, Meta e Supermeta', () => {
    const snapshot = buildCommercialOverviewSnapshot(
      dataset,
      initialCommercialOverviewFilters(),
    )

    expect(snapshot.periodLabel).toBe('01/07/2026 a 31/07/2026')
    expect(snapshot.metrics.activeSales).toBe(883)
    expect(snapshot.metrics.commercialSales).toBe(795)
    expect(snapshot.metrics.corporateSales).toBe(88)
    expect(snapshot.metrics.goal).toBe(800)
    expect(snapshot.metrics.superGoal).toBe(880)
    expect(snapshot.metrics.goalAchieved).toBe(795)
    expect(snapshot.metrics.superGoalAchieved).toBe(883)
    expect(snapshot.topSellers).toHaveLength(5)
    expect(snapshot.topPlans).toHaveLength(5)
    expect(snapshot.monthly).toHaveLength(7)
  })

  it('fecha cidade, time e origem no mesmo total de ativações', () => {
    const snapshot = buildCommercialOverviewSnapshot(
      dataset,
      initialCommercialOverviewFilters(),
    )
    const sum = (rows: readonly { activeSales: number }[]) =>
      rows.reduce((total, row) => total + row.activeSales, 0)

    // Sem cidade e sem time selecionados, os conjuntos comparativos coincidem
    // com o recorte principal.
    expect(snapshot.cityComparisonTotal).toBe(snapshot.metrics.activeSales)
    expect(snapshot.teamComparisonTotal).toBe(snapshot.metrics.activeSales)
    expect(sum(snapshot.topCities)).toBe(snapshot.metrics.activeSales)
    expect(sum(snapshot.teams)).toBe(snapshot.metrics.activeSales)
    expect(sum(snapshot.origins)).toBe(snapshot.metrics.activeSales)
    expect(snapshot.origins.find((row) => row.id === 'indicacao')?.activeSales).toBe(
      snapshot.metrics.indicatedSales,
    )
    expect(snapshot.origins.find((row) => row.id === 'vendedores')?.activeSales).toBe(
      snapshot.metrics.sellerSales,
    )
  })

  describe('painéis comparativos', () => {
    const base = initialCommercialOverviewFilters()
    const todos = buildCommercialOverviewSnapshot(dataset, base)

    it('mantém o ranking completo de cidades quando uma cidade é selecionada', () => {
      const comCidade = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
      })

      expect(comCidade.topCities.length).toBeGreaterThan(1)
      expect(comCidade.topCities).toEqual(todos.topCities)
      expect(comCidade.cityComparisonTotal).toBe(todos.cityComparisonTotal)
      // O recorte principal continua reduzido à cidade escolhida.
      expect(comCidade.metrics.activeSales).toBeLessThan(comCidade.cityComparisonTotal)
    })

    it('aplica time e data ao ranking de cidades, ignorando apenas a cidade', () => {
      const comercial = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
        team: 'comercial',
      })

      expect(comercial.cityComparisonTotal).toBe(todos.metrics.commercialSales)
      expect(comercial.cityComparisonTotal).toBeLessThan(todos.cityComparisonTotal)
      expect(comercial.topCities.map((row) => row.id)).toEqual(
        expect.arrayContaining(['atibaia']),
      )
      expect(
        comercial.topCities.reduce((total, row) => total + row.activeSales, 0),
      ).toBe(comercial.cityComparisonTotal)
    })

    it('mantém os dois times no comparativo quando um time é selecionado', () => {
      ;(['comercial', 'corporativo'] as const).forEach((team) => {
        const snapshot = buildCommercialOverviewSnapshot(dataset, { ...base, team })

        expect(snapshot.teams).toHaveLength(2)
        expect(snapshot.teams.map((row) => row.id).sort()).toEqual([
          'comercial',
          'corporativo',
        ])
        expect(snapshot.teams).toEqual(todos.teams)
        expect(snapshot.teamComparisonTotal).toBe(todos.teamComparisonTotal)
      })
    })

    it('aplica cidade e data ao comparativo de times, ignorando apenas o time', () => {
      const snapshot = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
        team: 'corporativo',
      })
      const soCidade = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
      })

      expect(snapshot.teams).toEqual(soCidade.teams)
      expect(snapshot.teamComparisonTotal).toBe(soCidade.metrics.activeSales)
      expect(snapshot.teamComparisonTotal).toBeLessThan(todos.teamComparisonTotal)
    })

    it('não altera Origem das vendas quando apenas o filtro de time muda', () => {
      const comercial = buildCommercialOverviewSnapshot(dataset, { ...base, team: 'comercial' })
      const corporativo = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        team: 'corporativo',
      })

      expect(comercial.origins).toEqual(todos.origins)
      expect(corporativo.origins).toEqual(todos.origins)
    })

    it('aplica cidade e data a Origem das vendas', () => {
      const comCidade = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
        team: 'comercial',
      })
      const soCidade = buildCommercialOverviewSnapshot(dataset, { ...base, cityId: 'atibaia' })

      expect(comCidade.origins).toEqual(soCidade.origins)
      expect(comCidade.origins).not.toEqual(todos.origins)
      expect(
        comCidade.origins.reduce((total, row) => total + row.activeSales, 0),
      ).toBe(comCidade.teamComparisonTotal)
    })

    it('calcula participação sobre o próprio conjunto comparativo', () => {
      const snapshot = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
        team: 'corporativo',
      })

      snapshot.topCities.forEach((row) => {
        expect(row.share).toBe(row.activeSales / snapshot.cityComparisonTotal)
      })
      snapshot.teams.forEach((row) => {
        expect(row.share).toBe(row.activeSales / snapshot.teamComparisonTotal)
      })
      snapshot.origins.forEach((row) => {
        expect(row.share).toBe(row.activeSales / snapshot.teamComparisonTotal)
      })
    })

    it('não quebra em um recorte sem nenhuma venda ativada', () => {
      const vazio = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        startDate: '2026-01-01',
        endDate: '2026-01-01',
        cityId: 'atibaia',
      })

      expect(Number.isFinite(vazio.cityComparisonTotal)).toBe(true)
      expect(Number.isFinite(vazio.teamComparisonTotal)).toBe(true)
      ;[...vazio.topCities, ...vazio.teams, ...vazio.origins].forEach((row) => {
        expect(Number.isFinite(row.share)).toBe(true)
        expect(row.share).toBeGreaterThanOrEqual(0)
      })
    })
  })

  it('deriva o valor mensal de cada time separadamente no histórico', () => {
    const snapshot = buildCommercialOverviewSnapshot(
      dataset,
      initialCommercialOverviewFilters(),
    )

    snapshot.monthly.forEach((point) => {
      expect(point.commercialValue).toBeGreaterThan(0)
      expect(point.corporateValue).toBeGreaterThan(0)
      expect(point.commercialValue + point.corporateValue).toBeCloseTo(point.monthlyValue, 6)
    })
  })

  it('zera o valor mensal do time ausente quando o filtro global restringe o time', () => {
    const comercial = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'comercial',
    })
    const corporativo = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'corporativo',
    })

    comercial.monthly.forEach((point) => {
      expect(point.corporateValue).toBe(0)
      expect(point.commercialValue).toBe(point.monthlyValue)
    })
    corporativo.monthly.forEach((point) => {
      expect(point.commercialValue).toBe(0)
      expect(point.corporateValue).toBe(point.monthlyValue)
    })
  })

  it('ordena Top 5 Planos por vendas ativadas e calcula participação', () => {
    const snapshot = buildCommercialOverviewSnapshot(
      dataset,
      initialCommercialOverviewFilters(),
    )

    snapshot.topPlans.forEach((plan, index) => {
      expect(plan.position).toBe(index + 1)
      expect(plan.share).toBe(plan.activeSales / snapshot.metrics.activeSales)
      if (index > 0) {
        expect(plan.activeSales).toBeLessThanOrEqual(snapshot.topPlans[index - 1].activeSales)
      }
    })
  })

  it('não inventa meta própria para o filtro exclusivo do Corporativo', () => {
    const snapshot = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'corporativo',
    })

    expect(snapshot.metrics.goal).toBeNull()
    expect(snapshot.metrics.superGoal).toBeNull()
    expect(snapshot.topSellers.every((seller) => seller.team === 'corporativo')).toBe(true)
  })

  it('consolida o valor mensal dos dois times em Todos os times', () => {
    const todos = buildCommercialOverviewSnapshot(dataset, initialCommercialOverviewFilters())
    const comercial = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'comercial',
    })
    const corporativo = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'corporativo',
    })

    expect(todos.monthly).toHaveLength(7)
    todos.monthly.forEach((point, index) => {
      expect(point.commercialSales).toBe(comercial.monthly[index].commercialSales)
      expect(point.corporateSales).toBe(corporativo.monthly[index].corporateSales)
      expect(point.monthlyValue).toBeCloseTo(
        comercial.monthly[index].monthlyValue + corporativo.monthly[index].monthlyValue,
        6,
      )
    })
  })

  it('reduz o histórico mensal ao Comercial quando o time é Comercial', () => {
    const snapshot = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'comercial',
    })

    expect(snapshot.monthly).toHaveLength(7)
    expect(snapshot.monthly.every((point) => point.corporateSales === 0)).toBe(true)
    expect(snapshot.monthly.every((point) => point.commercialSales > 0)).toBe(true)
    expect(snapshot.monthly.every((point) => point.monthlyValue > 0)).toBe(true)
  })

  it('reduz o histórico mensal ao Corporativo quando o time é Corporativo', () => {
    const snapshot = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'corporativo',
    })

    expect(snapshot.monthly).toHaveLength(7)
    expect(snapshot.monthly.every((point) => point.commercialSales === 0)).toBe(true)
    expect(snapshot.monthly.every((point) => point.corporateSales > 0)).toBe(true)
    expect(snapshot.monthly.every((point) => point.monthlyValue > 0)).toBe(true)
  })

  it('mantém o histórico mensal restrito aos meses existentes na base', () => {
    const snapshot = buildCommercialOverviewSnapshot(dataset, initialCommercialOverviewFilters())

    expect(snapshot.monthly.map((point) => point.month)).toEqual(dataset.months)
    expect(snapshot.monthly[0].month).toBe('2026-01')
    expect(snapshot.monthly[snapshot.monthly.length - 1].month).toBe('2026-07')
  })

  it('aplica cidade ao recorte executivo e ao histórico mensal', () => {
    const todos = buildCommercialOverviewSnapshot(dataset, initialCommercialOverviewFilters())
    const snapshot = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      cityId: 'atibaia',
    })

    // Indicadores, rankings e histórico continuam restritos à cidade; apenas o
    // painel comparativo de cidades permanece completo.
    expect(snapshot.metrics.activeSales).toBeLessThan(todos.metrics.activeSales)
    expect(snapshot.monthly.every((point) => point.monthlyValue > 0)).toBe(true)
    expect(snapshot.monthly.every((point, index) =>
      point.monthlyValue < todos.monthly[index].monthlyValue,
    )).toBe(true)
  })
})

describe('overviewModel: realizados do período anterior', () => {
  const base = initialCommercialOverviewFilters()

  it('expõe o realizado comercial e o total do mês anterior fechado', () => {
    const julho = buildCommercialOverviewSnapshot(dataset, base)
    const junho = buildCommercialOverviewSnapshot(dataset, {
      ...base,
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    })

    // O período anterior de julho fechado é junho fechado, a mesma janela que o
    // valor mensal já usava.
    expect(julho.previousGoalAchieved).toBe(junho.metrics.goalAchieved)
    expect(julho.previousSuperGoalAchieved).toBe(junho.metrics.superGoalAchieved)
  })

  it('usa o mesmo numerador de cada indicador', () => {
    const junho = buildCommercialOverviewSnapshot(dataset, {
      ...base,
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    })

    expect(junho.metrics.goalAchieved).toBe(junho.metrics.commercialSales)
    expect(junho.metrics.superGoalAchieved).toBe(junho.metrics.activeSales)
  })

  it('devolve null quando não existe período anterior na base', () => {
    const janeiro = buildCommercialOverviewSnapshot(dataset, {
      ...base,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(janeiro.previousGoalAchieved).toBeNull()
    expect(janeiro.previousSuperGoalAchieved).toBeNull()
    expect(janeiro.previousMonthlyValue).toBeNull()
  })

  it('acompanha cidade e time no período anterior', () => {
    const comercial = buildCommercialOverviewSnapshot(dataset, { ...base, team: 'comercial' })
    const todos = buildCommercialOverviewSnapshot(dataset, base)

    expect(comercial.previousGoalAchieved).toBe(todos.previousGoalAchieved)
    expect(comercial.previousSuperGoalAchieved).toBeLessThan(
      todos.previousSuperGoalAchieved as number,
    )
  })
})
