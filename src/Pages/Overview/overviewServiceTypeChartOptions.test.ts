import { describe, expect, it } from 'vitest'

import { OS_DONUT_PALETTE } from '../../components/charts/chartOptions'
import { statusColors } from '../../data/dashboardAggregates'
import type { ServiceTypeSlice } from '../../data/overviewOsAggregates'
import { mixHexColors } from '../../lib/colorMix'
import { periodScenario } from './osPeriodFixture.testing'
import {
  buildServiceTypeDescription,
  buildServiceTypeRows,
  buildServiceTypeTooltip,
  DIMMED_SLICE_RATIO,
  makeServiceTypeOptions,
  SERVICE_TYPE_EMPTY_MESSAGE,
  SERVICE_TYPE_MIN_ANGLE,
  SERVICE_TYPE_TOOLTIP_LIMIT,
  SERVICE_TYPE_HOVER_SCALE,
  serviceTypeColor,
  serviceTypeDirectLabel,
  nextLegendServiceType,
  serviceTypeFromChartClick,
  serviceTypeFromLegendChange,
  serviceTypeMarker,
  serviceTypePanelHighlight,
  serviceTypeSubtitle,
  shownLegendServiceType,
  type ServiceTypeHighlight,
} from './overviewServiceTypeChartOptions'

const slices: ServiceTypeSlice[] = [
  {
    name: 'Instalação',
    value: 60,
    categories: [
      ['fibra instalação', 50],
      ['fibra instalação + segundo ponto', 10],
    ],
  },
  { name: 'Infraestrutura', value: 30, categories: [['REPARO DE CTO', 30]] },
  { name: 'Auditoria', value: 10, categories: [['Auditória de Infraestrutura', 10]] },
]

describe('linhas da composição por tipo', () => {
  it('calcula a participação sobre o total e preserva a ordem decrescente de entrada', () => {
    const rows = buildServiceTypeRows(slices)

    expect(rows.map((row) => row.name)).toEqual(['Instalação', 'Infraestrutura', 'Auditoria'])
    expect(rows.map((row) => row.share)).toEqual([0.6, 0.3, 0.1])
    expect(rows[0].categories).toBe(slices[0].categories)
  })

  it('descarta fatias sem valor e devolve vazio quando nada resta', () => {
    expect(buildServiceTypeRows([{ name: 'Retirada', value: 0, categories: [] }])).toEqual([])
    expect(buildServiceTypeRows([])).toEqual([])
    expect(
      buildServiceTypeRows([...slices, { name: 'Retirada', value: 0, categories: [] }]).length,
    ).toBe(3)
  })

  it('descreve a coleção inteira para o leitor de tela', () => {
    expect(buildServiceTypeDescription(buildServiceTypeRows(slices))).toBe(
      'Composição por tipo de OS. Instalação: 60 OS, 60,0%. Infraestrutura: 30 OS, 30,0%. Auditoria: 10 OS, 10,0%.',
    )
    expect(buildServiceTypeDescription([])).toBe(
      `Composição por tipo de OS. ${SERVICE_TYPE_EMPTY_MESSAGE}.`,
    )
  })
})

