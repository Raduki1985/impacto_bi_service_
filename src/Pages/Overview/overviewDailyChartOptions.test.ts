import type { LineSeriesOption, YAXisComponentOption } from 'echarts'
import { describe, expect, it } from 'vitest'

import { makeLineOptions } from '../../components/charts/chartOptions'
import { executiveCardColors } from '../../components/dashboard/executiveMetricCardModel'
import { statusColors } from '../../data/dashboardAggregates'
import {
  buildDailyVolumeDescription,
  DAILY_VOLUME_COINCIDENT_MESSAGE,
  DAILY_VOLUME_COLORS,
  DAILY_VOLUME_COMPLETED_SERIES,
  DAILY_VOLUME_EMPTY_MESSAGE,
  DAILY_VOLUME_TOTAL_SERIES,
  DAILY_VOLUME_UNPRODUCTIVE_SERIES,
  dailySeriesCoincide,
  dailyVolumeStatusNote,
  formatDailyVolumeTooltip,
  makeDailyVolumeOptions,
  QUANTITY_AXIS_MIN_MAX,
  quantityAxisMax,
  SINGLE_DAY_SYMBOL_SIZES,
  withAlpha,
} from './overviewDailyChartOptions'

const labels = ['17/05', '18/05', '19/05']
const total = [24, 20, 27]
const completed = [20, 15, 24]
/** Proporção de 0 a 1, exatamente a forma publicada pelos agregados. */
const unproductiveRate = [0.125, 0.2, 0.05]
/** A mesma taxa na escala do eixo direito, em pontos percentuais. */
const ratePoints = [12.5, 20, 5]

function build(theme: 'light' | 'dark' = 'light') {
  return makeDailyVolumeOptions(labels, total, completed, unproductiveRate, theme)
}

/** As três séries do gráfico, já tipadas como linha. */
function seriesOf(option: ReturnType<typeof build>): LineSeriesOption[] {
  return option.series as LineSeriesOption[]
}

