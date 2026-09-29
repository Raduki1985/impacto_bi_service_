import type { BarSeriesOption, LineSeriesOption } from 'echarts'
import { describe, expect, it } from 'vitest'

import { makeLineOptions } from '../../components/charts/chartOptions'
import { executiveCardColors } from '../../components/dashboard/executiveMetricCardModel'
import { statusColors } from '../../data/dashboardAggregates'
import {
  buildDailyVolumeDescription,
  DAILY_VOLUME_BAR,
  DAILY_VOLUME_BAR_GAP,
  DAILY_VOLUME_CLICK_HINT,
  DAILY_VOLUME_COINCIDENT_MESSAGE,
  DAILY_VOLUME_COLORS,
  DAILY_VOLUME_COMPLETED_SERIES,
  DAILY_VOLUME_EMPTY_MESSAGE,
  DAILY_VOLUME_MIN_DRAWN_SHARE,
  DAILY_VOLUME_TOTAL_SERIES,
  DAILY_VOLUME_UNPRODUCTIVE_SERIES,
  dailySeriesCoincide,
  dailyVolumeDrawnBars,
  dailyVolumeFromChartClick,
  dailyVolumeFromDayIndex,
  dailyVolumeStatusNote,
  dailyVolumeSubtitle,
  dailyVolumeTooltipTitle,
  makeDailyVolumeOptions,
  makeDailyVolumeTooltipFormatter,
  QUANTITY_AXIS_MIN_MAX,
  quantityAxisMax,
  SINGLE_DAY_RATE_SYMBOL_RING,
  SINGLE_DAY_RATE_SYMBOL_SIZE,
  weekdayOfISO,
} from './overviewDailyChartOptions'

const labels = ['17/05', '18/05', '19/05']
/** As mesmas datas por extenso, como os agregados publicam em `iso`. */
const isoDates = ['2026-05-17', '2026-05-18', '2026-05-19']
const total = [24, 20, 27]
const completed = [20, 15, 24]
/** Contagem de improdutivas do dia, e não mais percentual. */
const unproductive = [3, 4, 1]

function build(theme: 'light' | 'dark' = 'light') {
  return makeDailyVolumeOptions(labels, isoDates, total, completed, unproductive, theme)
}

/**
 * As três séries do gráfico: duas barras de quantidade e a linha de
 * Improdutivas. O tipo é a união das duas porque o painel é um combinado.
 */
type DailySeries = BarSeriesOption & LineSeriesOption

function seriesOf(option: ReturnType<typeof build>): DailySeries[] {
  return option.series as DailySeries[]
}

/** As duas barras de quantidade, na ordem de pintura. */
function barsOf(option: ReturnType<typeof build>): DailySeries[] {
  return seriesOf(option).slice(0, 2)
}

/** A série de Improdutivas, a única em linha. */
function unproductiveOf(option: ReturnType<typeof build>): DailySeries {
  return seriesOf(option)[2]
}

