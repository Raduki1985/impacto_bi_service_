import type { BarSeriesOption } from 'echarts'
import { describe, expect, it } from 'vitest'

import type { Pair } from '../../data/dashboardTypes'
import {
  buildRankingDescription,
  buildRankingRows,
  makeRankingOptions,
  RANKING_EMPTY_MESSAGE,
  toRankingPairs,
} from './overviewRankingChartOptions'

const CATEGORY_COLOR = '#2f6bff'
const RESOLUTION_COLOR = '#00b3a4'

/** Mesma forma de `charts.categoryBar`, na ordem oficial dos metadados. */
const categoryLabels = [
  'Fibra Instalação',
  'Suporte Técnico',
  'Reparo',
  'Mudança de Endereço',
  'Upgrade de Plano',
  'Troca de Equipamento',
]
const categoryValues = [1620, 380, 310, 240, 130, 120]

/** Mesma forma de `charts.resolutionPairs`. */
const resolutionPairs: Pair[] = [
  ['Instalação Realizada', 540],
  ['Configuração Realizada', 230],
  ['Troca de Equipamento', 160],
  ['Reparo Realizado', 140],
  ['Cliente Orientado', 110],
  ['Equipamento Substituído', 95],
  ['Sem Defeito Encontrado', 70],
]

function buildCategory(theme: 'light' | 'dark' = 'light') {
  return makeRankingOptions({
    color: CATEGORY_COLOR,
    items: toRankingPairs(categoryLabels, categoryValues),
    name: 'Volume por categoria',
    theme,
  })
}

function buildResolution(theme: 'light' | 'dark' = 'light') {
  return makeRankingOptions({
    color: RESOLUTION_COLOR,
    items: resolutionPairs,
    name: 'Resoluções mais frequentes',
    theme,
  })
}

function seriesOf(option: ReturnType<typeof buildCategory>): BarSeriesOption[] {
  return option.series as BarSeriesOption[]
}

/** Itens desenhados, do topo do gráfico para baixo. */
function drawnTopDown(option: ReturnType<typeof buildCategory>) {
  const data = seriesOf(option)[0].data as { value: number; name: string }[]
  // O eixo de categorias desenha de baixo para cima, então o topo é o fim.
  return [...data].reverse()
}

describe('normalização das coleções recebidas', () => {
  it('junta rótulos e valores paralelos sem mutar as entradas', () => {
    const labels = [...categoryLabels]
    const values = [...categoryValues]
    const pairs = toRankingPairs(labels, values)

    expect(pairs).toHaveLength(6)
    expect(pairs[0]).toEqual(['Fibra Instalação', 1620])
    expect(labels).toEqual(categoryLabels)
    expect(values).toEqual(categoryValues)
  })

  it('conta zero para rótulo sem valor e descarta valor sem rótulo', () => {
    // Um rótulo a mais vira zero, e não `undefined` no gráfico.
    expect(toRankingPairs(['A', 'B'], [5])).toEqual([
      ['A', 5],
      ['B', 0],
    ])
    // Uma barra sem nome não pode ser lida, então não é desenhada.
    expect(toRankingPairs(['A'], [5, 9])).toEqual([['A', 5]])
  })
})

describe('linhas dos rankings', () => {
  it('ordena do maior para o menor sem mutar a coleção recebida', () => {
    const original = [...resolutionPairs]
    const rows = buildRankingRows(resolutionPairs)

    expect(rows.map((row) => row.label)).toEqual([
      'Instalação Realizada',
      'Configuração Realizada',
      'Troca de Equipamento',
      'Reparo Realizado',
      'Cliente Orientado',
      'Equipamento Substituído',
      'Sem Defeito Encontrado',
    ])
    expect(resolutionPairs).toEqual(original)
  })

  it('ordena a categoria mesmo chegando fora de ordem do agregado', () => {
    // O agregado monta as categorias na ordem dos metadados, sem ordenar por
    // valor: a ordenação é responsabilidade deste gerador.
    const rows = buildRankingRows(
      toRankingPairs(['Reparo', 'Fibra Instalação', 'Suporte Técnico'], [310, 1620, 380]),
    )

    expect(rows.map((row) => row.label)).toEqual([
      'Fibra Instalação',
      'Suporte Técnico',
      'Reparo',
    ])
  })

  it('preserva a ordem de origem no empate', () => {
    const empatados = toRankingPairs(['Reparo', 'Upgrade de Plano', 'Suporte Técnico', 'Fibra'], [90, 90, 200, 90])
    const rows = buildRankingRows(empatados)

    // Suporte Técnico sobe por ter o maior valor; os três empatados mantêm
    // entre si a ordem de chegada, sem depender do sort do motor.
    expect(rows.map((row) => row.label)).toEqual([
      'Suporte Técnico',
      'Reparo',
      'Upgrade de Plano',
      'Fibra',
    ])
  })

  it('formata a quantidade no padrão brasileiro, sem percentual', () => {
    const rows = buildRankingRows(toRankingPairs(['Fibra Instalação'], [1620]))

    expect(rows[0].text).toBe('1.620')
    expect(rows[0].text).not.toContain('%')
  })

  it('preserva item zerado ao lado de valores positivos', () => {
    const rows = buildRankingRows(
      toRankingPairs(['Reparo', 'Upgrade de Plano', 'Fibra Instalação'], [40, 0, 120]),
    )

    // O agregado monta as categorias a partir dos metadados: uma categoria sem
    // OS no recorte é um fato do período, e não um item a esconder.
    expect(rows.map((row) => row.label)).toEqual([
      'Fibra Instalação',
      'Reparo',
      'Upgrade de Plano',
    ])
    expect(rows[2]).toEqual({ label: 'Upgrade de Plano', value: 0, text: '0' })
  })
})

