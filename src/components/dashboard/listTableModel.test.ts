import { describe, expect, it } from 'vitest'

import {
  compareBrDates,
  compareNumberedCodes,
  filterListRows,
  hasListFilters,
  listColumnOptions,
  listTableMinWidth,
  normalizeListSearch,
  searchListRows,
  sortListRows,
  type ListColumn,
  type ListTableRules,
} from './listTableModel'

/**
 * Teste espelho do modelo de lista do portal, com linhas de mentira: o que
 * vale aqui é o comportamento, não a OS. Os casos de OS de verdade seguem em
 * `todayOsTableModel.test.ts`, que usa este modelo por baixo.
 */
type Row = {
  readonly code: string
  readonly city: string
  readonly owner: string | null
  readonly day: string
}

const columns: readonly ListColumn<Row, 'code' | 'city' | 'owner' | 'day'>[] = [
  { key: 'code', label: 'Código', width: 100, filterable: false, sortable: true, text: (row) => row.code, compare: compareNumberedCodes },
  { key: 'city', label: 'Cidade', width: 100, filterable: true, sortable: true, text: (row) => row.city },
  { key: 'owner', label: 'Dono', width: 100, filterable: true, sortable: true, text: (row) => row.owner ?? 'Sem dono' },
  { key: 'day', label: 'Dia', width: 80, filterable: true, sortable: true, text: (row) => row.day, compare: compareBrDates, sortKind: 'date' },
]

const rules: ListTableRules<Row> = {
  missing: new Set(['Sem dono']),
  tieBreak: (a, b) => compareNumberedCodes(a.code, b.code),
}

const rows: Row[] = [
  { code: 'V-10', city: 'Atibaia', owner: 'Ana', day: '02/09/2026' },
  { code: 'V-9', city: 'Piracaia', owner: 'Bruno', day: '30/08/2026' },
  { code: 'V-100', city: 'Atibaia', owner: null, day: '01/09/2026' },
]

describe('recorte por coluna', () => {
  it('lista vazia é sem filtro; a seleção recorta pelo texto da célula e combina colunas com E', () => {
    expect(filterListRows(rows, columns, {})).toHaveLength(3)
    expect(filterListRows(rows, columns, { city: [] })).toHaveLength(3)
    expect(filterListRows(rows, columns, { city: ['Atibaia'] }).map((row) => row.code)).toEqual(['V-10', 'V-100'])
    expect(filterListRows(rows, columns, { city: ['Atibaia'], owner: ['Ana'] }).map((row) => row.code)).toEqual(['V-10'])
    expect(hasListFilters(columns, { city: [] })).toBe(false)
    expect(hasListFilters(columns, { city: ['Atibaia'] })).toBe(true)
  })

  it('a ausência é escolhível como qualquer outro valor, e o recorte vazio devolve lista vazia', () => {
    expect(filterListRows(rows, columns, { owner: ['Sem dono'] }).map((row) => row.code)).toEqual(['V-100'])
    expect(filterListRows(rows, columns, { city: ['Campinas'] })).toEqual([])
  })

  it('devolve o mesmo tipo de linha que recebeu, com o que ela carregava a mais', () => {
    const extra = rows.map((row) => ({ ...row, origem: row.code }))

    expect(sortListRows(filterListRows(extra, columns, {}), columns, null, rules)[0].origem).toBe('V-10')
  })
})

