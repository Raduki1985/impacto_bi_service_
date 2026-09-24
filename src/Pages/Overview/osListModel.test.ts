import { describe, expect, it } from 'vitest'

import type { OverviewOsRecord } from '../../data/overviewOsData'
import { defaultOverviewOsFilters, type OverviewOsFilters } from '../../data/overviewOsFilters'
import { buildOsOutcome } from './overviewModel'
import { OUTCOME_COLORS } from './overviewOutcomeChartOptions'
import {
  buildReasonSummary,
  REASON_COLOR,
  REASON_MISSING,
  REASON_NOT_SPECIFIED,
  REASON_UNCLEAR_COLOR,
} from './overviewReasonsChartOptions'
import {
  buildOsListChips,
  buildOsListRows,
  osListChipsLabel,
  osListContext,
  osListPanelTitle,
  osListSelectionKey,
  osListSelectionLabel,
  pageFiltersText,
  selectOsListRecords,
  type OsListSelection,
} from './osListModel'

/**
 * Teste espelho da janela de OS da Visão Geral.
 *
 * A promessa que ele protege é a do estudo de 24/09/2026: o número da janela
 * é o número da barra clicada, porque as duas saem da mesma regra sobre os
 * mesmos registros. Também protege os atalhos, na ordem do painel, e a ordem
 * da lista, a mais recente primeiro.
 */

let sequence = 0

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
    ...overrides,
  }
}

const improdutiva = (reason: string | null, overrides: Partial<OverviewOsRecord> = {}) =>
  record({ status: 'Improdutiva', statusKey: 'unproductive', unproductiveReason: reason, ...overrides })

const recorte: OverviewOsRecord[] = [
  improdutiva('Cliente ausente'),
  improdutiva('Cliente ausente', { serviceType: 'Infraestrutura' }),
  improdutiva('Clima ou segurança'),
  improdutiva(null),
  improdutiva(REASON_NOT_SPECIFIED),
  // Concluída com o campo preenchido por engano: não é improdutiva e não entra.
  record({ unproductiveReason: 'Cliente ausente' }),
  record({ serviceType: 'Infraestrutura', status: 'Expirada', statusKey: 'expired' }),
  record({ status: 'Encerrada', statusKey: 'closed' }),
  record({ status: 'Agendada', statusKey: 'scheduled' }),
]

const clienteAusente: OsListSelection = { kind: 'reason', reason: 'Cliente ausente' }
const naoExecutadaCliente: OsListSelection = {
  kind: 'outcome',
  group: 'customer',
  outcome: 'notExecuted',
}

describe('a janela fecha com o número da barra', () => {
  it('cada motivo abre exatamente as improdutivas que a barra conta, de cliente e de infraestrutura', () => {
    for (const row of buildReasonSummary(recorte).rows) {
      expect(selectOsListRecords(recorte, { kind: 'reason', reason: row.reason })).toHaveLength(row.count)
    }
    expect(selectOsListRecords(recorte, clienteAusente).map((item) => item.serviceType)).toEqual([
      'Instalação',
      'Infraestrutura',
    ])
  })

  it('"Sem motivo registrado" abre as improdutivas sem motivo, e só elas', () => {
    const semMotivo = selectOsListRecords(recorte, { kind: 'reason', reason: REASON_MISSING })

    expect(semMotivo).toHaveLength(1)
    expect(semMotivo[0].unproductiveReason).toBeNull()
  })

  it('cada fatia do Destino abre as OS daquela saída, naquele grupo', () => {
    for (const group of buildOsOutcome(recorte)) {
      for (const outcome of ['completed', 'unproductive', 'notExecuted', 'open'] as const) {
        expect(
          selectOsListRecords(recorte, { kind: 'outcome', group: group.key, outcome }),
        ).toHaveLength(group.counts[outcome])
      }
    }
  })

  it('"Todas" abre o painel inteiro: todas as improdutivas, ou a barra inteira do grupo', () => {
    const todasImprodutivas = selectOsListRecords(recorte, { kind: 'reason', reason: null })

    expect(todasImprodutivas).toHaveLength(buildReasonSummary(recorte).total)
    expect(todasImprodutivas.every((item) => item.statusKey === 'unproductive')).toBe(true)
    for (const group of buildOsOutcome(recorte)) {
      expect(
        selectOsListRecords(recorte, { kind: 'outcome', group: group.key, outcome: null }),
      ).toHaveLength(group.total)
    }
  })
})

