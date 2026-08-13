/**
 * Opções ECharts próprias de Metas e Desempenho.
 *
 * Ficam no Comercial de propósito, e não em `chartOptions`: as opções genéricas
 * do portal não suportam o que esta página precisa, e alterá-las mudaria todos
 * os gráficos já publicados. O que falta lá e existe aqui:
 *
 * - linhas tracejadas de referência (ritmo esperado) ao lado das linhas cheias;
 * - duas comparações diárias com escala vertical compartilhada;
 * - dia futuro sem valor, que não pode desabar a linha até zero;
 * - rosca de composição com o total no centro;
 * - destaque de uma coluna do histórico sem esconder as demais.
 */

import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts'

import { monthLabel } from '../../../data/commercialCalendar'
import { formatNumber } from '../../../lib/formatters'
import type { CommercialDailyPoint, CommercialMonthlyPoint } from './commercialGoalsModel'

/** Paleta única da página: gráficos e barras de progresso usam as mesmas cores. */
export const goalsColors = {
  goalAchieved: '#2f6bff',
  goalReference: '#64748b',
  totalAchieved: '#00b3a4',
  superGoalReference: '#7a5af8',
} as const

/**
 * Origens do realizado, na rosca de composição.
 *
 * Vendas Internas reaproveita o azul do realizado da meta, e o Corporativo
 * reaproveita o roxo já usado como referência da supermeta: são as duas pontas
 * que a página inteira já associa a meta normal e a supermeta.
 */
export const goalsCompositionColors = {
  internal: '#2f6bff',
  partner: '#00b3a4',
  corporate: '#7a5af8',
} as const

export const goalsSeriesLabels = {
  goalAchieved: 'Realizado da meta',
  goalPace: 'Ritmo esperado da meta',
  totalAchieved: 'Realizado total',
  superGoalPace: 'Ritmo esperado da supermeta',
  goal: 'Meta',
  superGoal: 'Supermeta',
  monthlyGoalAchieved: 'Realizado da meta',
  monthlyTotalAchieved: 'Realizado total',
} as const

const textStyle = {
  fontFamily: 'IBM Plex Sans, sans-serif',
  color: '#475467',
  fontSize: 12,
}

/**
 * Base do tooltip.
 *
 * `confine` mantém a caixa dentro do próprio contêiner do gráfico. Sem ele, o
 * tooltip dos primeiros dias subia acima da área desenhada e cobria o título da
 * comparação, e o dos últimos dias vazava para fora do cartão em tela estreita.
 * A largura máxima curta existe pelo mesmo motivo: o tooltip mostra valores, e
 * não texto corrido.
 */
const tooltipBase = {
  backgroundColor: '#1a2331',
  borderColor: '#1a2331',
  confine: true,
  textStyle: { color: '#fff', fontSize: 12, fontFamily: 'IBM Plex Sans' },
  padding: [8, 11],
  extraCssText: 'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:230px',
}

const legend = {
  bottom: 0,
  type: 'scroll' as const,
  icon: 'roundRect',
  itemWidth: 14,
  itemHeight: 8,
  itemGap: 14,
  textStyle: { color: '#667085', fontSize: 11.5 },
}

const valueAxis = {
  type: 'value' as const,
  splitLine: { lineStyle: { color: '#f1f3f7' } },
  axisLabel: { color: '#98a2b3', fontSize: 11 },
}

type TooltipItem = {
  readonly axisValue: string
  readonly marker: string
  readonly seriesName: string
  readonly value: number | null
}

function tooltipRow(item: TooltipItem): string {
  const value = item.value === null ? 'sem dado' : formatNumber(item.value)

  return `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:3px">
    <span style="white-space:normal">${item.marker}${item.seriesName}</span>
    <b style="white-space:nowrap">${value}</b>
  </div>`
}

/* -------------------------------------------------------------------------- */
/* Evolução diária: duas comparações coordenadas                              */
/* -------------------------------------------------------------------------- */

/** Qual pergunta a comparação responde. */
export type GoalsDailyComparison = 'meta' | 'supermeta'

/**
 * Arredonda o teto do eixo para um número legível acima do maior valor.
 *
 * Sem isso, cada comparação escolheria o próprio teto e duas linhas de tamanhos
 * diferentes pareceriam equivalentes na tela.
 */
function niceCeil(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value))

  for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
    const candidate = step * magnitude
    if (candidate >= value) return candidate
  }

  return 10 * magnitude
}

/**
 * Teto vertical comum às duas comparações diárias.
 *
 * As duas comparações são lidas lado a lado, então precisam da mesma régua: um
 * eixo automático por gráfico faria 795 e 883 ocuparem a mesma altura e induziria
 * a conclusão errada. Devolve `undefined` quando não há nenhum valor positivo,
 * caso em que o eixo automático do ECharts já é o comportamento correto.
 */
