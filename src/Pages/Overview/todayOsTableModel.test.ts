import { describe, expect, it } from 'vitest'

import type { TodayOsRow } from './todayOsModel'
import {
  filterTodayRows,
  hasTodayTableFilters,
  sortTodayRows,
  TODAY_COLUMNS,
  TODAY_TABLE_MIN_WIDTH,
  todayCellText,
  todayColumnOptions,
} from './todayOsTableModel'

/**
 * Teste espelho dos filtros de coluna da lista de OS de hoje.
 *
 * O que ele protege: o texto que a célula mostra é o mesmo pelo qual a coluna
 * filtra e ordena, as opções de uma coluna respeitam os filtros das OUTRAS
 * colunas (e não o dela mesma), e a ausência é um valor escolhível, não um
 * buraco.
 */

function row(overrides: Partial<TodayOsRow> = {}): TodayOsRow {
  return {
    id: 'OS-2026-1234',
    period: 'Manhã',
    serviceType: 'Instalação',
    category: 'fibra instalação',
    city: 'Atibaia',
    technician: 'Ana Souza',
    team: 'Infra',
    hasTechnician: true,
    status: 'Concluída',
    detail: 'Instalação Realizada',
    unassignedAtRisk: false,
    ...overrides,
  }
}

const lista = [
  row({ id: 'OS-2026-10', city: 'Atibaia', team: 'Infra', technician: 'Ana Souza' }),
  row({ id: 'OS-2026-9', city: 'Piracaia', team: 'Terceirizada', technician: 'Bruno Lima' }),
  row({ id: 'OS-2026-100', city: 'Atibaia', team: null, technician: null, hasTechnician: false }),
]

describe('colunas da lista', () => {
  it('declara largura para todas e o piso da tabela é a soma delas', () => {
    expect(TODAY_COLUMNS.every((column) => column.width > 0)).toBe(true)
    expect(TODAY_TABLE_MIN_WIDTH).toBe(
      TODAY_COLUMNS.reduce((total, column) => total + column.width, 0),
    )
  })

  it('escreve a ausência por extenso, que é o mesmo texto da opção de filtro', () => {
    const vazia = row({ period: null, team: null, technician: null, hasTechnician: false, detail: null })

    expect(todayCellText(vazia, 'period')).toBe('Sem turno')
    expect(todayCellText(vazia, 'team')).toBe('Sem equipe')
    expect(todayCellText(vazia, 'technician')).toBe('Sem técnico')
    expect(todayCellText(row({ technician: null }), 'technician')).toBe('Técnico sem nome')
    expect(todayCellText(vazia, 'detail')).toBe('·')
  })
})

describe('recorte por coluna', () => {
  it('lista vazia é sem filtro, e a seleção recorta pelo texto da célula', () => {
    expect(filterTodayRows(lista, {})).toHaveLength(3)
    expect(filterTodayRows(lista, { city: [] })).toHaveLength(3)
    expect(filterTodayRows(lista, { city: ['Atibaia'] }).map((item) => item.id)).toEqual([
      'OS-2026-10',
      'OS-2026-100',
    ])
    expect(hasTodayTableFilters({ city: [] })).toBe(false)
    expect(hasTodayTableFilters({ city: ['Atibaia'] })).toBe(true)
  })

  it('a ausência é escolhível como qualquer outro valor', () => {
    expect(filterTodayRows(lista, { team: ['Sem equipe'] }).map((item) => item.id)).toEqual([
      'OS-2026-100',
    ])
  })

  it('combina colunas diferentes com E', () => {
    expect(
      filterTodayRows(lista, { city: ['Atibaia'], team: ['Infra'] }).map((item) => item.id),
    ).toEqual(['OS-2026-10'])
  })
})

describe('opções de uma coluna', () => {
  it('conta no contexto das outras colunas e ignora o filtro da própria', () => {
    // Com Atibaia escolhido em Cidade, a lista de cidades continua com as duas
    // para o gestor poder acrescentar Piracaia; já Equipe só mostra o que
    // sobrou dentro de Atibaia.
    expect(todayColumnOptions(lista, 'city', { city: ['Atibaia'] })).toEqual([
      { value: 'Atibaia', count: 2 },
      { value: 'Piracaia', count: 1 },
    ])
    expect(todayColumnOptions(lista, 'team', { city: ['Atibaia'] })).toEqual([
      { value: 'Infra', count: 1 },
      { value: 'Sem equipe', count: 1 },
    ])
  })

  it('ordena em português e joga a ausência para o fim', () => {
    expect(todayColumnOptions(lista, 'technician', {}).map((option) => option.value)).toEqual([
      'Ana Souza',
      'Bruno Lima',
      'Sem técnico',
    ])
  })
})

