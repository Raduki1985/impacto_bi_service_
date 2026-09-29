import type { LineSeriesOption, PieSeriesOption } from 'echarts'
import { describe, expect, it } from 'vitest'

import type { CommercialDailyPoint } from './commercialGoalsModel'
import {
  goalsDailyScaleMax,
  makeGoalsCompositionOptions,
  makeGoalsDailyComparisonOptions,
} from './goalsChartOptions'

/**
 * As opções dos gráficos são dados, e é assim que este arquivo as testa.
 *
 * O ECharts desenha em canvas: nada do que ele produz chega ao HTML, então
 * afirmar sobre a marcação renderizada não provaria nada sobre as séries, o
 * tooltip ou a escala. Aqui o objeto de opções é inspecionado direto, e o
 * formatador do tooltip é chamado com o mesmo formato que o ECharts passa.
 */

/** Julho encurtado: cinco dias realizados e dois dias ainda no futuro. */
const daily: readonly CommercialDailyPoint[] = [
  { day: 1, goalAchieved: 20, totalAchieved: 24, goalPace: 25, superGoalPace: 27.5 },
  { day: 2, goalAchieved: 45, totalAchieved: 52, goalPace: 50, superGoalPace: 55 },
  { day: 3, goalAchieved: 70, totalAchieved: 81, goalPace: 75, superGoalPace: 82.5 },
  { day: 4, goalAchieved: 96, totalAchieved: 110, goalPace: 100, superGoalPace: 110 },
  { day: 5, goalAchieved: 121, totalAchieved: 139, goalPace: 125, superGoalPace: 137.5 },
  { day: 6, goalAchieved: null, totalAchieved: null, goalPace: 150, superGoalPace: 165 },
  { day: 7, goalAchieved: null, totalAchieved: null, goalPace: 175, superGoalPace: 192.5 },
]

const noGoal: readonly CommercialDailyPoint[] = daily.map((point) => ({
  ...point,
  goalPace: null,
  superGoalPace: null,
}))

function seriesOf(option: ReturnType<typeof makeGoalsDailyComparisonOptions>) {
  return option.series as LineSeriesOption[]
}

/** Chama o formatador do tooltip com o mesmo formato que o ECharts passa. */
function callTooltip(tooltip: unknown, params: unknown): string {
  const formatter = (tooltip as { formatter: (value: unknown) => string }).formatter

  return formatter(params)
}