describe('séries do Volume diário de OS', () => {
  it('publica exatamente três séries independentes com os dados recebidos', () => {
    const series = seriesOf(build())

    expect(series).toHaveLength(3)
    expect(series.map((item) => item.name)).toEqual([
      DAILY_VOLUME_TOTAL_SERIES,
      DAILY_VOLUME_COMPLETED_SERIES,
      DAILY_VOLUME_UNPRODUCTIVE_SERIES,
    ])
    expect(series.map((item) => item.name)).toEqual(['Total', 'Concluídas', 'Improdutivas'])
    expect(series[0].data).toEqual(total)
    expect(series[1].data).toEqual(completed)
    // Contagem de OS, e não proporção: nada é multiplicado por cem no caminho.
    expect(series[2].data).toEqual(unproductive)
  })

  it('lê as três séries como quantidade, no mesmo eixo de valor', () => {
    const option = build()

    // Um eixo de valor só. Enquanto Improdutivas era percentual havia um
    // segundo eixo à direita, e ele saiu junto com a taxa.
    expect(Array.isArray(option.yAxis)).toBe(false)
    expect(option.yAxis).toMatchObject({ type: 'value', min: 0 })
    for (const item of seriesOf(option)) {
      expect(item.yAxisIndex).toBeUndefined()
    }
    // Nenhum rótulo de percentual sobrou em canto nenhum da opção.
    expect(JSON.stringify(option)).not.toContain('{value}%')
  })

  it('mantém o eixo de categorias com os rótulos recebidos', () => {
    expect(build().xAxis).toMatchObject({ type: 'category', data: labels })
  })

  it('deixa o eixo X rarear os rótulos sozinho, sem cortar dias nem rolar', () => {
    const xAxis = build().xAxis as { axisLabel: { interval: string; hideOverlap: boolean } }
    const option = build() as Record<string, unknown>

    expect(xAxis.axisLabel.interval).toBe('auto')
    expect(xAxis.axisLabel.hideOverlap).toBe(true)
    // Nada de zoom, escova de navegação ou paginação neste painel.
    expect(option.dataZoom).toBeUndefined()
    expect(option.brush).toBeUndefined()
  })

  it('desenha o período inteiro que recebe, por mais longo que seja', () => {
    // 95 dias é o recorte completo da fonte (06/04 a 21/08): nenhum ponto some.
    const longLabels = Array.from({ length: 95 }, (_, index) => `dia ${index + 1}`)
    const longIso = longLabels.map(() => '2026-08-21')
    const longTotal = longLabels.map((_, index) => index + 1)
    const series = seriesOf(
      makeDailyVolumeOptions(longLabels, longIso, longTotal, longTotal, longTotal, 'light'),
    )

    expect((build().xAxis as { data: string[] }).data).toHaveLength(3)
    for (const item of series) {
      expect(item.data).toHaveLength(95)
    }
  })

  it('desenha Total e Concluídas em barra, e Improdutivas em linha', () => {
    const [totalSeries, completedSeries] = barsOf(build())

    expect(totalSeries.type).toBe('bar')
    expect(completedSeries.type).toBe('bar')
    // A linha atravessa as colunas: uma terceira barra espremida na faixa do
    // dia deixaria de mostrar o desenho do período.
    expect(unproductiveOf(build()).type).toBe('line')
  })

  it('desenha a linha de Improdutivas em segmentos diretos, sem suavização', () => {
    expect(unproductiveOf(build()).smooth).toBe(false)
    // Suavização é assunto de linha: as barras não declaram nada disso.
    for (const item of barsOf(build())) {
      expect(item.smooth).toBeUndefined()
    }
  })

  it('não preenche nada por baixo da linha', () => {
    // Sobre as barras, a área vermelha viraria um véu por cima do volume do dia.
    for (const item of seriesOf(build())) {
      expect(item.areaStyle).toBeUndefined()
    }
  })

  it('não empilha nenhuma série: cada uma parte do próprio chão', () => {
    for (const item of seriesOf(build())) {
      expect(item.stack).toBeUndefined()
    }
  })

  it('usa as cores aprovadas, iguais nos dois temas', () => {
    expect(DAILY_VOLUME_COLORS).toEqual({
      total: '#2f6bff',
      completed: '#16a34a',
      // Vermelho semântico da paleta compartilhada, sem hexadecimal próprio.
      unproductive: executiveCardColors.red,
    })
    expect(DAILY_VOLUME_COLORS.unproductive).toBe('#e5484d')
    // O mesmo vermelho que pinta a barra do status `Improdutiva` nos gráficos
    // de OS: a improdutividade tem uma cor só no portal.
    expect(DAILY_VOLUME_COLORS.unproductive).toBe(statusColors.Improdutiva)

    for (const theme of ['light', 'dark'] as const) {
      const [totalSeries, completedSeries] = barsOf(build(theme))

      // As barras trazem a cor no preenchimento, a linha no traço.
      expect(totalSeries.itemStyle?.color).toBe('#2f6bff')
      expect(completedSeries.itemStyle?.color).toBe('#16a34a')
      expect(unproductiveOf(build(theme)).lineStyle?.color).toBe(executiveCardColors.red)
      expect(unproductiveOf(build(theme)).lineStyle?.width).toBe(2.4)
    }
  })

  it('arredonda só o topo das barras, no mesmo raio para as duas', () => {
    for (const item of barsOf(build())) {
      // Topo arredondado e base reta: a barra nasce colada no eixo.
      expect(item.itemStyle?.borderRadius).toEqual([2, 2, 0, 0])
    }
  })

  it('desenha a linha contínua, sem tracejado nenhum', () => {
    for (const theme of ['light', 'dark'] as const) {
      // Sem `type`: o padrão do ECharts já é a linha sólida.
      expect(unproductiveOf(build(theme)).lineStyle?.type).toBeUndefined()
      expect(JSON.stringify(build(theme))).not.toContain('[5,4]')
    }
  })

  it('não desenha símbolo na linha, nem no repouso nem sob o ponteiro do eixo', () => {
    // `showSymbol: false` não bastaria: com ele o ECharts ainda desenha o
    // símbolo do ponto quando o ponteiro do eixo passa por cima.
    expect(unproductiveOf(build()).symbol).toBe('none')
    expect(unproductiveOf(build()).showSymbol).toBeUndefined()
    for (const item of barsOf(build())) {
      expect(item.symbol).toBeUndefined()
    }
  })

  it('não destaca nada sob o ponteiro do mouse, em nenhuma das três séries', () => {
    for (const item of seriesOf(build())) {
      // Sem isto o ECharts clareia a barra e engrossa a linha no hover, e
      // também ao passar o mouse pela entrada da legenda.
      expect(item.emphasis).toEqual({ disabled: true })
    }
  })
})

