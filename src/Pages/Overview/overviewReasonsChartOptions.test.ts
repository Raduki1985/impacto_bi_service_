import { describe, expect, it } from 'vitest'

import type { OverviewOsRecord } from '../../data/overviewOsData'
import {
  buildReasonsDescription,
  buildReasonSummary,
  buildReasonTooltip,
  makeReasonsOptions,
  REASON_COLOR,
  REASON_MISSING,
  REASON_NOT_SPECIFIED,
  REASON_UNCLEAR_COLOR,
  reasonsChartHeight,
  reasonsEmptyMessage,
  REASONS_EMPTY_MESSAGE,
  REASONS_NO_SOURCE_MESSAGE,
  REASONS_STATUS_FILTER_MESSAGE,
  reasonFromChartClick,
  reasonOf,
  reasonsSubtitle,
} from './overviewReasonsChartOptions'

/** Teste espelho do painel Motivos de improdutiva da Visão Geral de OS. */

let sequence = 0

function record(overrides: Partial<OverviewOsRecord> = {}): OverviewOsRecord {
  sequence += 1

  return {
    id: `OS-${sequence}`,
    dateISO: '2026-09-01',
    technicianId: null,
    team: null,
    serviceType: 'Instalação',
    category: 'Fibra Instalação',
    city: 'Atibaia',
    status: 'Improdutiva',
    statusKey: 'unproductive',
    resolution: null,
    ...overrides,
  }
}

const improdutiva = (reason: string | null, serviceType = 'Instalação') =>
  record({ unproductiveReason: reason, serviceType })

describe('motivos das improdutivas do recorte', () => {
  it('conta só as improdutivas, pela chave do SGI', () => {
    const summary = buildReasonSummary([
      improdutiva('Cliente ausente'),
      record({ status: 'Concluída', statusKey: 'completed', unproductiveReason: 'Cliente ausente' }),
      record({ status: 'Encerrada', statusKey: 'closed' }),
    ])

    expect(summary.total).toBe(1)
    expect(summary.rows).toHaveLength(1)
    expect(summary.rows[0]).toMatchObject({ reason: 'Cliente ausente', count: 1, share: 1 })
  })

  it('ordena os motivos reais pela quantidade e o empate pelo nome', () => {
    const summary = buildReasonSummary([
      improdutiva('Local sem condição'),
      improdutiva('Clima ou segurança'),
      improdutiva('Cliente ausente'),
      improdutiva('Cliente ausente'),
    ])

    expect(summary.rows.map((row) => row.reason)).toEqual([
      'Cliente ausente',
      'Clima ou segurança',
      'Local sem condição',
    ])
  })

  it('deixa as duas barras sem motivo real no fim, cinza, na ordem fixa, mesmo maiores', () => {
    const summary = buildReasonSummary([
      improdutiva(null),
      improdutiva(null),
      improdutiva(null),
      improdutiva(REASON_NOT_SPECIFIED),
      improdutiva(REASON_NOT_SPECIFIED),
      improdutiva('Cliente ausente'),
    ])

    expect(summary.rows.map((row) => [row.reason, row.count, row.unclear])).toEqual([
      ['Cliente ausente', 1, false],
      [REASON_NOT_SPECIFIED, 2, true],
      [REASON_MISSING, 3, true],
    ])
  })

  it('trata motivo em branco como sem motivo registrado', () => {
    const summary = buildReasonSummary([improdutiva('   '), improdutiva('Cliente ausente')])

    expect(summary.rows.map((row) => row.reason)).toEqual(['Cliente ausente', REASON_MISSING])
  })

  it('motivo novo do aplicativo entra com o nome que veio', () => {
    const summary = buildReasonSummary([improdutiva('Portão trancado')])

    expect(summary.rows[0]).toMatchObject({ reason: 'Portão trancado', unclear: false })
  })

  it('conta cliente e infraestrutura juntos, com a divisão por motivo', () => {
    const summary = buildReasonSummary([
      improdutiva('Cliente ausente'),
      improdutiva('Cliente ausente', 'Infraestrutura'),
      improdutiva(REASON_NOT_SPECIFIED, 'Infraestrutura'),
    ])

    expect(summary).toMatchObject({ total: 3, customer: 1, infrastructure: 2 })
    expect(summary.rows[0]).toMatchObject({ reason: 'Cliente ausente', customer: 1, infrastructure: 1 })
    expect(summary.rows[0].share).toBeCloseTo(2 / 3)
  })
})