describe('tooltip com o ranking das categorias', () => {
  it('abre com o pontinho da cor da fatia, e SÓ no cabeçalho', () => {
    const [installation] = buildServiceTypeRows(slices)
    const html = buildServiceTypeTooltip(installation)
    const marker = serviceTypeMarker(serviceTypeColor('Instalação'))

    expect(html).toContain(marker)
    expect(html.indexOf(marker)).toBeLessThan(html.indexOf('Instalação'))
    expect(marker).toContain('background-color:#2f6bff')
    // Um ponto no total: as linhas do ranking não repetem o marcador.
    expect((html.match(/border-radius:10px/g) ?? []).length).toBe(1)
  })

  it('lista o tipo, a participação e as categorias, sem numerá-las', () => {
    const [installation] = buildServiceTypeRows(slices)
    const html = buildServiceTypeTooltip(installation)

    expect(html).toContain('Instalação')
    expect(html).toContain('60 OS · 60,0% do recorte')
    expect(html).toContain('Categorias que compõem')
    expect(html).toContain('>fibra instalação</span>')
    expect(html).toContain('>fibra instalação + segundo ponto</span>')
    // A ordem é a da própria lista, decrescente, e não uma numeração escrita.
    expect(html.indexOf('fibra instalação + segundo ponto')).toBeGreaterThan(
      html.indexOf('>fibra instalação<'),
    )
    expect(html).not.toMatch(/\d\.\s/)
    expect(html).not.toContain('e mais')
  })

  it('trunca o nome longo da categoria, e nunca o número, que fica sempre inteiro', () => {
    const [row] = buildServiceTypeRows([
      {
        name: 'Instalação de Câmeras',
        value: 20,
        categories: [['mudança de endereço de 2 câmeras - Instalação', 20]],
      },
    ])
    const html = buildServiceTypeTooltip(row)

    // O nome encolhe com reticências do próprio navegador; a quantidade não
    // participa do encolhimento e não é sobreposta por ele.
    expect(html).toContain('text-overflow:ellipsis')
    expect(html).toContain('>mudança de endereço de 2 câmeras - Instalação</span>')
    expect(html).toContain('<span style="flex:none;font-weight:600;white-space:nowrap">20</span>')
  })

  it('lista no máximo cinco categorias por fatia', () => {
    expect(SERVICE_TYPE_TOOLTIP_LIMIT).toBe(5)
  })

  it('resume o excedente além do limite em vez de crescer sem fim', () => {
    const categories = Array.from({ length: SERVICE_TYPE_TOOLTIP_LIMIT + 3 }, (_, index) => [
      `categoria ${index + 1}`,
      SERVICE_TYPE_TOOLTIP_LIMIT + 3 - index,
    ]) as [string, number][]
    const [row] = buildServiceTypeRows([{ name: 'Manutenção', value: 45, categories }])
    const html = buildServiceTypeTooltip(row)

    expect(html).toContain(`>categoria ${SERVICE_TYPE_TOOLTIP_LIMIT}</span>`)
    expect(html).not.toContain(`>categoria ${SERVICE_TYPE_TOOLTIP_LIMIT + 1}</span>`)
    expect(html).toContain('e mais 3 categorias')
  })

  it('usa o singular quando sobra uma categoria só', () => {
    const categories = Array.from({ length: SERVICE_TYPE_TOOLTIP_LIMIT + 1 }, (_, index) => [
      `categoria ${index + 1}`,
      1,
    ]) as [string, number][]
    const [row] = buildServiceTypeRows([{ name: 'Manutenção', value: 7, categories }])

    expect(buildServiceTypeTooltip(row)).toContain('e mais 1 categoria<')
  })
})

