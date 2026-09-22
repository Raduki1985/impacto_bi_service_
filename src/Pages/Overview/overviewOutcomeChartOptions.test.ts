import { describe, expect, it } from 'vitest'

import { statusColors } from '../../data/dashboardAggregates'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import { buildOsOutcome } from './overviewModel'
import {
  buildOutcomeDescription,
  buildOutcomeRows,
  buildOutcomeTooltip,
  lastVisibleSliceIndex,
  makeOutcomeOptions,
  OUTCOME_COLORS,
  OUTCOME_EMPTY_MESSAGE,
  outcomeChartHeight,
  outcomeSliceLabel,
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
  it('escreve quantidade e participação quando cabe, só a quantidade quando cabe menos, e nada quando não cabe', () => {
    expect(outcomeSliceLabel(936, 0.841)).toBe('936 · 84,1%')
    expect(outcomeSliceLabel(100, 0.08)).toBe('100')
    expect(outcomeSliceLabel(5, 0.01)).toBe('')
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
  })

  it('acrescenta "sem classificação" só quando alguma OS caiu nela', () => {
    const rows = buildOutcomeRows(
      buildOsOutcome([...customerOnly, record({ id: 'x', status: 'Rascunho', statusKey: null })]),
    )

    expect(rows[0].slices.map((slice) => slice.name)).toContain('Sem classificação')
    expect(rows[0].slices).toHaveLength(5)
  })

  it('a última fatia visível é a que leva o canto arredondado', () => {
    const rows = buildOutcomeRows(buildOsOutcome(customerOnly))

    // Em aberto vale zero e não é a última visível: o canto vai para "não
    // executada", que fecha a barra de fato.
    expect(lastVisibleSliceIndex(rows[0].slices)).toBe(2)
  })

  it('uma fatia final pequena ainda fecha a barra; só a lasca abaixo do piso perde o canto', () => {
    // 1 OS em aberto em 135 (0,7%): é o recorte real da base local para a
    // infraestrutura, e a fatia tem alguns pixels na largura do painel.
    const small = buildOutcomeRows(
      buildOsOutcome([
        ...Array.from({ length: 134 }, (_, index) => record({ id: `c${index}` })),
        record({ id: 'open', status: 'Agendada', statusKey: 'scheduled' }),
      ]),
    )
    expect(lastVisibleSliceIndex(small[0].slices)).toBe(3)

    // 1 em 500 (0,2%) é lasca: o canto volta para a fatia anterior.
    const sliver = buildOutcomeRows(
      buildOsOutcome([
        ...Array.from({ length: 499 }, (_, index) => record({ id: `c${index}` })),
        record({ id: 'open', status: 'Agendada', statusKey: 'scheduled' }),
      ]),
    )
    expect(lastVisibleSliceIndex(sliver[0].slices)).toBe(0)
  })

  it('a descrição acessível lista cada grupo e avisa o grupo sem OS', () => {
    const groups = buildOsOutcome(customerOnly)
    const description = buildOutcomeDescription(buildOutcomeRows(groups), groups)

    expect(description).toContain('Destino das OS do período. OS de cliente: 10 OS; Concluída 8 (80,0%)')
    expect(description).toContain('Infraestrutura: sem OS no recorte')
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
      data: { value: number }[]
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
    const legend = option.legend as { data: string[]; selectedMode: boolean }
    expect(legend.data).toEqual(series.map((item) => item.name))
    // Numa barra de 100% a legenda só identifica: desligar uma saída
    // deixaria a barra somando menos do que os rótulos dizem.
    expect(legend.selectedMode).toBe(false)
    expect((option.aria as { label: { description: string } }).label.description).toContain(
      'Infraestrutura: 4 OS',
    )
  })

  it('cresce com a quantidade de barras', () => {
    expect(outcomeChartHeight(2)).toBe(164)
    expect(outcomeChartHeight(1)).toBe(108)
    expect(outcomeChartHeight(0)).toBe(108)
  })
})