describe('estados vazios', () => {
  it('sem improdutiva diz que não houve, ou que o filtro de Status as tirou', () => {
    const summary = buildReasonSummary([])

    expect(reasonsEmptyMessage(summary, false)).toBe(REASONS_EMPTY_MESSAGE)
    expect(reasonsEmptyMessage(summary, true)).toBe(REASONS_STATUS_FILTER_MESSAGE)
  })

  it('fonte sem o campo não afirma "sem motivo registrado"', () => {
    const summary = buildReasonSummary([improdutiva(null), improdutiva(null)])

    expect(summary.hasReason).toBe(false)
    expect(reasonsEmptyMessage(summary, false)).toBe(REASONS_NO_SOURCE_MESSAGE)
  })

  it('o gráfico vazio vira um título centralizado, com a mesma frase na leitura acessível', () => {
    const option = makeReasonsOptions(buildReasonSummary([]), 'light', true) as {
      title: { text: string }
      aria: { label: { description: string } }
      series?: unknown
    }

    expect(option.title.text).toBe(REASONS_STATUS_FILTER_MESSAGE)
    expect(option.aria.label.description).toContain(REASONS_STATUS_FILTER_MESSAGE)
    expect(option.series).toBeUndefined()
  })
})

describe('texto do painel', () => {
  it('o subtítulo diz de que grupo são as improdutivas e que a barra abre as OS', () => {
    expect(reasonsSubtitle(buildReasonSummary([improdutiva('Cliente ausente')]), true)).toBe(
      '1 improdutiva de cliente · todos os filtros aplicados · clique numa barra para ver as OS',
    )
    expect(
      reasonsSubtitle(buildReasonSummary([improdutiva('Cliente ausente'), improdutiva(null)]), true),
    ).toBe('2 improdutivas de cliente · todos os filtros aplicados · clique numa barra para ver as OS')
    expect(
      reasonsSubtitle(
        buildReasonSummary([
          improdutiva('Cliente ausente'),
          improdutiva('Cliente ausente', 'Infraestrutura'),
        ]),
        true,
      ),
    ).toBe('1 de cliente · 1 de infraestrutura · todos os filtros aplicados · clique numa barra para ver as OS')
    expect(
      reasonsSubtitle(buildReasonSummary([improdutiva('Cliente ausente', 'Infraestrutura')]), true),
    ).toBe('1 improdutiva de infraestrutura · todos os filtros aplicados · clique numa barra para ver as OS')
    expect(reasonsSubtitle(buildReasonSummary([]), true)).toBe(
      'Por que a visita falhou · todos os filtros aplicados',
    )
  })

  it('sem o campo de motivo na fonte, o subtítulo não convida a um clique que não abre nada', () => {
    // A base local de estudo não tem o motivo: o painel mostra o aviso, sem barras.
    expect(reasonsSubtitle(buildReasonSummary([improdutiva(null)]), true)).toBe(
      '1 improdutiva de cliente · todos os filtros aplicados',
    )
  })

  it('com a lista desligada, as barras não convidam ao clique', () => {
    expect(reasonsSubtitle(buildReasonSummary([improdutiva('Cliente ausente')]), false)).toBe(
      '1 improdutiva de cliente · todos os filtros aplicados',
    )
  })

  it('a leitura acessível lista as mesmas barras, na mesma ordem', () => {
    const summary = buildReasonSummary([
      improdutiva(null),
      improdutiva('Cliente ausente'),
      improdutiva('Cliente ausente'),
      improdutiva('Local sem condição'),
    ])

    expect(buildReasonsDescription(summary, null)).toBe(
      'Motivos de improdutiva. 4 improdutivas no recorte. Cliente ausente: 2, 50,0%. Local sem condição: 1, 25,0%. Sem motivo registrado: 1, 25,0%.',
    )
    // Singular também na leitura de tela, como no subtítulo.
    expect(buildReasonsDescription(buildReasonSummary([improdutiva('Cliente ausente')]), null)).toBe(
      'Motivos de improdutiva. 1 improdutiva no recorte. Cliente ausente: 1, 100,0%.',
    )
  })

  it('o tooltip divide por grupo só quando há infraestrutura e explica a barra cinza', () => {
    const summary = buildReasonSummary([
      improdutiva('Cliente ausente'),
      improdutiva(REASON_NOT_SPECIFIED),
      improdutiva(REASON_NOT_SPECIFIED, 'Infraestrutura'),
    ])
    const [ausente, naoEspecificado] = summary.rows

    expect(buildReasonTooltip(ausente, '#ccc')).not.toContain('De infraestrutura')
    const tooltip = buildReasonTooltip(naoEspecificado, '#ccc')
    expect(tooltip).toContain('De infraestrutura')
    expect(tooltip).toContain('especificar nas observações')
    expect(tooltip).toContain(REASON_UNCLEAR_COLOR)
  })

  it('a altura fica em 280 até oito barras e cresce a partir da nona', () => {
    expect(reasonsChartHeight(8)).toBe(280)
    expect(reasonsChartHeight(0)).toBe(280)
    expect(reasonsChartHeight(9)).toBe(286)
    expect(reasonsChartHeight(12)).toBe(376)
  })
})

