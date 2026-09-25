import { describe, expect, it } from 'vitest'

import { statusColors } from '../../data/dashboardAggregates'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import { buildOsOutcome } from './overviewModel'
import {
  buildOutcomeDescription,
  buildOutcomeRows,
  buildOutcomeTooltip,
  drawnShares,
  firstVisibleSliceIndex,
  lastVisibleSliceIndex,
  makeOutcomeOptions,
  OUTCOME_AXIS_LABEL_WIDTH,
  OUTCOME_CLICK_HINT,
  OUTCOME_COLORS,
  OUTCOME_EMPTY_MESSAGE,
  OUTCOME_GRID_LEFT,
  OUTCOME_LABEL_PADDING,
  OUTCOME_MIN_DRAWN_SHARE,
  outcomeChartHeight,
  outcomeFromChartClick,
  outcomeSliceLabel,
  outcomeSubtitle,
  OUTCOME_SUBTITLE,
  sliceBorderRadius,
  sliceLabelFits,
} from './overviewOutcomeChartOptions'

function record(overrides: Partial<OverviewOsRecord> = {}): OverviewOsRecord {
  return {
    id: 'OS-1',
    dateISO: '2026-08-01',
    technicianId: null,
    team: null,
    serviceType: 'Instalação',
    category: 'fibra instalação',
    city: 'Atibaia',
    status: 'Concluída',
    statusKey: 'completed',
    resolution: null,
    ...overrides,
  }
}

/** 10 OS de cliente: 8 concluídas, 1 improdutiva, 1 encerrada. */
const customerOnly = [
  ...Array.from({ length: 8 }, (_, index) => record({ id: `c${index}` })),
  record({ id: 'u', status: 'Improdutiva', statusKey: 'unproductive' }),
  record({ id: 'e', status: 'Encerrada', statusKey: 'closed' }),
]

const withInfrastructure = [
  ...customerOnly,
  record({ id: 'i1', serviceType: 'Infraestrutura', status: 'Expirada', statusKey: 'expired' }),
  record({ id: 'i2', serviceType: 'Infraestrutura', status: 'Encerrada', statusKey: 'closed' }),
  record({ id: 'i3', serviceType: 'Infraestrutura', status: 'Agendada', statusKey: 'scheduled' }),
  record({ id: 'i4', serviceType: 'Infraestrutura' }),
]

/** 999 concluídas e 1 em aberto: a OS em mil que virava lasca. */
const oneInAThousand = [
  ...Array.from({ length: 999 }, (_, index) => record({ id: `c${index}` })),
  record({ id: 'open', status: 'Agendada', statusKey: 'scheduled' }),
]

function expectClose(actual: readonly number[], expected: readonly number[]) {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 10))
}

describe('paleta do destino das OS', () => {
  it('usa a cor semântica do status que representa cada saída, sem hex novo', () => {
    expect(OUTCOME_COLORS.completed).toBe(statusColors.Concluída)
    expect(OUTCOME_COLORS.unproductive).toBe(statusColors.Improdutiva)
    expect(OUTCOME_COLORS.notExecuted).toBe(statusColors.Encerrada)
    expect(OUTCOME_COLORS.open).toBe(statusColors.Agendada)
    expect(OUTCOME_COLORS.unknown).toBe(statusColors.Pendente)
  })
})

describe('rótulo dentro da fatia', () => {
  it('escreve só a quantidade, sem participação: ela vive no tooltip', () => {
    expect(outcomeSliceLabel(936)).toBe('936')
    expect(outcomeSliceLabel(1)).toBe('1')
    expect(outcomeSliceLabel(1023)).toBe('1.023')
  })

  it('saída zerada não tem texto, porque não tem barra', () => {
    expect(outcomeSliceLabel(0)).toBe('')
  })

  it('cabe ou não cabe é decidido pela medida em pixels, com respiro dos dois lados', () => {
    // "1" mede 6 px: cabe na fatia mínima de 26 px da tela do Mário.
    expect(sliceLabelFits(26, 6)).toBe(true)
    // Exatamente no limite: texto mais os dois respiros igual à fatia.
    expect(sliceLabelFits(6 + 2 * OUTCOME_LABEL_PADDING, 6)).toBe(true)
    // Um pixel a menos e o número sai, em vez de vazar para a vizinha.
    expect(sliceLabelFits(6 + 2 * OUTCOME_LABEL_PADDING - 1, 6)).toBe(false)
    // "1.023" mede 28 px: não cabe numa fatia de 20 px.
    expect(sliceLabelFits(20, 28)).toBe(false)
  })
})