describe('ordenação por coluna', () => {
  it('sem escolha, devolve a ordem que a lista já tinha', () => {
    expect(sortTodayRows(lista, null).map((item) => item.id)).toEqual([
      'OS-2026-10',
      'OS-2026-9',
      'OS-2026-100',
    ])
  })

  it('ordena texto em português nos dois sentidos', () => {
    expect(
      sortTodayRows(lista, { column: 'city', direction: 'asc' }).map((item) => item.city),
    ).toEqual(['Atibaia', 'Atibaia', 'Piracaia'])
    expect(
      sortTodayRows(lista, { column: 'city', direction: 'desc' }).map((item) => item.city),
    ).toEqual(['Piracaia', 'Atibaia', 'Atibaia'])
  })

  it('o código da OS ordena por número, e não como texto', () => {
    expect(sortTodayRows(lista, { column: 'id', direction: 'asc' }).map((item) => item.id)).toEqual([
      'OS-2026-9',
      'OS-2026-10',
      'OS-2026-100',
    ])
  })

  it('empate na coluna volta ao código, para a ordem não depender do acaso', () => {
    const rows = sortTodayRows(lista, { column: 'city', direction: 'asc' })

    expect(rows.slice(0, 2).map((item) => item.id)).toEqual(['OS-2026-10', 'OS-2026-100'])
  })

  it('no sentido inverso, a lista é o espelho da ordem crescente', () => {
    const crescente = sortTodayRows(lista, { column: 'city', direction: 'asc' })
    const decrescente = sortTodayRows(lista, { column: 'city', direction: 'desc' })

    expect(decrescente.map((item) => item.id)).toEqual(
      [...crescente].reverse().map((item) => item.id),
    )
  })

  it('a ausência fica no fim nos DOIS sentidos, e não no meio dos turnos', () => {
    const turnos = [
      row({ id: 'OS-1', period: null }),
      row({ id: 'OS-2', period: 'Tarde' }),
      row({ id: 'OS-3', period: 'Manhã' }),
    ]

    expect(
      sortTodayRows(turnos, { column: 'period', direction: 'asc' }).map((item) => item.period),
    ).toEqual(['Manhã', 'Tarde', null])
    expect(
      sortTodayRows(turnos, { column: 'period', direction: 'desc' }).map((item) => item.period),
    ).toEqual(['Tarde', 'Manhã', null])
  })

  it('valor do SGI que começa com "sem" não é tratado como ausência', () => {
    // "sem conexão" é categoria de verdade, e tem que ordenar junto das outras.
    const categorias = [
      row({ id: 'OS-1', category: 'sem conexão' }),
      row({ id: 'OS-2', category: 'troca de equipamento' }),
      row({ id: 'OS-3', category: 'fibra instalação' }),
    ]

    expect(
      sortTodayRows(categorias, { column: 'category', direction: 'asc' }).map(
        (item) => item.category,
      ),
    ).toEqual(['fibra instalação', 'sem conexão', 'troca de equipamento'])
  })
})

describe('recorte que não sobra nada', () => {
  it('filtro sem correspondência devolve lista vazia, e é isso que a tela mostra', () => {
    const vazio = filterTodayRows(lista, { city: ['Campinas'] })

    expect(vazio).toEqual([])
    // É o número que o cabeçalho escreve como "0 de 3 OS".
    expect(vazio.length).toBe(0)
    expect(lista.length).toBe(3)
  })

  it('opções de outra coluna, dentro de um recorte vazio, não quebram nem inventam', () => {
    expect(todayColumnOptions(lista, 'team', { city: ['Campinas'] })).toEqual([])
  })

  it('seleção que deixou de existir continua valendo, e a lista esvazia', () => {
    // O filtro de coluna NÃO volta sozinho ao neutro, diferente dos filtros da
    // página: quem desfaz é o "Restaurar tabela". A lista vazia, com a frase
    // própria, é o que avisa o gestor.
    expect(filterTodayRows(lista, { technician: ['Carlos que saiu da base'] })).toEqual([])
  })
})
