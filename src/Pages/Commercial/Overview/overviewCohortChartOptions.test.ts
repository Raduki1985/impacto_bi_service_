import type { BarSeriesOption } from 'echarts'
import { describe, expect, it } from 'vitest'

import { formatPercent } from '../../../lib/formatters'
import { formatAxisInteger } from './overviewChartOptions'
import {
  buildCohortDescription,
  buildCohortTooltip,
  COHORT_SERIES,
  cohortBarRadius,
  cohortChartMax,
  cohortColor,
  cohortShare,
  cohortTooltipFormatter,
  initialCohortLegendSelection,
  isCohortEmpty,
  makeOverviewCohortOptions,
} from './overviewCohortChartOptions'
import type { OverviewCohortPoint } from './overviewModel'

// Julho a setembro de 2026 em produção, medidos em 17/09/2026.
const pontos: OverviewCohortPoint[] = [
  { month: '2026-07', label: 'Jul/26', sold: 790, activatedInMonth: 675, activatedLater: 66, awaiting: 49, cancelledBefore: 0, other: 0 },
  { month: '2026-08', label: 'Ago/26', sold: 826, activatedInMonth: 684, activatedLater: 66, awaiting: 73, cancelledBefore: 3, other: 0 },
  { month: '2026-09', label: 'Set/26', sold: 393, activatedInMonth: 311, activatedLater: 0, awaiting: 81, cancelledBefore: 1, other: 0 },
]

type BarItem = { value: number; itemStyle: { borderRadius: number | number[]; opacity?: number } }

function series(option: ReturnType<typeof makeOverviewCohortOptions>): BarSeriesOption[] {
  return (Array.isArray(option.series) ? option.series : [option.series]) as BarSeriesOption[]
}

function items(bar: BarSeriesOption): BarItem[] {
  return bar.data as BarItem[]
}

function values(bar: BarSeriesOption): number[] {
  return items(bar).map((item) => item.value)
}

describe('overviewCohortChartOptions: fatias e cores', () => {
  it('empilha as quatro fatias na ordem da legenda, com o dado de cada mês', () => {
    const option = makeOverviewCohortOptions(pontos, 'light')
    const bars = series(option)

    expect(bars.map((bar) => bar.name)).toEqual([
      'Ativou no mês',
      'Ativou depois',
      'Aguarda hoje',
      'Cancelou antes de ativar',
    ])
    expect(bars.every((bar) => bar.stack === 'safra')).toBe(true)
    expect(values(bars[0])).toEqual([675, 684, 311])
    expect(values(bars[3])).toEqual([0, 3, 1])
    // As quatro fatias fecham com o vendido de cada mês, como o adaptador exige.
    pontos.forEach((point, index) => {
      const soma = bars.reduce((total, bar) => total + values(bar)[index], 0)
      expect(soma + point.other).toBe(point.sold)
    })
  })

  it('cor fixa por fatia, a identidade de cada card, medida contra a superfície de cada tema', () => {
    // Opção A, escolha do Mário em 18/09/2026: verde de Vendas ativadas, azul
    // do Tempo até a ativação, âmbar de Aguardando Ativação e cinza neutro.
    expect(COHORT_SERIES.map((s) => cohortColor(s.id, 'light'))).toEqual([
      '#00a862',
      '#2563eb',
      '#d97706',
      '#64748b',
    ])
    expect(COHORT_SERIES.map((s) => cohortColor(s.id, 'dark'))).toEqual([
      '#00d776',
      '#3b82f6',
      '#e8890b',
      '#64748b',
    ])
    const light = series(makeOverviewCohortOptions(pontos, 'light'))
    const dark = series(makeOverviewCohortOptions(pontos, 'dark'))
    light.forEach((bar, index) => {
      expect(bar.itemStyle?.color).toBe(cohortColor(COHORT_SERIES[index].id, 'light'))
      expect(dark[index].itemStyle?.color).toBe(cohortColor(COHORT_SERIES[index].id, 'dark'))
    })
  })

  it('todos os meses ficam acesos: o período da página não recorta nem apaga', () => {
    const bars = series(makeOverviewCohortOptions(pontos, 'light'))

    bars.forEach((bar) => {
      items(bar).forEach((item) => expect(item.itemStyle.opacity).toBeUndefined())
    })
  })

  it('legenda em círculo, eixo com os meses e descrição acessível da mesma coleção', () => {
    const option = makeOverviewCohortOptions(pontos, 'light')
    const legend = option.legend as { icon?: string; itemWidth?: number }
    const xAxis = option.xAxis as { data?: string[] }
    const aria = option.aria as { label?: { description?: string } }

    expect(legend.icon).toBe('circle')
    expect(legend.itemWidth).toBe(9)
    expect(xAxis.data).toEqual(['Jul/26', 'Ago/26', 'Set/26'])
    expect(aria.label?.description).toBe(buildCohortDescription(pontos))
  })

  it('escreve o milhar do eixo vertical em pt-BR, com o mesmo formatador da Evolução mensal', () => {
    const yAxis = makeOverviewCohortOptions(pontos, 'light').yAxis as {
      axisLabel?: { formatter?: (value: number) => string }
    }

    expect(formatAxisInteger(1000)).toBe('1.000')
    expect(yAxis.axisLabel?.formatter).toBe(formatAxisInteger)
  })
})

