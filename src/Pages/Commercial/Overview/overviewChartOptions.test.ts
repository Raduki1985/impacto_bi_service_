import { describe, expect, it } from 'vitest'
import type { BarSeriesOption, LineSeriesOption } from 'echarts'

import {
  buildTeamDetail,
  COMMERCIAL_SERIES,
  CORPORATE_SERIES,
  formatOverviewMonthlyTooltip,
  initialMonthlyLegendSelection,
  formatAxisInteger,
  makeMonthlyAxisLabelFormatter,
  makeOverviewMonthlyOptions,
  makeOverviewTeamOptions,
  MONTHLY_VALUE_SERIES,
  monthlyFromChartClick,
  monthlyFromMonthIndex,
  monthlyPanelSubtitle,
  monthlyTeamsShown,
  monthlyValueSeries,
  overviewSeriesColor,
  overviewTeamColor,
  resolveMonthlyValueTeams,
  UNASSIGNED_SERIES,
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

/**
 * Valores de uma série de barra: desde 18/09/2026 cada mês viaja como objeto,
 * porque o canto arredondado é decidido barra a barra.
 */
function barValues(bar: { data?: unknown } | undefined): number[] {
  return ((bar?.data ?? []) as ({ value: number } | number)[]).map((item) =>
    typeof item === 'number' ? item : item.value,
  )
}

/** Canto de cada mês de uma série de barra. */
function barRadii(bar: { data?: unknown } | undefined): (number | number[])[] {
  return ((bar?.data ?? []) as { itemStyle: { borderRadius: number | number[] } }[]).map(
    (item) => item.itemStyle.borderRadius,
  )
}

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
    // Venda sem time em todo mês, como a produção tem hoje: sem ela nos dados
    // do teste, um gráfico que a ignorasse passaria sem ninguém notar.
    const unassignedValue = 2_000 + index * 100
    return {
      month: `2026-${String(index + 1).padStart(2, '0')}` as CommercialMonthKey,
      label: `${MONTH_LABELS[index]}/${year}`,
      commercialSales: 600 + index * 10,
      corporateSales: 60 + index,
      unassignedSales: 15 + index,
      commercialValue,
      corporateValue,
      unassignedValue,
      monthlyValue: commercialValue + corporateValue + unassignedValue,
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
  it('exibe os dois times, a venda sem time e o valor mensal consolidado em Todos os times', () => {
    const monthly = makeMonthly(7)
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos')

    expect(seriesNames(option)).toEqual(['Comercial', 'Corporativo', 'Sem time', 'Valor mensal'])
    expect(seriesByName(option, 'Valor mensal')?.data).toEqual(
      monthly.map((point) => point.monthlyValue),
    )
  })

  it('desenha a venda sem time na cor neutra do painel de times, empilhada com os dois times', () => {
    const monthly = makeMonthly(7)
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos')
    const unassigned = seriesByName(option, UNASSIGNED_SERIES) as BarSeriesOption

    expect(barValues(unassigned)).toEqual(monthly.map((point) => point.unassignedSales))
    expect(unassigned.stack).toBe('vendas')
    expect(unassigned.itemStyle?.color).toBe(overviewSeriesColor('semTime', 'light'))
    expect(unassigned.itemStyle?.color).toBe(overviewTeamColor('sem-time', 'light'))
    // Sem esta barra, os meses anteriores a junho/2026 apareciam sem venda
    // nenhuma: a soma das três barras é o total ativado do mês.
    const bars = [COMMERCIAL_SERIES, CORPORATE_SERIES, UNASSIGNED_SERIES].map((name) =>
      barValues(seriesByName(option, name)),
    )
    monthly.forEach((point, index) => {
      expect(bars[0][index] + bars[1][index] + bars[2][index]).toBe(
        point.commercialSales + point.corporateSales + point.unassignedSales,
      )
    })
  })

  it('mantém a barra Sem time desenhada e na legenda quando ela vale zero', () => {
    const monthly = makeMonthly(7).map((point) => ({
      ...point,
      unassignedSales: 0,
      unassignedValue: 0,
      monthlyValue: point.commercialValue + point.corporateValue,
    }))
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos')

    expect(seriesNames(option)).toContain(UNASSIGNED_SERIES)
    expect(barValues(seriesByName(option, UNASSIGNED_SERIES))).toEqual(monthly.map(() => 0))
    // Com a venda sem time zerada, quem fecha a barra é o Corporativo.
    expect(barRadii(seriesByName(option, CORPORATE_SERIES))).toEqual(
      monthly.map(() => [3, 3, 0, 0]),
    )
    expect(barRadii(seriesByName(option, UNASSIGNED_SERIES))).toEqual(monthly.map(() => 0))
    expect(initialMonthlyLegendSelection()).toMatchObject({ [UNASSIGNED_SERIES]: true })
  })

  it('exibe somente a série Comercial no filtro Comercial', () => {
    const monthly = makeMonthly(7)
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'comercial')

    expect(seriesNames(option)).toEqual(['Comercial', 'Valor mensal'])
    expect(seriesNames(option)).not.toContain('Corporativo')
    // O filtro de time exige o vínculo com a equipe: venda sem time não cabe
    // no recorte, e a barra dela sairia sempre vazia.
    expect(seriesNames(option)).not.toContain('Sem time')
    expect(barValues(seriesByName(option, 'Comercial'))).toEqual(
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
    expect(seriesNames(option)).not.toContain('Sem time')
    expect(barValues(seriesByName(option, 'Corporativo'))).toEqual(
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

  it('soma as três barras quando Comercial, Corporativo e Sem time estão visíveis', () => {
    const option = makeOverviewMonthlyOptions(
      monthly,
      'light',
      'todos',
      initialMonthlyLegendSelection(),
    )

    expect(monthlyValueOf(option)).toEqual(
      monthly.map(
        (point) => point.commercialValue + point.corporateValue + point.unassignedValue,
      ),
    )
    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.monthlyValue))
  })

  it('usa somente o valor mensal Comercial quando as outras barras são desligadas na legenda', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: true,
      [CORPORATE_SERIES]: false,
      [UNASSIGNED_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    })

    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.commercialValue))
    expect(monthlyValueOf(option)).not.toEqual(monthly.map((point) => point.monthlyValue))
  })

  it('usa somente o valor mensal Corporativo quando as outras barras são desligadas na legenda', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: false,
      [CORPORATE_SERIES]: true,
      [UNASSIGNED_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    })

    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.corporateValue))
  })

  it('usa somente o valor da venda sem time quando os dois times são desligados na legenda', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: false,
      [CORPORATE_SERIES]: false,
      [UNASSIGNED_SERIES]: true,
      [MONTHLY_VALUE_SERIES]: true,
    })

    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.unassignedValue))
  })

  it('não zera a linha sem nenhuma barra visível: volta ao recorte do filtro', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: false,
      [CORPORATE_SERIES]: false,
      [UNASSIGNED_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    })

    expect(monthlyValueOf(option)).not.toEqual(monthly.map(() => 0))
    expect(monthlyValueOf(option)).toEqual(monthly.map((point) => point.monthlyValue))
  })

  it('reflete o estado da legenda no próprio option, para marca e valor não divergirem', () => {
    const selection = {
      [COMMERCIAL_SERIES]: true,
      [CORPORATE_SERIES]: false,
      [UNASSIGNED_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    }
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', selection)

    expect(option.legend).toMatchObject({ selected: selection })
  })

  it('mantém o tooltip com o mesmo valor da linha recalculada', () => {
    const option = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: true,
      [CORPORATE_SERIES]: false,
      [UNASSIGNED_SERIES]: false,
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
    expect(monthlyValueSeries([], { commercial: true, corporate: true, unassigned: false })).toEqual([])
    const option = makeOverviewMonthlyOptions([], 'light', 'todos')
    expect(monthlyValueOf(option)).toEqual([])
  })
})