describe('largura desenhada mínima', () => {
  it('participações já acima do mínimo não mudam', () => {
    expectClose(drawnShares([0.8, 0.1, 0.1, 0]), [0.8, 0.1, 0.1, 0])
  })

  it('a fatia abaixo do mínimo sobe até ele, as demais cedem na proporção e zero fica zero', () => {
    const drawn = drawnShares([0.9, 0.099, 0.001, 0])

    expect(drawn[2]).toBe(OUTCOME_MIN_DRAWN_SHARE)
    expect(drawn[3]).toBe(0)
    expect(drawn[0] / drawn[1]).toBeCloseTo(0.9 / 0.099, 10)
    expect(drawn.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10)
  })

  it('a fatia que só cai abaixo do mínimo depois de ceder espaço também é elevada', () => {
    // Três fatias exatamente no mínimo cederiam para 1,96% ao abrir espaço
    // para a lasca: todas as quatro terminam no mínimo, e a primeira paga.
    const min = OUTCOME_MIN_DRAWN_SHARE
    const drawn = drawnShares([1 - 3 * min - 0.001, min, min, min, 0.001])

    expectClose(drawn, [1 - 4 * min, min, min, min, min])
  })
})

describe('linhas do gráfico', () => {
  it('desenha só os grupos com OS, com as quatro saídas fixas em cada linha', () => {
    const rows = buildOutcomeRows(buildOsOutcome(customerOnly))

    expect(rows).toHaveLength(1)
    expect(rows[0].group).toBe('OS de cliente')
    expect(rows[0].total).toBe(10)
    expect(rows[0].slices.map((slice) => [slice.name, slice.count])).toEqual([
      ['Concluída', 8],
      ['Improdutiva', 1],
      ['Não executada', 1],
      ['Em aberto', 0],
    ])
    expect(rows[0].slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1)
    expect(rows[0].slices.reduce((sum, slice) => sum + slice.drawnShare, 0)).toBeCloseTo(1)
  })

  it('acrescenta "sem classificação" só quando alguma OS caiu nela', () => {
    const rows = buildOutcomeRows(
      buildOsOutcome([...customerOnly, record({ id: 'x', status: 'Rascunho', statusKey: null })]),
    )

    expect(rows[0].slices.map((slice) => slice.name)).toContain('Sem classificação')
    expect(rows[0].slices).toHaveLength(5)
  })

  it('uma OS em mil não vira lasca: a fatia sobe ao mínimo, leva o seu número e fecha a barra', () => {
    const rows = buildOutcomeRows(buildOsOutcome(oneInAThousand))
    const open = rows[0].slices[3]

    expect(open.count).toBe(1)
    expect(open.share).toBeCloseTo(0.001)
    expect(open.drawnShare).toBe(OUTCOME_MIN_DRAWN_SHARE)
    expect(open.label).toBe('1')
    // A concluída cede o espaço, e o número dela é o real.
    expect(rows[0].slices[0].drawnShare).toBeCloseTo(1 - OUTCOME_MIN_DRAWN_SHARE)
    expect(rows[0].slices[0].label).toBe('999')
    expect(lastVisibleSliceIndex(rows[0].slices)).toBe(3)
  })

  it('a primeira e a última fatia com OS levam o canto de cada ponta', () => {
    const rows = buildOutcomeRows(buildOsOutcome(customerOnly))

    expect(firstVisibleSliceIndex(rows[0].slices)).toBe(0)
    // Em aberto vale zero e não é a última visível: o canto direito vai para
    // "não executada", que fecha a barra de fato.
    expect(lastVisibleSliceIndex(rows[0].slices)).toBe(2)
    expect(sliceBorderRadius(rows[0].slices, 0)).toEqual([4, 0, 0, 4])
    expect(sliceBorderRadius(rows[0].slices, 1)).toEqual([0, 0, 0, 0])
    expect(sliceBorderRadius(rows[0].slices, 2)).toEqual([0, 4, 4, 0])
    expect(sliceBorderRadius(rows[0].slices, 3)).toEqual([0, 0, 0, 0])
  })

  it('barra com uma fatia só leva os dois cantos nela', () => {
    const rows = buildOutcomeRows(buildOsOutcome([record()]))

    expect(sliceBorderRadius(rows[0].slices, 0)).toEqual([4, 4, 4, 4])
  })

  it('a descrição acessível lista cada grupo e avisa o grupo sem OS', () => {
    const groups = buildOsOutcome(customerOnly)
    const description = buildOutcomeDescription(buildOutcomeRows(groups), groups)

    expect(description).toContain('Destino das OS do período. OS de cliente: 10 OS; Concluída 8 (80,0%)')
    expect(description).toContain('Infraestrutura: sem OS no recorte')
  })

  it('a descrição acessível diz a participação real, não a desenhada', () => {
    const groups = buildOsOutcome(oneInAThousand)

    expect(buildOutcomeDescription(buildOutcomeRows(groups), groups)).toContain('Em aberto 1 (0,1%)')
  })
})