describe('cor de identidade por tipo', () => {
  it('é fixa por tipo, e não pela posição da fatia, na paleta das roscas de OS', () => {
    expect(serviceTypeColor('Instalação')).toBe(OS_DONUT_PALETTE[0])
    expect(serviceTypeColor('Instalação de Câmeras')).toBe(OS_DONUT_PALETTE[1])
    expect(serviceTypeColor('Instalação')).toBe('#2f6bff')
    // Âmbar e roxo trocaram de dono a pedido do Mário, e continuam saindo da
    // paleta compartilhada, sem hexadecimal próprio.
    expect(serviceTypeColor('Manutenção')).toBe(OS_DONUT_PALETTE[2])
    expect(serviceTypeColor('Manutenção')).toBe('#f5a623')
    expect(serviceTypeColor('Mudança de Endereço')).toBe(OS_DONUT_PALETTE[4])
    expect(serviceTypeColor('Mudança de Endereço')).toBe('#8b5cf6')
    // O legado é resíduo: cinza neutro, o mesmo do status Pendente.
    expect(serviceTypeColor('Customer (legado)')).toBe(statusColors.Pendente)
    expect(serviceTypeColor('tipo inexistente')).toBe(statusColors.Pendente)
  })

  it('dá cor própria aos dois tipos de câmera que o SGI ganhou depois da paleta', () => {
    expect(serviceTypeColor('Manutenção de Câmeras')).toBe('#c026d3')
    expect(serviceTypeColor('Retirada de Câmeras')).toBe('#5b8a86')
  })

  it('nenhum tipo usa o vermelho nem o verde, que julgam resultado no portal', () => {
    // A Infraestrutura ocupava o vermelho da posição 3 da paleta, que é o MESMO
    // do status Improdutiva, desenhado ao lado na própria página. Vermelho e
    // verde carregam bom e ruim no portal inteiro e não identificam serviço.
    expect(serviceTypeColor('Infraestrutura')).toBe('#b5652f')
    expect(serviceTypeColor('Infraestrutura')).not.toBe(statusColors.Improdutiva)
    expect(serviceTypeColor('Infraestrutura')).not.toBe(OS_DONUT_PALETTE[3])

    const semanticas = [statusColors.Improdutiva, statusColors.Concluída]
    for (const tipo of [
      'Instalação',
      'Infraestrutura',
      'Manutenção',
      'Retirada',
      'Mudança de Endereço',
      'Auditoria',
      'Instalação de Câmeras',
      'Manutenção de Câmeras',
      'Retirada de Câmeras',
      'Customer (legado)',
    ]) {
      expect(semanticas).not.toContain(serviceTypeColor(tipo))
    }
  })

  it('nunca repete cor entre dois tipos do catálogo', () => {
    const names = [
      'Instalação',
      'Infraestrutura',
      'Manutenção',
      'Retirada',
      'Mudança de Endereço',
      'Auditoria',
      'Instalação de Câmeras',
      'Manutenção de Câmeras',
      'Retirada de Câmeras',
      'Customer (legado)',
    ]
    const colors = names.map((name) => serviceTypeColor(name))
    expect(new Set(colors).size).toBe(names.length)
  })
})

