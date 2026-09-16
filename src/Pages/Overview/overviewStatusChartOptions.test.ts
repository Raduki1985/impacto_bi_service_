import type { BarSeriesOption } from 'echarts'
import { describe, expect, it } from 'vitest'

import type { Pair } from '../../data/dashboardTypes'
import { OS_STATUSES } from '../../data/mockOsCatalog'
import { mixHexColors } from '../../lib/colorMix'
import {
  buildStatusDistributionDescription,
  buildStatusDistributionRows,
  makeStatusDistributionOptions,
  STATUS_BAR_MIN_LENGTH,
  STATUS_CHART_MIN_HEIGHT,
  STATUS_EMPTY_MESSAGE,
  statusDistributionHeight,
} from './overviewStatusChartOptions'

/**
 * Mesma forma de `charts.statusPairs`, na ordem de negócio dos agregados, com
 * um recorte dos status oficiais normalizados (o catálogo completo tem treze;
 * `Encerrada` é o status aprovado, e `Fechada` não existe mais na base).
 */
const pairs: Pair[] = [
  ['Concluída', 1510],
  ['Encerrada', 120],
  ['Improdutiva', 135],
  ['Em Andamento', 40],
  ['Cancelada', 16],
]

/** Mesma forma de `charts.statusColors`, com as cores oficiais destes status. */
const statusColors: Record<string, string> = {
  Concluída: '#16a34a',
  Encerrada: '#64748b',
  Improdutiva: '#e5484d',
  'Em Andamento': '#f5a623',
  Cancelada: '#8b5cf6',
}

const TOTAL = 1821

function build(theme: 'light' | 'dark' = 'light') {
  return makeStatusDistributionOptions(pairs, statusColors, theme)
}

function seriesOf(option: ReturnType<typeof build>): BarSeriesOption[] {
  return option.series as BarSeriesOption[]
}

/** Itens desenhados, do topo do gráfico para baixo. */
function drawnTopDown(option: ReturnType<typeof build>) {
  const data = seriesOf(option)[0].data as { value: number; name: string }[]
  // O eixo de categorias desenha de baixo para cima, então o topo é o fim.
  return [...data].reverse()
}

describe('linhas do gráfico de status', () => {
  it('ordena do maior para o menor sem mutar a coleção recebida', () => {
    const original = [...pairs]
    const { rows } = buildStatusDistributionRows(pairs, statusColors)

    expect(rows.map((row) => row.status)).toEqual([
      'Concluída',
      'Improdutiva',
      'Encerrada',
      'Em Andamento',
      'Cancelada',
    ])
    // A coleção de origem continua na ordem de negócio dos agregados.
    expect(pairs).toEqual(original)
  })

  it('preserva a ordem de origem no empate', () => {
    const empatados: Pair[] = [
      ['Encerrada', 50],
      ['Cancelada', 90],
      ['Improdutiva', 50],
      ['Em Andamento', 50],
    ]
    const { rows } = buildStatusDistributionRows(empatados, statusColors)

    // Cancelada sobe por ter o maior valor; os três empatados mantêm entre si a
    // ordem em que chegaram, sem depender da estabilidade do sort do motor.
    expect(rows.map((row) => row.status)).toEqual([
      'Cancelada',
      'Encerrada',
      'Improdutiva',
      'Em Andamento',
    ])
  })

  it('calcula a participação sobre a soma dos valores recebidos', () => {
    const { rows, total } = buildStatusDistributionRows(pairs, statusColors)

    expect(total).toBe(TOTAL)
    expect(rows[0].share).toBeCloseTo(1510 / TOTAL, 10)
    // As participações fecham em 100% do recorte, e não de um total externo.
    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 10)
  })

  it('acompanha o filtro: outro recorte, outro denominador', () => {
    const recorte: Pair[] = [
      ['Concluída', 80],
      ['Improdutiva', 20],
    ]
    const { rows, total } = buildStatusDistributionRows(recorte, statusColors)

    expect(total).toBe(100)
    expect(rows[0].label).toBe('80')
    expect(rows[1].label).toBe('20')
    // A participação sai do rótulo, não do cálculo: tooltip e leitura
    // acessível continuam tendo de onde tirá-la.
    expect(rows[0].share).toBeCloseTo(0.8, 10)
  })

  it('formata a quantidade no padrão brasileiro, sem percentual no rótulo', () => {
    const { rows } = buildStatusDistributionRows(pairs, statusColors)

    // Milhar com ponto, e nada além do número na ponta da barra.
    expect(rows[0].label).toBe('1.510')
    expect(rows[0].label).toMatch(/^\d{1,3}(\.\d{3})*$/)
    expect(rows.every((row) => !row.label.includes('%'))).toBe(true)
  })

  it('usa a cor oficial de cada status e um neutro seguro para o desconhecido', () => {
    const { rows } = buildStatusDistributionRows(
      // Nome sintético de propósito: representa um status fora do catálogo.
      [...pairs, ['Status Novo', 5] as Pair],
      statusColors,
    )
    const colorOf = (status: string) => rows.find((row) => row.status === status)?.color

    expect(colorOf('Concluída')).toBe('#16a34a')
    expect(colorOf('Encerrada')).toBe('#64748b')
    expect(colorOf('Improdutiva')).toBe('#e5484d')
    expect(colorOf('Em Andamento')).toBe('#f5a623')
    expect(colorOf('Cancelada')).toBe('#8b5cf6')
    // Status fora do mapa entra em cinza neutro, com nome e números corretos.
    expect(colorOf('Status Novo')).toBe('#94a3b8')
  })
})

