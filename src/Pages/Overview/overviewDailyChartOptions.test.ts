import type { LineSeriesOption } from 'echarts'
import { describe, expect, it } from 'vitest'

import { makeLineOptions } from '../../components/charts/chartOptions'
import {
  DAILY_VOLUME_COLORS,
  DAILY_VOLUME_COMPLETED_SERIES,
  DAILY_VOLUME_TOTAL_SERIES,
  formatDailyVolumeTooltip,
  makeDailyVolumeOptions,
} from './overviewDailyChartOptions'

const labels = ['17/05', '18/05', '19/05']
const total = [23, 19, 27]
const completed = [20, 15, 24]

function build(theme: 'light' | 'dark' = 'light') {
  return makeDailyVolumeOptions(labels, total, completed, theme)
}

/** As duas séries do gráfico, já tipadas como linha. */
function seriesOf(option: ReturnType<typeof build>): LineSeriesOption[] {
  return option.series as LineSeriesOption[]
}

describe('séries do Volume diário de OS', () => {
  it('publica exatamente duas séries independentes com os dados recebidos', () => {
    const series = seriesOf(build())

    expect(series).toHaveLength(2)
    expect(series[0].name).toBe(DAILY_VOLUME_TOTAL_SERIES)
    expect(series[1].name).toBe(DAILY_VOLUME_COMPLETED_SERIES)
    expect(series[0].data).toEqual(total)
    expect(series[1].data).toEqual(completed)
  })

  it('mantém o eixo de categorias com os rótulos recebidos', () => {
    const option = build()

    expect(option.xAxis).toMatchObject({ type: 'category', data: labels })
  })

  it('desenha segmentos diretos, sem suavização', () => {
    for (const item of seriesOf(build())) {
      expect(item.smooth).toBe(false)
    }
  })

  it('não empilha as séries, então as duas ficam na mesma escala', () => {
    const option = build()

    for (const item of seriesOf(option)) {
      expect(item.stack).toBeUndefined()
      // Uma escala só: nenhuma série é jogada para um segundo eixo.
      expect(item.yAxisIndex).toBeUndefined()
    }
    expect(Array.isArray(option.yAxis)).toBe(false)
  })

  it('preenche somente a série Total, com opacidade baixa', () => {
    const [totalSeries, completedSeries] = seriesOf(build())

    expect(totalSeries.areaStyle).toEqual({
      color: DAILY_VOLUME_COLORS.total,
      opacity: 0.1,
    })
    expect(completedSeries.areaStyle).toBeUndefined()
  })

  it('usa as cores aprovadas, iguais nos dois temas', () => {
    expect(DAILY_VOLUME_COLORS).toEqual({ total: '#2f6bff', completed: '#16a34a' })

    for (const theme of ['light', 'dark'] as const) {
      const [totalSeries, completedSeries] = seriesOf(build(theme))

      expect(totalSeries.lineStyle?.color).toBe('#2f6bff')
      expect(completedSeries.lineStyle?.color).toBe('#16a34a')
      expect(totalSeries.lineStyle?.width).toBe(2.4)
      expect(completedSeries.lineStyle?.width).toBe(2.4)
    }
  })

  it('não desenha símbolo nenhum, nem no repouso nem sob o ponteiro do eixo', () => {
    for (const item of seriesOf(build())) {
      // `showSymbol: false` não bastaria: com ele o ECharts ainda desenha o
      // símbolo do ponto quando o ponteiro do eixo passa por cima, e foi isso
      // que a verificação pixel a pixel no navegador flagrou.
      expect(item.symbol).toBe('none')
      expect(item.showSymbol).toBeUndefined()
      // Nada de engrossar ou destacar a linha no hover.
      expect(item.emphasis).toEqual({ disabled: true })
    }
  })
})

describe('movimento do Volume diário de OS', () => {
  it('desliga a animação de entrada e de atualização', () => {
    expect(build().animation).toBe(false)
  })

  it('mantém o tooltip instantâneo, sem atraso nem transição', () => {
    const { tooltip } = build() as { tooltip: Record<string, unknown> }

    expect(tooltip.trigger).toBe('axis')
    expect(tooltip.transitionDuration).toBe(0)
    expect(tooltip.showDelay).toBe(0)
    // O gatilho fica no padrão `mousemove|click` do ECharts, que atende mouse
    // e toque. Restringir para `click` ou `mousemove` tiraria um dos dois.
    expect(tooltip.triggerOn).toBeUndefined()
    // Em painel estreito a caixa fica contida em vez de vazar para fora.
    expect(tooltip.confine).toBe(true)
  })
})

describe('conteúdo do tooltip', () => {
  const params = [
    { axisValueLabel: '18/05', marker: '<span></span>', seriesName: 'Total', value: 19 },
    { axisValueLabel: '18/05', marker: '<span></span>', seriesName: 'Concluídas', value: 15 },
  ]

  it('mostra a data do ponto e os dois valores exatos do dia', () => {
    const html = formatDailyVolumeTooltip(params)

    expect(html).toContain('18/05')
    expect(html).toContain('Total')
    expect(html).toContain('19')
    expect(html).toContain('Concluídas')
    expect(html).toContain('15')
  })

  it('não acrescenta leitura, comparação nem unidade que o gráfico não tem', () => {
    const html = formatDailyVolumeTooltip(params)

    expect(html).not.toMatch(/%/)
    expect(html).not.toMatch(/período anterior/)
    expect(html).not.toMatch(/média|taxa/i)
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
  })

  it('sobrevive a parâmetro fora do formato esperado', () => {
    expect(formatDailyVolumeTooltip(null)).not.toContain('undefined')
    expect(formatDailyVolumeTooltip([])).toBe('<div style="margin-bottom:4px;font-weight:600"></div>')
  })
})

describe('adaptação ao tema', () => {
  it('troca eixos, grade, legenda, tooltip e ponteiro entre os temas', () => {
    const light: unknown = build('light')
    const dark: unknown = build('dark')
    const read = (option: unknown, path: string) =>
      path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], option)

    for (const path of [
      'xAxis.axisLabel.color',
      'xAxis.axisLine.lineStyle.color',
      'yAxis.splitLine.lineStyle.color',
      'yAxis.axisLabel.color',
      'legend.textStyle.color',
      'tooltip.backgroundColor',
      'tooltip.textStyle.color',
      'tooltip.axisPointer.lineStyle.color',
    ]) {
      expect(read(light, path)).not.toBe(read(dark, path))
      expect(read(light, path)).toBeTypeOf('string')
      expect(read(dark, path)).toBeTypeOf('string')
    }
  })

  it('mantém as duas séries na legenda nos dois temas', () => {
    for (const theme of ['light', 'dark'] as const) {
      const option = build(theme)

      expect(option.legend).toBeDefined()
      expect(seriesOf(option).map((item) => item.name)).toEqual(['Total', 'Concluídas'])
    }
  })
})

/**
 * O helper compartilhado continua como estava.
 *
 * É a razão de este arquivo existir: `makeLineOptions` serve vários gráficos do
 * portal, e suavização, animação e destaque no hover são o comportamento
 * esperado por eles.
 */
describe('makeLineOptions preservado para os demais gráficos', () => {
  it('mantém suavização e não herda as decisões deste gráfico', () => {
    const option = makeLineOptions(labels, [
      { name: 'Total', data: total, color: '#2f6bff', area: true },
    ])
    const [item] = option.series as LineSeriesOption[]

    expect(item.smooth).toBe(true)
    expect(item.emphasis).toBeUndefined()
    expect(option.animation).toBeUndefined()
  })
})