describe('barra de Concluídas dentro da barra de Total', () => {
  it('recua a verde uma largura inteira, para as duas encostarem na mesma borda', () => {
    const [totalSeries, completedSeries] = barsOf(build())

    // `-100%` é o recuo de uma largura: a verde volta para o começo da azul e
    // as duas ficam alinhadas pela ESQUERDA, que é o desenho aprovado.
    expect(completedSeries.barGap).toBe(DAILY_VOLUME_BAR_GAP)
    expect(DAILY_VOLUME_BAR_GAP).toBe('-100%')
    // A primeira não desloca nada: ela é a referência de posição do par.
    expect(totalSeries.barGap).toBeUndefined()
  })

  it('mantém a barra de Concluídas mais estreita que a do Total', () => {
    const [totalSeries, completedSeries] = barsOf(build())

    expect(totalSeries.barWidth).toBe(`${DAILY_VOLUME_BAR.total.width}%`)
    expect(completedSeries.barWidth).toBe(`${DAILY_VOLUME_BAR.completed.width}%`)
    // É a diferença de largura que deixa a azul aparecer à direita da verde.
    // Com larguras iguais, a de cima esconderia a de baixo por inteiro.
    expect(DAILY_VOLUME_BAR.completed.width).toBeLessThan(DAILY_VOLUME_BAR.total.width)
    expect(DAILY_VOLUME_BAR.completed.maxWidth).toBeLessThan(DAILY_VOLUME_BAR.total.maxWidth)
    // A barra fica dentro da faixa reservada ao dia, sem invadir a do vizinho.
    expect(DAILY_VOLUME_BAR.total.width).toBeLessThan(100)
  })

  it('deixa a linha de Improdutivas acima das duas barras', () => {
    const [totalSeries, completedSeries] = barsOf(build())

    // Sem `z` próprio a linha sumiria atrás da coluna nos dias de volume alto.
    expect(unproductiveOf(build()).z).toBe(3)
    expect(totalSeries.z).toBeUndefined()
    expect(completedSeries.z).toBeUndefined()
  })

  it('mantém as cores das barras iguais nos dois temas', () => {
    for (const theme of ['light', 'dark'] as const) {
      const [totalSeries, completedSeries] = barsOf(build(theme))

      // Cor é identidade da série, não do fundo: o que se adapta ao tema é o
      // entorno, ou seja eixos, grade, legenda e tooltip.
      expect(totalSeries.itemStyle?.color).toBe(DAILY_VOLUME_COLORS.total)
      expect(completedSeries.itemStyle?.color).toBe(DAILY_VOLUME_COLORS.completed)
    }
  })
})

describe('recorte de um único dia no Volume diário', () => {
  /** Mesma forma do recorte real de 21/08, e dos filtros que deixam uma OS só. */
  function buildSingle(theme: 'light' | 'dark' = 'light') {
    return makeDailyVolumeOptions(['21/08'], ['2026-08-21'], [1], [1], [0], theme)
  }

  it('dá um marcador circular à linha, que sozinha ficaria invisível', () => {
    for (const theme of ['light', 'dark'] as const) {
      const serie = unproductiveOf(buildSingle(theme))

      expect(serie.symbol).toBe('circle')
      expect(serie.symbolSize).toBe(SINGLE_DAY_RATE_SYMBOL_SIZE)
    }
  })

  it('separa o ponto da linha da barra que fica atrás dele', () => {
    const claro = unproductiveOf(buildSingle('light')).itemStyle
    const escuro = unproductiveOf(buildSingle('dark')).itemStyle

    // Anel na cor da superfície do painel, que muda com o tema. A cor do ponto
    // continua sendo a da série nos dois.
    expect(claro?.color).toBe(DAILY_VOLUME_COLORS.unproductive)
    expect(escuro?.color).toBe(DAILY_VOLUME_COLORS.unproductive)
    expect(claro?.borderColor).toBe('#ffffff')
    expect(escuro?.borderColor).toBe('#1f2937')
    expect(claro?.borderWidth).toBe(SINGLE_DAY_RATE_SYMBOL_RING)
    // Descontado o anel dos dois lados, ainda sobra miolo vermelho.
    expect(SINGLE_DAY_RATE_SYMBOL_SIZE - 2 * SINGLE_DAY_RATE_SYMBOL_RING).toBeGreaterThanOrEqual(6)
  })

  it('não precisa de marcador nas quantidades, que já são barras', () => {
    for (const item of barsOf(buildSingle())) {
      expect(item.type).toBe('bar')
      expect(item.symbol).toBeUndefined()
    }
  })

  it('limita a largura das barras para o dia único não virar um bloco', () => {
    const [totalSeries, completedSeries] = barsOf(buildSingle())

    // Com um dia só a faixa do eixo é o painel inteiro, e sem teto a barra
    // iria de parede a parede.
    expect(totalSeries.barMaxWidth).toBe(DAILY_VOLUME_BAR.total.maxWidth)
    expect(completedSeries.barMaxWidth).toBe(DAILY_VOLUME_BAR.completed.maxWidth)
  })

  it('reserva a faixa do dia em qualquer recorte, para a barra caber inteira', () => {
    for (const option of [buildSingle(), build()]) {
      expect((option.xAxis as { boundaryGap: boolean }).boundaryGap).toBe(true)
    }
  })

  it('não inventa barra nem segmento entre datas que não existem', () => {
    for (const item of seriesOf(buildSingle())) {
      expect(item.data).toHaveLength(1)
    }
    expect(barsOf(buildSingle())[0].data).toEqual([1])
  })

  it('volta ao comportamento normal, sem símbolo, com duas ou mais datas', () => {
    const two = makeDailyVolumeOptions(
      ['20/08', '21/08'],
      ['2026-08-20', '2026-08-21'],
      [2, 1],
      [1, 1],
      [1, 0],
      'light',
    )

    expect(unproductiveOf(two).symbol).toBe('none')
    expect(unproductiveOf(two).symbolSize).toBeUndefined()
  })

  it('só o ponto do dia único recebe clique; a linha deixa o clique passar', () => {
    // Com duas ou mais datas o traço vermelho engoliria o clique no fundo da
    // coluna, perto do chão, onde ficam os dias fracos.
    expect(unproductiveOf(build()).silent).toBe(true)
    // O ponto do dia único abre as improdutivas daquele dia.
    expect(unproductiveOf(buildSingle()).silent).toBeUndefined()
    for (const item of barsOf(build())) {
      expect(item.silent).toBeUndefined()
    }
  })
})