describe('estrutura dos rankings', () => {
  it('publica uma única série de barras horizontais em cada gráfico', () => {
    for (const option of [buildCategory(), buildResolution()]) {
      expect(seriesOf(option)).toHaveLength(1)
      expect(seriesOf(option)[0].type).toBe('bar')
      // Categorias em y e valores em x: a barra cresce na horizontal.
      expect((option.yAxis as { type: string }).type).toBe('category')
      expect((option.xAxis as { type: string }).type).toBe('value')
    }
  })

  it('coloca o maior item no topo dos dois gráficos', () => {
    expect(drawnTopDown(buildCategory())[0].name).toBe('Fibra Instalação')
    expect(drawnTopDown(buildResolution())[0].name).toBe('Instalação Realizada')
    // E a coleção inteira segue decrescente, de cima para baixo.
    const valores = drawnTopDown(buildResolution()).map((item) => item.value)
    expect(valores).toEqual([...valores].sort((a, b) => b - a))
  })

  it('mantém uma cor única por gráfico, sem paleta multicolorida', () => {
    const colorOf = (option: ReturnType<typeof buildCategory>) =>
      (seriesOf(option)[0].itemStyle as { color: string }).color

    expect(colorOf(buildCategory())).toBe(CATEGORY_COLOR)
    expect(colorOf(buildResolution())).toBe(RESOLUTION_COLOR)
    // Nenhum item carrega cor própria: a identidade é do gráfico.
    for (const option of [buildCategory(), buildResolution()]) {
      for (const item of seriesOf(option)[0].data as Record<string, unknown>[]) {
        expect(item.itemStyle).toBeUndefined()
      }
    }
  })

  it('mantém a cor igual nos dois temas', () => {
    const colorOf = (option: ReturnType<typeof buildCategory>) =>
      (seriesOf(option)[0].itemStyle as { color: string }).color

    expect(colorOf(buildCategory('light'))).toBe(colorOf(buildCategory('dark')))
    expect(colorOf(buildResolution('light'))).toBe(colorOf(buildResolution('dark')))
  })

  it('escreve a quantidade na ponta da barra, sem percentual', () => {
    const option = buildCategory()
    const label = seriesOf(option)[0].label as {
      show: boolean
      position: string
      formatter: (params: { dataIndex: number }) => string
    }
    const topIndex = (seriesOf(option)[0].data as unknown[]).length - 1

    expect(label.show).toBe(true)
    expect(label.position).toBe('right')
    expect(label.formatter({ dataIndex: topIndex })).toBe('1.620')
    expect(label.formatter({ dataIndex: topIndex })).not.toContain('%')
    expect(label.formatter({ dataIndex: 99 })).toBe('')
  })

  it('reserva margem à direita e espaço para os nomes longos', () => {
    const grid = buildResolution().grid as { right: number; containLabel: boolean }

    expect(grid.right).toBeGreaterThanOrEqual(48)
    // `containLabel` é o que garante `Equipamento Substituído` inteiro.
    expect(grid.containLabel).toBe(true)
  })

  it('não publica legenda nem repete os valores no eixo numérico', () => {
    for (const option of [buildCategory(), buildResolution()]) {
      expect(option.legend).toBeUndefined()
      expect((option.xAxis as { axisLabel: { show: boolean } }).axisLabel.show).toBe(false)
    }
  })
})

describe('movimento e consulta dos rankings', () => {
  it('desliga a animação de entrada e de atualização', () => {
    expect(buildCategory().animation).toBe(false)
    expect(buildResolution().animation).toBe(false)
  })

  it('desliga o destaque das barras no hover', () => {
    for (const option of [buildCategory(), buildResolution()]) {
      expect(seriesOf(option)[0].emphasis).toEqual({ disabled: true })
    }
  })

  it('mantém o tooltip por item, instantâneo e sem transição', () => {
    for (const option of [buildCategory(), buildResolution()]) {
      const tooltip = option.tooltip as Record<string, unknown>

      // Por item: no eixo o ECharts desenharia uma faixa cinza sobre a linha.
      expect(tooltip.trigger).toBe('item')
      expect(tooltip.showDelay).toBe(0)
      expect(tooltip.transitionDuration).toBe(0)
      expect(tooltip.confine).toBe(true)
    }
  })

  it('mostra nome, quantidade e unidade OS, sem inventar percentual', () => {
    const option = buildResolution()
    const tooltip = option.tooltip as { formatter: (params: unknown) => string }
    const topIndex = (seriesOf(option)[0].data as unknown[]).length - 1
    const html = tooltip.formatter({ dataIndex: topIndex })

    expect(html).toContain('Instalação Realizada')
    expect(html).toContain('540 OS')
    expect(html).not.toContain('%')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
    // Item fora da coleção não quebra o gráfico.
    expect(tooltip.formatter({ dataIndex: 99 })).toBe('')
  })
})

