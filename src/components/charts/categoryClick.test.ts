import { describe, expect, it } from 'vitest'

import {
  bindCategoryClick,
  categoryIndexAt,
  type CategoryClickChart,
  type CategoryClickHandler,
  type CategoryPointerEvent,
} from './categoryClick'

/**
 * Gráfico falso com o mesmo contrato do ECharts: a grade ocupa x de 40 a 340
 * e y de 20 a 220, e cada categoria tem 100 px de faixa, como três dias no
 * eixo. O arredondamento imita o do ECharts no eixo de categorias.
 */
function fakeChart() {
  const listeners = new Map<string, (event: CategoryPointerEvent) => void>()
  let cursor = 'default'
  const chart: CategoryClickChart = {
    containPixel: (_finder, [x, y]) => x >= 40 && x <= 340 && y >= 20 && y <= 220,
    convertFromPixel: (_finder, x) => Math.round((x - 90) / 100),
    getZr: () => ({
      on: (eventName, handler) => listeners.set(eventName, handler),
      setCursorStyle: (style) => {
        cursor = style
      },
    }),
  }

  return {
    chart,
    fire: (eventName: 'click' | 'mousemove', event: CategoryPointerEvent) =>
      listeners.get(eventName)?.(event),
    cursor: () => cursor,
  }
}

/** Ponto no fundo da área, sem elemento sob o ponteiro. */
const blank = (offsetX: number, offsetY = 200): CategoryPointerEvent => ({ offsetX, offsetY })

describe('categoria sob o ponteiro', () => {
  it('lê a faixa inteira da categoria, do chão ao topo da grade', () => {
    const { chart } = fakeChart()

    expect(categoryIndexAt(chart, blank(60))).toBe(0)
    expect(categoryIndexAt(chart, blank(190, 30))).toBe(1)
    expect(categoryIndexAt(chart, blank(330, 215))).toBe(2)
  })

  it('deixa barra, ponto e rótulo para o clique da série', () => {
    const { chart } = fakeChart()

    // Com elemento sob o ponteiro o `onEvents` já abre, e sabe a série.
    expect(categoryIndexAt(chart, { ...blank(190), target: {} })).toBeNull()
  })

  it('fora da grade não existe categoria', () => {
    const { chart } = fakeChart()

    // Legenda embaixo, eixo à esquerda e margem acima da grade.
    expect(categoryIndexAt(chart, blank(190, 240))).toBeNull()
    expect(categoryIndexAt(chart, blank(20))).toBeNull()
    expect(categoryIndexAt(chart, blank(190, 10))).toBeNull()
  })

  it('descarta posição que não é categoria', () => {
    const base = fakeChart().chart

    for (const value of [Number.NaN, -1, 1.5]) {
      const chart: CategoryClickChart = { ...base, convertFromPixel: () => value }
      expect(categoryIndexAt(chart, blank(190))).toBeNull()
    }
  })
})

describe('clique na faixa ligado ao gráfico', () => {
  it('entrega a categoria clicada ao manipulador da vez', () => {
    const { chart, fire } = fakeChart()
    const clicks: number[] = []
    let handler: CategoryClickHandler | undefined = (index) => clicks.push(index)
    bindCategoryClick(chart, () => handler)

    fire('click', blank(190))
    // O manipulador é lido a cada clique: trocar o recorte troca o que abre.
    handler = (index) => clicks.push(index * 10)
    fire('click', blank(290))

    expect(clicks).toEqual([1, 20])
  })

  it('não abre nada em cima de barra nem fora da grade', () => {
    const { chart, fire } = fakeChart()
    const clicks: number[] = []
    bindCategoryClick(chart, () => (index) => clicks.push(index))

    fire('click', { ...blank(190), target: {} })
    fire('click', blank(190, 240))

    expect(clicks).toEqual([])
  })

  it('mostra a mão sobre a faixa, e só com clique ligado', () => {
    const ligado = fakeChart()
    bindCategoryClick(ligado.chart, () => () => undefined)
    ligado.fire('mousemove', blank(190, 30))
    expect(ligado.cursor()).toBe('pointer')

    // Sem manipulador o gráfico fica como sempre foi: nem clique, nem mão.
    const desligado = fakeChart()
    bindCategoryClick(desligado.chart, () => undefined)
    desligado.fire('mousemove', blank(190, 30))
    expect(desligado.cursor()).toBe('default')
  })

  it('não troca o cursor fora da grade', () => {
    const { chart, fire, cursor } = fakeChart()
    bindCategoryClick(chart, () => () => undefined)

    fire('mousemove', blank(190, 240))

    expect(cursor()).toBe('default')
  })
})
