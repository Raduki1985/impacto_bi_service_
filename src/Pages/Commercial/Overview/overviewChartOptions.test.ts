import { describe, expect, it } from 'vitest'
import type { BarSeriesOption, LineSeriesOption } from 'echarts'

import {
  buildTeamDetail,
  COMMERCIAL_SERIES,
  CORPORATE_SERIES,
  formatOverviewMonthlyTooltip,
  initialMonthlyLegendSelection,
  makeMonthlyAxisLabelFormatter,
  makeOverviewMonthlyOptions,
  makeOverviewTeamOptions,
  MONTHLY_VALUE_SERIES,
  monthlyValueSeries,
  overviewSeriesColor,
  overviewTeamColor,
  resolveMonthlyValueTeams,
} from './overviewChartOptions'
import type { OverviewMonthlyPoint } from './overviewModel'
import type { CommercialMonthKey } from '../../../data/commercialTypes'

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

/** Mesma formatação usada pelo tooltip. Evita depender do separador que o
 *  `Intl` insere entre `R$` e o número, que não é um espaço comum. */
const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

/**
 * Coleção sintética usada apenas no teste, com o mesmo formato de rótulo do
 * modelo (`Jul/26`). A base mockada de produção continua com sete meses.
 */
function makeMonthly(length: number, year = '26'): OverviewMonthlyPoint[] {
  return Array.from({ length }, (_, index) => {
    const commercialValue = 100_000 + index * 1_000
    const corporateValue = 20_000 + index * 500
    return {
      month: `2026-${String(index + 1).padStart(2, '0')}` as CommercialMonthKey,
      label: `${MONTH_LABELS[index]}/${year}`,
      commercialSales: 600 + index * 10,
      corporateSales: 60 + index,
      commercialValue,
      corporateValue,
      monthlyValue: commercialValue + corporateValue,
    }
  })
}

function seriesNames(option: ReturnType<typeof makeOverviewMonthlyOptions>): string[] {
  const series = option.series as (BarSeriesOption | LineSeriesOption)[]
  return series.map((item) => String(item.name))
}

function seriesByName(
  option: ReturnType<typeof makeOverviewMonthlyOptions>,
  name: string,
): BarSeriesOption | LineSeriesOption | undefined {
  const series = option.series as (BarSeriesOption | LineSeriesOption)[]
  return series.find((item) => item.name === name)
}

describe('overviewChartOptions: tooltip mensal', () => {
  it('formata vendas e valor mensal sem expor casas decimais flutuantes', () => {
    const tooltip = formatOverviewMonthlyTooltip([
      { axisValueLabel: 'Jul', seriesName: 'Comercial', value: 795 },
      { axisValueLabel: 'Jul', seriesName: 'Corporativo', value: 88 },
      { axisValueLabel: 'Jul', seriesName: 'Valor mensal', value: 132111.70000000001 },
    ])

    expect(tooltip).toContain('795 vendas')
    expect(tooltip).toContain('88 vendas')
    expect(tooltip).toContain(brl(132111.7))
    expect(tooltip).not.toContain('132111.70000000001')
  })

  it('monta o tooltip sem float, com estrutura previsível e contida', () => {
    const tooltip = formatOverviewMonthlyTooltip([
      { axisValueLabel: 'Jan', seriesName: 'Comercial', value: 600 },
      { axisValueLabel: 'Jan', seriesName: 'Valor mensal', value: 90000 },
    ])

    expect(tooltip).not.toContain('float')
    expect(tooltip).toContain('display:flex')
    expect(tooltip).toContain('justify-content:space-between')
    expect(tooltip).toContain('min-width:150px')
  })

  it('mantém o tooltip confinado ao gráfico em qualquer mês selecionado', () => {
    const option = makeOverviewMonthlyOptions(makeMonthly(12), 'light')

    expect(option.tooltip).toMatchObject({ trigger: 'axis', confine: true })
  })
})

