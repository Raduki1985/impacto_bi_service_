import type { BarSeriesOption } from 'echarts'
import { describe, expect, it } from 'vitest'

import { formatNumber, formatPercent } from '../../../lib/formatters'
import { formatAxisInteger, MIN_DRAWN_SLICE_SHARE } from './overviewChartOptions'
import {
  buildCohortDescription,
  buildCohortTooltip,
  COHORT_SERIES,
  COHORT_STACK_ORDER,
  cohortBarLabel,
  cohortBarRadius,
  cohortChartMax,
  cohortColor,
  cohortFromChartClick,
  cohortFromMonthIndex,
  cohortPanelSubtitle,
  cohortShare,
  cohortTooltipFormatter,
  cohortTopSlice,
  cohortVisibleTotal,
  initialCohortLegendSelection,
  isCohortEmpty,
  makeOverviewCohortOptions,
} from './overviewCohortChartOptions'
import type { OverviewCohortPoint } from './overviewModel'

// Julho a setembro de 2026 em produção, medidos em 17/09/2026.
const pontos: OverviewCohortPoint[] = [
  { month: '2026-07', label: 'Jul/26', sold: 790, activatedInMonth: 675, activatedLater: 66, awaiting: 49, cancelled: 0, other: 0 },
  { month: '2026-08', label: 'Ago/26', sold: 826, activatedInMonth: 684, activatedLater: 66, awaiting: 73, cancelled: 3, other: 0 },
  { month: '2026-09', label: 'Set/26', sold: 393, activatedInMonth: 311, activatedLater: 0, awaiting: 81, cancelled: 1, other: 0 },
]