describe('overviewCohortChartOptions: cantos das barras', () => {
  it('arredonda a base na primeira fatia com valor e o topo na última, mês a mês', () => {
    // Julho: cancelou antes vale zero, então o topo é de "Aguarda hoje".
    expect(cohortBarRadius(pontos[0], 'activatedInMonth')).toEqual([0, 0, 3, 3])
    expect(cohortBarRadius(pontos[0], 'activatedLater')).toBe(0)
    expect(cohortBarRadius(pontos[0], 'awaiting')).toEqual([3, 3, 0, 0])
    expect(cohortBarRadius(pontos[0], 'cancelledBefore')).toBe(0)
    // Sem a régua do gráfico, qualquer fatia com valor fecha a pilha: em
    // agosto o topo cai na cancelada.
    expect(cohortBarRadius(pontos[1], 'cancelledBefore')).toEqual([3, 3, 0, 0])
    expect(cohortBarRadius(pontos[1], 'awaiting')).toBe(0)
  })

  it('a lasca do topo não leva o canto: ele vai para a última fatia que aparece', () => {
    // Visto na tela em 18/09/2026: agosto fecha com 3 canceladas e setembro
    // com 1, menos de meio pixel, e o topo saía reto.
    const chartMax = cohortChartMax(pontos)

    expect(chartMax).toBe(826)
    expect(cohortBarRadius(pontos[1], 'cancelledBefore', undefined, chartMax)).toBe(0)
    expect(cohortBarRadius(pontos[1], 'awaiting', undefined, chartMax)).toEqual([3, 3, 0, 0])
    expect(cohortBarRadius(pontos[2], 'cancelledBefore', undefined, chartMax)).toBe(0)
    expect(cohortBarRadius(pontos[2], 'awaiting', undefined, chartMax)).toEqual([3, 3, 0, 0])
    // Julho não muda: "Aguarda hoje" tem 49 de 826, acima do piso de 2%.
    expect(cohortBarRadius(pontos[0], 'awaiting', undefined, chartMax)).toEqual([3, 3, 0, 0])
  })

  it('o gráfico monta os cantos com a régua do maior mês', () => {
    const bars = series(makeOverviewCohortOptions(pontos, 'light'))
    const topoDeAgosto = items(bars[2])[1].itemStyle.borderRadius
    const lascaDeAgosto = items(bars[3])[1].itemStyle.borderRadius

    expect(topoDeAgosto).toEqual([3, 3, 0, 0])
    expect(lascaDeAgosto).toBe(0)
  })

  it('o maior mês conta só as fatias ligadas na legenda', () => {
    const semAtivadas = {
      ...initialCohortLegendSelection(),
      'Ativou no mês': false,
      'Ativou depois': false,
    }

    expect(cohortChartMax(pontos, semAtivadas)).toBe(82)
    expect(cohortChartMax([])).toBe(0)
  })

  it('uma fatia sozinha arredonda os quatro cantos', () => {
    const soUmaFatia = { ...pontos[0], sold: 10, activatedInMonth: 10, activatedLater: 0, awaiting: 0, cancelledBefore: 0 }

    expect(cohortBarRadius(soUmaFatia, 'activatedInMonth')).toBe(3)
    expect(cohortBarRadius(soUmaFatia, 'activatedInMonth', undefined, 826)).toBe(3)
  })

  it('fatia desligada na legenda deixa de contar para os cantos', () => {
    const semAguarda = { ...initialCohortLegendSelection(), 'Aguarda hoje': false }

    expect(cohortBarRadius(pontos[0], 'awaiting', semAguarda)).toBe(0)
    expect(cohortBarRadius(pontos[0], 'activatedLater', semAguarda)).toEqual([3, 3, 0, 0])
    const bars = series(makeOverviewCohortOptions(pontos, 'light', semAguarda))
    expect(items(bars[1])[0].itemStyle.borderRadius).toEqual([3, 3, 0, 0])
  })
})

