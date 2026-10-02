import { readFileSync } from 'node:fs'

import type { BarSeriesOption } from 'echarts'
import { describe, expect, it } from 'vitest'

import { executiveCardColors } from '../../components/dashboard/executiveMetricCardModel'
import type { Pair } from '../../data/dashboardTypes'
import { mixHexColors } from '../../lib/colorMix'
import {
  buildRankingDescription,
  buildRankingRows,
  DIMMED_RANKING_BAR_RATIO,
  makeRankingOptions,
  RANKING_BAR_MIN_LENGTH,
  RANKING_EMPTY_MESSAGE,
  RANKING_LABEL_MAX_LENGTH,
  RANKING_LABEL_MAX_WIDTH,
  RESOLUTION_EMPTY_MESSAGE,
  toRankingPairs,
  truncateRankingLabel,
} from './overviewRankingChartOptions'

/**
 * Identidade oficial de cada ranking: a MESMA paleta compartilhada dos cards
 * executivos, sem literal próprio. É a cor que a página passa ao gerador.
 *
 * Categorias segue no azul do card `Total de OS`; Resoluções passou para o verde
 * do card `OS Concluídas`, porque é o desfecho justamente dessas OS. O ciano
 * saiu da página: ele não correspondia a card nenhum da coleção executiva.
 */
const CATEGORY_COLOR = executiveCardColors.blue
const RESOLUTION_COLOR = executiveCardColors.green

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