describe('opções de uma coluna', () => {
  it('conta no contexto das outras colunas e ignora o filtro da própria', () => {
    expect(listColumnOptions(rows, columns, 'city', { city: ['Atibaia'] }, rules)).toEqual([
      { value: 'Atibaia', count: 2 },
      { value: 'Piracaia', count: 1 },
    ])
    expect(listColumnOptions(rows, columns, 'owner', { city: ['Atibaia'] }, rules)).toEqual([
      { value: 'Ana', count: 1 },
      { value: 'Sem dono', count: 1 },
    ])
  })

  it('ordena pela ordem natural da coluna, com a ausência no fim', () => {
    expect(listColumnOptions(rows, columns, 'owner', {}, rules).map((option) => option.value)).toEqual([
      'Ana',
      'Bruno',
      'Sem dono',
    ])
    expect(listColumnOptions(rows, columns, 'day', {}, rules).map((option) => option.value)).toEqual([
      '30/08/2026',
      '01/09/2026',
      '02/09/2026',
    ])
  })

  it('recorte vazio não quebra nem inventa', () => {
    expect(listColumnOptions(rows, columns, 'owner', { city: ['Campinas'] }, rules)).toEqual([])
  })

  it('chave que não está entre as colunas da lista não tem opções, e não ordena nada', () => {
    // A lista da agenda de hoje não tem a coluna Dia: um filtro ou uma
    // ordenação nela não pode inventar nada.
    const semDia = columns.filter((column) => column.key !== 'day')

    expect(listColumnOptions(rows, semDia, 'day', {}, rules)).toEqual([])
    expect(sortListRows(rows, semDia, { column: 'day', direction: 'desc' }, rules).map((row) => row.code)).toEqual(['V-10', 'V-9', 'V-100'])
  })
})

describe('coluna de data com célula que não é data', () => {
  // A OS declara o traço como ausência; outra página pode esquecer. A célula
  // vazia não pode abrir a lista "mais recente primeiro".
  const dias = [
    { code: 'V-1', city: 'A', owner: 'Ana', day: '02/09/2026' },
    { code: 'V-2', city: 'A', owner: 'Ana', day: '' },
    { code: 'V-3', city: 'A', owner: 'Ana', day: '30/08/2026' },
    { code: 'V-4', city: 'A', owner: 'Ana', day: '·' },
  ]

  it('sem regras da página, o que não é data vai para o fim nos dois sentidos', () => {
    const decrescente = sortListRows(dias, columns, { column: 'day', direction: 'desc' }).map((row) => row.code)
    const crescente = sortListRows(dias, columns, { column: 'day', direction: 'asc' }).map((row) => row.code)

    expect(decrescente.slice(0, 2)).toEqual(['V-1', 'V-3'])
    expect(crescente.slice(0, 2)).toEqual(['V-3', 'V-1'])
    expect([...decrescente.slice(2)].sort()).toEqual(['V-2', 'V-4'])
    expect([...crescente.slice(2)].sort()).toEqual(['V-2', 'V-4'])
    expect(listColumnOptions(dias, columns, 'day', {}).map((option) => option.value).slice(0, 2)).toEqual(['30/08/2026', '02/09/2026'])
  })
})

describe('ordenação por coluna', () => {
  it('sem escolha devolve a ordem que a lista já tinha', () => {
    expect(sortListRows(rows, columns, null, rules).map((row) => row.code)).toEqual(['V-10', 'V-9', 'V-100'])
  })

  it('usa a ordem natural da coluna: número no código, calendário na data, alfabeto no resto', () => {
    expect(sortListRows(rows, columns, { column: 'code', direction: 'asc' }, rules).map((row) => row.code)).toEqual(['V-9', 'V-10', 'V-100'])
    expect(sortListRows(rows, columns, { column: 'day', direction: 'asc' }, rules).map((row) => row.code)).toEqual(['V-9', 'V-100', 'V-10'])
    expect(sortListRows(rows, columns, { column: 'city', direction: 'asc' }, rules).map((row) => row.city)).toEqual(['Atibaia', 'Atibaia', 'Piracaia'])
  })

  it('a ausência fica no fim nos dois sentidos, e o empate volta ao desempate da página', () => {
    expect(sortListRows(rows, columns, { column: 'owner', direction: 'asc' }, rules).map((row) => row.owner)).toEqual(['Ana', 'Bruno', null])
    expect(sortListRows(rows, columns, { column: 'owner', direction: 'desc' }, rules).map((row) => row.owner)).toEqual(['Bruno', 'Ana', null])
    expect(sortListRows(rows, columns, { column: 'city', direction: 'asc' }, rules).slice(0, 2).map((row) => row.code)).toEqual(['V-10', 'V-100'])
  })

  it('o sentido inverso é o espelho exato do crescente', () => {
    const crescente = sortListRows(rows, columns, { column: 'city', direction: 'asc' }, rules)
    const decrescente = sortListRows(rows, columns, { column: 'city', direction: 'desc' }, rules)

    expect(decrescente.map((row) => row.code)).toEqual([...crescente].reverse().map((row) => row.code))
  })

  it('sem regras da página, a ausência é só mais um texto e o empate mantém a ordem de chegada', () => {
    expect(sortListRows(rows, columns, { column: 'owner', direction: 'asc' }).map((row) => row.owner)).toEqual(['Ana', 'Bruno', null])
    expect(sortListRows(rows, columns, { column: 'city', direction: 'asc' }).slice(0, 2).map((row) => row.code)).toEqual(['V-10', 'V-100'])
  })
})

