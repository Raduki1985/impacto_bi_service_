import { describe, expect, it } from 'vitest'

import { getCommercialDataset } from '../../../data/mockCommercialData'
import {
  buildSalesPeriodSnapshot,
  DEFAULT_SALES_PERIOD_END,
  DEFAULT_SALES_PERIOD_START,
  initialSalesPeriodFilters,
} from './salesPeriodModel'

const dataset = getCommercialDataset()

describe('salesPeriodModel', () => {
  it('monta o recorte padrão com vendas, receita e no máximo cinco vendedores', () => {
    const snapshot = buildSalesPeriodSnapshot(dataset, initialSalesPeriodFilters())

    expect(snapshot.filters.startDate).toBe(DEFAULT_SALES_PERIOD_START)
    expect(snapshot.filters.endDate).toBe(DEFAULT_SALES_PERIOD_END)
    expect(snapshot.facts.length).toBeGreaterThan(0)
    expect(snapshot.metrics.activeSales).toBeGreaterThan(0)
    expect(snapshot.metrics.monthlyRevenue).toBeGreaterThan(0)
    expect(snapshot.topSellers.length).toBeLessThanOrEqual(5)
    expect(snapshot.daily).toHaveLength(31)
    expect(snapshot.metrics.sellerSales + snapshot.metrics.indicatedSales).toBe(
      snapshot.metrics.activeSales,
    )
    expect(snapshot.metrics.commercialSales + snapshot.metrics.corporateSales).toBe(
      snapshot.metrics.activeSales,
    )
    expect(snapshot.metrics.goal).toBe(800)
    expect(snapshot.metrics.superGoal).toBe(880)
    expect(snapshot.metrics.activationRate).toBe(
      snapshot.metrics.activeSales / snapshot.metrics.totalContracts,
    )

    const june = buildSalesPeriodSnapshot(dataset, {
      ...initialSalesPeriodFilters(),
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    })
    expect(snapshot.metrics.previousActiveSales).toBe(june.metrics.activeSales)
    expect(snapshot.metrics.activeSalesChange).toBe(
      snapshot.metrics.activeSales - june.metrics.activeSales,
    )

    snapshot.topSellers.forEach((seller, index) => {
      expect(seller.position).toBe(index + 1)
      expect(seller.share).toBeGreaterThan(0)
      expect(seller.share).toBeLessThanOrEqual(1)
      if (index > 0) {
        expect(seller.activeSales).toBeLessThanOrEqual(snapshot.topSellers[index - 1].activeSales)
      }
    })
  })

  it('aplica o filtro do time Corporativo aos fatos e ao ranking', () => {
    const filters = { ...initialSalesPeriodFilters(), team: 'corporativo' as const }
    const snapshot = buildSalesPeriodSnapshot(dataset, filters)

    expect(snapshot.facts.length).toBeGreaterThan(0)
    expect(snapshot.facts.every((fact) => fact.team === 'corporativo')).toBe(true)
    expect(snapshot.topSellers.every((seller) => seller.team === 'corporativo')).toBe(true)
    expect(snapshot.metrics.goal).toBeNull()
    expect(snapshot.metrics.superGoal).toBeNull()
  })

  it('aplica intervalo inclusivo e proporciona meta e supermeta pelos dias selecionados', () => {
    const filters = {
      ...initialSalesPeriodFilters(),
      startDate: '2026-07-01',
      endDate: '2026-07-10',
    }
    const snapshot = buildSalesPeriodSnapshot(dataset, filters)

    expect(snapshot.daily).toHaveLength(10)
    expect(
      snapshot.facts.every(
        (fact) => fact.eventDate >= filters.startDate && fact.eventDate <= filters.endDate,
      ),
    ).toBe(true)
    expect(snapshot.metrics.goal).toBe(258.1)
    expect(snapshot.metrics.superGoal).toBe(283.9)

    const previousTenDays = buildSalesPeriodSnapshot(dataset, {
      ...initialSalesPeriodFilters(),
      startDate: '2026-06-21',
      endDate: '2026-06-30',
    })
    expect(snapshot.metrics.previousActiveSales).toBe(previousTenDays.metrics.activeSales)
  })

  it('não inventa comparação quando não existe período anterior completo na base', () => {
    const snapshot = buildSalesPeriodSnapshot(dataset, {
      ...initialSalesPeriodFilters(),
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(snapshot.metrics.previousActiveSales).toBeNull()
    expect(snapshot.metrics.activeSalesChange).toBeNull()
    expect(snapshot.metrics.activeSalesChangeRate).toBeNull()
  })

  it('filtra pelo CPF sintético do indicador sem inferir identidade', () => {
    const indicator = dataset.partners[0].indicationCode
    const filters = { ...initialSalesPeriodFilters(), indicator }
    const snapshot = buildSalesPeriodSnapshot(dataset, filters)

    expect(snapshot.facts.length).toBeGreaterThan(0)
    expect(snapshot.facts.every((fact) => fact.indicatorCpf === indicator)).toBe(true)
  })

  it('classifica retorno à base somente em uma nova venda ativada do mock', () => {
    const filters = { ...initialSalesPeriodFilters(), returnType: 'retornaram' as const }
    const snapshot = buildSalesPeriodSnapshot(dataset, filters)

    expect(snapshot.facts.length).toBeGreaterThan(0)
    expect(
      snapshot.facts.every(
        (fact) => fact.returnedToBase && fact.status === 'ativa' && fact.activatedAt !== null,
      ),
    ).toBe(true)
    expect(snapshot.metrics.returnedCustomers).toBe(snapshot.metrics.activeSales)
  })

  it('mantém apenas o status selecionado e não conta pipeline como venda ativada', () => {
    const filters = { ...initialSalesPeriodFilters(), status: 'aguardando-aprovacao' as const }
    const snapshot = buildSalesPeriodSnapshot(dataset, filters)

    expect(snapshot.facts.length).toBeGreaterThan(0)
    expect(snapshot.facts.every((fact) => fact.status === 'aguardando-aprovacao')).toBe(true)
    expect(snapshot.metrics.activeSales).toBe(0)
    expect(snapshot.metrics.pipelineSales).toBe(snapshot.facts.length)
  })
})
