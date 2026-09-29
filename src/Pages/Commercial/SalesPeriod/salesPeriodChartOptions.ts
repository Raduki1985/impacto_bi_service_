import type { EChartsOption } from 'echarts'

import type { ActiveSalesDailyPoint } from './salesPeriodModel'

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const tooltipCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

const axisLabel = { color: '#7d899d', fontSize: 10 }
const splitLine = { lineStyle: { color: 'rgba(129, 143, 164, 0.16)' } }

/**
 * Nomes das duas séries.
 *
 * Ficam em constantes porque o tooltip decide o formato pelo nome da série: se
 * o rótulo mudasse só em um dos dois lugares, o valor mensal voltaria a ser
 * exibido como quantidade de vendas.
 */
export const SALES_PERIOD_COUNT_SERIES = 'Vendas ativas iniciadas'
export const SALES_PERIOD_VALUE_SERIES = 'Valor mensal contratado'

function shortDate(isoDate: string): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`
}

type DailyTooltipParam = {
  readonly axisValueLabel?: string
  readonly marker?: string
  readonly seriesName?: string
  readonly value?: unknown
}

function tooltipNumber(value: unknown): number {
  const normalized = Array.isArray(value) ? value[value.length - 1] : value
  return Number(normalized)
}

export function formatSalesPeriodDailyTooltip(params: unknown): string {
  const items = (Array.isArray(params) ? params : [params]).filter(
    (item): item is DailyTooltipParam => typeof item === 'object' && item !== null,
  )
  const title = items[0]?.axisValueLabel ?? ''
  // Linha zerada não entra no tooltip (pedido do Mário em 28/09/2026); dia
  // sem venda nenhuma não abre caixa, porque sobraria só a data.
  const shown = items.filter((item) => tooltipNumber(item.value) !== 0)
  if (shown.length === 0) return ''
  const rows = shown.map((item) => {
    const formatted =
      item.seriesName === SALES_PERIOD_VALUE_SERIES
        ? tooltipCurrency.format(tooltipNumber(item.value))
        : `${integer.format(tooltipNumber(item.value))} ${tooltipNumber(item.value) === 1 ? 'venda' : 'vendas'}`

    return `${item.marker ?? ''}${item.seriesName ?? ''}<span style="float:right;margin-left:20px;font-weight:600">${formatted}</span>`
  })

  return `<div style="margin-bottom:4px">${title}</div>${rows.join('<br/>')}`
}

/** Evolução por Data de Início: quantidade e valor mensal contratado por dia. */
export function makeSalesPeriodDailyOptions(
  daily: readonly ActiveSalesDailyPoint[],
): EChartsOption {
  return {
    animationDuration: 450,
    color: ['#00a862', '#2f7de1'],
    grid: { left: 42, right: 58, top: 42, bottom: 28 },
    legend: {
      top: 2,
      right: 0,
      itemHeight: 8,
      itemWidth: 14,
      textStyle: { color: '#7d899d', fontSize: 10 },
    },
    tooltip: {
      trigger: 'axis',
      formatter: formatSalesPeriodDailyTooltip,
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: daily.map((point) => shortDate(point.date)),
      axisLabel,
      axisLine: { lineStyle: { color: 'rgba(129, 143, 164, 0.25)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        minInterval: 1,
        axisLabel,
        splitLine,
      },
      {
        type: 'value',
        axisLabel: { ...axisLabel, formatter: (value: number) => currency.format(value) },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: SALES_PERIOD_COUNT_SERIES,
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: daily.map((point) => point.activeSales),
      },
      {
        name: SALES_PERIOD_VALUE_SERIES,
        type: 'line',
        yAxisIndex: 1,
        smooth: 0.25,
        symbol: 'none',
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.08 },
        data: daily.map((point) => point.monthlyContractedValue),
      },
    ],
  }
}