describe('atalhos no topo da janela', () => {
  it('nos motivos, "Todas" vem primeiro, e depois as barras do painel na mesma ordem e cor', () => {
    const chips = buildOsListChips(recorte, clienteAusente)

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
    const chips = buildOsListChips(recorte, naoExecutadaCliente)

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
    const infra = buildOsListChips(recorte, { kind: 'outcome', group: 'infrastructure', outcome: 'notExecuted' })
    expect(infra.map((chip) => [chip.label, chip.count])).toEqual([
      ['Todas', 2],
      ['Improdutiva', 1],
      ['Não executada', 1],
    ])
  })

  it('cada atalho tem identidade própria, e o aceso é o da seleção', () => {
    const keys = buildOsListChips(recorte, clienteAusente).map((chip) => osListSelectionKey(chip.selection))

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
    const filtrado = { ...setembro, team: 'Infra', technicianId: 'tec-1', city: 'Atibaia' }

    expect(osListContext(filtrado, coverage, new Map([['tec-1', 'Ana Souza']]))).toBe(
      'Setembro de 2026, até o dia 23 · Equipe: Infra · Técnico: Ana Souza · Cidade: Atibaia',
    )
  })
})

describe('OS sem classificação', () => {
  // Chave de status nula ou fora do de-para: a fatia existe para ela aparecer.
  const comChaveNova = [...recorte, record({ status: 'Rascunho', statusKey: null })]

  it('a fatia abre a janela, e a lista tem o número dela', () => {
    const selection: OsListSelection = { kind: 'outcome', group: 'customer', outcome: 'unknown' }
    const group = buildOsOutcome(comChaveNova).find((item) => item.key === 'customer')!

    expect(group.counts.unknown).toBe(1)
    expect(selectOsListRecords(comChaveNova, selection)).toHaveLength(1)
  })

  it('vira atalho, no fim, só quando o grupo tem alguma OS nela', () => {
    const chips = buildOsListChips(comChaveNova, naoExecutadaCliente)

    expect(chips.at(-1)).toMatchObject({ label: 'Sem classificação', count: 1 })
    expect(buildOsListChips(recorte, naoExecutadaCliente).map((chip) => chip.label)).not.toContain(
      'Sem classificação',
    )
  })
})

describe('recorte vazio', () => {
  it('não há atalho nenhum, em nenhum dos dois painéis', () => {
    expect(buildOsListChips([], clienteAusente)).toEqual([])
    expect(buildOsListChips([], naoExecutadaCliente)).toEqual([])
  })
})

describe('Detalhe da improdutiva na janela', () => {
  it('diz o motivo com o nome da barra, inclusive "Sem motivo registrado"', () => {
    const rows = buildOsListRows(
      [
        improdutiva('  Cliente ausente ', { id: 'OS-2026-1' }),
        improdutiva(null, { id: 'OS-2026-2' }),
        record({ id: 'OS-2026-3', resolution: 'Instalação Realizada' }),
      ],
      new Map(),
    )

    expect(rows.map((row) => row.detail)).toEqual([
      'Cliente ausente',
      REASON_MISSING,
      'Instalação Realizada',
    ])
  })

  it('sem o campo de motivo na fonte, fica o traço: o dado não existe', () => {
    const semCampo = improdutiva(null)
    delete (semCampo as { unproductiveReason?: unknown }).unproductiveReason

    expect(buildOsListRows([semCampo], new Map())[0].detail).toBeNull()
  })
})