describe('altura adaptável da comparação entre status', () => {
  it('preserva a altura aprovada até cinco status', () => {
    expect(STATUS_CHART_MIN_HEIGHT).toBe(280)
    for (const count of [1, 2, 3, 4, 5]) {
      expect(statusDistributionHeight(count)).toBe(280)
    }
    // A base traz cinco status hoje: o painel continua exatamente como está.
    expect(statusDistributionHeight(pairs.length)).toBe(280)
  })

  it('nunca encolhe: zero status devolve a altura mínima', () => {
    expect(statusDistributionHeight(0)).toBe(280)
    // Entrada inválida também não reduz o painel nem gera NaN.
    expect(statusDistributionHeight(-3)).toBe(280)
    expect(statusDistributionHeight(Number.NaN)).toBe(280)
    expect(statusDistributionHeight(Number.POSITIVE_INFINITY)).toBe(280)
  })

  it('cresce progressivamente acima de cinco status', () => {
    const alturas = [6, 7, 8, 9, 10, 11, 12, 13].map((count) =>
      statusDistributionHeight(count),
    )

    expect(statusDistributionHeight(6)).toBeGreaterThan(280)
    for (let index = 1; index < alturas.length; index += 1) {
      expect(alturas[index]).toBeGreaterThan(alturas[index - 1])
    }
  })

  it('suporta os treze status oficiais com folga de leitura', () => {
    const altura = statusDistributionHeight(OS_STATUSES.length)

    expect(OS_STATUSES.length).toBe(13)
    expect(altura).toBe(552)
    // Cada linha fica com no mínimo 40 px: barra de 20 px, nome e rótulo sem
    // sobreposição. É a garantia numérica de que treze status caberiam.
    expect(altura / OS_STATUSES.length).toBeGreaterThanOrEqual(40)
  })

  it('é determinística: a mesma quantidade devolve sempre a mesma altura', () => {
    for (const count of [0, 5, 6, 13, 20]) {
      expect(statusDistributionHeight(count)).toBe(statusDistributionHeight(count))
    }
    // Quantidade fracionária arredonda para cima, sem devolver meio pixel.
    expect(Number.isInteger(statusDistributionHeight(6.4))).toBe(true)
    expect(statusDistributionHeight(6.4)).toBe(statusDistributionHeight(7))
  })
})