describe('comparações e medidas', () => {
  it('código com prefixo igual ordena pelo número; prefixos diferentes voltam ao alfabeto', () => {
    expect(compareNumberedCodes('OS-2026-98', 'OS-2026-1234')).toBeLessThan(0)
    expect(compareNumberedCodes('OS-2026-1234', 'OS-2026-98')).toBeGreaterThan(0)
    expect(compareNumberedCodes('A-1', 'B-1')).toBeLessThan(0)
    expect(compareNumberedCodes('sem número', 'outro')).toBeGreaterThan(0)
  })

  it('a data brasileira compara pelo calendário, e não pelo texto', () => {
    expect(compareBrDates('30/08/2026', '02/09/2026')).toBeLessThan(0)
    expect(compareBrDates('02/09/2026', '02/09/2026')).toBe(0)
  })

  it('o piso da tabela é a soma das larguras', () => {
    expect(listTableMinWidth(columns)).toBe(380)
  })
})

/**
 * Busca na lista (13/10/2026, pedido do Mário): acha a linha por qualquer
 * pedaço de texto, em qualquer coluna, sem acento e sem maiúscula.
 */
describe('busca na lista', () => {
  const comAcento: Row[] = [
    { code: 'OS-2026-8739', city: 'Mairiporã', owner: 'Ana', day: '02/09/2026' },
    { code: 'OS-2026-9005', city: 'Atibaia', owner: 'João', day: '02/09/2026' },
  ]

  it('tira acento, maiúscula e espaço sobrando', () => {
    expect(normalizeListSearch('  Mairiporã   INSTALAÇÃO ')).toBe('mairipora instalacao')
  })

  it('acha pelo pedaço do código, sem acento e sem maiúscula', () => {
    expect(searchListRows(comAcento, columns, '8739').map((row) => row.code)).toEqual(['OS-2026-8739'])
    expect(searchListRows(comAcento, columns, 'MAIRIPORA').map((row) => row.code)).toEqual(['OS-2026-8739'])
    expect(searchListRows(comAcento, columns, 'joao').map((row) => row.code)).toEqual(['OS-2026-9005'])
  })

  it('cada palavra precisa aparecer em alguma coluna da linha, em qualquer ordem', () => {
    expect(searchListRows(comAcento, columns, 'ana mairipora').map((row) => row.code)).toEqual(['OS-2026-8739'])
    expect(searchListRows(comAcento, columns, 'ana atibaia')).toEqual([])
  })

  it('busca vazia devolve a lista inteira, na mesma ordem', () => {
    expect(searchListRows(comAcento, columns, '   ')).toEqual(comAcento)
  })

  it('acha também o texto que a página entrega à parte, como o da dica de mouse', () => {
    const extra = (row: Row) => (row.code === 'OS-2026-9005' ? 'motivo: chuva forte' : '')

    expect(searchListRows(comAcento, columns, 'chuva', extra).map((row) => row.code)).toEqual(['OS-2026-9005'])
    expect(searchListRows(comAcento, columns, 'chuva')).toEqual([])
  })
})
