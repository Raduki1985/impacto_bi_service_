import { describe, expect, it } from 'vitest'

import { reasonSummary as buildReasonSummary, type ReasonItem } from './osPeriodFixture.testing'
import {
  buildReasonsDescription,
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
  reasonsSubtitle,
} from './overviewReasonsChartOptions'

/** Teste espelho do painel Motivos de improdutiva da Visão Geral de OS. */

/**
 * Desde 01/10/2026 os motivos chegam contados do serviço (`reason_summary`,
 * com a regra testada lá); aqui eles são montados à mão para testar o painel.
 */
const improdutiva = (reason: string | null, serviceType = 'Instalação'): ReasonItem => [
  reason,
  serviceType === 'Infraestrutura' ? 'infrastructure' : 'customer',
]

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

  it('motivo só de infraestrutura não mostra "De cliente 0" no tooltip', () => {
    const [soInfra] = buildReasonSummary([
      improdutiva('Cliente ausente', 'Infraestrutura'),
      improdutiva('Cliente ausente', 'Infraestrutura'),
    ]).rows
    const tooltip = buildReasonTooltip(soInfra, '#ccc')

    expect(soInfra.customer).toBe(0)
    expect(tooltip).toContain('De infraestrutura')
    expect(tooltip).not.toContain('De cliente')
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

})
