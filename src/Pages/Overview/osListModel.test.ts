import { describe, expect, it } from 'vitest'

import type { OverviewOsRecord } from '../../data/overviewOsData'
import { defaultOverviewOsFilters, type OverviewOsFilters } from '../../data/overviewOsFilters'
import { handFacts, outcomeGroups, reasonSummary } from './osPeriodFixture.testing'
import { DAILY_VOLUME_COLORS } from './overviewDailyChartOptions'
import type { OverviewDaily } from './overviewModel'
import { OUTCOME_COLORS } from './overviewOutcomeChartOptions'
import {
  REASON_COLOR,
  REASON_MISSING,
  REASON_NOT_SPECIFIED,
  REASON_UNCLEAR_COLOR,
} from './overviewReasonsChartOptions'
import { serviceTypeColor } from './overviewServiceTypeChartOptions'
import {
  buildOsListChips,
  buildOsListRows,
  osListChipsLabel,
  osListContext,
  osListFilters,
  osListPanelTitle,
  osListRange,
  osListSelectionKey,
  osListSelectionLabel,
  pageFiltersText,
  type OsListSelection,
} from './osListModel'

/**
 * Teste espelho da janela de OS da Visão Geral.
 *
 * A promessa do estudo de 24/09/2026 continua: o número da janela é o número
 * da barra clicada. Desde 01/10/2026 quem a cumpre é o serviço, que conta o
 * painel e devolve as OS da barra pela MESMA regra (testado em
 * `tests/test_bi_os_period.py`). Aqui ficam os atalhos (contados com os
 * números do período, na ordem do painel), os nomes, o contexto e a ordem e o
 * Detalhe da lista.
 */

/**
 * O recorte dos atalhos: 5 improdutivas (2 de cliente ausente, uma de
 * infraestrutura), uma concluída, uma encerrada, uma agendada e uma
 * infraestrutura expirada, como o serviço as conta.
 */
const facts = handFacts({
  outcome: outcomeGroups([
    ['customer', 'completed', 'Concluída'],
    ['customer', 'unproductive', 'Improdutiva'],
    ['customer', 'unproductive', 'Improdutiva'],
    ['customer', 'unproductive', 'Improdutiva'],
    ['customer', 'unproductive', 'Improdutiva'],
    ['customer', 'notExecuted', 'Encerrada'],
    ['customer', 'open', 'Agendada'],
    ['infrastructure', 'unproductive', 'Improdutiva'],
    ['infrastructure', 'notExecuted', 'Expirada'],
  ]),
  reasons: reasonSummary([
    ['Cliente ausente', 'customer'],
    ['Cliente ausente', 'infrastructure'],
    ['Clima ou segurança', 'customer'],
    [null, 'customer'],
    [REASON_NOT_SPECIFIED, 'customer'],
  ]),
})

const clienteAusente: OsListSelection = { kind: 'reason', reason: 'Cliente ausente' }
const naoExecutadaCliente: OsListSelection = {
  kind: 'outcome',
  group: 'customer',
  outcome: 'notExecuted',
}