describe('identidade oficial dos rankings na página', () => {
  // O ECharts desenha em canvas, então a renderização estática não expõe a cor
  // recebida: a prova de que a página passa a paleta compartilhada, e não um
  // literal próprio, é a própria configuração dos rankings em `Overview.tsx`.
  const pageSource = readFileSync(new URL('./Overview.tsx', import.meta.url), 'utf8')

  it('Volume por categoria e Resoluções usam a paleta compartilhada dos cards', () => {
    expect(pageSource).toContain('color: executiveCardColors.blue')
    expect(pageSource).toContain('color: executiveCardColors.green')
    expect(CATEGORY_COLOR).toBe('#2f7de1')
    expect(RESOLUTION_COLOR).toBe('#00a862')
  })

  it('o ciano não é mais usado por ranking nenhum', () => {
    expect(pageSource).not.toContain('executiveCardColors.cyan')
    expect(RESOLUTION_COLOR).not.toBe(executiveCardColors.cyan)
  })

  it('nenhum hexadecimal é copiado para a página', () => {
    expect(pageSource).not.toContain('#2f6bff')
    expect(pageSource).not.toContain('#00b3a4')
    // Nenhuma cor literal, de forma nenhuma: a página só nomeia a paleta.
    expect(pageSource).not.toMatch(/#[0-9a-fA-F]{3,8}/)
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
    const colorsOf = (option: ReturnType<typeof buildCategory>) =>
      (seriesOf(option)[0].data as { itemStyle: { color: string } }[]).map(
        (item) => item.itemStyle.color,
      )

    // Todas as barras carregam a MESMA cor de identidade do gráfico: o
    // itemStyle é por item só para o destaque de opacidade, nunca para cor.
    expect(new Set(colorsOf(buildCategory()))).toEqual(new Set([CATEGORY_COLOR]))
    expect(new Set(colorsOf(buildResolution()))).toEqual(new Set([RESOLUTION_COLOR]))
  })

  it('mantém a cor igual nos dois temas', () => {
    const colorOf = (option: ReturnType<typeof buildCategory>) =>
      (seriesOf(option)[0].data as { itemStyle: { color: string } }[])[0].itemStyle.color

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

  it('aceita mensagem específica por ranking, no desenho e na descrição', () => {
    const option = makeRankingOptions({
      color: RESOLUTION_COLOR,
      emptyMessage: RESOLUTION_EMPTY_MESSAGE,
      items: [],
      name: 'Resoluções mais frequentes',
      theme: 'light',
    })

    // Resolução só existe em OS Concluída: o vazio deste ranking tem causa
    // conhecida, e a mensagem diz a causa em vez do aviso genérico.
    expect((option.title as { text: string }).text).toBe('Sem OS concluídas no recorte')
    expect((option.aria as { label: { description: string } }).label.description).toBe(
      'Resoluções mais frequentes. Sem OS concluídas no recorte.',
    )
    expect(option.series).toBeUndefined()
  })

  it('sem mensagem declarada, o padrão de sempre continua valendo', () => {
    const option = makeRankingOptions({
      color: CATEGORY_COLOR,
      items: [],
      name: 'Volume por categoria',
      theme: 'light',
    })

    expect((option.title as { text: string }).text).toBe(RANKING_EMPTY_MESSAGE)
    expect(buildRankingDescription('Volume por categoria', [])).toBe(
      'Volume por categoria. Sem dados no período.',
    )
    expect(buildRankingDescription('Resoluções mais frequentes', [], RESOLUTION_EMPTY_MESSAGE)).toBe(
      'Resoluções mais frequentes. Sem OS concluídas no recorte.',
    )
  })

  it('a mensagem específica não muda ranking COM dados', () => {
    const option = makeRankingOptions({
      color: RESOLUTION_COLOR,
      emptyMessage: RESOLUTION_EMPTY_MESSAGE,
      items: resolutionPairs,
      name: 'Resoluções mais frequentes',
      theme: 'light',
    })

    expect(option.title).toBeUndefined()
    expect(seriesOf(option)).toHaveLength(1)
    expect((option.aria as { label: { description: string } }).label.description).not.toContain(
      RESOLUTION_EMPTY_MESSAGE,
    )
  })

  it('é a página quem liga a mensagem específica ao ranking de resoluções', () => {
    // Mesma prova documental dos testes de identidade: o ECharts desenha em
    // canvas, então a ligação visível é a configuração em `Overview.tsx`.
    const pageSource = readFileSync(new URL('./Overview.tsx', import.meta.url), 'utf8')

    expect(pageSource).toContain('emptyMessage: RESOLUTION_EMPTY_MESSAGE')
    // Uma vez só: `Volume por categoria` continua com a mensagem padrão.
    expect(pageSource.match(/emptyMessage/g)).toHaveLength(1)
  })
})

describe('piso de visibilidade da barra pequena', () => {
  it('desenha um comprimento mínimo, o mesmo do painel de status', () => {
    for (const option of [buildCategory(), buildResolution()]) {
      expect(seriesOf(option)[0].barMinHeight).toBe(RANKING_BAR_MIN_LENGTH)
    }
    // O piso vale nos dois temas: ele é geometria, não cor.
    expect(seriesOf(buildCategory('dark'))[0].barMinHeight).toBe(RANKING_BAR_MIN_LENGTH)
    expect(RANKING_BAR_MIN_LENGTH).toBe(4)
  })

  it('não toca em valor nenhum: o piso é só desenho', () => {
    // Recorte com a mesma desproporção real do `Volume por cidade` (938 e 1).
    const option = makeRankingOptions({
      color: CATEGORY_COLOR,
      items: toRankingPairs(['Atibaia', 'Cidade não informada'], [938, 1]),
      name: 'Volume por cidade',
      theme: 'light',
    })
    const data = seriesOf(option)[0].data as { value: number; name: string }[]
    const label = seriesOf(option)[0].label as {
      formatter: (params: { dataIndex: number }) => string
    }
    const aria = option.aria as { label: { description: string } }

    // O dado da barra continua sendo 1, e não o valor que 4 px representariam.
    expect(data.map((item) => item.value)).toEqual([1, 938])
    // A quantidade escrita na ponta é o que separa as barras achatadas no piso.
    expect(label.formatter({ dataIndex: 0 })).toBe('1')
    expect(aria.label.description).toContain('Cidade não informada: 1 OS')
  })
})

describe('item do próprio filtro selecionado no ranking', () => {
  const comSelecao = (value: string | null) =>
    makeRankingOptions({
      color: CATEGORY_COLOR,
      items: toRankingPairs(categoryLabels, categoryValues),
      name: 'Volume por categoria',
      selected: value === null ? null : { noun: 'categoria', values: [value] },
      theme: 'light',
    })

  const coresPorItem = (value: string | null) =>
    Object.fromEntries(
      (seriesOf(comSelecao(value))[0].data as {
        name: string
        itemStyle: { color: string }
      }[]).map((item) => [item.name, item.itemStyle.color]),
    )

  it('destaca a barra do item escolhido e mantém as demais como contexto', () => {
    const resultado = coresPorItem('Reparo')
    const esmaecida = mixHexColors(CATEGORY_COLOR, '#ffffff', DIMMED_RANKING_BAR_RATIO)

    // O ranking não vira barra única: todas continuam desenhadas, e só a
    // ênfase muda. As apagadas seguem visíveis, porque são a comparação.
    expect(resultado.Reparo).toBe(CATEGORY_COLOR)
    for (const label of categoryLabels.filter((item) => item !== 'Reparo')) {
      expect(resultado[label]).toBe(esmaecida)
    }
    // Esmaecer é MISTURA, e não transparência: a barra segue opaca, então as
    // linhas de grade do eixo não aparecem por dentro dela.
    expect(esmaecida).not.toBe('#ffffff')
    expect(JSON.stringify(seriesOf(comSelecao('Reparo'))[0].data)).not.toContain('opacity')
  })

  it('sem seleção, nenhuma barra perde ênfase', () => {
    expect(new Set(Object.values(coresPorItem(null)))).toEqual(new Set([CATEGORY_COLOR]))
  })

  it('não mexe em valor nenhum: quantidades e ordem continuam as mesmas', () => {
    const valores = (value: string | null) =>
      (seriesOf(comSelecao(value))[0].data as { value: number }[]).map((item) => item.value)

    expect(valores('Reparo')).toEqual(valores(null))
  })

  it('explica o destaque para o leitor de tela, com a dimensão de negócio', () => {
    const rows = buildRankingRows(toRankingPairs(categoryLabels, categoryValues))
    const descricao = buildRankingDescription(
      'Volume por categoria',
      rows,
      RANKING_EMPTY_MESSAGE,
      { noun: 'categoria', values: ['Reparo'] },
    )

    expect(descricao).toContain('A categoria Reparo está selecionada no filtro')
    expect(descricao).toContain('as demais categorias permanecem como contexto comparativo')

    const cidades = buildRankingRows([
      ['Atibaia', 40],
      ['Mairiporã', 12],
    ])
    const porCidade = buildRankingDescription('Volume por cidade', cidades, RANKING_EMPTY_MESSAGE, {
      noun: 'cidade',
      values: ['Atibaia'],
    })
    expect(porCidade).toContain('A cidade Atibaia está selecionada no filtro')
    // Sem seleção, a descrição segue exatamente como era.
    expect(buildRankingDescription('Volume por categoria', rows)).not.toContain(
      'selecionada no filtro',
    )
  })

  it('com vários itens marcados, todos ficam em destaque e a leitura vai para o plural', () => {
    const resultado = Object.fromEntries(
      (seriesOf(
        makeRankingOptions({
          color: CATEGORY_COLOR,
          items: toRankingPairs(categoryLabels, categoryValues),
          name: 'Volume por categoria',
          selected: { noun: 'categoria', values: ['Reparo', 'Suporte Técnico'] },
          theme: 'light',
        }),
      )[0].data as { name: string; itemStyle: { color: string } }[]).map((item) => [
        item.name,
        item.itemStyle.color,
      ]),
    )
    const esmaecida = mixHexColors(CATEGORY_COLOR, '#ffffff', DIMMED_RANKING_BAR_RATIO)

    expect(resultado.Reparo).toBe(CATEGORY_COLOR)
    expect(resultado['Suporte Técnico']).toBe(CATEGORY_COLOR)
    expect(resultado['Fibra Instalação']).toBe(esmaecida)

    const rows = buildRankingRows(toRankingPairs(categoryLabels, categoryValues))
    expect(
      buildRankingDescription('Volume por categoria', rows, RANKING_EMPTY_MESSAGE, {
        noun: 'categoria',
        values: ['Reparo', 'Suporte Técnico'],
      }),
    ).toContain(
      ' As categorias Reparo e Suporte Técnico estão selecionadas no filtro e aparecem em destaque; ' +
        'as demais categorias permanecem como contexto comparativo do recorte.',
    )
  })

  it('marcada sem barra no ranking não é citada nem apaga as outras', () => {
    // Uma categoria marcada pode ficar sem OS depois de um filtro posterior,
    // como Cidade: o número está certo, e a frase não pode afirmar destaque.
    const rows = buildRankingRows(toRankingPairs(categoryLabels, categoryValues))
    const descricao = buildRankingDescription('Volume por categoria', rows, RANKING_EMPTY_MESSAGE, {
      noun: 'categoria',
      values: ['Reparo', 'Categoria sem OS'],
    })

    expect(descricao).toContain(' A categoria Reparo está selecionada no filtro e aparece em destaque; ')
    expect(descricao).not.toContain('Categoria sem OS')

    const soFantasma = makeRankingOptions({
      color: CATEGORY_COLOR,
      items: toRankingPairs(categoryLabels, categoryValues),
      name: 'Volume por categoria',
      selected: { noun: 'categoria', values: ['Categoria sem OS'] },
      theme: 'light',
    })
    const cores = (seriesOf(soFantasma)[0].data as { itemStyle: { color: string } }[]).map(
      (item) => item.itemStyle.color,
    )
    expect(new Set(cores)).toEqual(new Set([CATEGORY_COLOR]))
  })

  it('lista de marcados vazia vale como sem seleção', () => {
    const vazia = makeRankingOptions({
      color: CATEGORY_COLOR,
      items: toRankingPairs(categoryLabels, categoryValues),
      name: 'Volume por categoria',
      selected: { noun: 'categoria', values: [] },
      theme: 'light',
    })
    const cores = (seriesOf(vazia)[0].data as { itemStyle: { color: string } }[]).map(
      (item) => item.itemStyle.color,
    )

    expect(new Set(cores)).toEqual(new Set([CATEGORY_COLOR]))
  })
})

describe('rótulos longos do eixo do ranking', () => {
  const long = 'Instalação Parcial das Câmeras, Retornar ao Local'

  it('encurta apenas a exibição do eixo, sem tocar nos dados', () => {
    const option = makeRankingOptions({
      color: RESOLUTION_COLOR,
      items: [[long, 10]],
      name: 'Resoluções mais frequentes',
      theme: 'light',
    })
    const yAxis = option.yAxis as {
      data: string[]
      axisLabel: { formatter: (value: string) => string }
    }

    // O dado guarda o nome completo; só o texto desenhado no eixo é menor.
    expect(yAxis.data).toEqual([long])
    const shown = yAxis.axisLabel.formatter(long)
    expect(shown.length).toBeLessThanOrEqual(RANKING_LABEL_MAX_LENGTH)
    expect(shown.endsWith('…')).toBe(true)
  })

  it('preserva o nome completo no tooltip e na descrição acessível', () => {
    const option = makeRankingOptions({
      color: RESOLUTION_COLOR,
      items: [[long, 10]],
      name: 'Resoluções mais frequentes',
      theme: 'light',
    })
    const tooltip = option.tooltip as { formatter: (params: unknown) => string }
    const aria = option.aria as { label: { description: string } }

    expect(tooltip.formatter({ dataIndex: 0 })).toContain(long)
    expect(aria.label.description).toContain(long)
  })

  it('não encurta nomes que já cabem no eixo', () => {
    expect(truncateRankingLabel('Equipamento Substituído')).toBe('Equipamento Substituído')
    expect(truncateRankingLabel('Instalação Realizada')).toBe('Instalação Realizada')
  })

  it('limita a LARGURA desenhada do rótulo, com reticências deliberadas', () => {
    const axisLabel = (buildCategory().yAxis as {
      axisLabel: { width: number; overflow: string; ellipsis: string }
    }).axisLabel

    // O corte em pixels acontece no desenho: um nome mais largo que a faixa
    // reservada termina em reticências, e nunca amputado à esquerda como
    // `uditória de Infraestrutura`.
    expect(axisLabel.width).toBe(RANKING_LABEL_MAX_WIDTH)
    expect(axisLabel.overflow).toBe('truncate')
    expect(axisLabel.ellipsis).toBe('…')
    // Acima do rótulo formatado mais largo dos recortes aprovados (183 px no
    // corpo 11.5): os rótulos de hoje não mudam de desenho, e `Auditória de
    // Infraestrutura`, com 142 px, aparece inteiro.
    expect(RANKING_LABEL_MAX_WIDTH).toBeGreaterThanOrEqual(184)
  })

  it('mantém `Auditória de Infraestrutura` intacto nos dados e no formatter', () => {
    // O nome preserva a grafia do SGI e tem menos de 30 caracteres: o limite de
    // caracteres não o toca, e quem o protege do corte acidental é a largura.
    expect(truncateRankingLabel('Auditória de Infraestrutura')).toBe(
      'Auditória de Infraestrutura',
    )
    const option = makeRankingOptions({
      color: CATEGORY_COLOR,
      items: [['Auditória de Infraestrutura', 12]],
      name: 'Volume por categoria',
      theme: 'light',
    })

    expect((option.yAxis as { data: string[] }).data).toEqual(['Auditória de Infraestrutura'])
    expect((option.aria as { label: { description: string } }).label.description).toContain(
      'Auditória de Infraestrutura: 12 OS',
    )
  })
})