describe('tooltip de uma fatia', () => {
  it('abre os status dentro da saída quando eles dizem algo além do nome dela', () => {
    const rows = buildOutcomeRows(buildOsOutcome(withInfrastructure))
    const infrastructure = rows[1]
    const notExecuted = infrastructure.slices[2]
    const tooltip = buildOutcomeTooltip(infrastructure, notExecuted)

    expect(tooltip).toContain('Infraestrutura · Não executada')
    expect(tooltip).toContain('2 OS · 50,0% de 4')
    expect(tooltip).toContain('Encerrada')
    expect(tooltip).toContain('Expirada')
    // O cabeçalho abre com o pontinho na cor da fatia, como nos demais
    // tooltips da página.
    expect(tooltip).toContain(`background-color:${OUTCOME_COLORS.notExecuted}`)

    // Concluída só tem o status Concluída: nada a abrir.
    const completed = buildOutcomeTooltip(rows[0], rows[0].slices[0])
    expect(completed).toContain('OS de cliente · Concluída')
    expect(completed).not.toContain('display:flex')
  })

  it('diz a participação real mesmo quando a fatia foi desenhada com o mínimo', () => {
    const rows = buildOutcomeRows(buildOsOutcome(oneInAThousand))

    expect(buildOutcomeTooltip(rows[0], rows[0].slices[3])).toContain('1 OS · 0,1% de 1.000')
  })
})

describe('opções do gráfico', () => {
  it('sem grupo com OS, devolve o painel vazio com a mensagem padrão', () => {
    const option = makeOutcomeOptions(buildOsOutcome([]), 'light')

    expect(option.title).toMatchObject({ text: OUTCOME_EMPTY_MESSAGE })
    expect(option.series).toBeUndefined()
  })

  it('monta uma série empilhada por saída e uma barra por grupo, com o cliente no topo', () => {
    const option = makeOutcomeOptions(buildOsOutcome(withInfrastructure), 'dark')
    const series = option.series as {
      name: string
      stack: string
      itemStyle: { color: string }
      data: { value: number; itemStyle: { borderRadius: number[] } }[]
    }[]

    expect(series.map((item) => item.name)).toEqual(['Concluída', 'Improdutiva', 'Não executada', 'Em aberto'])
    expect(new Set(series.map((item) => item.stack))).toEqual(new Set(['destino']))
    // A cor mora na série, que é o que a legenda lê: sem isso a legenda
    // pegava a paleta padrão da biblioteca e não batia com as barras.
    expect(series.map((item) => item.itemStyle.color)).toEqual([
      OUTCOME_COLORS.completed,
      OUTCOME_COLORS.unproductive,
      OUTCOME_COLORS.notExecuted,
      OUTCOME_COLORS.open,
    ])
    // O eixo desenha de baixo para cima: a infraestrutura vem primeiro na
    // coleção para o cliente ficar em cima.
    expect((option.yAxis as { data: string[] }).data).toEqual([
      'Infraestrutura · 4',
      'OS de cliente · 10',
    ])
    expect(series[0].data.map((item) => item.value)).toEqual([0.25, 0.8])
    // Cantos: a concluída abre as duas barras; a infraestrutura fecha em
    // "em aberto" e o cliente fecha em "não executada".
    expect(series[0].data.map((item) => item.itemStyle.borderRadius)).toEqual([
      [4, 0, 0, 4],
      [4, 0, 0, 4],
    ])
    expect(series[3].data[0].itemStyle.borderRadius).toEqual([0, 4, 4, 0])
    expect(series[2].data[1].itemStyle.borderRadius).toEqual([0, 4, 4, 0])
    const legend = option.legend as { data: string[]; selectedMode: boolean }
    expect(legend.data).toEqual(series.map((item) => item.name))
    // Numa barra de 100% a legenda só identifica: desligar uma saída
    // deixaria a barra somando menos do que os rótulos dizem.
    expect(legend.selectedMode).toBe(false)
    expect((option.aria as { label: { description: string } }).label.description).toContain(
      'Infraestrutura: 4 OS',
    )
  })

  it('desenha a largura mínima, e não a participação real, na fatia de uma OS em mil', () => {
    const option = makeOutcomeOptions(buildOsOutcome(oneInAThousand), 'light')
    const series = option.series as { data: { value: number }[] }[]

    expect(series[3].data[0].value).toBe(OUTCOME_MIN_DRAWN_SHARE)
    expect(series[0].data[0].value).toBeCloseTo(1 - OUTCOME_MIN_DRAWN_SHARE)
  })

  it('apaga o número da fatia em que ele não cabe, medindo na hora de desenhar', () => {
    const option = makeOutcomeOptions(buildOsOutcome(withInfrastructure), 'light')
    const series = option.series as {
      labelLayout: (params: { rect: { width: number }; labelRect: { width: number } }) => {
        fontSize?: number
      }
    }[]
    const layout = series[0].labelLayout

    expect(layout({ rect: { width: 26 }, labelRect: { width: 6 } })).toEqual({})
    expect(layout({ rect: { width: 12 }, labelRect: { width: 18 } })).toEqual({ fontSize: 0 })
  })

  it('reserva largura fixa para o rótulo do grupo, para a barra começar sempre no mesmo lugar', () => {
    const option = makeOutcomeOptions(buildOsOutcome(withInfrastructure), 'light')

    expect(option.grid).toMatchObject({ left: OUTCOME_GRID_LEFT, containLabel: false })
    expect((option.yAxis as { axisLabel: { width: number; overflow: string } }).axisLabel).toMatchObject({
      width: OUTCOME_AXIS_LABEL_WIDTH,
      overflow: 'truncate',
    })
  })

  it('cresce com a quantidade de barras', () => {
    expect(outcomeChartHeight(2)).toBe(164)
    expect(outcomeChartHeight(1)).toBe(108)
    expect(outcomeChartHeight(0)).toBe(108)
  })
})

