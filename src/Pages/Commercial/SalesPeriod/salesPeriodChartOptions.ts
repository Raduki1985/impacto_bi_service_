import type { EChartsOption } from 'echarts'

import type {
  SalesPeriodDailyPoint,
  SalesPeriodStatusSlice,
} from './salesPeriodModel'

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
  const rows = items.map((item) => {
    const formatted =
      item.seriesName === 'Valor mensal'
        ? tooltipCurrency.format(tooltipNumber(item.value))
        : `${integer.format(tooltipNumber(item.value))} vendas`

    return `${item.marker ?? ''}${item.seriesName ?? ''}<span style="float:right;margin-left:20px;font-weight:600">${formatted}</span>`
  })

  return `<div style="margin-bottom:4px">${title}</div>${rows.join('<br/>')}`
}

export function makeSalesPeriodDailyOptions(
  daily: readonly SalesPeriodDailyPoint[],
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
        name: 'Vendas ativadas',
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: daily.map((point) => point.activeSales),
      },
      {
        name: 'Valor mensal',
        type: 'line',
        yAxisIndex: 1,
        smooth: 0.25,
        symbol: 'none',
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.08 },
        data: daily.map((point) => point.monthlyRevenue),
      },
    ],
  }
}

const statusColors = [
  '#00a862',
  '#2f7de1',
  '#ef9f27',
  '#8b5cf6',
  '#64748b',
  '#d32744',
  '#14b8a6',
  '#f97316',
]

export function makeSalesPeriodStatusOptions(
  slices: readonly SalesPeriodStatusSlice[],
): EChartsOption {
  return {
    animationDuration: 450,
    color: statusColors,
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 0,
      top: 'middle',
      itemHeight: 8,
      itemWidth: 10,
      textStyle: { color: '#7d899d', fontSize: 10 },
    },
    series: [
      {
        name: 'Status',
        type: 'pie',
        radius: ['50%', '72%'],
        center: ['34%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: { scaleSize: 5 },
        data: slices.map((slice) => ({ name: slice.label, value: slice.value })),
      },
    ],
  }
}