export function goalsDailyScaleMax(daily: readonly CommercialDailyPoint[]): number | undefined {
  let max = 0

  for (const point of daily) {
    for (const value of [
      point.goalAchieved,
      point.totalAchieved,
      point.goalPace,
      point.superGoalPace,
    ]) {
      if (value !== null && value > max) max = value
    }
  }

  return max <= 0 ? undefined : niceCeil(max)
}

const comparisonSeries = {
  meta: {
    achievedLabel: goalsSeriesLabels.goalAchieved,
    achievedColor: goalsColors.goalAchieved,
    paceLabel: goalsSeriesLabels.goalPace,
    paceColor: goalsColors.goalReference,
    achieved: (point: CommercialDailyPoint) => point.goalAchieved,
    pace: (point: CommercialDailyPoint) => point.goalPace,
  },
  supermeta: {
    achievedLabel: goalsSeriesLabels.totalAchieved,
    achievedColor: goalsColors.totalAchieved,
    paceLabel: goalsSeriesLabels.superGoalPace,
    paceColor: goalsColors.superGoalReference,
    achieved: (point: CommercialDailyPoint) => point.totalAchieved,
    pace: (point: CommercialDailyPoint) => point.superGoalPace,
  },
} as const satisfies Record<
  GoalsDailyComparison,
  {
    achievedLabel: string
    achievedColor: string
    paceLabel: string
    paceColor: string
    achieved: (point: CommercialDailyPoint) => number | null
    pace: (point: CommercialDailyPoint) => number | null
  }
>

/**
 * Uma das duas comparações da evolução diária acumulada.
 *
 * Somente duas séries: o realizado acumulado, em linha cheia dominante com área,
 * e o ritmo esperado, em linha tracejada mais fina. A distinção não depende da
 * cor: linha cheia contra linha tracejada já separa realizado de referência em
 * escala de cinza.
 *
 * Dia posterior à data de atualização da base chega como `null` e interrompe a
 * linha, em vez de despencar até zero.
 *
 * São duas instâncias coordenadas, e não duas grades na mesma instância: o
 * ECharts com múltiplas grades exige recalcular altura, legenda e margens a cada
 * quebra de layout, enquanto duas instâncias herdam o empilhamento do CSS e
 * redimensionam sozinhas.
 */
export function makeGoalsDailyComparisonOptions(
  daily: readonly CommercialDailyPoint[],
  comparison: GoalsDailyComparison,
  scaleMax: number | undefined,
): EChartsOption {
  const spec = comparisonSeries[comparison]
  const days = daily.map((point) => String(point.day).padStart(2, '0'))
  const hasPace = daily.some((point) => spec.pace(point) !== null)

  const series: LineSeriesOption[] = [
    {
      name: spec.achievedLabel,
      type: 'line',
      smooth: false,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: false,
      data: daily.map(spec.achieved),
      lineStyle: { width: 3, color: spec.achievedColor },
      itemStyle: { color: spec.achievedColor },
      areaStyle: { color: `${spec.achievedColor}18` },
      z: 3,
    },
  ]

  if (hasPace) {
    series.push({
      name: spec.paceLabel,
      type: 'line',
      smooth: false,
      showSymbol: false,
      data: daily.map(spec.pace),
      lineStyle: { width: 1.8, type: 'dashed', color: spec.paceColor },
      itemStyle: { color: spec.paceColor },
      z: 2,
    })
  }

  return {
    textStyle,
    tooltip: {
      ...tooltipBase,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = params as TooltipItem[]
        if (items.length === 0) return ''

        return `<div style="font-weight:600">Dia ${items[0].axisValue}</div>${items.map(tooltipRow).join('')}`
      },
    },
    legend,
    grid: { left: 6, right: 14, top: 14, bottom: 44, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: days,
      axisLine: { lineStyle: { color: '#e4e7ee' } },
      axisTick: { show: false },
      axisLabel: { color: '#98a2b3', fontSize: 10.5 },
    },
    yAxis: { ...valueAxis, min: 0, max: scaleMax },
    series,
  }
}

/* -------------------------------------------------------------------------- */
/* Composição do realizado                                                    */
/* -------------------------------------------------------------------------- */

type CompositionSlice = {
  readonly name: string
  readonly value: number
  readonly color: string
}

type PieTooltipItem = {
  readonly marker: string
  readonly name: string
  readonly percent: number
  readonly value: number
}