describe('coincidência entre Total e Concluídas', () => {
  it('reconhece as duas séries integralmente iguais, e só com dados', () => {
    expect(dailySeriesCoincide([4, 2, 7], [4, 2, 7])).toBe(true)
    expect(dailySeriesCoincide([1], [1])).toBe(true)
    // Recorte vazio não tem coincidência a explicar.
    expect(dailySeriesCoincide([], [])).toBe(false)
  })

  it('não acusa coincidência com qualquer dia diferente ou coleção descasada', () => {
    expect(dailySeriesCoincide([4, 2, 7], [4, 2, 6])).toBe(false)
    expect(dailySeriesCoincide([4, 2], [4, 2, 7])).toBe(false)
    expect(dailySeriesCoincide([4, 2, 7], [4, 2])).toBe(false)
  })

  it('usa o texto neutro aprovado, sem esconder série nem deslocar valor', () => {
    expect(DAILY_VOLUME_COINCIDENT_MESSAGE).toBe('Total e Concluídas coincidem neste recorte')
  })
})

describe('nota do painel diário com status filtrado', () => {
  it('com Concluída, a nota é a coincidência de sempre', () => {
    expect(dailyVolumeStatusNote('Concluída')).toBe(DAILY_VOLUME_COINCIDENT_MESSAGE)
  })

  it('com Improdutiva, explica o zero das Concluídas e o Total repetido', () => {
    // A série deixou de ser taxa, então a nota não fala mais em 100%.
    expect(dailyVolumeStatusNote('Improdutiva')).toBe(
      'Recorte limitado ao status Improdutiva: Concluídas fica em 0 e ' +
        'Improdutivas repete o Total por definição',
    )
  })

  it('com qualquer outro status, explica os zeros por definição, nomeando o status', () => {
    for (const status of ['Encerrada', 'Expirada', 'Pendente de Aprovação']) {
      const nota = dailyVolumeStatusNote(status)

      expect(nota).toBe(
        `Recorte limitado ao status ${status}: Concluídas e Improdutivas ficam em 0 por definição`,
      )
      // Sem travessão em texto de interface, como em todo o portal.
      expect(nota).not.toContain('—')
      expect(nota).not.toContain('–')
    }
  })
})