describe('overviewChartOptions: filtro de time no gráfico mensal', () => {
  it('exibe os dois times e o valor mensal consolidado em Todos os times', () => {
    const monthly = makeMonthly(7)
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos')

    expect(seriesNames(option)).toEqual(['Comercial', 'Corporativo', 'Valor mensal'])
    expect(seriesByName(option, 'Valor mensal')?.data).toEqual(
      monthly.map((point) => point.monthlyValue),
    )
  })

  it('exibe somente a série Comercial no filtro Comercial', () => {
    const monthly = makeMonthly(7)
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'comercial')

    expect(seriesNames(option)).toEqual(['Comercial', 'Valor mensal'])
    expect(seriesNames(option)).not.toContain('Corporativo')
    expect(seriesByName(option, 'Comercial')?.data).toEqual(
      monthly.map((point) => point.commercialSales),
    )
    expect(seriesByName(option, 'Valor mensal')?.data).toEqual(
      monthly.map((point) => point.commercialValue),
    )
  })

  it('exibe somente a série Corporativo no filtro Corporativo', () => {
    const monthly = makeMonthly(7)
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'corporativo')

    expect(seriesNames(option)).toEqual(['Corporativo', 'Valor mensal'])
    expect(seriesNames(option)).not.toContain('Comercial')
    expect(seriesByName(option, 'Corporativo')?.data).toEqual(
      monthly.map((point) => point.corporateSales),
    )
    expect(seriesByName(option, 'Valor mensal')?.data).toEqual(
      monthly.map((point) => point.corporateValue),
    )
  })

  it('preserva a cor de cada time mesmo quando uma série é removida', () => {
    const soloCorporate = makeOverviewMonthlyOptions(makeMonthly(7), 'light', 'corporativo')
    const corporate = seriesByName(soloCorporate, 'Corporativo') as BarSeriesOption

    expect(corporate.itemStyle?.color).toBe(overviewSeriesColor('corporativo', 'light'))

    const soloCommercial = makeOverviewMonthlyOptions(makeMonthly(7), 'light', 'comercial')
    const commercial = seriesByName(soloCommercial, 'Comercial') as BarSeriesOption

    expect(commercial.itemStyle?.color).toBe(overviewSeriesColor('comercial', 'light'))
  })
})

describe('overviewChartOptions: legenda do gráfico mensal e valor mensal', () => {
  const monthly = makeMonthly(7)
  const monthlyValueOf = (option: ReturnType<typeof makeOverviewMonthlyOptions>) =>
    seriesByName(option, MONTHLY_VALUE_SERIES)?.data

  it('soma os dois times quando Comercial e Corporativo estão visíveis', () => {
    const option = makeOverviewMonthlyOptions(
      monthly,
      'light',
      'todos',
      initialMonthlyLegendSelection(),
    )

    expect(monthlyValueOf(option)).toEqual(
      monthly.map((point) => point.commercialValue + point.corporateValue),
    )
    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.monthlyValue))
  })

  it('usa somente o valor mensal Comercial quando o Corporativo é desligado na legenda', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: true,
      [CORPORATE_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    })

    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.commercialValue))
    expect(monthlyValueOf(option)).not.toEqual(monthly.map((point) => point.monthlyValue))
  })

  it('usa somente o valor mensal Corporativo quando o Comercial é desligado na legenda', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: false,
      [CORPORATE_SERIES]: true,
      [MONTHLY_VALUE_SERIES]: true,
    })

    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.corporateValue))
  })

  it('não zera a linha sem nenhum time visível: volta ao recorte do filtro', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: false,
      [CORPORATE_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    })

    expect(monthlyValueOf(option)).not.toEqual(monthly.map(() => 0))
    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.monthlyValue))
  })

  it('reflete o estado da legenda no próprio option, para marca e valor não divergirem', () => {
    const selection = {
      [COMMERCIAL_SERIES]: true,
      [CORPORATE_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    }
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', selection)

    expect(option.legend).toMatchObject({ selected: selection })
  })

  it('mantém o tooltip com o mesmo valor da linha recalculada', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: true,
      [CORPORATE_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    })
    const lineData = monthlyValueOf(option) as number[]
    const tooltip = formatOverviewMonthlyTooltip([
      { axisValue: 'Jan/26', seriesName: COMMERCIAL_SERIES, value: monthly[0].commercialSales },
      { axisValue: 'Jan/26', seriesName: MONTHLY_VALUE_SERIES, value: lineData[0] },
    ])

    expect(lineData[0]).toBe(monthly[0].commercialValue)
    expect(tooltip).toContain(brl(monthly[0].commercialValue))
    expect(tooltip).not.toContain(brl(monthly[0].monthlyValue))
  })

  it('soma com segurança uma coleção vazia', () => {
    expect(monthlyValueSeries([], { commercial: true, corporate: true })).toEqual([])
    const option = makeOverviewMonthlyOptions([], 'light', 'todos')
    expect(monthlyValueOf(option)).toEqual([])
  })
})

