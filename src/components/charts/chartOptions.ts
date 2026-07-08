import type { EChartsOption } from 'echarts'

import type { ChartSeries, Pair } from '../../data/dashboardTypes'

const textStyle = {
  fontFamily: 'IBM Plex Sans, sans-serif',
  color: '#475467',
  fontSize: 12,
}

const tooltip = (trigger: 'axis' | 'item' = 'axis') => ({
  trigger,
  backgroundColor: '#1a2331',
  borderColor: '#1a2331',
  textStyle: { color: '#fff', fontSize: 12, fontFamily: 'IBM Plex Sans' },
  padding: [7, 11],
  extraCssText: 'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18)',
})

const valueAxis = {
  type: 'value' as const,
  splitLine: { lineStyle: { color: '#f1f3f7' } },
  axisLabel: { color: '#98a2b3', fontSize: 11 },
}

const categoryAxis = (labels: string[]) => ({
  type: 'category' as const,
  data: labels,
  axisLine: { lineStyle: { color: '#e4e7ee' } },
  axisTick: { show: false },
  axisLabel: {
    color: '#667085',
    fontSize: 11,
    interval: 0,
    rotate: labels.some((label) => label.length > 10) ? 18 : 0,
  },
})

export function makeBarOptions(labels: string[], values: number[], color = '#2f6bff', horizontal = false): EChartsOption {
  return {
    textStyle,
    tooltip: tooltip('axis'),
    grid: { left: horizontal ? 90 : 10, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: horizontal ? valueAxis : categoryAxis(labels),
    yAxis: horizontal ? { ...categoryAxis(labels.slice().reverse()), axisLabel: { color: '#667085', fontSize: 11 } } : valueAxis,
    series: [
      {
        type: 'bar',
        data: horizontal ? values.slice().reverse() : values,
        itemStyle: { color, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
        barMaxWidth: 34,
      },
    ],
  }
}

export function makeDonutOptions(pairs: Pair[], colors?: string[]): EChartsOption {
  const palette = colors ?? ['#2f6bff', '#00b3a4', '#f5a623', '#e5484d', '#8b5cf6', '#0ea5e9', '#64748b']

  return {
    textStyle,
    tooltip: tooltip('item'),
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: '#667085', fontSize: 11.5 },
    },
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: pairs.map(([name, value], index) => ({
          name,
          value,
          itemStyle: { color: palette[index % palette.length] },
        })),
      },
    ],
  }
}

export function makeStackedBarOptions(labels: string[], series: ChartSeries[]): EChartsOption {
  return {
    textStyle,
    tooltip: tooltip('axis'),
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: '#667085', fontSize: 11.5 },
    },
    grid: { left: 10, right: 16, top: 16, bottom: 44, containLabel: true },
    xAxis: categoryAxis(labels),
    yAxis: valueAxis,
    series: series.map((item) => ({
      name: item.name,
      type: 'bar',
      stack: 'total',
      data: item.data,
      itemStyle: { color: item.color },
      barMaxWidth: 46,
    })),
  }
}

export function makeLineOptions(labels: string[], series: (ChartSeries & { area?: boolean })[]): EChartsOption {
  return {
    textStyle,
    tooltip: tooltip('axis'),
    legend:
      series.length > 1
        ? {
            bottom: 0,
            icon: 'circle',
            itemWidth: 9,
            itemHeight: 9,
            textStyle: { color: '#667085', fontSize: 11.5 },
          }
        : undefined,
    grid: { left: 10, right: 18, top: 20, bottom: series.length > 1 ? 40 : 10, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: '#e4e7ee' } },
      axisTick: { show: false },
      axisLabel: { color: '#98a2b3', fontSize: 10.5 },
    },
    yAxis: valueAxis,
    series: series.map((item) => ({
      name: item.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: false,
      data: item.data,
      lineStyle: { width: 2.4, color: item.color },
      itemStyle: { color: item.color },
      areaStyle: item.area ? { color: `${item.color}22` } : undefined,
    })),
  }
}

export function makeHeatmapOptions(x: string[], y: string[], data: [number, number, number][], max: number): EChartsOption {
  return {
    textStyle,
    tooltip: {
      ...tooltip('item'),
      formatter: (params: unknown) => {
        const data = (params as { data: [number, number, number] }).data
        return `${x[data[0]]} · ${y[data[1]]}: <b>${data[2]}</b>`
      },
    },
    grid: { left: 10, right: 14, top: 10, bottom: 70, containLabel: true },
    xAxis: {
      type: 'category',
      data: x,
      splitArea: { show: true },
      axisLabel: { color: '#667085', fontSize: 10.5, interval: 0, rotate: x.some((label) => label.length > 8) ? 30 : 0 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: y,
      splitArea: { show: true },
      axisLabel: { color: '#667085', fontSize: 10.5 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      min: 0,
      max,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 6,
      itemWidth: 12,
      itemHeight: 120,
      textStyle: { color: '#98a2b3', fontSize: 10 },
      inRange: { color: ['#eef3ff', '#9dbcff', '#3f79ff', '#123a99'] },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: { show: x.length * y.length <= 90, color: '#33507f', fontSize: 10 },
        itemStyle: { borderColor: '#fff', borderWidth: 1.5 },
      },
    ],
  }
}

export function makeCalendarHeatmapOptions(range: [string, string], data: [string, number][]): EChartsOption {
  const max = Math.max(...data.map((item) => item[1]))

  return {
    textStyle,
    tooltip: {
      ...tooltip('item'),
      formatter: (params: unknown) => {
        const data = (params as { data: [string, number] }).data
        return `${data[0]}: <b>${data[1]}</b> OS`
      },
    },
    visualMap: {
      min: 0,
      max,
      orient: 'horizontal',
      left: 'center',
      bottom: 2,
      itemWidth: 12,
      itemHeight: 110,
      textStyle: { color: '#98a2b3', fontSize: 10 },
      inRange: { color: ['#eef3ff', '#9dbcff', '#3f79ff', '#123a99'] },
    },
    calendar: {
      top: 26,
      left: 40,
      right: 20,
      cellSize: ['auto', 20],
      range,
      itemStyle: { color: '#fafbfc', borderColor: '#fff', borderWidth: 2 },
      splitLine: { lineStyle: { color: '#e4e7ee' } },
      yearLabel: { show: false },
      monthLabel: {
        color: '#667085',
        fontSize: 11,
        nameMap: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      },
      dayLabel: { color: '#98a2b3', fontSize: 10, nameMap: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] },
    },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data }],
  }
}