describe('atalhos no topo da janela', () => {
  it('nos motivos, "Todas" vem primeiro, e depois as barras do painel na mesma ordem e cor', () => {
    const chips = buildOsListChips(facts, clienteAusente)

    expect(chips.map((chip) => [chip.label, chip.count])).toEqual([
      ['Todas', 5],
      ['Cliente ausente', 2],
      ['Clima ou segurança', 1],
      [REASON_NOT_SPECIFIED, 1],
      [REASON_MISSING, 1],
    ])
    // "Todas" não é uma barra do painel: não leva cor.
    expect(chips.map((chip) => chip.color)).toEqual([
      null,
      REASON_COLOR,
      REASON_COLOR,
      REASON_UNCLEAR_COLOR,
      REASON_UNCLEAR_COLOR,
    ])
  })

  it('no Destino, "Todas" é o grupo inteiro, e as saídas são só as do grupo clicado', () => {
    const chips = buildOsListChips(facts, naoExecutadaCliente)

    // OS de cliente: 1 concluída, 4 improdutivas, 1 encerrada, 1 agendada.
    expect(chips.map((chip) => [chip.label, chip.count])).toEqual([
      ['Todas', 7],
      ['Concluída', 1],
      ['Improdutiva', 4],
      ['Não executada', 1],
      ['Em aberto', 1],
    ])
    expect(chips[3].color).toBe(OUTCOME_COLORS.notExecuted)

    // Infraestrutura: só improdutiva e não executada.
    const infra = buildOsListChips(facts, { kind: 'outcome', group: 'infrastructure', outcome: 'notExecuted' })
    expect(infra.map((chip) => [chip.label, chip.count])).toEqual([
      ['Todas', 2],
      ['Improdutiva', 1],
      ['Não executada', 1],
    ])
  })

  it('cada atalho tem identidade própria, e o aceso é o da seleção', () => {
    const keys = buildOsListChips(facts, clienteAusente).map((chip) => osListSelectionKey(chip.selection))

    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain(osListSelectionKey(clienteAusente))
  })

  it('a chave do "Todas" não se confunde com a de um motivo de nome parecido', () => {
    expect(osListSelectionKey({ kind: 'reason', reason: null })).not.toBe(
      osListSelectionKey({ kind: 'reason', reason: 'null' }),
    )
    expect(osListSelectionKey({ kind: 'outcome', group: 'customer', outcome: null })).not.toBe(
      osListSelectionKey({ kind: 'outcome', group: 'infrastructure', outcome: null }),
    )
  })

  it('a saída sem classificação vira atalho, no fim, só quando o grupo tem alguma OS nela', () => {
    const comChaveNova = handFacts({
      outcome: outcomeGroups([
        ['customer', 'completed', 'Concluída'],
        ['customer', 'unknown', 'Rascunho'],
      ]),
    })

    expect(buildOsListChips(comChaveNova, naoExecutadaCliente).at(-1)).toMatchObject({
      label: 'Sem classificação',
      count: 1,
    })
    expect(buildOsListChips(facts, naoExecutadaCliente).map((chip) => chip.label)).not.toContain(
      'Sem classificação',
    )
  })

  it('recorte vazio não tem atalho nenhum, em nenhum dos painéis', () => {
    const empty = handFacts({ outcome: outcomeGroups([]) })

    expect(buildOsListChips(empty, clienteAusente)).toEqual([])
    expect(buildOsListChips(empty, naoExecutadaCliente)).toEqual([])
    expect(buildOsListChips(empty, { kind: 'day', date: '2026-09-01', series: null })).toEqual([])
  })
})

describe('nomes da janela', () => {
  it('o título é o painel de origem, e a lista diz o motivo ou o grupo e a saída', () => {
    expect(osListPanelTitle(clienteAusente)).toBe('Motivos de improdutiva')
    expect(osListSelectionLabel(clienteAusente)).toBe('Cliente ausente')
    expect(osListPanelTitle(naoExecutadaCliente)).toBe('Destino das OS do período')
    expect(osListSelectionLabel(naoExecutadaCliente)).toBe('OS de cliente · Não executada')
    expect(osListChipsLabel(naoExecutadaCliente)).toBe('Trocar de saída, OS de cliente')
  })

  it('no "Todas", a lista diz que são todas, e de quê', () => {
    expect(osListSelectionLabel({ kind: 'reason', reason: null })).toBe('Todas as improdutivas')
    expect(osListSelectionLabel({ kind: 'outcome', group: 'customer', outcome: null })).toBe(
      'Todas as OS de cliente',
    )
    expect(osListSelectionLabel({ kind: 'outcome', group: 'infrastructure', outcome: null })).toBe(
      'Todas as OS de infraestrutura',
    )
  })
})

let sequence = 0

/** Uma OS da lista como o serviço a manda: com saída, grupo e motivo. */
function record(overrides: Partial<OverviewOsRecord> = {}): OverviewOsRecord {
  sequence += 1

  return {
    id: `OS-2026-${sequence}`,
    dateISO: '2026-09-01',
    technicianId: null,
    team: null,
    serviceType: 'Instalação',
    category: 'Fibra Instalação',
    city: 'Atibaia',
    status: 'Concluída',
    statusKey: 'completed',
    resolution: null,
    outcome: 'completed',
    group: 'customer',
    listReason: null,
    ...overrides,
  }
}

describe('ordem da lista', () => {
  it('a OS mais recente primeiro e, no mesmo dia, turno, técnico e código', () => {
    const names = new Map([['tec-1', 'Ana'], ['tec-2', 'Bruno']])
    const rows = buildOsListRows(
      [
        record({ id: 'OS-2026-10', dateISO: '2026-08-31', period: 'Manhã', technicianId: 'tec-1' }),
        record({ id: 'OS-2026-11', dateISO: '2026-09-02', period: 'Tarde', technicianId: 'tec-1' }),
        record({ id: 'OS-2026-12', dateISO: '2026-09-02', period: 'Manhã', technicianId: 'tec-2' }),
        record({ id: 'OS-2026-13', dateISO: '2026-09-02', period: 'Manhã', technicianId: 'tec-1' }),
      ],
      names,
    )

    expect(rows.map((row) => row.id)).toEqual(['OS-2026-13', 'OS-2026-12', 'OS-2026-11', 'OS-2026-10'])
    expect(rows[0]).toMatchObject({ date: '2026-09-02', technician: 'Ana' })
  })

  it('recorte vazio é lista vazia', () => {
    expect(buildOsListRows([], new Map())).toEqual([])
  })
})