describe('overviewChartOptions: eixo vertical em pt-BR', () => {
  it('escreve o milhar como 1.000, igual à Safra de vendas por mês', () => {
    const option = makeOverviewMonthlyOptions(makeMonthly(7), 'light')
    const [quantidade] = option.yAxis as { axisLabel?: { formatter?: unknown } }[]

    expect(formatAxisInteger(1000)).toBe('1.000')
    expect(formatAxisInteger(85)).toBe('85')
    expect(quantidade.axisLabel?.formatter).toBe(formatAxisInteger)
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
    // Comercial, Corporativo, Sem time e a linha Valor mensal.
    expect(light.series).toHaveLength(4)
    expect(dark.series).toHaveLength(4)
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

  it('usa o azul de dados do Comercial, o mesmo das barras e rankings da página', () => {
    // `#2f7de1` é o azul de dados do Comercial: rosca, barras HTML dos
    // rankings e Vendas por período compartilham o mesmo tom, igual nos dois
    // temas. Ele não segue o `--accent` da estrutura (#003be2) nem o azul das
    // barras de OS (#2f6bff), e o antigo `#4d95ef` do escuro continua fora.
    expect(buildTeamDetail(comercial, 'light').color).toBe('#2f7de1')
    expect(buildTeamDetail(comercial, 'dark').color).toBe('#2f7de1')
    expect(overviewSeriesColor('comercial', 'light')).toBe('#2f7de1')
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

describe('overviewChartOptions: Sem time', () => {
  /**
   * "Sem time" é o vendedor sem vínculo em `team_users` no SGI, pendência de
   * cadastro que o serviço reporta em `quality`. Em 10/09/2026, no SGI de
   * desenvolvimento, era o ÚNICO time da página. Ele nunca herda o azul do
   * Comercial: ganha o cinza neutro da paleta de dados, que enxerga nos dois
   * temas (4,76 sobre branco e 3,08 sobre `#1f2937`).
   */
  const semTime = {
    id: 'sem-time',
    label: 'Sem time',
    activeSales: 68,
    monthlyValue: 14_725.61,
    share: 1,
  }

  it('pinta Sem time no cinza neutro, e não no azul do Comercial', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(overviewTeamColor('sem-time', theme)).toBe('#64748b')
      expect(overviewTeamColor('sem-time', theme)).not.toBe(overviewTeamColor('comercial', theme))
      expect(overviewTeamColor('sem-time', theme)).not.toBe(
        overviewTeamColor('corporativo', theme),
      )
    }
  })

  it('leva a mesma cor para o bloco de leitura e para a fatia da rosca', () => {
    const detail = buildTeamDetail(semTime, 'light')
    const option = makeOverviewTeamOptions([semTime], 68, 'light')
    const series = option.series as { data: { itemStyle: { color: string } }[] }[]

    expect(detail.color).toBe('#64748b')
    expect(series[0].data[0].itemStyle.color).toBe('#64748b')
    expect(detail.share).toBe('100,0%')
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

    expect(barValues(seriesByName(dark, COMMERCIAL_SERIES))).toEqual(
      barValues(seriesByName(light, COMMERCIAL_SERIES)),
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
      [UNASSIGNED_SERIES]: false,
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
    [UNASSIGNED_SERIES]: false,
    [MONTHLY_VALUE_SERIES]: true,
  }

  it('mantém os times visíveis quando pelo menos um está ligado', () => {
    const ambos = { commercial: true, corporate: true, unassigned: false }

    expect(resolveMonthlyValueTeams(ambos, { commercial: true, corporate: true, unassigned: false })).toEqual({
      commercial: true,
      corporate: true,
      unassigned: false,
    })
    expect(resolveMonthlyValueTeams(ambos, { commercial: true, corporate: false, unassigned: false })).toEqual({
      commercial: true,
      corporate: false,
      unassigned: false,
    })
    expect(resolveMonthlyValueTeams(ambos, { commercial: false, corporate: true, unassigned: false })).toEqual({
      commercial: false,
      corporate: true,
      unassigned: false,
    })
  })

  it('mantém a venda sem time visível quando só ela está ligada', () => {
    const tudo = { commercial: true, corporate: true, unassigned: true }

    expect(
      resolveMonthlyValueTeams(tudo, { commercial: false, corporate: false, unassigned: true }),
    ).toEqual({ commercial: false, corporate: false, unassigned: true })
  })

  it('volta ao recorte permitido quando nenhum time está visível', () => {
    expect(
      resolveMonthlyValueTeams(
        { commercial: true, corporate: true, unassigned: false },
        { commercial: false, corporate: false, unassigned: false },
      ),
    ).toEqual({ commercial: true, corporate: true, unassigned: false })
    expect(
      resolveMonthlyValueTeams(
        { commercial: true, corporate: false, unassigned: false },
        { commercial: false, corporate: false, unassigned: false },
      ),
    ).toEqual({ commercial: true, corporate: false, unassigned: false })
    expect(
      resolveMonthlyValueTeams(
        { commercial: false, corporate: true, unassigned: false },
        { commercial: false, corporate: false, unassigned: false },
      ),
    ).toEqual({ commercial: false, corporate: true, unassigned: false })
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
      [UNASSIGNED_SERIES]: false,
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
      [UNASSIGNED_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    })
    const soCorporativo = makeOverviewMonthlyOptions(monthly, 'light', 'todos', {
      [COMMERCIAL_SERIES]: false,
      [CORPORATE_SERIES]: true,
      [UNASSIGNED_SERIES]: false,
      [MONTHLY_VALUE_SERIES]: true,
    })

    expect(monthlyValueOf(ambos)).toEqual(monthly.map((point) => point.monthlyValue))
    expect(monthlyValueOf(soComercial)).toEqual(monthly.map((point) => point.commercialValue))
    expect(monthlyValueOf(soCorporativo)).toEqual(monthly.map((point) => point.corporateValue))
  })

  it('soma com segurança uma coleção vazia no fallback', () => {
    expect(monthlyValueSeries([], { commercial: true, corporate: true, unassigned: false })).toEqual([])
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

describe('Evolução mensal: clique que abre a janela de contratos', () => {
  const monthly = makeMonthly(3)

  it('a barra clicada abre o mês e o grupo dela', () => {
    expect(
      monthlyFromChartClick(monthly, { componentType: 'series', dataIndex: 1, seriesName: CORPORATE_SERIES }),
    ).toEqual({ month: '2026-02', team: 'corporativo' })
    expect(
      monthlyFromChartClick(monthly, { componentType: 'series', dataIndex: 0, seriesName: UNASSIGNED_SERIES }),
    ).toEqual({ month: '2026-01', team: 'unassigned' })
  })

  it('o ponto do Valor mensal não abre nada: a linha soma só as barras ligadas na legenda', () => {
    expect(
      monthlyFromChartClick(monthly, { componentType: 'series', dataIndex: 2, seriesName: MONTHLY_VALUE_SERIES }),
    ).toBeNull()
  })

  it('o nome do mês e o fundo da coluna abrem o mês inteiro', () => {
    expect(monthlyFromChartClick(monthly, { componentType: 'xAxis', value: 'Fev/26' })).toEqual({
      month: '2026-02',
      team: null,
    })
    expect(monthlyFromMonthIndex(monthly, 0)).toEqual({ month: '2026-01', team: null })
    // O eixo avisa o clique no nome do mês.
    expect((makeOverviewMonthlyOptions(monthly, 'light').xAxis as { triggerEvent?: boolean }).triggerEvent).toBe(
      true,
    )
  })

  it('barra zerada, mês sem ativação e alvo desconhecido não abrem nada', () => {
    const semTime = monthly.map((point) => ({ ...point, unassignedSales: 0 }))
    const vazio = monthly.map((point) => ({ ...point, commercialSales: 0, corporateSales: 0, unassignedSales: 0 }))

    expect(
      monthlyFromChartClick(semTime, { componentType: 'series', dataIndex: 0, seriesName: UNASSIGNED_SERIES }),
    ).toBeNull()
    expect(monthlyFromMonthIndex(vazio, 0)).toBeNull()
    expect(monthlyFromMonthIndex(monthly, 9)).toBeNull()
    expect(monthlyFromChartClick(monthly, { componentType: 'legend' })).toBeNull()
    expect(monthlyFromChartClick(monthly, null)).toBeNull()
  })

  it('o subtítulo convida ao clique só com o serviço ligado e algum mês com ativação', () => {
    const convite = 'Clique numa barra ou no mês para ver as ativações.'
    const vazio = monthly.map((point) => ({ ...point, commercialSales: 0, corporateSales: 0, unassignedSales: 0 }))

    expect(monthlyPanelSubtitle(monthly, true)).toContain(convite)
    expect(monthlyPanelSubtitle(monthly, false)).not.toContain(convite)
    expect(monthlyPanelSubtitle(vazio, true)).not.toContain(convite)
    expect(monthlyPanelSubtitle(monthly, false)).toContain('O valor mensal soma as barras visíveis')
  })

  it('com um time filtrado, só conta o que o gráfico desenha', () => {
    // Filtro Corporativo, e o mês só tem parcela Comercial: o vendedor dos dois
    // times com o Comercial como principal. Nenhuma barra aparece no gráfico.
    const soComercial = monthly.map((point) => ({ ...point, corporateSales: 0, unassignedSales: 0 }))

    expect(monthlyFromMonthIndex(soComercial, 0, 'corporativo')).toBeNull()
    expect(monthlyFromChartClick(soComercial, { componentType: 'xAxis', value: 'Jan/26' }, 'corporativo')).toBeNull()
    expect(
      monthlyFromChartClick(monthly, { componentType: 'series', dataIndex: 0, seriesName: COMMERCIAL_SERIES }, 'corporativo'),
    ).toBeNull()
    expect(monthlyPanelSubtitle(soComercial, true, 'corporativo')).not.toContain('para ver as ativações')
    expect(monthlyFromMonthIndex(soComercial, 0, 'comercial')).toEqual({ month: '2026-01', team: null })
    expect(monthlyTeamsShown('corporativo')).toEqual(['corporativo'])
  })
})