describe('teto do eixo de quantidade', () => {
  it('arredonda o pico para uma escala legível', () => {
    // Os dois casos aprovados: o pico do recorte padrão e um recorte médio.
    expect(quantityAxisMax([48, 71, 86, 74])).toBe(100)
    expect(quantityAxisMax([24, 20, 27])).toBe(30)
    // Passo sempre da família 1, 2, 5 e 10 vezes potências de dez.
    expect(quantityAxisMax([7])).toBe(8)
    expect(quantityAxisMax([13])).toBe(15)
    expect(quantityAxisMax([25])).toBe(25)
    expect(quantityAxisMax([4465])).toBe(5000)
  })

  it('nunca corta o maior valor do recorte', () => {
    const recortes = [[1], [5], [9], [46], [67], [86], [98, 12, 74], [4465]]

    for (const valores of recortes) {
      const teto = quantityAxisMax(valores)

      expect(teto).toBeGreaterThanOrEqual(Math.max(...valores))
      expect(Number.isFinite(teto)).toBe(true)
      expect(teto).toBeGreaterThan(0)
    }
  })

  it('é determinística: mesmas coleções, mesmo teto', () => {
    for (const valores of [[86, 12], [27], [1], []]) {
      expect(quantityAxisMax(valores)).toBe(quantityAxisMax(valores))
    }
  })

  it('devolve escala válida para recorte vazio ou zerado', () => {
    expect(quantityAxisMax([])).toBe(QUANTITY_AXIS_MIN_MAX)
    expect(quantityAxisMax([0, 0, 0])).toBe(QUANTITY_AXIS_MIN_MAX)
    expect(QUANTITY_AXIS_MIN_MAX).toBeGreaterThan(0)
    // Volume mínimo também não gera eixo degenerado com marcas fracionárias.
    expect(quantityAxisMax([1])).toBe(QUANTITY_AXIS_MIN_MAX)
  })

  it('ignora valores negativos e não finitos, sem NaN nem Infinity', () => {
    for (const valores of [
      [Number.NaN],
      [Number.POSITIVE_INFINITY],
      [Number.NEGATIVE_INFINITY],
      [-30, -5],
      [Number.NaN, 27, Number.POSITIVE_INFINITY],
    ]) {
      const teto = quantityAxisMax(valores)

      expect(Number.isFinite(teto)).toBe(true)
      expect(teto).toBeGreaterThan(0)
    }
    // O valor representável do meio ainda manda na escala.
    expect(quantityAxisMax([Number.NaN, 27, Number.POSITIVE_INFINITY])).toBe(30)
  })

  it('cai em Concluídas apenas quando Total não tem valor representável', () => {
    // As outras séries são subconjunto do Total: em operação normal ele basta.
    expect(quantityAxisMax([86, 40], [70, 30])).toBe(100)
    expect(quantityAxisMax([], [24, 20, 27])).toBe(30)
    expect(quantityAxisMax([Number.NaN], [24, 20, 27])).toBe(30)
    expect(quantityAxisMax([], [])).toBe(QUANTITY_AXIS_MIN_MAX)
  })

  it('escala o eixo de zero até o teto do Total do recorte', () => {
    const quantity = build().yAxis as { min: number; max: number }

    expect(quantity.min).toBe(0)
    // Pico de 27 no recorte de teste: teto legível em 30.
    expect(quantity.max).toBe(quantityAxisMax(total, completed))
    expect(quantity.max).toBe(30)
  })

  it('mantém a escala idêntica nos dois temas e em recortes iguais', () => {
    const claro = build('light').yAxis as { max: number }
    const escuro = build('dark').yAxis as { max: number }

    expect(claro.max).toBe(escuro.max)
    // A opção é montada de novo a cada render: mesmo recorte, mesmo eixo. É o
    // que garante que ligar ou desligar séries na legenda não reescale nada.
    expect(build().yAxis).toEqual(build().yAxis)
  })

  it('acompanha os DADOS: outro recorte, outro teto', () => {
    const pequeno = makeDailyVolumeOptions(['01/08'], ['2026-08-01'], [4], [3], [1], 'light')
      .yAxis as { max: number }
    const grande = makeDailyVolumeOptions(['01/08'], ['2026-08-01'], [86], [70], [8], 'light')
      .yAxis as { max: number }

    // Recorte pequeno não é achatado por um teto global, e o grande não é
    // cortado: cada um recebe a própria escala.
    expect(pequeno.max).toBeLessThan(grande.max)
    expect(grande.max).toBe(100)
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
    // Em painel estreito a caixa fica contida em vez de vazar.
    expect(tooltip.confine).toBe(true)
  })

  it('marca o dia consultado com a faixa da coluna, e não com uma linha', () => {
    const { tooltip } = build() as { tooltip: { axisPointer: { type: string } } }

    // Com barras, a linha vertical cortaria a coluna ao meio.
    expect(tooltip.axisPointer.type).toBe('shadow')
  })
})

describe('dia da semana no tooltip', () => {
  it('devolve o dia da semana em português de uma data completa', () => {
    // 17/05/2026 foi um domingo, e 18/05/2026 uma segunda.
    expect(weekdayOfISO('2026-05-17')).toBe('domingo')
    expect(weekdayOfISO('2026-05-18')).toBe('segunda')
    expect(weekdayOfISO('2026-08-21')).toBe('sexta')
    expect(weekdayOfISO('2026-08-22')).toBe('sábado')
  })

  it('não desloca o dia por causa de fuso horário', () => {
    // O parse por `new Date('2026-05-18')` seria interpretado como UTC e, no
    // nosso fuso, cairia no dia anterior: a segunda viraria domingo.
    expect(weekdayOfISO('2026-05-18')).not.toBe(weekdayOfISO('2026-05-17'))
    expect(weekdayOfISO('2026-01-01')).toBe('quinta')
  })

  it('devolve vazio para texto fora do formato ou data que não existe', () => {
    for (const entrada of ['', '18/05/2026', '2026-5-18', 'ontem', '2026-02-30', '2026-13-01']) {
      expect(weekdayOfISO(entrada)).toBe('')
    }
  })

  it('escreve o dia da semana antes da data, e só a data quando não dá para saber', () => {
    // O dia da semana abre o título, então leva maiúscula (pedido de 24/09/2026).
    expect(dailyVolumeTooltipTitle('18/05', '2026-05-18')).toBe('Segunda, 18/05')
    expect(dailyVolumeTooltipTitle('22/08', '2026-08-22')).toBe('Sábado, 22/08')
    // Sem data completa o título não inventa nada nem mostra vírgula solta.
    expect(dailyVolumeTooltipTitle('18/05', undefined)).toBe('18/05')
    expect(dailyVolumeTooltipTitle('18/05', 'data inválida')).toBe('18/05')
  })
})