describe('overviewChartOptions: eixo mensal dinâmico', () => {
  it('aceita a coleção atual de sete meses sem rótulo fixo', () => {
    const monthly = makeMonthly(7)
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos')
    const xAxis = option.xAxis as { data: string[]; axisLabel: { interval: number } }

    expect(xAxis.data).toEqual([
      'Jan/26',
      'Fev/26',
      'Mar/26',
      'Abr/26',
      'Mai/26',
      'Jun/26',
      'Jul/26',
    ])
    expect(xAxis.data).not.toContain('Ago/26')
    expect(xAxis.data).not.toContain('Dez/26')
    expect(xAxis.axisLabel.interval).toBe(0)
  })

  it('aceita uma coleção sintética de doze meses sem alteração estrutural', () => {
    const monthly = makeMonthly(12)
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos')
    const xAxis = option.xAxis as {
      data: string[]
      axisLabel: { interval: number; hideOverlap: boolean }
    }

    expect(xAxis.data).toHaveLength(12)
    expect(xAxis.data[0]).toBe('Jan/26')
    expect(xAxis.data[11]).toBe('Dez/26')
    expect(xAxis.axisLabel.interval).toBe(0)
    expect(xAxis.axisLabel.hideOverlap).toBe(true)
  })

  it('encurta o rótulo do eixo quando toda a coleção é do mesmo ano', () => {
    const sameYear = makeMonthlyAxisLabelFormatter(makeMonthly(12))

    expect(sameYear).toBeTypeOf('function')
    expect(sameYear?.('Jan/26')).toBe('Jan')
    expect(sameYear?.('Dez/26')).toBe('Dez')
  })

  it('preserva o ano no rótulo quando a coleção cruza dois anos', () => {
    const crossYear = [...makeMonthly(7, '26'), ...makeMonthly(5, '27')]

    expect(makeMonthlyAxisLabelFormatter(crossYear)).toBeUndefined()
    expect(makeMonthlyAxisLabelFormatter([])).toBeUndefined()
  })

  it('mantém o mês completo no título do tooltip mesmo com o eixo encurtado', () => {
    const tooltip = formatOverviewMonthlyTooltip([
      { axisValue: 'Dez/26', axisValueLabel: 'Dez', seriesName: 'Comercial', value: 600 },
    ])

    expect(tooltip).toContain('Dez/26')
  })

  it('acompanha a coleção recebida em rótulos e pontos das séries', () => {
    ;[1, 7, 12].forEach((length) => {
      const option = makeOverviewMonthlyOptions(makeMonthly(length), 'light', 'todos')
      const xAxis = option.xAxis as { data: string[] }
      const series = option.series as (BarSeriesOption | LineSeriesOption)[]

      expect(xAxis.data).toHaveLength(length)
      series.forEach((item) => expect(item.data).toHaveLength(length))
    })
  })

  it('adapta a paleta textual do gráfico ao tema', () => {
    const monthly = makeMonthly(7)
    const light = makeOverviewMonthlyOptions(monthly, 'light')
    const dark = makeOverviewMonthlyOptions(monthly, 'dark')

    expect(light).not.toEqual(dark)
    expect(light.series).toHaveLength(3)
    expect(dark.series).toHaveLength(3)
  })
})