describe('opções da rosca', () => {
  it('desenha uma fatia por tipo, com a cor do tipo e a legenda sempre presente', () => {
    const option = makeServiceTypeOptions(slices, 'light')
    const [series] = option.series as { type: string; data: { name: string; itemStyle: { color: string } }[] }[]

    expect(series.type).toBe('pie')
    expect(series.data.map((item) => item.name)).toEqual([
      'Instalação',
      'Infraestrutura',
      'Auditoria',
    ])
    expect(series.data[0].itemStyle.color).toBe(OS_DONUT_PALETTE[0])
    expect(option.legend).toMatchObject({ orient: 'vertical', type: 'scroll' })
  })

  it('cresce a fatia sob o ponteiro, com a transição suave da rosca de Categorias', () => {
    const option = makeServiceTypeOptions(slices, 'light')
    const [series] = option.series as { emphasis: { scale: boolean; scaleSize: number } }[]

    expect(series.emphasis).toEqual({ scale: true, scaleSize: SERVICE_TYPE_HOVER_SCALE })
    // O crescimento cabe no card com folga: o raio externo é 84% do meio da
    // altura, então restam uns 22px antes de a fatia encostar na borda.
    expect(SERVICE_TYPE_HOVER_SCALE).toBeLessThan(0.16 * (280 / 2))
    // Contido: o padrão de 10px do ECharts fazia a fatia saltar em vez de
    // apenas responder ao ponteiro.
    expect(SERVICE_TYPE_HOVER_SCALE).toBe(6)

    // O ECharts só executa a transição de estado com a animação ligada, então
    // ela fica ligada com as durações de entrada e de atualização zeradas: o
    // hover ganha movimento e a troca de filtro continua instantânea.
    expect(option.animation).toBe(true)
    expect(option.animationDuration).toBe(0)
    expect(option.animationDurationUpdate).toBe(0)
    expect(option.stateAnimation).toMatchObject({ duration: 260 })
  })

  it('o estado vazio não anima nada: não há fatia para destacar', () => {
    expect(makeServiceTypeOptions([], 'light').animation).toBe(false)
  })

  it('a legenda diz nome e participação; o tooltip traz o ranking da fatia', () => {
    const option = makeServiceTypeOptions(slices, 'light')
    const legend = option.legend as { formatter: (name: string) => string }
    const tooltip = option.tooltip as { formatter: (params: unknown) => string }

    expect(legend.formatter('Instalação')).toBe('Instalação  60,0%')
    expect(tooltip.formatter({ name: 'Infraestrutura' })).toContain('>REPARO DE CTO</span>')
    expect(tooltip.formatter({ name: 'inexistente' })).toBe('')
  })

  it('o rótulo segue o tamanho DESENHADO, e não a participação no recorte', () => {
    // `percent` é o tamanho no desenho atual, que o ângulo mínimo pode
    // afastar da participação, e é ele que decide se cabe rótulo; o número
    // escrito continua sendo a participação real no recorte, a mesma da
    // legenda e do tooltip.
    const [, , auditoria] = buildServiceTypeRows(slices)

    expect(auditoria.name).toBe('Auditoria')
    expect(auditoria.share).toBe(0.1)

    // Desenhada maior que a participação, cabe rótulo.
    expect(serviceTypeDirectLabel(auditoria, 25)).toBe('10,0%')
    // Desenhada do tamanho da participação, os 10% continuam com rótulo.
    expect(serviceTypeDirectLabel(auditoria, 10)).toBe('10,0%')
    // Encolhida no desenho, o rótulo sai e o nome fica só na legenda.
    expect(serviceTypeDirectLabel(auditoria, 2)).toBe('')
    // Sem o tamanho desenhado, vale a participação no recorte, como antes.
    expect(serviceTypeDirectLabel(auditoria)).toBe('10,0%')
    expect(serviceTypeDirectLabel(undefined, 90)).toBe('')
  })

  it('o rótulo direto só aparece nas fatias com espaço para ele', () => {
    const option = makeServiceTypeOptions(
      [
        { name: 'Instalação', value: 97, categories: [['fibra instalação', 97]] },
        { name: 'Auditoria', value: 3, categories: [['Auditória de Infraestrutura', 3]] },
      ],
      'light',
    )
    const [series] = option.series as { label: { formatter: (p: { name: string }) => string } }[]

    expect(series.label.formatter({ name: 'Instalação' })).toBe('97,0%')
    expect(series.label.formatter({ name: 'Auditoria' })).toBe('')
  })

  it('sem dados, mostra a mensagem de vazio no lugar da rosca', () => {
    const option = makeServiceTypeOptions([], 'dark')

    expect(option.series).toBeUndefined()
    expect(option.title).toMatchObject({ text: SERVICE_TYPE_EMPTY_MESSAGE })
  })

  it('aceita as fatias reais do recorte padrão, como o serviço as manda', () => {
    const option = makeServiceTypeOptions(periodScenario('padrao').facts.serviceTypeSlices, 'light')
    const [series] = option.series as { data: { name: string }[] }[]

    expect(series.data[0].name).toBe('Instalação')
    expect(series.data.length).toBe(6)
  })
})

describe('piso de visibilidade da fatia pequena', () => {
  it('garante um ângulo mínimo por fatia, sem tocar em valor nenhum', () => {
    // Proporção real da página: `Auditoria` com 2 OS em 1.248, que hoje some
    // inteira dentro do próprio separador de 2 px.
    const reais: ServiceTypeSlice[] = [
      { name: 'Instalação', value: 1246, categories: [['fibra instalação', 1246]] },
      { name: 'Auditoria', value: 2, categories: [['Auditória de Infraestrutura', 2]] },
    ]
    const option = makeServiceTypeOptions(reais, 'light')
    const [series] = option.series as { minAngle: number; data: { value: number }[] }[]

    expect(series.minAngle).toBe(SERVICE_TYPE_MIN_ANGLE)
    // Cinco graus deixam a fatia sobreviver ao separador, e continuam pequenos
    // o bastante para a distorção ser imperceptível na maior fatia.
    expect(SERVICE_TYPE_MIN_ANGLE).toBe(5)
    // O valor desenhado continua sendo o real: o piso é só geometria.
    expect(series.data.map((item) => item.value)).toEqual([1246, 2])
  })

  it('mantém os percentuais escritos saindo dos dados, e não do desenho', () => {
    const reais: ServiceTypeSlice[] = [
      { name: 'Instalação', value: 1246, categories: [['fibra instalação', 1246]] },
      { name: 'Auditoria', value: 2, categories: [['Auditória de Infraestrutura', 2]] },
    ]
    const option = makeServiceTypeOptions(reais, 'light')
    const legend = option.legend as { formatter: (name: string) => string }
    const aria = option.aria as { label: { description: string } }

    // 2 em 1.248 são 0,2%, e é isso que a legenda e a leitura acessível dizem,
    // mesmo com a fatia desenhada em 1,4% do círculo.
    expect(legend.formatter('Auditoria')).toBe('Auditoria  0,2%')
    expect(aria.label.description).toContain('Auditoria: 2 OS, 0,2%')
    expect(legend.formatter('Instalação')).toBe('Instalação  99,8%')
  })
})