describe('conteúdo do tooltip', () => {
  const formatDailyVolumeTooltip = makeDailyVolumeTooltipFormatter(isoDates)
  const params = [
    {
      axisValueLabel: '18/05',
      dataIndex: 1,
      marker: '<span></span>',
      seriesName: 'Total',
      value: 68,
    },
    {
      axisValueLabel: '18/05',
      dataIndex: 1,
      marker: '<span></span>',
      seriesName: 'Concluídas',
      value: 52,
    },
    {
      axisValueLabel: '18/05',
      dataIndex: 1,
      marker: '<span></span>',
      seriesName: 'Improdutivas',
      value: 8,
    },
  ]

  it('mostra o dia com o dia da semana e os três valores', () => {
    const html = formatDailyVolumeTooltip(params)

    expect(html).toContain('Segunda, 18/05')
    expect(html).toContain('Total')
    expect(html).toContain('>68<')
    expect(html).toContain('Concluídas')
    expect(html).toContain('>52<')
    expect(html).toContain('Improdutivas')
    expect(html).toContain('>8<')
  })

  it('não mostra percentual em lugar nenhum: as três séries contam OS', () => {
    expect(formatDailyVolumeTooltip(params)).not.toContain('%')
  })

  it('mantém a ordem das séries, que é a do desenho e a da legenda', () => {
    const html = formatDailyVolumeTooltip(params)

    expect(html.indexOf('Total')).toBeLessThan(html.indexOf('Concluídas'))
    expect(html.indexOf('Concluídas')).toBeLessThan(html.indexOf('Improdutivas'))
  })

  it('não acrescenta comparação nem leitura que o gráfico não tem', () => {
    const html = formatDailyVolumeTooltip(params)

    expect(html).not.toMatch(/período anterior/)
    expect(html).not.toMatch(/média/i)
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
  })

  it('formata a quantidade no padrão brasileiro de milhar', () => {
    const html = formatDailyVolumeTooltip([
      { axisValueLabel: '18/05', dataIndex: 1, seriesName: 'Total', value: 1248 },
    ])

    expect(html).toContain('1.248')
  })

  it('descarta a linha do dia sem valor representável', () => {
    const html = formatDailyVolumeTooltip([
      { axisValueLabel: '18/05', dataIndex: 1, seriesName: 'Total', value: 68 },
      { axisValueLabel: '18/05', dataIndex: 1, seriesName: 'Improdutivas', value: null },
    ])

    expect(html).toContain('Total')
    expect(html).not.toContain('Improdutivas')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
  })

  it('mostra só a data quando o índice não casa com nenhuma data conhecida', () => {
    const html = formatDailyVolumeTooltip([
      { axisValueLabel: '30/12', dataIndex: 99, seriesName: 'Total', value: 3 },
    ])

    // Índice fora da coleção não pode virar dia da semana errado.
    expect(html).toContain('30/12')
    expect(html).not.toContain(',')
  })

  it('sobrevive a parâmetro fora do formato esperado', () => {
    expect(formatDailyVolumeTooltip(null)).not.toContain('undefined')
    // Sem linha nenhuma, a caixa nem abre: sobraria só um título vazio.
    expect(formatDailyVolumeTooltip([])).toBe('')
  })

  it('não lista série zerada no dia: nenhum tooltip do portal mostra zero', () => {
    const html = formatDailyVolumeTooltip([
      { axisValueLabel: '18/05', dataIndex: 1, seriesName: 'Total', value: 12 },
      { axisValueLabel: '18/05', dataIndex: 1, seriesName: 'Concluídas', value: 0 },
      { axisValueLabel: '18/05', dataIndex: 1, seriesName: 'Improdutivas', value: 0 },
    ])

    expect(html).toContain('>12<')
    expect(html).not.toContain('Concluídas')
    expect(html).not.toContain('Improdutivas')
  })
})

describe('adaptação ao tema', () => {
  it('troca eixos, grade, legenda, tooltip e ponteiro entre os temas', () => {
    const light: unknown = build('light')
    const dark: unknown = build('dark')
    const read = (option: unknown, path: string) =>
      path
        .split('.')
        .reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], option)

    for (const path of [
      'xAxis.axisLabel.color',
      'xAxis.axisLine.lineStyle.color',
      'yAxis.splitLine.lineStyle.color',
      'yAxis.axisLabel.color',
      'legend.textStyle.color',
      'tooltip.backgroundColor',
      'tooltip.textStyle.color',
      'tooltip.axisPointer.shadowStyle.color',
    ]) {
      expect(read(light, path)).not.toBe(read(dark, path))
      expect(read(light, path)).toBeTypeOf('string')
      expect(read(dark, path)).toBeTypeOf('string')
    }
  })

  it('mantém as três séries na legenda nos dois temas', () => {
    for (const theme of ['light', 'dark'] as const) {
      const legend = build(theme).legend as { data?: unknown }

      // Sem lista própria: a legenda sai das séries, na ordem em que elas são
      // desenhadas, então nome e ordem não têm como divergir do gráfico.
      expect(legend.data).toBeUndefined()
      expect(seriesOf(build(theme)).map((item) => item.name)).toEqual([
        DAILY_VOLUME_TOTAL_SERIES,
        DAILY_VOLUME_COMPLETED_SERIES,
        DAILY_VOLUME_UNPRODUCTIVE_SERIES,
      ])
    }
  })

  it('usa o mesmo ponto redondo nas três entradas da legenda', () => {
    for (const theme of ['light', 'dark'] as const) {
      const legend = build(theme).legend as {
        icon: string
        itemWidth: number
        itemHeight: number
      }

      expect(legend.icon).toBe('circle')
      expect(legend.itemWidth).toBe(9)
      expect(legend.itemHeight).toBe(9)
    }
  })

  it('não deixa o anel do marcador encolher o ponto vermelho da legenda', () => {
    for (const theme of ['light', 'dark'] as const) {
      const legend = build(theme).legend as { itemStyle: { borderWidth: number } }

      // A legenda herda o `itemStyle` da série, e o anel comeria a borda de um
      // ícone de 9 px: o ponto vermelho sairia menor que o azul e o verde.
      expect(legend.itemStyle.borderWidth).toBe(0)
      expect(unproductiveOf(build(theme)).itemStyle?.borderWidth).toBeGreaterThan(0)
    }
  })
})