/** Os dois eixos de valor, na ordem em que a opção os declara. */
function axesOf(option: ReturnType<typeof build>): YAXisComponentOption[] {
  return option.yAxis as YAXisComponentOption[]
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
    expect(series.map((item) => item.name)).toEqual([
      'Total',
      'Concluídas',
      'Taxa de improdutividade',
    ])
    expect(series[0].data).toEqual(total)
    expect(series[1].data).toEqual(completed)
    // A taxa entra como proporção e é desenhada em pontos percentuais, que é
    // a escala do eixo direito. A proporção crua não vai para o gráfico.
    expect(series[2].data).toEqual(ratePoints)
  })

  it('mantém o eixo de categorias com os rótulos recebidos', () => {
    const option = build()

    expect(option.xAxis).toMatchObject({ type: 'category', data: labels })
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
    const longTotal = longLabels.map((_, index) => index + 1)
    const longRate = longLabels.map(() => 0.1)
    const series = seriesOf(
      makeDailyVolumeOptions(longLabels, longTotal, longTotal, longRate, 'light'),
    )

    expect((build().xAxis as { data: string[] }).data).toHaveLength(3)
    for (const item of series) {
      expect(item.data).toHaveLength(95)
    }
  })

  it('desenha segmentos diretos, sem suavização', () => {
    for (const item of seriesOf(build())) {
      expect(item.smooth).toBe(false)
    }
  })

  it('não empilha nenhuma série: cada eixo tem a própria leitura', () => {
    for (const item of seriesOf(build())) {
      expect(item.stack).toBeUndefined()
    }
  })

  it('preenche as três séries, cada uma a partir do chão do próprio eixo', () => {
    for (const item of seriesOf(build())) {
      expect(item.areaStyle).toBeDefined()
      // `origin` fica no padrão do ECharts, que preenche até o começo do eixo
      // da série: zero à esquerda para as quantidades e 0% à direita para a
      // taxa. Nenhuma série empilha a área na de baixo.
      expect(item.areaStyle?.origin).toBeUndefined()
      expect(item.stack).toBeUndefined()
    }
  })

  it('usa as cores aprovadas, iguais nos dois temas', () => {
    expect(DAILY_VOLUME_COLORS).toEqual({
      total: '#2f6bff',
      completed: '#16a34a',
      // Vermelho semântico da paleta compartilhada, sem hexadecimal próprio.
      unproductiveRate: executiveCardColors.red,
    })
    expect(DAILY_VOLUME_COLORS.unproductiveRate).toBe('#e5484d')
    // O mesmo vermelho que pinta a barra do status `Improdutiva` nos gráficos
    // de OS: a improdutividade tem uma cor só no portal.
    expect(DAILY_VOLUME_COLORS.unproductiveRate).toBe(statusColors.Improdutiva)

    for (const theme of ['light', 'dark'] as const) {
      const [totalSeries, completedSeries, rateSeries] = seriesOf(build(theme))

      expect(totalSeries.lineStyle?.color).toBe('#2f6bff')
      expect(completedSeries.lineStyle?.color).toBe('#16a34a')
      expect(rateSeries.lineStyle?.color).toBe(executiveCardColors.red)
      // Mesma espessura nas três: nenhuma série é rebaixada a leitura de apoio.
      expect(totalSeries.lineStyle?.width).toBe(2.4)
      expect(completedSeries.lineStyle?.width).toBe(2.4)
      expect(rateSeries.lineStyle?.width).toBe(2.4)
    }
  })

  it('desenha a improdutividade em linha contínua, sem tracejado nenhum', () => {
    for (const theme of ['light', 'dark'] as const) {
      const series = seriesOf(build(theme))

      // Sem `type`: o padrão do ECharts já é a linha sólida, e nenhuma
      // propriedade extra simula a continuidade.
      for (const item of series) {
        expect(item.lineStyle?.type).toBeUndefined()
      }
      // O padrão [5, 4] do traço anterior não sobrou em canto nenhum da opção.
      expect(JSON.stringify(build(theme))).not.toContain('[5,4]')
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

describe('recorte de um único dia no Volume diário', () => {
  /** Mesma forma do recorte real de 21/08, e dos filtros que deixam uma OS só. */
  function buildSingle(theme: 'light' | 'dark' = 'light') {
    return makeDailyVolumeOptions(['21/08'], [1], [1], [0], theme)
  }

  it('desenha marcadores circulares visíveis nas três séries', () => {
    for (const theme of ['light', 'dark'] as const) {
      const [totalSeries, completedSeries, rateSeries] = seriesOf(buildSingle(theme))

      // Sem segmento de linha para desenhar, o símbolo é o desenho: com
      // `symbol: 'none'` o painel ficava visualmente vazio.
      expect(totalSeries.symbol).toBe('circle')
      expect(completedSeries.symbol).toBe('circle')
      expect(rateSeries.symbol).toBe('circle')
      expect(totalSeries.symbolSize).toBe(SINGLE_DAY_SYMBOL_SIZES.total)
      expect(completedSeries.symbolSize).toBe(SINGLE_DAY_SYMBOL_SIZES.completed)
      expect(rateSeries.symbolSize).toBe(SINGLE_DAY_SYMBOL_SIZES.unproductiveRate)
    }
  })

  it('mantém Total maior que Concluídas para as duas aparecerem sobrepostas', () => {
    // Concluídas é pintada por cima do Total: menor, o ponto verde fica dentro
    // do anel azul quando as duas séries caem na mesma coordenada.
    expect(SINGLE_DAY_SYMBOL_SIZES.completed).toBeLessThan(SINGLE_DAY_SYMBOL_SIZES.total)
  })

  it('centraliza o único dia com a folga do eixo, sem colar na borda esquerda', () => {
    const single = buildSingle().xAxis as { boundaryGap: boolean }
    const multiple = build().xAxis as { boundaryGap: boolean }

    // A folga só entra no recorte de um dia: com duas ou mais datas as linhas
    // continuam encostando nas bordas do painel, como sempre.
    expect(single.boundaryGap).toBe(true)
    expect(multiple.boundaryGap).toBe(false)
  })

  it('não inventa linha nem área entre datas que não existem', () => {
    const [totalSeries] = seriesOf(buildSingle())

    // Um ponto por série, sem vizinho para ligar: o dado continua sendo só o
    // dia recebido, e nenhuma coleção ganha pontos extras.
    for (const item of seriesOf(buildSingle())) {
      expect(item.data).toHaveLength(1)
    }
    expect(totalSeries.data).toEqual([1])
  })

  it('preserva os dois eixos, o tooltip e as cores no recorte de um dia', () => {
    const option = buildSingle()
    const [totalSeries, completedSeries, rateSeries] = seriesOf(option)

    expect(axesOf(option)).toHaveLength(2)
    expect((option.tooltip as { trigger: string }).trigger).toBe('axis')
    expect(totalSeries.itemStyle?.color).toBe(DAILY_VOLUME_COLORS.total)
    expect(completedSeries.itemStyle?.color).toBe(DAILY_VOLUME_COLORS.completed)
    expect(rateSeries.itemStyle?.color).toBe(DAILY_VOLUME_COLORS.unproductiveRate)
  })

  it('volta ao comportamento normal, sem símbolo, com duas ou mais datas', () => {
    const two = seriesOf(makeDailyVolumeOptions(['20/08', '21/08'], [2, 1], [1, 1], [0, 0], 'light'))

    for (const item of two) {
      expect(item.symbol).toBe('none')
      expect(item.symbolSize).toBeUndefined()
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

  it('com Improdutiva, explica o zero das Concluídas e o 100% da taxa', () => {
    expect(dailyVolumeStatusNote('Improdutiva')).toBe(
      'Recorte limitado ao status Improdutiva: Concluídas fica em 0 e a taxa ' +
        'de improdutividade em 100% por definição',
    )
  })

  it('com qualquer outro status, explica os zeros por definição, nomeando o status', () => {
    for (const status of ['Encerrada', 'Expirada', 'Pendente de Aprovação']) {
      const nota = dailyVolumeStatusNote(status)

      expect(nota).toBe(
        `Recorte limitado ao status ${status}: Concluídas e a taxa de ` +
          'improdutividade ficam em 0 por definição',
      )
      // Sem travessão em texto de interface, como em todo o portal.
      expect(nota).not.toContain('—')
      expect(nota).not.toContain('–')
    }
  })
})

describe('áreas sobrepostas do Volume diário', () => {
  type Gradiente = {
    type: string
    x: number
    y: number
    x2: number
    y2: number
    colorStops: { offset: number; color: string }[]
  }

  const gradienteDe = (item: LineSeriesOption): Gradiente =>
    item.areaStyle?.color as unknown as Gradiente

  it('dá gradiente vertical às três séries', () => {
    for (const item of seriesOf(build())) {
      const gradiente = gradienteDe(item)

      expect(gradiente.type).toBe('linear')
      // Vertical: mesma coordenada horizontal no começo e no fim, do topo do
      // desenho até a base.
      expect(gradiente.x).toBe(gradiente.x2)
      expect(gradiente.y).toBe(0)
      expect(gradiente.y2).toBe(1)
      expect(gradiente.colorStops).toHaveLength(2)
      expect(gradiente.colorStops[0].offset).toBe(0)
      expect(gradiente.colorStops[1].offset).toBe(1)
    }
  })

  it('dissolve o preenchimento da linha para a base', () => {
    const opacidadeDe = (cor: string) => Number(cor.slice(cor.lastIndexOf(',') + 1, -1))

    for (const item of seriesOf(build())) {
      const [topo, base] = gradienteDe(item).colorStops

      // Mais presente junto da linha e mais leve perto do eixo: é isso que dá
      // volume à série sem transformar a área num bloco chapado.
      expect(opacidadeDe(topo.color)).toBeGreaterThan(opacidadeDe(base.color))
      expect(opacidadeDe(topo.color)).toBeLessThan(0.5)
      expect(opacidadeDe(base.color)).toBeLessThanOrEqual(0.08)
    }
  })

  it('tinge cada área com a cor oficial da própria série', () => {
    const [totalSeries, completedSeries, rateSeries] = seriesOf(build())

    for (const stop of gradienteDe(totalSeries).colorStops) {
      // Mesmo RGB de `#2f6bff`, só a transparência muda: a área não usa um azul
      // paralelo ao da linha.
      expect(stop.color).toContain('rgba(47,107,255,')
    }
    for (const stop of gradienteDe(completedSeries).colorStops) {
      // Mesmo RGB de `#16a34a`.
      expect(stop.color).toContain('rgba(22,163,74,')
    }
    for (const stop of gradienteDe(rateSeries).colorStops) {
      // Mesmo RGB do vermelho compartilhado, sem hexadecimal repetido aqui.
      expect(stop.color).toContain('rgba(229,72,77,')
      expect(stop.color).toContain(withAlpha(executiveCardColors.red, 1).slice(0, 15))
    }
    expect(withAlpha(DAILY_VOLUME_COLORS.total, 0.3)).toBe('rgba(47,107,255,0.3)')
    expect(withAlpha(DAILY_VOLUME_COLORS.completed, 0.38)).toBe('rgba(22,163,74,0.38)')
    expect(withAlpha(DAILY_VOLUME_COLORS.unproductiveRate, 0.3)).toBe('rgba(229,72,77,0.3)')
  })

  it('dá à área vermelha a mesma intensidade da área azul, em cada tema', () => {
    const opacidadesDe = (item: LineSeriesOption) =>
      gradienteDe(item).colorStops.map((stop) =>
        Number(stop.color.slice(stop.color.lastIndexOf(',') + 1, -1)),
      )

    // Claro e escuro têm valores próprios, mas dentro de cada tema o vermelho
    // acompanha o azul ponto a ponto: as três séries pesam igual no painel.
    const esperado = { light: [0.3, 0.02], dark: [0.34, 0.03] }

    for (const theme of ['light', 'dark'] as const) {
      const [totalSeries, completedSeries, rateSeries] = seriesOf(build(theme))

      expect(opacidadesDe(rateSeries)).toEqual(opacidadesDe(totalSeries))
      expect(opacidadesDe(rateSeries)).toEqual(esperado[theme])
      // O verde continua exatamente como estava, um pouco à frente do azul
      // porque é desenhado por cima dele.
      expect(opacidadesDe(completedSeries)).toEqual(
        theme === 'light' ? [0.38, 0.04] : [0.44, 0.06],
      )
    }
  })

  it('sobrepõe as áreas em vez de empilhá-las', () => {
    const series = seriesOf(build())

    // Concluídas é subconjunto do Total: empilhar somaria as duas alturas e
    // contaria a mesma OS duas vezes.
    for (const item of series) {
      expect(item.stack).toBeUndefined()
    }
    // Ordem de pintura: Total ao fundo, Concluídas por cima, taxa acima das
    // duas áreas. As duas de quantidade partem do mesmo eixo, então a verde
    // fica dentro da azul.
    expect(series.map((item) => item.name)).toEqual([
      DAILY_VOLUME_TOTAL_SERIES,
      DAILY_VOLUME_COMPLETED_SERIES,
      DAILY_VOLUME_UNPRODUCTIVE_SERIES,
    ])
    expect(series[0].yAxisIndex).toBe(series[1].yAxisIndex)
  })

  it('reforça a opacidade no tema escuro para a área não sumir no painel', () => {
    const opacidadeDe = (item: LineSeriesOption) =>
      Number(
        gradienteDe(item).colorStops[0].color.slice(
          gradienteDe(item).colorStops[0].color.lastIndexOf(',') + 1,
          -1,
        ),
      )

    for (const indice of [0, 1, 2]) {
      const claro = opacidadeDe(seriesOf(build('light'))[indice])
      const escuro = opacidadeDe(seriesOf(build('dark'))[indice])

      expect(escuro).toBeGreaterThan(claro)
    }
  })

  it('mantém o verde mais presente que o azul, que fica embaixo dele', () => {
    const opacidadeDe = (item: LineSeriesOption) => {
      const cor = gradienteDe(item).colorStops[0].color
      return Number(cor.slice(cor.lastIndexOf(',') + 1, -1))
    }

    for (const theme of ['light', 'dark'] as const) {
      const [totalSeries, completedSeries] = seriesOf(build(theme))

      expect(opacidadeDe(completedSeries)).toBeGreaterThan(opacidadeDe(totalSeries))
    }
  })

  it('converte a cor oficial em rgba sem inventar canal', () => {
    expect(withAlpha('#000000', 0)).toBe('rgba(0,0,0,0)')
    expect(withAlpha('#ffffff', 1)).toBe('rgba(255,255,255,1)')
    expect(withAlpha(executiveCardColors.red, 0.5)).toBe('rgba(229,72,77,0.5)')
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

    for (const total of recortes) {
      const teto = quantityAxisMax(total)

      expect(teto).toBeGreaterThanOrEqual(Math.max(...total))
      expect(Number.isFinite(teto)).toBe(true)
      expect(teto).toBeGreaterThan(0)
    }
  })

  it('é determinística: mesmas coleções, mesmo teto', () => {
    for (const total of [[86, 12], [27], [1], []]) {
      expect(quantityAxisMax(total)).toBe(quantityAxisMax(total))
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
    for (const total of [
      [Number.NaN],
      [Number.POSITIVE_INFINITY],
      [Number.NEGATIVE_INFINITY],
      [-30, -5],
      [Number.NaN, 27, Number.POSITIVE_INFINITY],
    ]) {
      const teto = quantityAxisMax(total)

      expect(Number.isFinite(teto)).toBe(true)
      expect(teto).toBeGreaterThan(0)
    }
    // O valor representável do meio ainda manda na escala.
    expect(quantityAxisMax([Number.NaN, 27, Number.POSITIVE_INFINITY])).toBe(30)
  })

  it('cai em Concluídas apenas quando Total não tem valor representável', () => {
    // Concluídas é subconjunto do Total: em operação normal o Total já basta.
    expect(quantityAxisMax([86, 40], [70, 30])).toBe(100)
    // Sem Total utilizável, a escala nasce das Concluídas em vez de degenerar.
    expect(quantityAxisMax([], [24, 20, 27])).toBe(30)
    expect(quantityAxisMax([Number.NaN], [24, 20, 27])).toBe(30)
    // Sem nenhuma das duas, o piso seguro.
    expect(quantityAxisMax([], [])).toBe(QUANTITY_AXIS_MIN_MAX)
  })
})

describe('dois eixos de valor do Volume diário', () => {
  it('declara um eixo de quantidades e um de percentual', () => {
    const axes = axesOf(build())

    expect(Array.isArray(axes)).toBe(true)
    expect(axes).toHaveLength(2)
    expect(axes[0].type).toBe('value')
    expect(axes[1].type).toBe('value')
  })

  it('mantém Total e Concluídas na esquerda e a taxa na direita', () => {
    const [totalSeries, completedSeries, rateSeries] = seriesOf(build())

    expect(totalSeries.yAxisIndex).toBe(0)
    expect(completedSeries.yAxisIndex).toBe(0)
    expect(rateSeries.yAxisIndex).toBe(1)
  })

  it('fixa o eixo direito de 0% a 100%, com o sinal de percentual no rótulo', () => {
    const rate = axesOf(build())[1] as {
      min: number
      max: number
      interval: number
      axisLabel: { formatter: string }
    }

    expect(rate.min).toBe(0)
    expect(rate.max).toBe(100)
    expect(rate.axisLabel.formatter).toBe('{value}%')
    // Cinco faixas, o mesmo número de divisões que o eixo de quantidades usa
    // por padrão: os rótulos caem na altura das linhas de grade.
    expect(rate.interval).toBe(20)
  })

  it('escala o eixo esquerdo de zero até o teto do Total do recorte', () => {
    const quantity = axesOf(build())[0] as { min: number; max: number }

    expect(quantity.min).toBe(0)
    // Pico de 27 no recorte de teste: teto legível em 30.
    expect(quantity.max).toBe(quantityAxisMax(total, completed))
    expect(quantity.max).toBe(30)
    expect(quantity.max).toBeGreaterThanOrEqual(Math.max(...total))
  })

  it('mantém a escala esquerda idêntica em todos os temas e recortes iguais', () => {
    const claro = axesOf(build('light'))[0] as { min: number; max: number }
    const escuro = axesOf(build('dark'))[0] as { min: number; max: number }

    expect(claro.max).toBe(escuro.max)
    // A opção é montada de novo a cada render: mesmo recorte, mesmo eixo. É o
    // que garante que ligar ou desligar séries na legenda não reescale nada,
    // porque `min` e `max` explícitos desligam o cálculo automático do ECharts.
    expect(axesOf(build())[0]).toEqual(axesOf(build())[0])
  })

  it('acompanha os DADOS: outro recorte, outro teto', () => {
    const pequeno = axesOf(
      makeDailyVolumeOptions(['01/08'], [4], [3], [0.25], 'light'),
    )[0] as { max: number }
    const grande = axesOf(
      makeDailyVolumeOptions(['01/08'], [86], [70], [0.1], 'light'),
    )[0] as { max: number }

    // Recorte pequeno não é achatado por um teto global, e o grande não é
    // cortado: cada um recebe a própria escala.
    expect(pequeno.max).toBeLessThan(grande.max)
    expect(grande.max).toBe(100)
  })

  it('não duplica a grade: só o eixo das quantidades desenha as horizontais', () => {
    const [quantity, rate] = axesOf(build()) as [
      { splitLine: { lineStyle: { color: string } } },
      { splitLine: { show: boolean } },
    ]

    expect(quantity.splitLine.lineStyle.color).toBeTypeOf('string')
    expect(rate.splitLine.show).toBe(false)
  })

  it('não deixa o eixo direito competir com o de quantidades', () => {
    const [quantity, rate] = axesOf(build()) as [
      { axisLabel: { color: string; fontSize: number } },
      { axisLabel: { color: string; fontSize: number } },
    ]

    // Mesma cor discreta e mesmo tamanho dos rótulos da esquerda.
    expect(rate.axisLabel.color).toBe(quantity.axisLabel.color)
    expect(rate.axisLabel.fontSize).toBe(quantity.axisLabel.fontSize)
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
})

describe('conteúdo do tooltip', () => {
  const params = [
    { axisValueLabel: '18/05', marker: '<span></span>', seriesName: 'Total', value: 68 },
    { axisValueLabel: '18/05', marker: '<span></span>', seriesName: 'Concluídas', value: 52 },
    {
      axisValueLabel: '18/05',
      marker: '<span></span>',
      seriesName: 'Taxa de improdutividade',
      // Pontos percentuais, como a série chega ao eixo direito.
      value: 11.76470588235294,
    },
  ]

  it('mostra a data do ponto e os três valores do dia', () => {
    const html = formatDailyVolumeTooltip(params)

    expect(html).toContain('18/05')
    expect(html).toContain('Total')
    expect(html).toContain('>68<')
    expect(html).toContain('Concluídas')
    expect(html).toContain('>52<')
    expect(html).toContain('Taxa de improdutividade')
    // Percentual brasileiro, com vírgula e uma casa.
    expect(html).toContain('11,8%')
  })

  it('separa quantidade de percentual e nunca mostra a proporção crua', () => {
    const html = formatDailyVolumeTooltip(params)

    // Só a taxa carrega o `%`: as quantidades saem inteiras.
    expect(html.match(/%/g)).toHaveLength(1)
    expect(html).not.toContain('0.117')
    expect(html).not.toContain('68%')
    expect(html).not.toContain('52%')
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
      { axisValueLabel: '18/05', seriesName: 'Total', value: 1248 },
    ])

    expect(html).toContain('1.248')
  })

  it('descarta a linha do dia sem valor representável', () => {
    const html = formatDailyVolumeTooltip([
      { axisValueLabel: '18/05', seriesName: 'Total', value: 68 },
      { axisValueLabel: '18/05', seriesName: 'Taxa de improdutividade', value: null },
    ])

    expect(html).toContain('Total')
    expect(html).not.toContain('Taxa de improdutividade')
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
      'yAxis.0.splitLine.lineStyle.color',
      'yAxis.0.axisLabel.color',
      'yAxis.1.axisLabel.color',
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

      // Um ícone só para a legenda inteira: as três entradas ficam idênticas
      // em forma e tamanho, e só a cor separa uma série da outra.
      expect(legend.icon).toBe('circle')
      expect(legend.itemWidth).toBe(9)
      expect(legend.itemHeight).toBe(9)
    }
  })
})

describe('descrição acessível do Volume diário', () => {
  it('cita as três séries na ordem visual, separando quantidade de percentual', () => {
    const aria = build().aria as { enabled: boolean; label: { description: string } }
    const description = aria.label.description

    expect(aria.enabled).toBe(true)
    expect(description).toBe(
      'Volume diário de OS. 3 dias com OS, de 17/05 a 19/05. ' +
        'Total: quantidade de OS, de 20 a 27 por dia, 71 no período. ' +
        'Concluídas: quantidade de OS, de 15 a 24 por dia, 59 no período. ' +
        'Taxa de improdutividade: percentual das OS do dia, de 5,0% a 20,0%.',
    )
    // A ordem anunciada é a mesma do desenho e da legenda.
    expect(description.indexOf('Total:')).toBeLessThan(description.indexOf('Concluídas:'))
    expect(description.indexOf('Concluídas:')).toBeLessThan(
      description.indexOf('Taxa de improdutividade:'),
    )
  })

  it('não anuncia percentual como quantidade nem quantidade como percentual', () => {
    const description = buildDailyVolumeDescription(labels, total, completed, unproductiveRate)
    const totalPart = description.slice(
      description.indexOf('Total:'),
      description.indexOf('Concluídas:'),
    )
    const ratePart = description.slice(description.indexOf('Taxa de improdutividade:'))

    expect(totalPart).toContain('quantidade de OS')
    expect(totalPart).not.toContain('%')
    expect(ratePart).toContain('percentual')
    expect(ratePart).not.toContain('OS,')
    expect(description).not.toContain('undefined')
    expect(description).not.toContain('NaN')
    expect(description).not.toContain('Infinity')
  })

  it('descreve o recorte de um dia só no singular', () => {
    expect(buildDailyVolumeDescription(['21/08'], [74], [55], [0.081])).toContain(
      '1 dia com OS, em 21/08',
    )
  })

  it('descreve o recorte sem nenhum dia com OS', () => {
    const aria = makeDailyVolumeOptions([], [], [], [], 'dark').aria as {
      label: { description: string }
    }

    expect(aria.label.description).toBe(`Volume diário de OS. ${DAILY_VOLUME_EMPTY_MESSAGE}.`)
  })
})

describe('entrada vazia ou inválida do Volume diário', () => {
  it('não inventa linha nem percentual quando o recorte não tem dias', () => {
    const option = makeDailyVolumeOptions([], [], [], [], 'light')
    const serialized = JSON.stringify(option)

    for (const item of seriesOf(option)) {
      expect(item.data).toEqual([])
    }
    expect(serialized).not.toContain('NaN')
    expect(serialized).not.toContain('Infinity')
    expect(serialized).not.toContain('undefined')
  })

  it('vira lacuna, e não zero, no dia sem taxa representável', () => {
    const option = makeDailyVolumeOptions(
      labels,
      total,
      completed,
      // Coleção curta e valor inválido: nenhum dos dois pode virar 0%.
      [Number.NaN],
      'light',
    )
    const [, , rateSeries] = seriesOf(option)

    expect(rateSeries.data).toEqual([null, null, null])
    expect(JSON.stringify(option)).not.toContain('NaN')
  })

  it('mantém um ponto por rótulo mesmo com a taxa mais longa que o eixo', () => {
    const [, , rateSeries] = seriesOf(
      makeDailyVolumeOptions(labels, total, completed, [0.1, 0.2, 0.3, 0.4, 0.5], 'light'),
    )

    expect(rateSeries.data).toEqual([10, 20, 30])
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