describe('temas dos rankings', () => {
  it('troca nomes, rótulos, grade e tooltip entre claro e escuro', () => {
    const read = (option: unknown, path: string) =>
      path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], option)
    const light: unknown = buildCategory('light')
    const dark: unknown = buildCategory('dark')

    for (const path of [
      'yAxis.axisLabel.color',
      'xAxis.splitLine.lineStyle.color',
      'series.0.label.color',
      'tooltip.backgroundColor',
      'tooltip.textStyle.color',
    ]) {
      expect(read(light, path)).not.toBe(read(dark, path))
      expect(read(light, path)).toBeTypeOf('string')
      expect(read(dark, path)).toBeTypeOf('string')
    }
  })
})

describe('descrição acessível dos rankings', () => {
  it('anuncia cada gráfico separadamente, com nome, itens e quantidades', () => {
    const ariaOf = (option: ReturnType<typeof buildCategory>) =>
      (option.aria as { enabled: boolean; label: { description: string } })

    expect(ariaOf(buildCategory()).enabled).toBe(true)
    expect(ariaOf(buildCategory()).label.description).toBe(
      'Volume por categoria. Fibra Instalação: 1.620 OS. Suporte Técnico: 380 OS. ' +
        'Reparo: 310 OS. Mudança de Endereço: 240 OS. Upgrade de Plano: 130 OS. ' +
        'Troca de Equipamento: 120 OS.',
    )
    expect(ariaOf(buildResolution()).label.description).toBe(
      'Resoluções mais frequentes. Instalação Realizada: 540 OS. ' +
        'Configuração Realizada: 230 OS. Troca de Equipamento: 160 OS. ' +
        'Reparo Realizado: 140 OS. Cliente Orientado: 110 OS. ' +
        'Equipamento Substituído: 95 OS. Sem Defeito Encontrado: 70 OS.',
    )
  })

  it('sai da mesma coleção ordenada do desenho, sem undefined nem NaN', () => {
    const rows = buildRankingRows(resolutionPairs)
    const description = buildRankingDescription('Resoluções mais frequentes', rows)

    expect(description).not.toContain('undefined')
    expect(description).not.toContain('NaN')
    expect(description).not.toContain('Infinity')
    expect(description).not.toContain('%')
    // A ordem da descrição é a mesma do desenho, do maior para o menor.
    expect(description.indexOf('Instalação Realizada')).toBeLessThan(
      description.indexOf('Sem Defeito Encontrado'),
    )
  })
})

describe('estado vazio dos rankings', () => {
  const vazios: { readonly caso: string; readonly items: Pair[] }[] = [
    { caso: 'coleção vazia', items: [] },
    { caso: 'todos os valores zerados', items: toRankingPairs(['Reparo', 'Fibra'], [0, 0]) },
  ]

  for (const { caso, items } of vazios) {
    it(`mostra a mensagem neutra sem NaN nem Infinity: ${caso}`, () => {
      const option = makeRankingOptions({
        color: CATEGORY_COLOR,
        items,
        name: 'Volume por categoria',
        theme: 'light',
      })
      const serialized = JSON.stringify(option)

      expect(buildRankingRows(items)).toEqual([])
      expect((option.title as { text: string }).text).toBe(RANKING_EMPTY_MESSAGE)
      // Nenhuma barra fictícia é desenhada.
      expect(option.series).toBeUndefined()
      expect(serialized).not.toContain('NaN')
      expect(serialized).not.toContain('Infinity')
      expect(serialized).not.toContain('undefined')
    })
  }

  it('descreve o estado vazio nomeando o gráfico certo', () => {
    const ariaOf = (name: string) =>
      (
        makeRankingOptions({ color: CATEGORY_COLOR, items: [], name, theme: 'dark' }).aria as {
          label: { description: string }
        }
      ).label.description

    expect(ariaOf('Volume por categoria')).toBe('Volume por categoria. Sem dados no período.')
    expect(ariaOf('Resoluções mais frequentes')).toBe(
      'Resoluções mais frequentes. Sem dados no período.',
    )
  })

  it('mantém a mensagem legível nos dois temas', () => {
    const colorOf = (theme: 'light' | 'dark') =>
      (
        makeRankingOptions({ color: CATEGORY_COLOR, items: [], name: 'X', theme }).title as {
          textStyle: { color: string }
        }
      ).textStyle.color

    expect(colorOf('light')).not.toBe(colorOf('dark'))
  })
})