describe('estrutura do gráfico de status', () => {
  it('publica uma única série de barras horizontais', () => {
    const option = build()

    expect(seriesOf(option)).toHaveLength(1)
    expect(seriesOf(option)[0].type).toBe('bar')
    // Categorias em y e valores em x: a barra cresce na horizontal.
    expect((option.yAxis as { type: string }).type).toBe('category')
    expect((option.xAxis as { type: string }).type).toBe('value')
  })

  it('garante comprimento mínimo às barras sem tocar na espessura', () => {
    const serie = seriesOf(build())[0]

    // Em barra horizontal o `barMinHeight` do ECharts age no eixo de VALOR, ou
    // seja, no comprimento: é ele que impede a barra de um status minúsculo de
    // virar um risco de menos de um pixel.
    expect(serie.barMinHeight).toBe(STATUS_BAR_MIN_LENGTH)
    expect(serie.barMinHeight).toBe(4)
    // A espessura transversal continua sendo assunto do `barMaxWidth`.
    expect(serie.barMaxWidth).toBe(20)
  })

  it('coloca o maior status no topo do gráfico', () => {
    expect(drawnTopDown(build()).map((item) => item.name)).toEqual([
      'Concluída',
      'Improdutiva',
      'Encerrada',
      'Em Andamento',
      'Cancelada',
    ])
  })

  it('leva a cor de cada status para a própria barra', () => {
    const data = seriesOf(build())[0].data as { name: string; itemStyle: { color: string } }[]
    const painted = Object.fromEntries(data.map((item) => [item.name, item.itemStyle.color]))

    expect(painted).toEqual(statusColors)
  })

  it('escreve só a quantidade na ponta da barra', () => {
    const option = build()
    const label = seriesOf(option)[0].label as {
      show: boolean
      position: string
      formatter: (params: { dataIndex: number }) => string
    }
    const data = seriesOf(option)[0].data as { name: string }[]

    expect(label.show).toBe(true)
    expect(label.position).toBe('right')
    // O rótulo do topo é o do maior status.
    const topIndex = data.length - 1
    expect(label.formatter({ dataIndex: topIndex })).toBe('1.510')
    expect(label.formatter({ dataIndex: 0 })).toBe('16')
  })

  it('reserva margem à direita para o rótulo não ser cortado', () => {
    const grid = build().grid as { right: number; containLabel: boolean }

    // Mesma reserva do painel de ranking, que tem rótulo idêntico. Cobre seis
    // dígitos com separador de milhar em 11 px seminegrito, e este painel é o
    // que desenha o maior número da página.
    expect(grid.right).toBeGreaterThanOrEqual(56)
    expect(grid.containLabel).toBe(true)
  })

  it('não publica legenda, porque o nome já está em cada barra', () => {
    expect(build().legend).toBeUndefined()
  })

  it('esconde os números do eixo, que repetiriam os rótulos das barras', () => {
    const xAxis = build().xAxis as { axisLabel: { show: boolean } }

    expect(xAxis.axisLabel.show).toBe(false)
  })
})

