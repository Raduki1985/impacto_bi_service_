import { describe, expect, it } from 'vitest'

import {
  formatSalesPeriodDailyTooltip,
  makeSalesPeriodDailyOptions,
} from './salesPeriodChartOptions'

describe('salesPeriodChartOptions', () => {
  it('formata o valor mensal do tooltip em reais com duas casas decimais', () => {
    const option = makeSalesPeriodDailyOptions([
      {
        date: '2026-06-22',
        day: 22,
        activeSales: 32,
        monthlyRevenue: 4466.800000000001,
      },
    ])
    const tooltip = formatSalesPeriodDailyTooltip([
      {
        axisValueLabel: '22/06',
        marker: '•',
        seriesName: 'Vendas ativadas',
        value: 32,
      },
      {
        axisValueLabel: '22/06',
        marker: '•',
        seriesName: 'Valor mensal',
        value: 4466.800000000001,
      },
    ])

    expect(option.tooltip).toBeDefined()
    expect(tooltip).toContain('32 vendas')
    expect(tooltip).toContain('R$\u00a04.466,80')
    expect(tooltip).not.toContain('4466.800000000001')
  })
})