describe('desenho', () => {
  it('o motivo mais frequente fica no topo e as barras cinza embaixo, com a cor certa', () => {
    const summary = buildReasonSummary([
      improdutiva(null),
      improdutiva('Cliente ausente'),
      improdutiva('Cliente ausente'),
    ])
    const option = makeReasonsOptions(summary, 'dark', false) as {
      yAxis: { data: string[] }
      series: { data: { value: number; itemStyle: { color: string } }[] }[]
    }

    // O eixo desenha de baixo para cima: o último item é o do topo.
    expect(option.yAxis.data).toEqual([REASON_MISSING, 'Cliente ausente'])
    expect(option.series[0].data.map((item) => [item.value, item.itemStyle.color])).toEqual([
      [1, REASON_UNCLEAR_COLOR],
      [2, REASON_COLOR],
    ])
  })

  it('o nome do motivo no eixo também recebe o clique', () => {
    const option = makeReasonsOptions(buildReasonSummary([improdutiva('Cliente ausente')]), 'light', false)

    expect((option.yAxis as { triggerEvent?: boolean }).triggerEvent).toBe(true)
  })
})

describe('clique numa barra', () => {
  const summary = buildReasonSummary([
    improdutiva(null),
    improdutiva('Clima ou segurança'),
    improdutiva('Cliente ausente'),
    improdutiva('Cliente ausente'),
  ])

  it('a posição na série é a da lista desenhada, de baixo para cima', () => {
    // Desenho: Sem motivo registrado (0), Clima ou segurança (1), Cliente ausente (2).
    expect(reasonFromChartClick(summary, { componentType: 'series', dataIndex: 2 })).toBe(
      'Cliente ausente',
    )
    expect(reasonFromChartClick(summary, { componentType: 'series', dataIndex: 0 })).toBe(
      REASON_MISSING,
    )
  })

  it('o nome no eixo abre o mesmo motivo da barra', () => {
    expect(reasonFromChartClick(summary, { componentType: 'yAxis', value: 'Clima ou segurança' })).toBe(
      'Clima ou segurança',
    )
  })

  it('clique fora de uma barra, ou num motivo que não está no painel, não abre nada', () => {
    expect(reasonFromChartClick(summary, { componentType: 'series', dataIndex: 9 })).toBeNull()
    expect(reasonFromChartClick(summary, { componentType: 'yAxis', value: 'Material em falta' })).toBeNull()
    expect(reasonFromChartClick(summary, { componentType: 'title' })).toBeNull()
    expect(reasonFromChartClick(summary, null)).toBeNull()
  })

  it('o motivo da OS é o do painel: sem motivo, "Sem motivo registrado"', () => {
    expect(reasonOf({ unproductiveReason: '  Cliente ausente ' })).toBe('Cliente ausente')
    expect(reasonOf({ unproductiveReason: '   ' })).toBe(REASON_MISSING)
    expect(reasonOf({})).toBe(REASON_MISSING)
  })
})