describe('descrição acessível do Volume diário', () => {
  it('cita as três séries na ordem visual, todas como quantidade', () => {
    const aria = build().aria as { enabled: boolean; label: { description: string } }
    const description = aria.label.description

    expect(aria.enabled).toBe(true)
    expect(description).toBe(
      'Volume diário de OS. 3 dias com OS, de 17/05 a 19/05. ' +
        'Total: quantidade de OS, de 20 a 27 por dia, 71 no período. ' +
        'Concluídas: quantidade de OS, de 15 a 24 por dia, 59 no período. ' +
        'Improdutivas: quantidade de OS, de 1 a 4 por dia, 8 no período.',
    )
    // A ordem anunciada é a mesma do desenho e da legenda.
    expect(description.indexOf('Total:')).toBeLessThan(description.indexOf('Concluídas:'))
    expect(description.indexOf('Concluídas:')).toBeLessThan(description.indexOf('Improdutivas:'))
  })

  it('não anuncia percentual: o painel deixou de ter taxa', () => {
    const description = buildDailyVolumeDescription(labels, total, completed, unproductive)

    expect(description).not.toContain('%')
    expect(description).not.toContain('undefined')
    expect(description).not.toContain('NaN')
    expect(description).not.toContain('Infinity')
  })

  it('descreve o recorte de um dia só no singular', () => {
    expect(buildDailyVolumeDescription(['21/08'], [74], [55], [6])).toContain(
      '1 dia com OS, em 21/08',
    )
  })

  it('descreve o recorte sem nenhum dia com OS', () => {
    const aria = makeDailyVolumeOptions([], [], [], [], [], 'dark').aria as {
      label: { description: string }
    }

    expect(aria.label.description).toBe(`Volume diário de OS. ${DAILY_VOLUME_EMPTY_MESSAGE}.`)
  })
})

describe('entrada vazia ou inválida do Volume diário', () => {
  it('não inventa barra nem ponto quando o recorte não tem dias', () => {
    const option = makeDailyVolumeOptions([], [], [], [], [], 'light')
    const serialized = JSON.stringify(option)

    for (const item of seriesOf(option)) {
      expect(item.data).toEqual([])
    }
    expect(serialized).not.toContain('NaN')
    expect(serialized).not.toContain('Infinity')
    expect(serialized).not.toContain('undefined')
  })

  it('vira lacuna, e não zero, no dia sem valor representável', () => {
    const option = makeDailyVolumeOptions(
      labels,
      isoDates,
      total,
      completed,
      // Coleção curta e valor inválido: nenhum dos dois pode virar 0.
      [Number.NaN],
      'light',
    )

    expect(unproductiveOf(option).data).toEqual([null, null, null])
    expect(JSON.stringify(option)).not.toContain('NaN')
  })

  it('mantém um ponto por rótulo mesmo com a coleção mais longa que o eixo', () => {
    const option = makeDailyVolumeOptions(
      labels,
      isoDates,
      total,
      completed,
      [1, 2, 3, 4, 5],
      'light',
    )

    expect(unproductiveOf(option).data).toEqual([1, 2, 3])
  })
})

