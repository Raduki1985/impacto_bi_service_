import { describe, expect, it } from 'vitest'

import {
  makeAxisTooltipFormatter,
  makeBarOptions,
  makeHeatmapOptions,
  makeLineOptions,
  makeStackedBarOptions,
} from './chartOptions'

/**
 * Tooltip dos geradores compartilhados: nenhum tooltip do portal mostra linha
 * zerada (pedido do Mário em 28/09/2026). Os geradores servem as páginas de
 * OS com base de exemplo, e a regra vale para todas de uma vez.
 */

type Formatter = (params: unknown) => string

function formatterOf(option: { tooltip?: unknown }): Formatter {
  return (option.tooltip as { formatter: Formatter }).formatter
}

describe('tooltip de eixo sem linha zerada', () => {
  it('lista só as séries com valor, com o milhar em pt-BR', () => {
    const html = makeAxisTooltipFormatter(true)([
      { axisValueLabel: 'Mar', marker: '<i></i>', seriesName: 'Concluída', value: 1248 },
      { axisValueLabel: 'Mar', marker: '<i></i>', seriesName: 'Cancelada', value: 0 },
    ])

    expect(html).toContain('Mar')
    expect(html).toContain('Concluída')
    expect(html).toContain('1.248')
    expect(html).not.toContain('Cancelada')
  })

  it('categoria sem nenhum valor não abre caixa', () => {
    const formatter = makeAxisTooltipFormatter(true)

    expect(formatter([{ axisValueLabel: 'Abr', seriesName: 'Concluída', value: 0 }])).toBe('')
    expect(formatter([{ axisValueLabel: 'Abr', seriesName: 'Concluída', value: null }])).toBe('')
    expect(formatter([])).toBe('')
  })

  it('barra simples não escreve o nome interno da série', () => {
    const html = makeAxisTooltipFormatter(false)([
      { axisValueLabel: 'Fibra', marker: '<i></i>', seriesName: 'series\u00000', value: 12 },
    ])

    expect(html).toContain('>12<')
    expect(html).not.toContain('series')
  })

  it('os três geradores de eixo usam o formatador sem zero', () => {
    const zero = [{ axisValueLabel: 'Jan', seriesName: 'Total', value: 0 }]

    expect(formatterOf(makeBarOptions(['Jan'], [0]))(zero)).toBe('')
    expect(formatterOf(makeStackedBarOptions(['Jan'], []))(zero)).toBe('')
    expect(formatterOf(makeLineOptions(['Jan'], []))(zero)).toBe('')
  })

  it('célula zerada do mapa de calor não abre caixa', () => {
    const formatter = formatterOf(makeHeatmapOptions(['Seg'], ['08h'], [[0, 0, 0]], 5))

    expect(formatter({ data: [0, 0, 0] })).toBe('')
    expect(formatter({ data: [0, 0, 3] })).toContain('<b>3</b>')
  })
})