describe('overviewChartOptions: Vendas por time', () => {
  const comercial = {
    id: 'comercial',
    label: 'Comercial',
    activeSales: 795,
    monthlyValue: 105_530.5,
    share: 0.9003397508493771,
  }
  const corporativo = {
    id: 'corporativo',
    label: 'Corporativo',
    activeSales: 88,
    monthlyValue: 24_991.2,
    share: 0.0996602491506229,
  }

  it('deriva vendas, participação, ticket médio e valor mensal para leitura fixa', () => {
    const detail = buildTeamDetail(comercial, 'light')

    expect(detail.color).toBe(overviewTeamColor('comercial', 'light'))
    expect(detail.share).toBe('90,0%')
    expect(detail.rows).toEqual([
      { term: 'Vendas ativadas', value: '795' },
      { term: 'Participação', value: '90,0%' },
      { term: 'Ticket médio', value: brl(105_530.5 / 795) },
      { term: 'Valor mensal', value: brl(105_530.5) },
    ])
    expect(detail.accessibleText).toContain('Comercial')
    expect(detail.accessibleText).toContain(`Ticket médio ${brl(105_530.5 / 795)}`)
  })

  it('coloca Ticket médio antes de Valor mensal, com Valor mensal por último', () => {
    const detail = buildTeamDetail(comercial, 'light')
    const terms = detail.rows.map((row) => row.term)

    expect(terms.indexOf('Ticket médio')).toBeLessThan(terms.indexOf('Valor mensal'))
    expect(terms[terms.length - 1]).toBe('Valor mensal')
    expect(detail.averageTicket).toEqual(detail.rows[2])
    expect(detail.monthlyValue).toEqual(detail.rows[3])
    // O texto acessível segue a mesma ordem da tela.
    expect(detail.accessibleText.indexOf('Ticket médio')).toBeLessThan(
      detail.accessibleText.indexOf('Valor mensal'),
    )
  })

  it('usa o verde Impacto no Corporativo, sem o roxo nem o âmbar anteriores', () => {
    const light = buildTeamDetail(corporativo, 'light').color
    const dark = buildTeamDetail(corporativo, 'dark').color

    expect(light).toBe('#00a862')
    expect(dark).toBe('#00d776')
    expect([light, dark]).not.toContain('#8b5cf6')
    expect([light, dark]).not.toContain('#d97706')
    expect([light, dark]).not.toContain('#f5a524')
    expect(light).not.toBe(dark)
  })

  it('usa o azul do portal no Comercial, o mesmo das barras da Visão Geral de OS', () => {
    // `#2f6bff` é o token `--accent` e a cor das barras de OS. Igual nos dois
    // temas, como lá: a cor da série é identidade do gráfico. Os dois azuis
    // anteriores, quase iguais entre si e diferentes do portal, saíram.
    expect(buildTeamDetail(comercial, 'light').color).toBe('#2f6bff')
    expect(buildTeamDetail(comercial, 'dark').color).toBe('#2f6bff')
    expect(overviewSeriesColor('comercial', 'light')).not.toBe('#2f7de1')
    expect(overviewSeriesColor('comercial', 'dark')).not.toBe('#4d95ef')
  })

  it('mantém o Comercial separado do Corporativo nos dois temas', () => {
    expect(overviewTeamColor('comercial', 'light')).not.toBe(
      overviewTeamColor('corporativo', 'light'),
    )
    expect(overviewTeamColor('comercial', 'dark')).not.toBe(
      overviewTeamColor('corporativo', 'dark'),
    )
  })

  it('não inventa ticket médio quando o time não possui ativações', () => {
    const detail = buildTeamDetail(
      { id: 'corporativo', label: 'Corporativo', activeSales: 0, monthlyValue: 0, share: 0 },
      'light',
    )

    expect(detail.averageTicket).toEqual({ term: 'Ticket médio', value: 'Sem ativações' })
    expect(detail.rows[1]).toEqual({ term: 'Participação', value: '0,0%' })
  })

  it('monta a rosca com total no centro e responde ao ponteiro como a de OS', () => {
    const option = makeOverviewTeamOptions([comercial, corporativo], 883, 'light')
    const title = option.title as { text: string; subtext: string }
    const tooltip = option.tooltip as {
      trigger: string
      backgroundColor: string
      showDelay: number
      transitionDuration: number
      formatter: (params: unknown) => string
    }
    const series = option.series as {
      silent?: boolean
      emphasis: { scale: boolean; scaleSize: number }
      data: { name: string; value: number; itemStyle: { color: string; opacity: number } }[]
    }[]

    expect(title.text).toBe('883')
    expect(title.subtext).toBe('ativações')
    // A fatia sob o ponteiro cresce e a caixa aparece parada no lugar.
    expect(series[0].silent).toBeUndefined()
    expect(series[0].emphasis).toEqual({ scale: true, scaleSize: 6 })
    expect(tooltip.trigger).toBe('item')
    expect(tooltip.backgroundColor).toBe('#1a2331')
    expect(tooltip.showDelay).toBe(0)
    expect(tooltip.transitionDuration).toBe(0)

    const conteudo = tooltip.formatter({ name: 'Comercial' })
    expect(conteudo).toContain('Comercial')
    expect(conteudo).toContain('795')
    expect(conteudo).toContain('90,0%')
    // Nome fora da coleção não quebra a caixa.
    expect(tooltip.formatter({ name: 'Inexistente' })).toBe('')

    expect(series[0].data.map((item) => item.itemStyle.color)).toEqual([
      overviewTeamColor('comercial', 'light'),
      overviewTeamColor('corporativo', 'light'),
    ])
  })

  it('atenua o time não selecionado e mantém os dois na rosca', () => {
    const option = makeOverviewTeamOptions([comercial, corporativo], 883, 'light', 'comercial')
    const series = option.series as {
      data: { name: string; itemStyle: { opacity: number } }[]
    }[]

    expect(series[0].data).toHaveLength(2)
    expect(series[0].data[0].itemStyle.opacity).toBe(1)
    expect(series[0].data[1].itemStyle.opacity).toBeLessThan(1)
  })

  it('não atenua nenhum time com Todos os times', () => {
    const option = makeOverviewTeamOptions([comercial, corporativo], 883, 'light', 'todos')
    const series = option.series as { data: { itemStyle: { opacity: number } }[] }[]

    expect(series[0].data.every((item) => item.itemStyle.opacity === 1)).toBe(true)
  })

  it('monta a rosca com segurança sem nenhum time no recorte', () => {
    const option = makeOverviewTeamOptions([], 0, 'light')
    const title = option.title as { text: string; subtext: string }
    const series = option.series as { data: unknown[] }[]

    expect(title.text).toBe('0')
    expect(title.subtext).toBe('ativações')
    expect(series[0].data).toEqual([])
  })
})