describe('altura mínima do dia fraco', () => {
  // Pico de 300 OS: teto 300, mínimo de 3% = 9 OS de altura.
  const fraco = { total: [300, 2, 0, 20], completed: [250, 1, 0, 1] }

  it('sobe o Total do dia fraco ao mínimo e leva a verde junto, na mesma proporção', () => {
    const drawn = dailyVolumeDrawnBars(fraco.total, fraco.completed, 300)
    const piso = 300 * DAILY_VOLUME_MIN_DRAWN_SHARE

    expect(drawn.total[1]).toBeCloseTo(piso, 6)
    expect(drawn.completed[1]).toBeCloseTo(piso / 2, 6)
  })

  it('não mexe no dia acima do mínimo, nem dá mínimo próprio à verde', () => {
    const drawn = dailyVolumeDrawnBars(fraco.total, fraco.completed, 300)

    // 1 concluída em 20 continua 1: subir só a verde faria o dia parecer
    // muito mais concluído do que foi.
    expect(drawn.total[0]).toBe(300)
    expect(drawn.completed[0]).toBe(250)
    expect(drawn.total[3]).toBe(20)
    expect(drawn.completed[3]).toBe(1)
  })

  it('dia sem OS continua sem barra', () => {
    const drawn = dailyVolumeDrawnBars(fraco.total, fraco.completed, 300)

    expect(drawn.total[2]).toBe(0)
    expect(drawn.completed[2]).toBe(0)
  })

  it('desenha as alturas mínimas e mostra no tooltip a quantidade real', () => {
    const dias = ['01/09', '02/09', '03/09', '04/09']
    const datas = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']
    const option = makeDailyVolumeOptions(dias, datas, fraco.total, fraco.completed, [0, 0, 0, 0], 'light')
    const series = option.series as BarSeriesOption[]
    const formatter = (option.tooltip as { formatter: (params: unknown) => string }).formatter
    const html = formatter([
      { axisValueLabel: '02/09', dataIndex: 1, seriesName: DAILY_VOLUME_TOTAL_SERIES, value: 9 },
      { axisValueLabel: '02/09', dataIndex: 1, seriesName: DAILY_VOLUME_COMPLETED_SERIES, value: 4.5 },
    ])

    expect((series[0].data as number[])[1]).toBeCloseTo(9, 6)
    expect(html).toMatch(/Total<\/span><span[^>]*>2</)
    expect(html).toMatch(/Concluídas<\/span><span[^>]*>1</)
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

describe('clique num dia', () => {
  const day = { x: labels, iso: isoDates, total, completed, unproductive }

  it('a barra azul abre o Total do dia e a verde as Concluídas, pelo nome da série', () => {
    expect(
      dailyVolumeFromChartClick(day, { componentType: 'series', seriesName: DAILY_VOLUME_TOTAL_SERIES, dataIndex: 1 }),
    ).toEqual({ date: '2026-05-18', series: null })
    expect(
      dailyVolumeFromChartClick(day, {
        componentType: 'series',
        seriesName: DAILY_VOLUME_COMPLETED_SERIES,
        dataIndex: 2,
      }),
    ).toEqual({ date: '2026-05-19', series: 'completed' })
    // O ponto de Improdutivas só existe no recorte de um dia, e abre as improdutivas.
    expect(
      dailyVolumeFromChartClick(day, {
        componentType: 'series',
        seriesName: DAILY_VOLUME_UNPRODUCTIVE_SERIES,
        dataIndex: 0,
      }),
    ).toEqual({ date: '2026-05-17', series: 'unproductive' })
  })

  it('o nome do dia no eixo abre o Total daquele dia', () => {
    expect(dailyVolumeFromChartClick(day, { componentType: 'xAxis', value: '18/05' })).toEqual({
      date: '2026-05-18',
      series: null,
    })
  })

  it('série zerada no dia, dia fora do eixo ou clique fora de barra não abrem nada', () => {
    const semConcluidas = { ...day, completed: [0, 15, 24] }

    expect(
      dailyVolumeFromChartClick(semConcluidas, {
        componentType: 'series',
        seriesName: DAILY_VOLUME_COMPLETED_SERIES,
        dataIndex: 0,
      }),
    ).toBeNull()
    expect(dailyVolumeFromChartClick(day, { componentType: 'xAxis', value: '01/01' })).toBeNull()
    expect(dailyVolumeFromChartClick(day, { componentType: 'legend' })).toBeNull()
    expect(dailyVolumeFromChartClick(day, null)).toBeNull()
  })

  it('o nome do dia no eixo recebe o clique', () => {
    expect((build().xAxis as { triggerEvent?: boolean }).triggerEvent).toBe(true)
  })

  it('o fundo da coluna abre o Total do dia daquela posição', () => {
    expect(dailyVolumeFromDayIndex(day, 0)).toEqual({ date: '2026-05-17', series: null })
    expect(dailyVolumeFromDayIndex(day, 2)).toEqual({ date: '2026-05-19', series: null })
  })

  it('posição fora dos dias do recorte, ou dia sem OS, não abre nada', () => {
    // Na borda direita exata da grade o ECharts arredonda para além do último dia.
    expect(dailyVolumeFromDayIndex(day, 3)).toBeNull()
    expect(dailyVolumeFromDayIndex(day, -1)).toBeNull()
    expect(dailyVolumeFromDayIndex({ ...day, total: [0, 20, 27] }, 0)).toBeNull()
  })
})

describe('subtítulo do painel', () => {
  it('sem nota, o convite ao clique vira o subtítulo, com maiúscula', () => {
    expect(dailyVolumeSubtitle(undefined, true, 3)).toBe(
      'Clique numa barra ou no dia para ver as OS',
    )
  })

  it('com nota do recorte, o convite vem depois dela', () => {
    expect(dailyVolumeSubtitle(DAILY_VOLUME_COINCIDENT_MESSAGE, true, 3)).toBe(
      `${DAILY_VOLUME_COINCIDENT_MESSAGE} · ${DAILY_VOLUME_CLICK_HINT}`,
    )
  })

  it('com a lista desligada ou sem dia nenhum, nada de convite', () => {
    expect(dailyVolumeSubtitle(undefined, false, 3)).toBeUndefined()
    expect(dailyVolumeSubtitle(undefined, true, 0)).toBeUndefined()
    expect(dailyVolumeSubtitle(DAILY_VOLUME_COINCIDENT_MESSAGE, false, 3)).toBe(
      DAILY_VOLUME_COINCIDENT_MESSAGE,
    )
  })
})