describe('tipo selecionado no filtro', () => {
  const porTipo: ServiceTypeHighlight = { kind: 'service-type', serviceTypes: ['Infraestrutura'] }

  /**
   * Cor desenhada de cada fatia. Esmaecer é MISTURA com a superfície do painel,
   * e não transparência: a fatia continua opaca e nada aparece através dela.
   */
  const coresPorFatia = (highlight: ServiceTypeHighlight | null) => {
    const option = makeServiceTypeOptions(slices, 'light', highlight)
    const [series] = option.series as { data: { name: string; itemStyle: { color: string } }[] }[]

    return Object.fromEntries(series.data.map((item) => [item.name, item.itemStyle.color]))
  }

  const cheia = (nome: string) => serviceTypeColor(nome)
  const apagada = (nome: string) =>
    mixHexColors(serviceTypeColor(nome), '#ffffff', DIMMED_SLICE_RATIO)

  it('destaca a fatia do tipo escolhido e mantém as demais como contexto', () => {
    expect(coresPorFatia(porTipo)).toEqual({
      Instalação: apagada('Instalação'),
      Infraestrutura: cheia('Infraestrutura'),
      Auditoria: apagada('Auditoria'),
    })
    // As fatias apagadas continuam visíveis: elas são a comparação, não ruído.
    expect(apagada('Instalação')).not.toBe('#ffffff')
  })

  it('sem tipo escolhido, nenhuma fatia perde ênfase', () => {
    expect(coresPorFatia(null)).toEqual({
      Instalação: cheia('Instalação'),
      Infraestrutura: cheia('Infraestrutura'),
      Auditoria: cheia('Auditoria'),
    })
  })

  it('não mexe em valor nenhum: só a ênfase muda', () => {
    const option = makeServiceTypeOptions(slices, 'light', porTipo)
    const [series] = option.series as { data: { name: string; value: number }[] }[]
    const legend = option.legend as { formatter: (name: string) => string }

    expect(series.data.map((item) => item.value)).toEqual([60, 30, 10])
    expect(legend.formatter('Instalação')).toBe('Instalação  60,0%')
  })

  it('explica o destaque para o leitor de tela, e não só no desenho', () => {
    const rows = buildServiceTypeRows(slices)
    const descricao = buildServiceTypeDescription(rows, porTipo)

    expect(descricao).toContain('O tipo Infraestrutura está selecionado no filtro')
    expect(descricao).toContain('contexto comparativo do recorte')
    // Sem seleção, a descrição segue exatamente como era.
    expect(buildServiceTypeDescription(rows)).not.toContain('selecionado no filtro')
  })

  it('categoria selecionada destaca o tipo que a contém, sem reduzir a rosca', () => {
    const porCategoria: ServiceTypeHighlight = {
      kind: 'category',
      categories: ['REPARO DE CTO'],
      serviceTypes: ['Infraestrutura'],
    }

    // As três fatias continuam desenhadas: a rosca não vira 100% de um tipo.
    expect(coresPorFatia(porCategoria)).toEqual({
      Instalação: apagada('Instalação'),
      Infraestrutura: cheia('Infraestrutura'),
      Auditoria: apagada('Auditoria'),
    })

    const descricao = buildServiceTypeDescription(buildServiceTypeRows(slices), porCategoria)
    expect(descricao).toContain('A categoria REPARO DE CTO está selecionada no filtro')
    expect(descricao).toContain('o tipo Infraestrutura, que a contém, aparece em destaque')
  })

  it('categoria que vive sob DOIS tipos destaca os dois, com a leitura no plural', () => {
    const porCategoria: ServiceTypeHighlight = {
      kind: 'category',
      categories: ['fibra instalação + segundo ponto'],
      serviceTypes: ['Instalação', 'Auditoria'],
    }

    expect(coresPorFatia(porCategoria)).toEqual({
      Instalação: cheia('Instalação'),
      Infraestrutura: apagada('Infraestrutura'),
      Auditoria: cheia('Auditoria'),
    })

    const descricao = buildServiceTypeDescription(buildServiceTypeRows(slices), porCategoria)
    expect(descricao).toContain('os tipos Instalação e Auditoria, que a contêm, aparecem em destaque')
  })

  it('com vários tipos marcados, todos ficam em destaque e a leitura vai para o plural', () => {
    const porTipos: ServiceTypeHighlight = {
      kind: 'service-type',
      serviceTypes: ['Instalação', 'Infraestrutura'],
    }

    expect(coresPorFatia(porTipos)).toEqual({
      Instalação: cheia('Instalação'),
      Infraestrutura: cheia('Infraestrutura'),
      Auditoria: apagada('Auditoria'),
    })
    expect(buildServiceTypeDescription(buildServiceTypeRows(slices), porTipos)).toContain(
      ' Os tipos Instalação e Infraestrutura estão selecionados no filtro e aparecem em destaque; ',
    )
  })

  it('com várias categorias marcadas, a leitura fala delas no plural', () => {
    const umTipo: ServiceTypeHighlight = {
      kind: 'category',
      categories: ['REPARO DE CTO', 'Rompimento Massivo'],
      serviceTypes: ['Infraestrutura'],
    }
    const doisTipos: ServiceTypeHighlight = {
      kind: 'category',
      categories: ['REPARO DE CTO', 'fibra instalação'],
      serviceTypes: ['Instalação', 'Infraestrutura'],
    }
    const rows = buildServiceTypeRows(slices)

    expect(buildServiceTypeDescription(rows, umTipo)).toContain(
      'As categorias REPARO DE CTO e Rompimento Massivo estão selecionadas no filtro e ' +
        'o tipo Infraestrutura, que as contém, aparece em destaque',
    )
    expect(buildServiceTypeDescription(rows, doisTipos)).toContain(
      'os tipos Instalação e Infraestrutura, que as contêm, aparecem em destaque',
    )
  })

  it('categoria sem tipo identificável não apaga a rosca inteira', () => {
    const semTipos: ServiceTypeHighlight = {
      kind: 'category',
      categories: ['categoria fantasma'],
      serviceTypes: [],
    }

    expect(coresPorFatia(semTipos)).toEqual({
      Instalação: cheia('Instalação'),
      Infraestrutura: cheia('Infraestrutura'),
      Auditoria: cheia('Auditoria'),
    })
    expect(buildServiceTypeDescription(buildServiceTypeRows(slices), semTipos)).not.toContain(
      'em destaque',
    )
  })
})