describe('overviewCohortChartOptions: participação e tooltip', () => {
  it('participação é a fatia sobre o vendido, e zero sem venda', () => {
    expect(cohortShare(pontos[1], 'activatedInMonth')).toBeCloseTo(684 / 826, 10)
    expect(
      cohortShare({ ...pontos[0], sold: 0, activatedInMonth: 0, activatedLater: 0, awaiting: 0, cancelledBefore: 0 }, 'awaiting'),
    ).toBe(0)
  })

  it('tooltip traz o vendido no título e cada fatia com quantidade e participação', () => {
    const html = buildCohortTooltip(pontos[1], 'light')

    expect(html).toContain('Ago/26: 826 vendidas')
    expect(html).toContain('Ativou no mês')
    expect(html).toContain(`684 (${formatPercent(684 / 826)})`)
    expect(html).toContain('Cancelou antes de ativar')
    expect(html).toContain(`3 (${formatPercent(3 / 826)})`)
    expect(html).toContain(cohortColor('awaiting', 'light'))
    expect(html).not.toContain('Outras situações')
    expect(html).not.toContain('—')
  })

  it('só menciona outras situações quando existem, alinhada às fatias, e fala no singular com uma venda', () => {
    const comOutras = buildCohortTooltip({ ...pontos[2], other: 2 }, 'dark')

    expect(comOutras).toContain('Outras situações')
    expect(comOutras).toContain('width:16px')
    expect(
      buildCohortTooltip(
        { month: '2026-01', label: 'Jan/26', sold: 1, activatedInMonth: 1, activatedLater: 0, awaiting: 0, cancelledBefore: 0, other: 0 },
        'light',
      ),
    ).toContain('Jan/26: 1 vendida')
  })

  it('formatador acha o mês pelo índice do ponto e devolve vazio fora da coleção', () => {
    const formatter = cohortTooltipFormatter(pontos, 'light')

    expect(formatter([{ dataIndex: 2 }])).toContain('Set/26: 393 vendidas')
    expect(formatter({ dataIndex: 0 })).toContain('Jul/26')
    expect(formatter([{ dataIndex: 7 }])).toBe('')
    expect(formatter(undefined)).toBe('')
  })

  it('descrição acessível lista mês a mês, na ordem da legenda, com outras situações quando existem', () => {
    const descricao = buildCohortDescription(pontos.slice(0, 1))

    expect(descricao).toBe(
      'Safra de vendas por mês. Jul/26: 790 vendidas, ativou no mês 675, ativou depois 66, aguarda hoje 49, cancelou antes de ativar 0.',
    )
    expect(buildCohortDescription([{ ...pontos[0], other: 2 }])).toContain(
      'cancelou antes de ativar 0, outras situações 2.',
    )
  })

  it('legenda nasce com as quatro fatias ligadas e respeita a seleção recebida', () => {
    expect(initialCohortLegendSelection()).toEqual({
      'Ativou no mês': true,
      'Ativou depois': true,
      'Aguarda hoje': true,
      'Cancelou antes de ativar': true,
    })
    const legend = makeOverviewCohortOptions(pontos, 'light').legend as { selected?: unknown }
    expect(legend.selected).toEqual(initialCohortLegendSelection())

    const soAguarda = { ...initialCohortLegendSelection(), 'Ativou no mês': false }
    const custom = makeOverviewCohortOptions(pontos, 'light', soAguarda).legend as { selected?: unknown }
    expect(custom.selected).toEqual(soAguarda)
  })
})

describe('overviewCohortChartOptions: estado vazio', () => {
  const vazio = pontos.map((point) => ({
    ...point,
    sold: 0,
    activatedInMonth: 0,
    activatedLater: 0,
    awaiting: 0,
    cancelledBefore: 0,
    other: 0,
  }))

  it('sem venda em mês nenhum mostra o aviso centralizado, sem série nem animação', () => {
    expect(isCohortEmpty(vazio)).toBe(true)
    expect(isCohortEmpty(pontos)).toBe(false)
    const option = makeOverviewCohortOptions(vazio, 'dark')
    const title = option.title as { text?: string; textStyle?: { color?: string } }

    expect(title.text).toBe('Sem vendas na base')
    expect(title.textStyle?.color).toBe('#a9b5c6')
    expect(option.series).toBeUndefined()
    expect(option.animation).toBe(false)
    expect(buildCohortDescription(vazio)).toBe('Safra de vendas por mês: nenhuma venda na base.')
  })

  it('mês zerado no meio da coleção continua desenhado: zero é resultado', () => {
    const comMesZerado = [pontos[0], vazio[1], pontos[2]]
    const bars = series(makeOverviewCohortOptions(comMesZerado, 'light'))

    expect(values(bars[0])).toEqual([675, 0, 311])
    expect((makeOverviewCohortOptions(comMesZerado, 'light').xAxis as { data?: string[] }).data).toHaveLength(3)
  })
})