describe('linha de contexto', () => {
  const coverage = { min: '2026-04-06', max: '2026-09-30' }
  const setembro: OverviewOsFilters = {
    ...defaultOverviewOsFilters,
    dateFrom: '2026-09-01',
    dateTo: '2026-09-23',
  }

  it('sem outro filtro, diz o período pelo nome e que não há outros filtros', () => {
    expect(pageFiltersText(setembro, coverage, new Map())).toBeNull()
    expect(osListContext(setembro, coverage, new Map())).toBe(
      'Setembro de 2026, até o dia 23 · sem outros filtros',
    )
  })

  it('com filtros, escreve como os chips da faixa, com o nome do técnico', () => {
    const filtrado = { ...setembro, team: ['Infra'], technicianId: ['tec-1'], city: ['Atibaia'] }

    expect(osListContext(filtrado, coverage, new Map([['tec-1', 'Ana Souza']]))).toBe(
      'Setembro de 2026, até o dia 23 · Equipe: Infra · Técnico: Ana Souza · Cidade: Atibaia',
    )
  })

  it('com várias opções num campo, escreve todas por extenso, sem o +N do chip', () => {
    const filtrado = {
      ...setembro,
      technicianId: ['tec-1', 'tec-2'],
      city: ['Atibaia', 'Mairiporã', 'Piracaia'],
    }
    const nomes = new Map([
      ['tec-1', 'Ana Souza'],
      ['tec-2', 'Bruno Lima'],
    ])

    expect(pageFiltersText(filtrado, coverage, nomes)).toBe(
      'Técnico: Ana Souza, Bruno Lima · Cidade: Atibaia, Mairiporã, Piracaia',
    )
  })
})

describe('Detalhe da improdutiva na janela', () => {
  const improdutiva = (listReason: string | null, overrides: Partial<OverviewOsRecord> = {}) =>
    record({ status: 'Improdutiva', statusKey: 'unproductive', outcome: 'unproductive', listReason, ...overrides })

  it('diz o motivo com o nome da barra que o serviço mandou, inclusive "Sem motivo registrado"', () => {
    const rows = buildOsListRows(
      [
        improdutiva('Cliente ausente', { id: 'OS-2026-1' }),
        improdutiva(REASON_MISSING, { id: 'OS-2026-2' }),
        record({ id: 'OS-2026-3', resolution: 'Instalação Realizada' }),
      ],
      new Map(),
    )

    expect(rows.map((row) => row.detail)).toEqual(['Cliente ausente', REASON_MISSING, 'Instalação Realizada'])
  })

  it('sem o motivo na OS, fica o traço: o dado não existe', () => {
    expect(buildOsListRows([improdutiva(null)], new Map())[0].detail).toBeNull()
  })
})

describe('janela do Volume diário', () => {
  /**
   * 01/09: concluída, improdutiva, encerrada e uma de chave nova; 02/09: uma
   * concluída de infraestrutura e uma agendada; nenhuma improdutiva.
   */
  const daily: OverviewDaily = {
    x: ['01/09', '02/09'],
    iso: ['2026-09-01', '2026-09-02'],
    total: [4, 2],
    completed: [1, 1],
    unproductive: [1, 0],
    notExecuted: [1, 0],
    open: [0, 1],
    unknown: [1, 0],
  }
  const dayFacts = handFacts({ daily })
  const filtros: OverviewOsFilters = {
    ...defaultOverviewOsFilters,
    dateFrom: '2026-09-01',
    dateTo: '2026-09-30',
  }

  it('os atalhos são o Total e as saídas do dia, e saída sem OS no dia fica de fora', () => {
    const chips = buildOsListChips(dayFacts, { kind: 'day', date: '2026-09-02', series: null })

    expect(chips.map((chip) => [chip.label, chip.count, chip.color])).toEqual([
      ['Total', 2, DAILY_VOLUME_COLORS.total],
      ['Concluídas', 1, DAILY_VOLUME_COLORS.completed],
      ['Em aberto', 1, OUTCOME_COLORS.open],
    ])
    expect(buildOsListChips(dayFacts, { kind: 'day', date: '2026-09-03', series: null })).toEqual([])
  })

  it('as saídas do dia somam o Total, inclusive a sem classificação', () => {
    const [total, ...saidas] = buildOsListChips(dayFacts, { kind: 'day', date: '2026-09-01', series: null })

    expect(saidas.map((chip) => chip.label)).toEqual([
      'Concluídas',
      'Improdutivas',
      'Não executadas',
      'Sem classificação',
    ])
    expect(saidas.reduce((sum, chip) => sum + chip.count, 0)).toBe(total.count)
  })

  it('o período da lista é o dia clicado, e a lista diz a série', () => {
    const improdutivas: OsListSelection = { kind: 'day', date: '2026-09-01', series: 'unproductive' }

    expect(osListRange(improdutivas, filtros)).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-01' })
    expect(osListPanelTitle(improdutivas)).toBe('Volume diário de OS')
    expect(osListSelectionLabel(improdutivas)).toBe('Improdutivas')
    expect(osListSelectionLabel({ kind: 'day', date: '2026-09-01', series: null })).toBe('Todas as OS')
    expect(osListChipsLabel(improdutivas)).toBe('Trocar de série, dia 01/09/2026')
    // Nos demais painéis, o período é o da página.
    expect(osListRange(clienteAusente, filtros)).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
  })

  it('cada série do dia tem identidade própria', () => {
    const keys = buildOsListChips(dayFacts, { kind: 'day', date: '2026-09-01', series: null }).map((chip) =>
      osListSelectionKey(chip.selection),
    )

    expect(keys).toEqual([
      'day:2026-09-01:total',
      'day:2026-09-01:completed',
      'day:2026-09-01:unproductive',
      'day:2026-09-01:notExecuted',
      'day:2026-09-01:unknown',
    ])
  })

  it('a lista das outras saídas diz o nome do atalho', () => {
    expect(osListSelectionLabel({ kind: 'day', date: '2026-09-01', series: 'notExecuted' })).toBe(
      'Não executadas',
    )
    expect(osListSelectionLabel({ kind: 'day', date: '2026-09-01', series: 'open' })).toBe('Em aberto')
  })
})