describe('overviewChartOptions: paleta das séries por tema', () => {
  const monthly = makeMonthly(7)

  it('pinta a série Corporativo do gráfico mensal com o verde Impacto', () => {
    const light = seriesByName(
      makeOverviewMonthlyOptions(monthly, 'light', 'todos'),
      CORPORATE_SERIES,
    ) as BarSeriesOption
    const dark = seriesByName(
      makeOverviewMonthlyOptions(monthly, 'dark', 'todos'),
      CORPORATE_SERIES,
    ) as BarSeriesOption

    expect(light.itemStyle?.color).toBe('#00a862')
    expect(dark.itemStyle?.color).toBe('#00d776')
    expect(light.itemStyle?.color).not.toBe('#8b5cf6')
    expect(dark.itemStyle?.color).not.toBe('#8b5cf6')
  })

  it('pinta a linha Valor mensal de laranja no ponto e na linha, sem área', () => {
    const light = seriesByName(
      makeOverviewMonthlyOptions(monthly, 'light', 'todos'),
      MONTHLY_VALUE_SERIES,
    ) as LineSeriesOption
    const dark = seriesByName(
      makeOverviewMonthlyOptions(monthly, 'dark', 'todos'),
      MONTHLY_VALUE_SERIES,
    ) as LineSeriesOption

    expect(light.itemStyle?.color).toBe('#e06a00')
    expect(light.lineStyle?.color).toBe('#e06a00')
    expect(dark.itemStyle?.color).toBe('#ff9f43')
    expect(dark.lineStyle?.color).toBe('#ff9f43')
    // O preenchimento sob a linha saiu: ele lavava o quadro inteiro de creme,
    // que nenhum gráfico da Visão Geral de OS tem.
    expect(light.areaStyle).toBeUndefined()
    expect(dark.areaStyle).toBeUndefined()
  })

  it('tira o verde anterior da linha Valor mensal', () => {
    expect(overviewSeriesColor('monthlyValue', 'light')).not.toBe('#00a862')
    expect(overviewSeriesColor('monthlyValue', 'dark')).not.toBe('#22c98a')
    expect(overviewSeriesColor('monthlyValue', 'dark')).not.toBe('#00d776')
  })

  it('mantém as três séries distinguíveis entre si nos dois temas', () => {
    ;(['light', 'dark'] as const).forEach((theme) => {
      const cores = [
        overviewSeriesColor('comercial', theme),
        overviewSeriesColor('corporativo', theme),
        overviewSeriesColor('monthlyValue', theme),
      ]

      expect(new Set(cores).size).toBe(3)
    })
  })

  it('não altera os dados das séries ao trocar a paleta', () => {
    const light = makeOverviewMonthlyOptions(monthly, 'light', 'todos')
    const dark = makeOverviewMonthlyOptions(monthly, 'dark', 'todos')

    expect(seriesByName(dark, COMMERCIAL_SERIES)?.data).toEqual(
      seriesByName(light, COMMERCIAL_SERIES)?.data,
    )
    expect(seriesByName(dark, CORPORATE_SERIES)?.data).toEqual(
      seriesByName(light, CORPORATE_SERIES)?.data,
    )
    expect(seriesByName(dark, MONTHLY_VALUE_SERIES)?.data).toEqual(
      monthly.map((point) => point.monthlyValue),
    )
  })

  it('mantém a alternância das séries funcionando com a nova paleta', () => {
    const soComercial = makeOverviewMonthlyOptions(monthly, 'dark', 'todos', {
      [COMMERCIAL_SERIES]: true,
      [CORPORATE_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    })

    expect(seriesByName(soComercial, MONTHLY_VALUE_SERIES)?.data).toEqual(
      monthly.map((point) => point.commercialValue),
    )
    expect(
      (seriesByName(soComercial, CORPORATE_SERIES) as BarSeriesOption).itemStyle?.color,
    ).toBe('#00d776')
  })
})

describe('overviewChartOptions: linha mensal sem nenhuma barra visível', () => {
  const monthly = makeMonthly(7)
  const monthlyValueOf = (option: ReturnType<typeof makeOverviewMonthlyOptions>) =>
    seriesByName(option, MONTHLY_VALUE_SERIES)?.data
  const nenhumTimeVisivel = {
    [COMMERCIAL_SERIES]: false,
    [CORPORATE_SERIES]: false,
    [MONTHLY_VALUE_SERIES]: true,
  }

  it('mantém os times visíveis quando pelo menos um está ligado', () => {
    const ambos = { commercial: true, corporate: true }

    expect(resolveMonthlyValueTeams(ambos, { commercial: true, corporate: true })).toEqual({
      commercial: true,
      corporate: true,
    })
    expect(resolveMonthlyValueTeams(ambos, { commercial: true, corporate: false })).toEqual({
      commercial: true,
      corporate: false,
    })
    expect(resolveMonthlyValueTeams(ambos, { commercial: false, corporate: true })).toEqual({
      commercial: false,
      corporate: true,
    })
  })

  it('volta ao recorte permitido quando nenhum time está visível', () => {
    expect(
      resolveMonthlyValueTeams(
        { commercial: true, corporate: true },
        { commercial: false, corporate: false },
      ),
    ).toEqual({ commercial: true, corporate: true })
    expect(
      resolveMonthlyValueTeams(
        { commercial: true, corporate: false },
        { commercial: false, corporate: false },
      ),
    ).toEqual({ commercial: true, corporate: false })
    expect(
      resolveMonthlyValueTeams(
        { commercial: false, corporate: true },
        { commercial: false, corporate: false },
      ),
    ).toEqual({ commercial: false, corporate: true })
  })

  it('usa o consolidado no filtro Todos os times, sem zerar a linha', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', nenhumTimeVisivel)

    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.monthlyValue))
    expect(monthlyValueOf(option)).not.toEqual(monthly.map(() => 0))
  })

  it('usa o Comercial inteiro no filtro Comercial', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'comercial', nenhumTimeVisivel)

    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.commercialValue))
  })

  it('usa o Corporativo inteiro no filtro Corporativo', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'corporativo', nenhumTimeVisivel)

    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.corporateValue))
  })

  it('não força a visibilidade da própria série Valor mensal', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: false,
      [CORPORATE_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: false,
    })
    const legend = option.legend as { selected: Record<string, boolean> }

    expect(legend.selected[MONTHLY_VALUE_SERIES]).toBe(false)
    // Os dados voltam ao consolidado, mas a série continua desligada.
    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.monthlyValue))
  })

  it('preserva o comportamento aprovado com uma ou duas barras visíveis', () => {
    const ambos = makeOverviewMonthlyOptions(
      monthly,
      'light',
      'todos',
      initialMonthlyLegendSelection(),
    )
    const soComercial = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: true,
      [CORPORATE_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    })
    const soCorporativo = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: false,
      [CORPORATE_SERIES]: true,
      [MONTHLY_VALUE_SERIES]: true,
    })

    expect(monthlyValueOf(ambos)).toEqual(monthly.map((point) => point.monthlyValue))
    expect(monthlyValueOf(soComercial)).toEqual(monthly.map((point) => point.commercialValue))
    expect(monthlyValueOf(soCorporativo)).toEqual(monthly.map((point) => point.corporateValue))
  })

  it('soma com segurança uma coleção vazia no fallback', () => {
    expect(monthlyValueSeries([], { commercial: true, corporate: true })).toEqual([])
    expect(monthlyValueOf(makeOverviewMonthlyOptions([], 'light', 'todos', nenhumTimeVisivel))).toEqual(
      [],
    )
  })
})

