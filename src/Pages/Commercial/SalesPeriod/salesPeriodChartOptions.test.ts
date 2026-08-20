import { describe, expect, it } from 'vitest'

import {
  formatSalesPeriodDailyTooltip,
  makeSalesPeriodDailyOptions,
  SALES_PERIOD_COUNT_SERIES,
  SALES_PERIOD_VALUE_SERIES,
} from './salesPeriodChartOptions'

const daily = [
  {
    date: '2026-07-22',
    day: 22,
    activeSales: 32,
    monthlyContractedValue: 4466.800000000001,
    // A cobrança única das instalações existe no ponto e continua fora do
    // gráfico: ele mostra quantidade e valor mensal contratado.
    installationContractedValue: 2137.5,
  },
]

/** O tipo de série do ECharts é uma união ampla; o teste só lê nome e dados. */
type SeriesShape = { readonly name?: string; readonly data?: unknown }

function seriesOf(): SeriesShape[] {
  const { series } = makeSalesPeriodDailyOptions(daily)
  return (Array.isArray(series) ? series : [series]) as SeriesShape[]
}

describe('salesPeriodChartOptions', () => {
  it('nomeia as séries pela terminologia de vendas ativas iniciadas', () => {
    const series = seriesOf()

    expect(SALES_PERIOD_COUNT_SERIES).toBe('Vendas ativas iniciadas')
    expect(SALES_PERIOD_VALUE_SERIES).toBe('Valor mensal contratado')
    expect(series.map((item) => item.name)).toEqual([
      SALES_PERIOD_COUNT_SERIES,
      SALES_PERIOD_VALUE_SERIES,
    ])
    // Nenhuma série afirma que houve uma ativação dentro do período.
    expect(JSON.stringify(series)).not.toContain('ativadas')
  })

  it('lê a quantidade e o valor mensal contratado dos pontos da evolução', () => {
    const series = seriesOf()

    expect(makeSalesPeriodDailyOptions(daily).tooltip).toBeDefined()
    expect(series[0]?.data).toEqual([32])
    expect(series[1]?.data).toEqual([4466.800000000001])
  })

  it('formata o valor mensal do tooltip em reais com duas casas decimais', () => {
    // Montado pelo próprio Intl para o teste não depender de qual espaço o
    // ambiente grava entre o símbolo e o número.
    const expectedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(4466.8)
    const tooltip = formatSalesPeriodDailyTooltip([
      {
        axisValueLabel: '22/07',
        marker: '•',
        seriesName: SALES_PERIOD_COUNT_SERIES,
        value: 32,
      },
      {
        axisValueLabel: '22/07',
        marker: '•',
        seriesName: SALES_PERIOD_VALUE_SERIES,
        value: 4466.800000000001,
      },
    ])

    expect(expectedValue).toMatch(/^R\$\s4\.466,80$/u)
    expect(tooltip).toContain('32 vendas')
    expect(tooltip).toContain(expectedValue)
    expect(tooltip).not.toContain('4466.800000000001')
  })
})