/**
 * Janela da Composição por tipo de OS (pedido do Mário em 21/10/2026): a
 * fatia abre as OS do tipo. A rosca ignora os filtros Tipo de OS e Categoria,
 * e a lista também, para o número da janela fechar com o da fatia.
 */
describe('janela da Composição por tipo de OS', () => {
  const typeFacts = handFacts({
    serviceTypeSlices: [
      { name: 'Manutenção', value: 7, categories: [['Sem Conexão', 7]] },
      { name: 'Instalação de Câmeras', value: 3, categories: [['Instalação de 2 Câmeras', 3]] },
      { name: 'Retirada', value: 0, categories: [] },
    ],
  })
  const manutencao: OsListSelection = { kind: 'service-type', serviceType: 'Manutenção' }

  it('os atalhos são "Todas" e as fatias com OS, na ordem e na cor da rosca', () => {
    const chips = buildOsListChips(typeFacts, manutencao)

    expect(chips.map((chip) => [chip.label, chip.count, chip.color])).toEqual([
      ['Todas', 10, null],
      ['Manutenção', 7, serviceTypeColor('Manutenção')],
      ['Instalação de Câmeras', 3, serviceTypeColor('Instalação de Câmeras')],
    ])
    expect(buildOsListChips(handFacts(), manutencao)).toEqual([])
  })

  it('nomes, identidade e período da lista', () => {
    const todas: OsListSelection = { kind: 'service-type', serviceType: null }

    expect(osListPanelTitle(manutencao)).toBe('Composição por tipo de OS')
    expect(osListSelectionLabel(manutencao)).toBe('Manutenção')
    expect(osListSelectionLabel(todas)).toBe('Todas as OS')
    expect(osListChipsLabel(manutencao)).toBe('Trocar de tipo')
    expect(osListSelectionKey(manutencao)).not.toBe(osListSelectionKey(todas))
    expect(osListSelectionKey(manutencao)).not.toBe(osListSelectionKey({ kind: 'reason', reason: 'Manutenção' }))
    expect(osListRange(manutencao, { dateFrom: '2026-10-01', dateTo: '2026-10-20' })).toEqual({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-20',
    })
  })

  it('a lista troca o Tipo pelo da fatia e solta a Categoria, como a rosca', () => {
    const page: OverviewOsFilters = {
      ...defaultOverviewOsFilters,
      serviceType: ['Instalação'],
      category: ['fibra instalação'],
      city: ['Atibaia'],
      status: ['Concluída'],
    }

    expect(osListFilters(manutencao, page, true)).toEqual({
      ...page,
      serviceType: ['Manutenção'],
      category: [],
    })
    expect(osListFilters({ kind: 'service-type', serviceType: null }, page, true).serviceType).toEqual([])
  })

  it('o Status sai quando não tira OS nenhuma, como o serviço faz ao contar a rosca', () => {
    const page: OverviewOsFilters = { ...defaultOverviewOsFilters, status: ['Concluída', 'Improdutiva'] }

    expect(osListFilters(manutencao, page, false).status).toEqual([])
    expect(osListFilters(manutencao, page, true).status).toEqual(['Concluída', 'Improdutiva'])
  })

  it('nos painéis de barra, a lista usa os filtros da página como chegam', () => {
    const page: OverviewOsFilters = { ...defaultOverviewOsFilters, category: ['fibra instalação'] }

    expect(osListFilters(clienteAusente, page, false)).toBe(page)
  })
})