describe('comparações diárias', () => {
  it('desenha somente o realizado e a referência daquela comparação', () => {
    const scaleMax = goalsDailyScaleMax(daily)
    const meta = seriesOf(makeGoalsDailyComparisonOptions(daily, 'meta', scaleMax))
    const superMeta = seriesOf(makeGoalsDailyComparisonOptions(daily, 'supermeta', scaleMax))

    expect(meta.map((serie) => serie.name)).toEqual([
      'Realizado da meta',
      'Ritmo esperado da meta',
    ])
    expect(superMeta.map((serie) => serie.name)).toEqual([
      'Realizado total',
      'Ritmo esperado da supermeta',
    ])
  })

  it('usa os valores do dia sem transformar dia futuro em zero', () => {
    const meta = seriesOf(makeGoalsDailyComparisonOptions(daily, 'meta', undefined))
    const superMeta = seriesOf(makeGoalsDailyComparisonOptions(daily, 'supermeta', undefined))

    expect(meta[0].data).toEqual([20, 45, 70, 96, 121, null, null])
    expect(meta[1].data).toEqual([25, 50, 75, 100, 125, 150, 175])
    expect(superMeta[0].data).toEqual([24, 52, 81, 110, 139, null, null])
    expect(superMeta[1].data).toEqual([27.5, 55, 82.5, 110, 137.5, 165, 192.5])
  })

  it('deixa a linha realizada dominante e a referência tracejada', () => {
    const [achieved, pace] = seriesOf(makeGoalsDailyComparisonOptions(daily, 'meta', undefined))

    expect(achieved.lineStyle?.width).toBeGreaterThan(pace.lineStyle?.width as number)
    expect(achieved.areaStyle).toBeDefined()
    // Tracejado: a referência é identificável mesmo sem enxergar a cor.
    expect(pace.lineStyle?.type).toBe('dashed')
    expect(pace.areaStyle).toBeUndefined()
  })

  it('compartilha o mesmo teto vertical entre as duas comparações', () => {
    const scaleMax = goalsDailyScaleMax(daily)
    const meta = makeGoalsDailyComparisonOptions(daily, 'meta', scaleMax)
    const superMeta = makeGoalsDailyComparisonOptions(daily, 'supermeta', scaleMax)

    // O maior valor das quatro séries é 192,5, na referência da supermeta.
    expect(scaleMax).toBe(200)
    expect((meta.yAxis as { max?: number }).max).toBe(200)
    expect((superMeta.yAxis as { max?: number }).max).toBe(200)
    expect((meta.yAxis as { min?: number }).min).toBe(0)
  })

  it('não força escala quando o recorte não tem nenhum valor positivo', () => {
    const empty = daily.map((point) => ({
      ...point,
      goalAchieved: 0,
      totalAchieved: 0,
      goalPace: null,
      superGoalPace: null,
    }))

    expect(goalsDailyScaleMax(empty)).toBeUndefined()
  })

  it('omite a referência quando o recorte não tem meta', () => {
    const meta = seriesOf(makeGoalsDailyComparisonOptions(noGoal, 'meta', undefined))

    expect(meta).toHaveLength(1)
    expect(meta[0].name).toBe('Realizado da meta')
  })

  it('mostra no tooltip apenas o dia e os valores das séries', () => {
    const option = makeGoalsDailyComparisonOptions(daily, 'meta', undefined)
    const html = callTooltip(option.tooltip, [
      {
        axisValue: '03',
        marker: '<i></i>',
        seriesName: 'Realizado da meta',
        value: 70,
      },
      {
        axisValue: '03',
        marker: '<i></i>',
        seriesName: 'Ritmo esperado da meta',
        value: 75,
      },
    ])

    expect(html).toContain('Dia 03')
    expect(html).toContain('Realizado da meta')
    expect(html).toContain('70')
    expect(html).toContain('Ritmo esperado da meta')
    expect(html).toContain('75')
    // O parágrafo sobre os numeradores saiu do tooltip e virou texto fixo da página.
    expect(html).not.toContain('Vendas Internas')
    expect(html).not.toContain('Corporativo')
  })

  it('não mostra linha zerada no tooltip, e "sem dado" continua', () => {
    const option = makeGoalsDailyComparisonOptions(daily, 'meta', undefined)
    const html = callTooltip(option.tooltip, [
      { axisValue: '01', marker: '<i></i>', seriesName: 'Realizado da meta', value: 0 },
      { axisValue: '01', marker: '<i></i>', seriesName: 'Ritmo esperado da meta', value: 25 },
    ])
    const futuro = callTooltip(option.tooltip, [
      { axisValue: '06', marker: '<i></i>', seriesName: 'Realizado da meta', value: null },
      { axisValue: '06', marker: '<i></i>', seriesName: 'Ritmo esperado da meta', value: 150 },
    ])

    expect(html).not.toContain('Realizado da meta')
    expect(html).toContain('Ritmo esperado da meta')
    expect(futuro).toContain('sem dado')
  })

  it('mantém o tooltip confinado no gráfico e estreito', () => {
    const tooltip = makeGoalsDailyComparisonOptions(daily, 'meta', undefined).tooltip as {
      confine?: boolean
      extraCssText?: string
    }

    expect(tooltip.confine).toBe(true)
    expect(tooltip.extraCssText).toContain('max-width:230px')
  })
})

describe('composição do realizado', () => {
  const slices = [
    { name: 'Vendas Internas', value: 600, color: '#2f6bff' },
    { name: 'Colaboradores', value: 195, color: '#00b3a4' },
    { name: 'Corporativo', value: 88, color: '#7a5af8' },
  ]

  it('desenha uma rosca com as três origens e o total no centro', () => {
    const option = makeGoalsCompositionOptions(slices, 883)
    const [serie] = option.series as PieSeriesOption[]

    expect(serie.type).toBe('pie')
    // Raio interno maior que zero é o que separa rosca de pizza.
    expect((serie.radius as string[])[0]).toBe('60%')
    expect((serie.data as { name: string }[]).map((item) => item.name)).toEqual([
      'Vendas Internas',
      'Colaboradores',
      'Corporativo',
    ])
    expect((option.title as { text?: string }).text).toBe('883')
    expect((option.title as { subtext?: string }).subtext).toBe('Realizado total')
  })

  it('mostra nome, quantidade e percentual no tooltip da fatia', () => {
    const option = makeGoalsCompositionOptions(slices, 883)
    const html = callTooltip(option.tooltip, {
      marker: '<i></i>',
      name: 'Corporativo',
      percent: 10,
      value: 88,
    })

    expect(html).toContain('Corporativo')
    expect(html).toContain('88')
    expect(html).toContain('10,0% do realizado total')
  })
})