type BarItem = {
  value: number
  itemStyle: { borderRadius: number | number[]; opacity?: number }
  label?: { show?: boolean; position?: string; formatter?: () => string }
}

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
  it('empilha na ordem do fluxo, com a cancelada no topo, igual à legenda', () => {
    const option = makeOverviewCohortOptions(pontos, 'light')
    const bars = series(option)
    const legend = option.legend as { data?: string[] }

    // Ordem da pilha, do piso para o topo: a cancelada fecha a barra desde
    // 28/09/2026 (pedido do Mário); antes ela ficava no piso.
    expect(bars.map((bar) => bar.name)).toEqual([
      'Ativou no mês',
      'Ativou depois',
      'Aguarda hoje',
      'Cancelou',
    ])
    // Ordem da legenda e do tooltip: o fluxo, como na leitura do card.
    expect(legend.data).toEqual([
      'Ativou no mês',
      'Ativou depois',
      'Aguarda hoje',
      'Cancelou',
    ])
    expect(COHORT_STACK_ORDER).toHaveLength(COHORT_SERIES.length)
    expect([...COHORT_STACK_ORDER].sort()).toEqual([...COHORT_SERIES.map((s) => s.id)].sort())
    expect(bars.every((bar) => bar.stack === 'safra')).toBe(true)
    // A cancelada de agosto (3) e a de setembro (1) são desenhadas com a
    // altura mínima, 4% do maior mês (28/09/2026); julho não tem cancelada e
    // fica zero, e sem fatia pequena não muda nada.
    const piso = cohortChartMax(pontos) * MIN_DRAWN_SLICE_SHARE
    expect(values(bars[3])).toEqual([0, piso, piso])
    expect(values(bars[0])[0]).toBe(675)
    // As quatro fatias fecham com o vendido de cada mês, como o adaptador
    // exige: o mínimo sai da fatia grande do mesmo mês.
    pontos.forEach((point, index) => {
      const soma = bars.reduce((total, bar) => total + values(bar)[index], 0)
      expect(soma + point.other).toBeCloseTo(point.sold, 6)
    })
  })

  it('cor fixa por fatia, a identidade de cada card, medida contra a superfície de cada tema', () => {
    // Opção A, escolha do Mário em 18/09/2026: verde de Vendas ativadas, azul
    // do Tempo até a ativação e âmbar de Aguardando Ativação; desde
    // 02/10/2026, o vermelho desfavorável do portal em Cancelou.
    expect(COHORT_SERIES.map((s) => cohortColor(s.id, 'light'))).toEqual([
      '#00a862',
      '#2563eb',
      '#d97706',
      '#e5384e',
    ])
    expect(COHORT_SERIES.map((s) => cohortColor(s.id, 'dark'))).toEqual([
      '#00d776',
      '#3b82f6',
      '#e8890b',
      '#ff4d6a',
    ])
    const light = series(makeOverviewCohortOptions(pontos, 'light'))
    const dark = series(makeOverviewCohortOptions(pontos, 'dark'))
    light.forEach((bar, index) => {
      expect(bar.itemStyle?.color).toBe(cohortColor(COHORT_STACK_ORDER[index], 'light'))
      expect(dark[index].itemStyle?.color).toBe(cohortColor(COHORT_STACK_ORDER[index], 'dark'))
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

  it('escreve o milhar do eixo vertical em pt-BR, com o mesmo formatador do painel Vendas ativadas por mês', () => {
    const yAxis = makeOverviewCohortOptions(pontos, 'light').yAxis as {
      axisLabel?: { formatter?: (value: number) => string }
    }

    expect(formatAxisInteger(1000)).toBe('1.000')
    expect(yAxis.axisLabel?.formatter).toBe(formatAxisInteger)
  })
})

describe('overviewCohortChartOptions: cantos das barras', () => {
  it('arredonda só o topo da pilha: a base fica reta sobre o eixo', () => {
    // Julho, sem cancelada: o topo é "Aguarda hoje" e nenhuma fatia leva
    // canto na base, nem a que apoia a barra (decisão do Mário em 18/09/2026).
    expect(cohortBarRadius(pontos[0], 'activatedInMonth')).toBe(0)
    expect(cohortBarRadius(pontos[0], 'activatedLater')).toBe(0)
    expect(cohortBarRadius(pontos[0], 'awaiting')).toEqual([3, 3, 0, 0])
    expect(cohortBarRadius(pontos[0], 'cancelled')).toBe(0)
    // Agosto, com as quatro fatias: a cancelada fecha a barra.
    expect(cohortBarRadius(pontos[1], 'cancelled')).toEqual([3, 3, 0, 0])
    expect(cohortBarRadius(pontos[1], 'activatedInMonth')).toBe(0)
    expect(cohortBarRadius(pontos[1], 'awaiting')).toBe(0)
  })

  it('a cancelada pequena no topo ganha a altura mínima e leva o canto', () => {
    // Agosto tem 3 canceladas e setembro 1: sem o mínimo, no topo, eram a
    // tampa reta que o Mário viu em 18/09/2026.
    const chartMax = cohortChartMax(pontos)

    expect(chartMax).toBe(826)
    expect(cohortBarRadius(pontos[1], 'cancelled', undefined, chartMax)).toEqual([3, 3, 0, 0])
    expect(cohortBarRadius(pontos[1], 'awaiting', undefined, chartMax)).toBe(0)
    expect(cohortBarRadius(pontos[2], 'cancelled', undefined, chartMax)).toEqual([3, 3, 0, 0])
    expect(cohortBarRadius(pontos[2], 'awaiting', undefined, chartMax)).toBe(0)
  })

  it('fatia pequena no topo ganha a altura mínima e leva o canto e o total', () => {
    // 5 aguardando num gráfico de 826: antes da altura mínima (28/09/2026)
    // era uma lasca reta em cima da fatia azul arredondada.
    const maio = { ...pontos[0], sold: 685, activatedInMonth: 610, activatedLater: 70, awaiting: 5, cancelled: 0 }
    const bars = series(makeOverviewCohortOptions([maio, pontos[1]], 'light'))
    const aguarda = items(bars[2])[0]

    expect(cohortTopSlice(maio, undefined, 826)).toBe('awaiting')
    expect(aguarda.value).toBeCloseTo(826 * MIN_DRAWN_SLICE_SHARE, 6)
    expect(aguarda.itemStyle.borderRadius).toEqual([3, 3, 0, 0])
    expect(aguarda.label?.show).toBe(true)
    expect(aguarda.label?.formatter?.()).toBe('685')
    expect(items(bars[1])[0].itemStyle.borderRadius).toBe(0)
    // O tooltip segue com o número real.
    expect(buildCohortTooltip(maio, 'light')).toContain('5 (0,7%)')
  })

  it('o gráfico monta os cantos com a régua do maior mês', () => {
    const bars = series(makeOverviewCohortOptions(pontos, 'light'))
    const [noMes, , aguarda, cancelada] = bars
    // Agosto: nada arredondado na base, e o topo na cancelada.
    expect(items(noMes)[1].itemStyle.borderRadius).toBe(0)
    expect(items(aguarda)[1].itemStyle.borderRadius).toBe(0)
    expect(items(cancelada)[1].itemStyle.borderRadius).toEqual([3, 3, 0, 0])
  })

  it('põe o total da barra em cima dela, na fatia que fecha a pilha', () => {
    const bars = series(makeOverviewCohortOptions(pontos, 'light'))
    const rotulos = bars.flatMap((bar) =>
      items(bar)
        .map((item, index) => ({ index, label: item.label }))
        .filter((item) => item.label?.show),
    )

    // Um rótulo por mês, e nenhum a mais.
    expect(rotulos).toHaveLength(pontos.length)
    expect(rotulos.map((item) => item.index).sort()).toEqual([0, 1, 2])
    rotulos.forEach((item) => {
      expect(item.label?.position).toBe('top')
      expect(item.label?.formatter?.()).toBe(formatNumber(pontos[item.index].sold))
    })
  })

  it('com outras situações no mês, o rótulo é o vendido, o mesmo do tooltip, sem fatia própria', () => {
    // Setembro de 2026 em 02/10/2026: 704 nas quatro fatias e 3 fora delas.
    // Até esse dia o rótulo dizia 704 e o tooltip 707.
    const setembro = {
      ...pontos[2],
      sold: 707,
      activatedInMonth: 583,
      activatedLater: 19,
      awaiting: 99,
      cancelled: 3,
      other: 3,
    }
    const bars = series(makeOverviewCohortOptions([pontos[1], setembro], 'light'))
    const rotulo = items(bars[3])[1].label

    expect(bars).toHaveLength(4)
    expect(cohortVisibleTotal(setembro)).toBe(704)
    expect(cohortBarLabel(setembro)).toBe(707)
    expect(rotulo?.show).toBe(true)
    expect(rotulo?.formatter?.()).toBe('707')
    expect(buildCohortTooltip(setembro, 'light')).toContain('Set/26: 707 vendidas')
  })

  it('com fatia desligada, o rótulo diz o que a barra mede, e não o vendido do mês', () => {
    const semAtivadas = {
      ...initialCohortLegendSelection(),
      'Ativou no mês': false,
      'Ativou depois': false,
    }
    const bars = series(makeOverviewCohortOptions(pontos, 'light', semAtivadas))
    const rotulo = items(bars[3])[1].label

    expect(cohortVisibleTotal(pontos[1], semAtivadas)).toBe(76)
    expect(rotulo?.show).toBe(true)
    expect(rotulo?.formatter?.()).toBe('76')
  })

  it('mês sem venda nenhuma não ganha rótulo solto', () => {
    const semVenda = { ...pontos[0], sold: 0, activatedInMonth: 0, activatedLater: 0, awaiting: 0, cancelled: 0 }
    const bars = series(makeOverviewCohortOptions([semVenda, pontos[1]], 'light'))

    expect(cohortTopSlice(semVenda)).toBeNull()
    bars.forEach((bar) => expect(items(bar)[0].label?.show).toBe(false))
  })

  it('nenhuma fatia recebe canto na base, em mês nenhum', () => {
    const bars = series(makeOverviewCohortOptions(pontos, 'light'))

    bars.forEach((bar) => {
      items(bar).forEach((item) => {
        const radius = item.itemStyle.borderRadius
        const soTopo = radius === 0 || JSON.stringify(radius) === JSON.stringify([3, 3, 0, 0])
        expect(soTopo).toBe(true)
      })
    })
  })

  it('só com Aguarda hoje e Cancelou ligados, a cancelada fecha a barra com o mínimo', () => {
    // O caso do print do Mário em 18/09/2026: com as ativadas desligadas, a
    // cancelada de 1 venda virava uma tampa reta. Com a altura mínima ela é
    // uma fatia de verdade, e leva o canto.
    const soFila = {
      ...initialCohortLegendSelection(),
      'Ativou no mês': false,
      'Ativou depois': false,
    }
    const chartMax = cohortChartMax(pontos, soFila)

    expect(chartMax).toBe(82)
    expect(cohortBarRadius(pontos[2], 'cancelled', soFila, chartMax)).toEqual([3, 3, 0, 0])
    expect(cohortBarRadius(pontos[2], 'awaiting', soFila, chartMax)).toBe(0)
    expect(cohortBarRadius(pontos[1], 'cancelled', soFila, chartMax)).toEqual([3, 3, 0, 0])
    expect(cohortBarRadius(pontos[1], 'awaiting', soFila, chartMax)).toBe(0)
    const setembro = items(series(makeOverviewCohortOptions(pontos, 'light', soFila))[3])[2]
    expect(setembro.value).toBeCloseTo(chartMax * MIN_DRAWN_SLICE_SHARE, 6)
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

  it('uma fatia sozinha arredonda o topo e apoia reto no eixo', () => {
    const soUmaFatia = { ...pontos[0], sold: 10, activatedInMonth: 10, activatedLater: 0, awaiting: 0, cancelled: 0 }

    expect(cohortBarRadius(soUmaFatia, 'activatedInMonth')).toEqual([3, 3, 0, 0])
    expect(cohortBarRadius(soUmaFatia, 'activatedInMonth', undefined, 826)).toEqual([3, 3, 0, 0])
  })

  it('fatia desligada na legenda deixa de contar para o topo', () => {
    const semAguarda = { ...initialCohortLegendSelection(), 'Aguarda hoje': false }

    expect(cohortBarRadius(pontos[0], 'awaiting', semAguarda)).toBe(0)
    expect(cohortBarRadius(pontos[0], 'activatedLater', semAguarda)).toEqual([3, 3, 0, 0])
    const bars = series(makeOverviewCohortOptions(pontos, 'light', semAguarda))
    // Julho, com Aguarda desligada: o topo é "Ativou depois", a segunda da pilha.
    expect(items(bars[1])[0].itemStyle.borderRadius).toEqual([3, 3, 0, 0])
  })
})

describe('overviewCohortChartOptions: participação e tooltip', () => {
  it('participação é a fatia sobre o vendido, e zero sem venda', () => {
    expect(cohortShare(pontos[1], 'activatedInMonth')).toBeCloseTo(684 / 826, 10)
    expect(
      cohortShare({ ...pontos[0], sold: 0, activatedInMonth: 0, activatedLater: 0, awaiting: 0, cancelled: 0 }, 'awaiting'),
    ).toBe(0)
  })

  it('tooltip traz o vendido no título e cada fatia com quantidade e participação', () => {
    const html = buildCohortTooltip(pontos[1], 'light')

    expect(html).toContain('Ago/26: 826 vendidas')
    expect(html).toContain('Ativou no mês')
    expect(html).toContain(`684 (${formatPercent(684 / 826)})`)
    expect(html).toContain('Cancelou')
    expect(html).toContain(`3 (${formatPercent(3 / 826)})`)
    expect(html).toContain(cohortColor('awaiting', 'light'))
    expect(html).not.toContain('Outras situações')
    expect(html).not.toContain('—')
  })

  it('fatia zerada não entra no tooltip, e o mês sem venda não abre caixa', () => {
    // Setembro não tem "Ativou depois"; julho não tem cancelada.
    const setembro = buildCohortTooltip(pontos[2], 'light')
    const julho = buildCohortTooltip(pontos[0], 'light')
    const semVenda = { ...pontos[0], sold: 0, activatedInMonth: 0, activatedLater: 0, awaiting: 0, cancelled: 0 }

    expect(setembro).not.toContain('Ativou depois')
    expect(setembro).toContain('Ativou no mês')
    expect(julho).not.toContain('Cancelou')
    expect(julho).not.toContain('0 (0,0%)')
    expect(buildCohortTooltip(semVenda, 'light')).toBe('')
  })

  it('só menciona outras situações quando existem, alinhada às fatias, e fala no singular com uma venda', () => {
    const comOutras = buildCohortTooltip({ ...pontos[2], other: 2 }, 'dark')

    expect(comOutras).toContain('Outras situações')
    expect(comOutras).toContain('width:16px')
    expect(
      buildCohortTooltip(
        { month: '2026-01', label: 'Jan/26', sold: 1, activatedInMonth: 1, activatedLater: 0, awaiting: 0, cancelled: 0, other: 0 },
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
      'Evolução mensal das vendas. Jul/26: 790 vendidas, ativou no mês 675, ativou depois 66, aguarda hoje 49, cancelou 0.',
    )
    expect(buildCohortDescription([{ ...pontos[0], other: 2 }])).toContain(
      'cancelou 0, outras situações 2.',
    )
  })

  it('legenda nasce com as quatro fatias ligadas e respeita a seleção recebida', () => {
    expect(initialCohortLegendSelection()).toEqual({
      'Ativou no mês': true,
      'Ativou depois': true,
      'Aguarda hoje': true,
      Cancelou: true,
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
    cancelled: 0,
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
    expect(buildCohortDescription(vazio)).toBe('Evolução mensal das vendas: nenhuma venda na base.')
  })

  it('mês zerado no meio da coleção continua desenhado: zero é resultado', () => {
    const comMesZerado = [pontos[0], vazio[1], pontos[2]]
    const bars = series(makeOverviewCohortOptions(comMesZerado, 'light'))

    // A primeira da pilha é "Ativou no mês", no piso.
    expect(values(bars[0])[0]).toBe(675)
    bars.forEach((bar) => expect(values(bar)[1]).toBe(0))
    expect((makeOverviewCohortOptions(comMesZerado, 'light').xAxis as { data?: string[] }).data).toHaveLength(3)
  })
})

describe('overviewCohortChartOptions: clique que abre a janela de contratos', () => {
  it('a fatia clicada abre o mês e a fatia', () => {
    expect(
      cohortFromChartClick(pontos, { componentType: 'series', dataIndex: 1, seriesName: 'Aguarda hoje' }),
    ).toEqual({ month: '2026-08', series: 'awaiting' })
  })

  it('o nome do mês embaixo do eixo e o fundo da coluna abrem o mês inteiro', () => {
    expect(cohortFromChartClick(pontos, { componentType: 'xAxis', value: 'Set/26' })).toEqual({
      month: '2026-09',
      series: null,
    })
    expect(cohortFromMonthIndex(pontos, 0)).toEqual({ month: '2026-07', series: null })
    // O eixo avisa o clique no nome do mês.
    expect(
      (makeOverviewCohortOptions(pontos, 'light').xAxis as { triggerEvent?: boolean }).triggerEvent,
    ).toBe(true)
  })

  it('fatia zerada, mês sem venda e alvo desconhecido não abrem nada', () => {
    // Julho não tem cancelada.
    expect(
      cohortFromChartClick(pontos, {
        componentType: 'series',
        dataIndex: 0,
        seriesName: 'Cancelou',
      }),
    ).toBeNull()
    const semVenda = [{ ...pontos[0], sold: 0, activatedInMonth: 0, activatedLater: 0, awaiting: 0 }]
    expect(cohortFromMonthIndex(semVenda, 0)).toBeNull()
    expect(cohortFromMonthIndex(pontos, 9)).toBeNull()
    expect(
      cohortFromChartClick(pontos, { componentType: 'series', dataIndex: 0, seriesName: 'Outra série' }),
    ).toBeNull()
    expect(cohortFromChartClick(pontos, { componentType: 'legend' })).toBeNull()
    expect(cohortFromChartClick(pontos, null)).toBeNull()
  })

  it('o subtítulo convida ao clique só com o serviço ligado e algum mês com venda', () => {
    const convite = 'Clique numa barra ou no mês para ver os contratos.'
    const vazio = pontos.map((point) => ({ ...point, sold: 0, activatedInMonth: 0, activatedLater: 0, awaiting: 0, cancelled: 0 }))

    expect(cohortPanelSubtitle(pontos, true)).toContain(convite)
    expect(cohortPanelSubtitle(pontos, false)).not.toContain(convite)
    expect(cohortPanelSubtitle(vazio, true)).not.toContain(convite)
    expect(cohortPanelSubtitle(null, true)).not.toContain(convite)
    expect(cohortPanelSubtitle(pontos, false)).toContain('o filtro de período não muda este gráfico')
  })
})