describe('clique numa fatia', () => {
  const groups = buildOsOutcome(withInfrastructure)

  it('a barra de cima é a das OS de cliente, e a série é a saída', () => {
    // Desenho de baixo para cima: Infraestrutura (0), OS de cliente (1).
    // Séries na ordem do fluxo: Concluída (0), Improdutiva (1), Não executada (2), Em aberto (3).
    expect(outcomeFromChartClick(groups, { componentType: 'series', dataIndex: 1, seriesIndex: 2 })).toEqual({
      group: 'customer',
      outcome: 'notExecuted',
    })
    expect(outcomeFromChartClick(groups, { componentType: 'series', dataIndex: 0, seriesIndex: 3 })).toEqual({
      group: 'infrastructure',
      outcome: 'open',
    })
  })

  it('cada barra carrega o grupo que desenha', () => {
    expect(buildOutcomeRows(groups).map((row) => row.key)).toEqual(['customer', 'infrastructure'])
  })

  it('saída zerada, posição fora do desenho ou clique fora de fatia não abrem nada', () => {
    // OS de cliente não tem nenhuma "em aberto" neste recorte.
    expect(outcomeFromChartClick(groups, { componentType: 'series', dataIndex: 1, seriesIndex: 3 })).toBeNull()
    expect(outcomeFromChartClick(groups, { componentType: 'series', dataIndex: 5, seriesIndex: 0 })).toBeNull()
    expect(outcomeFromChartClick(groups, { componentType: 'legend' })).toBeNull()
    expect(outcomeFromChartClick([], { componentType: 'series', dataIndex: 0, seriesIndex: 0 })).toBeNull()
  })
})

describe('fatia Sem classificação', () => {
  it('entra como quinta série, e o clique nela abre a saída certa', () => {
    const groups = buildOsOutcome([...customerOnly, record({ id: 'x', status: 'Rascunho', statusKey: null })])

    expect(buildOutcomeRows(groups)[0].slices.map((slice) => slice.key)).toEqual([
      'completed',
      'unproductive',
      'notExecuted',
      'open',
      'unknown',
    ])
    expect(outcomeFromChartClick(groups, { componentType: 'series', dataIndex: 0, seriesIndex: 4 })).toEqual({
      group: 'customer',
      outcome: 'unknown',
    })
  })
})

describe('subtítulo do painel', () => {
  it('convida ao clique só com fatia para clicar e com a lista ligada', () => {
    const groups = buildOsOutcome(withInfrastructure)

    expect(outcomeSubtitle(groups, true)).toBe(`${OUTCOME_SUBTITLE}, ${OUTCOME_CLICK_HINT}`)
    // Base local de estudo: a lista é desligada, como a faixa Hoje ao vivo.
    expect(outcomeSubtitle(groups, false)).toBe(OUTCOME_SUBTITLE)
    // Recorte vazio: o painel diz que não há dados, e não há o que clicar.
    expect(outcomeSubtitle(buildOsOutcome([]), true)).toBe(OUTCOME_SUBTITLE)
  })
})