describe('rótulo direto dentro da fatia', () => {
  it('sai em branco sobre as cores das roscas de OS', () => {
    const option = makeServiceTypeOptions(slices, 'light')
    const [series] = option.series as { label: { color: string } }[]

    expect(series.label.color).toBe('#ffffff')
  })
})

/**
 * Clique e legenda (pedido do Mário em 21/10/2026): a fatia abre a lista das
 * OS do tipo, e a legenda destaca em vez de esconder.
 */
describe('clique na fatia e na legenda', () => {
  it('a fatia clicada devolve o tipo dela; fora de uma fatia com OS, nada', () => {
    expect(serviceTypeFromChartClick(slices, { componentType: 'series', name: 'Infraestrutura' })).toBe(
      'Infraestrutura',
    )
    expect(serviceTypeFromChartClick(slices, { componentType: 'legend', name: 'Infraestrutura' })).toBeNull()
    expect(serviceTypeFromChartClick(slices, { componentType: 'series', name: 'Retirada' })).toBeNull()
    expect(serviceTypeFromChartClick(slices, null)).toBeNull()
  })

  it('a troca de legenda devolve o tipo clicado, só se ele estiver na rosca', () => {
    expect(serviceTypeFromLegendChange(slices, { name: 'Auditoria', selected: { Auditoria: false } })).toBe(
      'Auditoria',
    )
    expect(serviceTypeFromLegendChange(slices, { name: 'Retirada' })).toBeNull()
    expect(serviceTypeFromLegendChange(slices, 'Auditoria')).toBeNull()
  })

  it('a legenda declara todos os tipos visíveis, então o clique nunca apaga uma fatia', () => {
    const option = makeServiceTypeOptions(slices, 'light')
    const legend = option.legend as { selected: Record<string, boolean> }

    expect(legend.selected).toEqual({ Instalação: true, Infraestrutura: true, Auditoria: true })
  })

  it('o tipo escolhido na legenda fica em cor plena e os demais esmaecem, como no filtro', () => {
    const option = makeServiceTypeOptions(slices, 'dark', { kind: 'legend', serviceTypes: ['Infraestrutura'] })
    const [series] = option.series as { data: { name: string; itemStyle: { color: string } }[] }[]
    const colorOf = (name: string) => series.data.find((item) => item.name === name)?.itemStyle.color

    expect(colorOf('Infraestrutura')).toBe(serviceTypeColor('Infraestrutura'))
    expect(colorOf('Instalação')).toBe(mixHexColors(serviceTypeColor('Instalação'), '#1f2937', DIMMED_SLICE_RATIO))
    expect(
      buildServiceTypeDescription(buildServiceTypeRows(slices), { kind: 'legend', serviceTypes: ['Infraestrutura'] }),
    ).toContain('O tipo Infraestrutura foi escolhido na legenda e aparece em destaque')
  })

  it('o subtítulo convida ao clique só quando a lista existe e há OS', () => {
    expect(serviceTypeSubtitle(slices, true)).toBe(
      'Tipos no contexto dos demais filtros · passe o mouse para ver as categorias, clique numa fatia para ver as OS',
    )
    expect(serviceTypeSubtitle(slices, false)).toBe(
      'Tipos no contexto dos demais filtros · passe o mouse para ver as categorias',
    )
    expect(serviceTypeSubtitle([], true)).toBe(
      'Tipos no contexto dos demais filtros · passe o mouse para ver as categorias',
    )
  })
})