/**
 * Alinhamento visual à Visão Geral de OS.
 *
 * Estes testes travam o que a página tinha de diferente sem decisão: a fonte
 * que nunca era declarada, o tooltip claro padrão da biblioteca, a animação a
 * cada troca de filtro e a legenda com marca quadrada. São as regras da casa,
 * não preferência de página.
 */
describe('overviewChartOptions: alinhamento à Visão Geral de OS', () => {
  const teamRows = [
    { id: 'comercial', label: 'Comercial', activeSales: 795, monthlyValue: 105_530.5, share: 0.9 },
    { id: 'corporativo', label: 'Corporativo', activeSales: 88, monthlyValue: 24_991.2, share: 0.1 },
  ]

  const meses = makeMonthly(7)
  const options = [
    makeOverviewMonthlyOptions(meses, 'light', 'todos'),
    makeOverviewMonthlyOptions(meses, 'dark', 'todos'),
    makeOverviewTeamOptions(teamRows, 883, 'light'),
    makeOverviewTeamOptions(teamRows, 883, 'dark'),
  ]

  it('declara a IBM Plex Sans em todos os gráficos da página', () => {
    for (const option of options) {
      expect(option.textStyle).toEqual({ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 })
    }
  })

  it('abre e troca de filtro sem animação, guardando movimento só para o hover', () => {
    for (const option of options) {
      expect(option.animation).toBe(true)
      expect(option.animationDuration).toBe(0)
      expect(option.animationDurationUpdate).toBe(0)
      expect(option.stateAnimation).toEqual({ duration: 260, easing: 'cubicOut' })
    }
  })

  it('usa a caixa escura de tooltip do portal, que aparece parada no lugar', () => {
    const claro = options[0].tooltip as Record<string, unknown>
    const escuro = options[1].tooltip as Record<string, unknown>

    expect(claro.backgroundColor).toBe('#1a2331')
    expect(escuro.backgroundColor).toBe('#263448')
    expect(escuro.borderColor).toBe('#46556b')
    for (const tooltip of [claro, escuro]) {
      expect(tooltip.showDelay).toBe(0)
      expect(tooltip.transitionDuration).toBe(0)
      expect(tooltip.textStyle).toEqual({
        color: expect.any(String),
        fontSize: 12,
        fontFamily: 'IBM Plex Sans',
      })
      expect(String(tooltip.extraCssText)).toContain('border-radius:8px')
      expect(String(tooltip.extraCssText)).toContain('box-shadow')
    }
  })

  it('marca o mês sob o ponteiro com uma faixa discreta, não com o cinza padrão', () => {
    const claro = (options[0].tooltip as { axisPointer: { type: string; shadowStyle: { color: string } } })
      .axisPointer
    const escuro = (options[1].tooltip as { axisPointer: { shadowStyle: { color: string } } })
      .axisPointer

    expect(claro.type).toBe('shadow')
    expect(claro.shadowStyle.color).toBe('rgba(26,35,49,0.06)')
    expect(escuro.shadowStyle.color).toBe('rgba(233,237,243,0.08)')
  })

  it('usa ponto redondo na legenda do gráfico mensal, como em OS', () => {
    const legend = options[0].legend as { icon: string; itemWidth: number; itemHeight: number; textStyle: { fontSize: number } }

    expect(legend.icon).toBe('circle')
    expect(legend.itemWidth).toBe(9)
    expect(legend.itemHeight).toBe(9)
    expect(legend.textStyle.fontSize).toBe(11.5)
  })
})