describe('status de participação mínima', () => {
  /** Mesmo recorte real do período padrão, com 1 OS em Pendente de Aprovação. */
  const recorte: Pair[] = [
    ['Pendente de Aprovação', 1],
    ['Concluída', 959],
    ['Improdutiva', 134],
    ['Encerrada', 44],
    ['Expirada', 110],
  ]
  const cores: Record<string, string> = {
    ...statusColors,
    'Pendente de Aprovação': '#a855f7',
    Expirada: '#b45309',
  }
  const option = makeStatusDistributionOptions(recorte, cores, 'light')
  const data = seriesOf(option)[0].data as { value: number; name: string }[]

  it('mantém o valor real da barra, sem número inflado para caber o mínimo', () => {
    const { rows, total } = buildStatusDistributionRows(recorte, cores)
    const menor = rows[rows.length - 1]

    expect(total).toBe(1248)
    expect(menor.status).toBe('Pendente de Aprovação')
    expect(menor.value).toBe(1)
    expect(menor.share).toBeCloseTo(1 / 1248, 10)
    // O comprimento mínimo é desenho: o dado que vai para a série é o de sempre.
    expect(data[0]).toMatchObject({ name: 'Pendente de Aprovação', value: 1 })
  })

  it('escreve a quantidade verdadeira na ponta da barra', () => {
    const label = seriesOf(option)[0].label as {
      formatter: (params: { dataIndex: number }) => string
    }

    expect(label.formatter({ dataIndex: 0 })).toBe('1')
    // Barras maiores seguem com os próprios números, na mesma escala.
    expect(label.formatter({ dataIndex: data.length - 1 })).toBe('959')
  })

  it('não leva valor artificial para o tooltip nem para a leitura acessível', () => {
    const tooltip = option.tooltip as { formatter: (params: unknown) => string }
    const aria = option.aria as { label: { description: string } }
    const html = tooltip.formatter({ dataIndex: 0 })

    expect(html).toContain('Pendente de Aprovação')
    expect(html).toContain('1 OS')
    expect(html).toContain('0,1%')
    expect(aria.label.description).toContain('Pendente de Aprovação: 1 OS, 0,1%')
    expect(aria.label.description).toContain('Concluída: 959 OS, 76,8%')
  })

  it('preserva as proporções das barras maiores', () => {
    const valores = [...data].reverse().map((item) => item.value)

    // Decrescente e com os valores originais: o piso de 4 px não reordena nem
    // reescala nada, ele só garante que a menor barra apareça.
    expect(valores).toEqual([959, 134, 110, 44, 1])
    expect(valores.reduce((soma, valor) => soma + valor, 0)).toBe(1248)
    expect(seriesOf(option)[0].barMinHeight).toBe(STATUS_BAR_MIN_LENGTH)
  })

  it('mantém o piso e a cor com um status selecionado no filtro', () => {
    const comFiltro = makeStatusDistributionOptions(
      recorte,
      cores,
      'dark',
      'Pendente de Aprovação',
    )
    const itens = seriesOf(comFiltro)[0].data as {
      name: string
      value: number
      itemStyle: { color: string }
    }[]

    expect(seriesOf(comFiltro)[0].barMinHeight).toBe(STATUS_BAR_MIN_LENGTH)
    // O status selecionado é justamente o de 1 OS: ele fica em cor plena, com
    // o valor verdadeiro, e as barras de contexto seguem visíveis.
    expect(itens[0]).toMatchObject({ name: 'Pendente de Aprovação', value: 1 })
    expect(itens[0].itemStyle.color).toBe(cores['Pendente de Aprovação'])
    for (const item of itens.slice(1)) {
      // Esmaecidas por MISTURA, e não por transparência: a barra continua
      // opaca, então as linhas de grade não atravessam o desenho dela.
      expect(item.itemStyle.color).not.toBe(cores[item.name])
      expect(item.itemStyle.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(item.value).toBeGreaterThan(0)
    }
    expect(JSON.stringify(itens)).not.toContain('opacity')
  })
})

describe('movimento e consulta do gráfico de status', () => {
  it('desliga a animação de entrada e de atualização', () => {
    expect(build().animation).toBe(false)
  })

  it('desliga o destaque das barras no hover', () => {
    expect(seriesOf(build())[0].emphasis).toEqual({ disabled: true })
  })

  it('mantém o tooltip por item, instantâneo e sem transição', () => {
    const tooltip = build().tooltip as Record<string, unknown>

    // Por item: no eixo o ECharts desenharia uma faixa cinza sobre a linha.
    expect(tooltip.trigger).toBe('item')
    expect(tooltip.showDelay).toBe(0)
    expect(tooltip.transitionDuration).toBe(0)
    expect(tooltip.confine).toBe(true)
  })

  it('mostra no tooltip os mesmos números do rótulo direto', () => {
    const option = build()
    const tooltip = option.tooltip as { formatter: (params: unknown) => string }
    const topIndex = (seriesOf(option)[0].data as unknown[]).length - 1
    const html = tooltip.formatter({ dataIndex: topIndex })

    expect(html).toContain('Concluída')
    expect(html).toContain('1.510')
    expect(html).toContain('82,9%')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
    // Item fora da coleção não quebra o gráfico.
    expect(tooltip.formatter({ dataIndex: 99 })).toBe('')
  })
})

describe('temas do gráfico de status', () => {
  it('troca textos, grade e tooltip entre claro e escuro', () => {
    const read = (option: unknown, path: string) =>
      path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], option)
    const light: unknown = build('light')
    const dark: unknown = build('dark')

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

  it('mantém as cores dos status iguais nos dois temas', () => {
    const colorsOf = (theme: 'light' | 'dark') =>
      (seriesOf(build(theme))[0].data as { itemStyle: { color: string } }[]).map(
        (item) => item.itemStyle.color,
      )

    // A cor é identidade do status, não decoração do tema.
    expect(colorsOf('light')).toEqual(colorsOf('dark'))
  })
})

describe('descrição acessível do gráfico de status', () => {
  it('descreve o gráfico, cada status, a quantidade e a participação', () => {
    const aria = build().aria as { enabled: boolean; label: { description: string } }

    expect(aria.enabled).toBe(true)
    expect(aria.label.description).toBe(
      'Distribuição por status. Concluída: 1.510 OS, 82,9%. Improdutiva: 135 OS, 7,4%. ' +
        'Encerrada: 120 OS, 6,6%. Em Andamento: 40 OS, 2,2%. Cancelada: 16 OS, 0,9%.',
    )
  })

  it('sai dos dados reais, sem undefined nem NaN', () => {
    const { rows } = buildStatusDistributionRows(pairs, statusColors)
    const description = buildStatusDistributionDescription(rows)

    expect(description).not.toContain('undefined')
    expect(description).not.toContain('NaN')
    expect(description).not.toContain('Infinity')
    // Cada status é citado uma única vez.
    for (const [status] of pairs) {
      expect(description.match(new RegExp(status, 'g'))).toHaveLength(1)
    }
  })
})

describe('estado vazio do gráfico de status', () => {
  const vazios: { readonly caso: string; readonly entrada: Pair[] }[] = [
    { caso: 'coleção vazia', entrada: [] },
    { caso: 'soma zero', entrada: [['Concluída', 0], ['Encerrada', 0]] },
  ]

  for (const { caso, entrada } of vazios) {
    it(`mostra a mensagem neutra sem NaN nem Infinity: ${caso}`, () => {
      const { rows, total } = buildStatusDistributionRows(entrada, statusColors)
      const option = makeStatusDistributionOptions(entrada, statusColors, 'light')
      const serialized = JSON.stringify(option)

      expect(rows).toEqual([])
      expect(total).toBe(0)
      expect((option.title as { text: string }).text).toBe(STATUS_EMPTY_MESSAGE)
      // Nenhuma barra inventada para status ausentes.
      expect(option.series).toBeUndefined()
      expect(serialized).not.toContain('NaN')
      expect(serialized).not.toContain('Infinity')
      expect(serialized).not.toContain('undefined')
    })
  }

  it('descreve o estado vazio para a tecnologia assistiva', () => {
    const aria = makeStatusDistributionOptions([], statusColors, 'dark').aria as {
      label: { description: string }
    }

    expect(aria.label.description).toBe('Distribuição por status. Sem dados no período.')
  })

  it('mantém a mensagem legível nos dois temas', () => {
    const colorOf = (theme: 'light' | 'dark') =>
      (makeStatusDistributionOptions([], statusColors, theme).title as {
        textStyle: { color: string }
      }).textStyle.color

    expect(colorOf('light')).not.toBe(colorOf('dark'))
  })
})

describe('destaque contextual do status selecionado', () => {
  type DrawnItem = { name: string; value: number; itemStyle: { color: string } }

  const drawnWith = (selected: string | null) =>
    (
      seriesOf(makeStatusDistributionOptions(pairs, statusColors, 'light', selected))[0]
        .data as DrawnItem[]
    )

  it('sem seleção, todas as barras ficam com a cor de identidade cheia', () => {
    for (const item of drawnWith(null)) {
      expect(item.itemStyle.color).toBe(statusColors[item.name])
    }
  })

  it('com seleção, destaca o status escolhido e apenas reduz a ênfase dos demais', () => {
    const drawn = drawnWith('Improdutiva')
    const selected = drawn.find((item) => item.name === 'Improdutiva')!
    const others = drawn.filter((item) => item.name !== 'Improdutiva')

    expect(selected.itemStyle.color).toBe(statusColors.Improdutiva)
    for (const item of others) {
      // As demais barras seguem visíveis, com valor real: contexto, não ruído.
      // A cor esmaecida é a mistura da identidade com a superfície do painel,
      // então fica entre as duas e nunca alcança nenhuma delas.
      expect(item.itemStyle.color).toBe(
        mixHexColors(statusColors[item.name], '#ffffff', 0.4),
      )
      expect(item.itemStyle.color).not.toBe(statusColors[item.name])
      expect(item.itemStyle.color).not.toBe('#ffffff')
      expect(item.value).toBeGreaterThan(0)
    }
    // Nenhuma barra some nem zera: o gráfico não vira 100% de um status só.
    expect(drawn).toHaveLength(pairs.length)
    // A cor de identidade não muda com a seleção.
    expect(selected.itemStyle.color).toBe(statusColors.Improdutiva)
  })

  it('explica o contexto comparativo na descrição acessível', () => {
    const { rows } = buildStatusDistributionRows(pairs, statusColors)
    const description = buildStatusDistributionDescription(rows, 'Improdutiva')

    expect(description).toContain('Improdutiva: 135 OS, 7,4%')
    expect(description).toContain('O status Improdutiva está selecionado no filtro')
    expect(description).toContain('contexto comparativo do recorte')
    // Sem seleção, a descrição continua a de sempre.
    expect(buildStatusDistributionDescription(rows)).not.toContain('selecionado no filtro')
  })
})