describe('destaque pela legenda', () => {
  it('cada clique muda o tipo destacado, e é isso que redesenha a rosca com a fatia de volta', () => {
    expect(nextLegendServiceType(null, 'Auditoria')).toBe('Auditoria')
    expect(nextLegendServiceType('Instalação', 'Auditoria')).toBe('Auditoria')
    // O segundo clique no mesmo tipo devolve o destaque aos filtros.
    expect(nextLegendServiceType('Auditoria', 'Auditoria')).toBeNull()
    for (const [current, clicked] of [
      [null, 'Auditoria'],
      ['Instalação', 'Auditoria'],
      ['Auditoria', 'Auditoria'],
    ] as const) {
      expect(nextLegendServiceType(current, clicked)).not.toBe(current)
    }
  })

  it('a legenda vale por cima do filtro, e sem ela o destaque volta a ser o do filtro', () => {
    const filtro: ServiceTypeHighlight = { kind: 'service-type', serviceTypes: ['Instalação'] }

    expect(serviceTypePanelHighlight('Auditoria', filtro)).toEqual({ kind: 'legend', serviceTypes: ['Auditoria'] })
    expect(serviceTypePanelHighlight(null, filtro)).toBe(filtro)
    expect(serviceTypePanelHighlight(null, null)).toBeNull()
  })

  it('tipo que não está na rosca não destaca nada', () => {
    expect(shownLegendServiceType('Auditoria', slices)).toBe('Auditoria')
    expect(shownLegendServiceType('Retirada', slices)).toBeNull()
    expect(shownLegendServiceType(null, slices)).toBeNull()
  })

  it('com um tipo escolhido, o subtítulo diz qual e como tirar o destaque', () => {
    expect(serviceTypeSubtitle(slices, true, 'Auditoria')).toBe(
      'Tipos no contexto dos demais filtros · Auditoria em destaque, clique de novo na legenda para tirar',
    )
  })
})