/**
 * Rosca da composição do realizado total.
 *
 * Rosca, e não velocímetro: Colaboradores e Corporativo não possuem meta
 * própria, então qualquer escala de progresso para eles seria inventada. A
 * pergunta aqui é de onde vêm as vendas, e a resposta é uma partição do total.
 *
 * O total fica no centro, como título centrado, porque é o número que a rosca
 * está dividindo. Quem chama garante que o total é maior que zero: com zero não
 * existe partição e a página mostra o estado vazio em vez de um anel vazio.
 */
export function makeGoalsCompositionOptions(
  slices: readonly CompositionSlice[],
  total: number,
): EChartsOption {
  return {
    textStyle,
    title: {
      text: formatNumber(total),
      subtext: 'Realizado total',
      left: 'center',
      top: 'center',
      itemGap: 3,
      textStyle: {
        color: '#0f2038',
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 23,
        fontWeight: 800,
      },
      subtextStyle: {
        color: '#667085',
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 11,
      },
    },
    tooltip: {
      ...tooltipBase,
      trigger: 'item',
      formatter: (params: unknown) => {
        const item = params as PieTooltipItem

        return `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between">
          <span>${item.marker}${item.name}</span>
          <b style="white-space:nowrap">${formatNumber(item.value)}</b>
        </div>
        <div style="margin-top:2px;font-size:11px;color:#a7bad4">${item.percent.toFixed(1).replace('.', ',')}% do realizado total</div>`
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['60%', '86%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        data: slices.map((slice) => ({
          name: slice.name,
          value: slice.value,
          itemStyle: { color: slice.color },
        })),
      },
    ],
  }
}

/**
 * Histórico mensal.
 *
 * Os sete meses continuam visíveis com qualquer mês selecionado: o mês do filtro
 * é destacado por opacidade e por uma faixa de fundo, e nunca por remoção dos
 * demais.
 */
export function makeGoalsMonthlyOptions(
  monthly: readonly CommercialMonthlyPoint[],
): EChartsOption {
  const labels = monthly.map((point) => point.label)
  const selectedIndex = monthly.findIndex((point) => point.selected)
  const hasGoal = monthly.some((point) => point.goal !== null)

  /** Faixa de fundo do mês selecionado, em coordenadas de categoria. */
  const selectedBand: BarSeriesOption['markArea'] =
    selectedIndex >= 0
      ? {
          silent: true,
          itemStyle: { color: 'rgba(47,107,255,.07)' },
          data: [[{ xAxis: selectedIndex - 0.5 }, { xAxis: selectedIndex + 0.5 }]],
        }
      : undefined

  const bar = (
    name: string,
    color: string,
    pick: (point: CommercialMonthlyPoint) => number,
    withMarkArea: boolean,
  ): BarSeriesOption => ({
    name,
    type: 'bar',
    barMaxWidth: 34,
    data: monthly.map((point) => ({
      value: pick(point),
      itemStyle: { color, opacity: point.selected ? 1 : 0.42, borderRadius: [4, 4, 0, 0] },
    })),
    markArea: withMarkArea ? selectedBand : undefined,
  })

  const series: (BarSeriesOption | LineSeriesOption)[] = [
    bar(goalsSeriesLabels.monthlyGoalAchieved, goalsColors.goalAchieved, (point) => point.goalAchieved, true),
    bar(goalsSeriesLabels.monthlyTotalAchieved, goalsColors.totalAchieved, (point) => point.totalAchieved, false),
  ]

  if (hasGoal) {
    series.push(
      {
        name: goalsSeriesLabels.goal,
        type: 'line',
        showSymbol: false,
        data: monthly.map((point) => point.goal),
        lineStyle: { width: 2, type: 'dashed', color: goalsColors.goalReference },
        itemStyle: { color: goalsColors.goalReference },
        z: 5,
      },
      {
        name: goalsSeriesLabels.superGoal,
        type: 'line',
        showSymbol: false,
        data: monthly.map((point) => point.superGoal),
        lineStyle: { width: 2, type: 'dotted', color: goalsColors.superGoalReference },
        itemStyle: { color: goalsColors.superGoalReference },
        z: 5,
      },
    )
  }

  return {
    textStyle,
    tooltip: {
      ...tooltipBase,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = params as TooltipItem[]
        if (items.length === 0) return ''

        const point = monthly.find((item) => item.label === items[0].axisValue)
        const title = point ? monthLabel(point.month) : items[0].axisValue

        return `<div style="font-weight:600">${title}</div>${items.map(tooltipRow).join('')}`
      },
    },
    legend,
    grid: { left: 8, right: 16, top: 18, bottom: 46, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: '#e4e7ee' } },
      axisTick: { show: false },
      axisLabel: { color: '#667085', fontSize: 11, interval: 0 },
    },
    yAxis: valueAxis,
    series,
  }
}
