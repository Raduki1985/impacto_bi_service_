import { describe, expect, it } from 'vitest'

import { getCommercialDataset } from '../../../data/mockCommercialData'
import {
  buildActiveSalesSnapshot,
  initialActiveSalesFilters,
  salesPeriodOriginLabels,
  type ActiveSaleRow,
} from './salesPeriodModel'
import {
  activeSalesTableColumns,
  applySalesTableFilters,
  buildSalesTableOptions,
  hasActiveSalesTableFilters,
  initialSalesTableFilters,
  isDateRangeInvalid,
  isValueRangeInvalid,
  matchesContractSearch,
  matchesOptionSearch,
  normalizeContract,
  parseCurrencyInput,
  parseDateInput,
  salesTableSortColumn,
  sortSalesTableRows,
  type SalesTableFilters,
  type SalesTableSort,
} from './salesPeriodTableModel'

const dataset = getCommercialDataset()
const rows = buildActiveSalesSnapshot(dataset, initialActiveSalesFilters()).rows

function filtersWith(overrides: Partial<SalesTableFilters> = {}): SalesTableFilters {
  return { ...initialSalesTableFilters(), ...overrides }
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

describe('estado inicial dos filtros locais', () => {
  it('começa sem nenhum filtro ativo', () => {
    const filters = initialSalesTableFilters()

    expect(hasActiveSalesTableFilters(filters)).toBe(false)
    expect(activeSalesTableColumns(filters).size).toBe(0)
    expect(applySalesTableFilters(rows, filters)).toHaveLength(rows.length)
  })

  it('marca como ativa cada coluna efetivamente filtrada', () => {
    expect([...activeSalesTableColumns(filtersWith({ sellers: ['vnd-ana-maria'] }))]).toEqual([
      'sellers',
    ])
    expect([...activeSalesTableColumns(filtersWith({ minValue: 100 }))]).toEqual(['value'])
    expect([...activeSalesTableColumns(filtersWith({ maxValue: 100 }))]).toEqual(['value'])
    expect([...activeSalesTableColumns(filtersWith({ startDateFrom: '2025-01-01' }))]).toEqual([
      'startDate',
    ])
    expect([...activeSalesTableColumns(filtersWith({ startDateTo: '2025-01-01' }))]).toEqual([
      'startDate',
    ])
    expect([...activeSalesTableColumns(filtersWith({ contract: '1300' }))]).toEqual(['contract'])
    expect([...activeSalesTableColumns(filtersWith({ origins: ['indicacao'] }))]).toEqual([
      'origins',
    ])
    expect(activeSalesTableColumns(filtersWith({ cities: ['atibaia'], plans: ['1 Giga'] })).size).toBe(
      2,
    )
  })

  it('não trata uma pesquisa de contrato em branco como filtro', () => {
    expect(hasActiveSalesTableFilters(filtersWith({ contract: '   ' }))).toBe(false)
  })

  it('não expõe mais o filtro de Status atual', () => {
    expect(Object.keys(initialSalesTableFilters())).not.toContain('statuses')
    expect(buildSalesTableOptions(rows, initialSalesTableFilters())).not.toHaveProperty('statuses')
  })
})

describe('composição dos filtros locais', () => {
  it('filtra por cliente, vendedor, cidade, plano e origem', () => {
    const sample = rows[0]

    expect(
      applySalesTableFilters(rows, filtersWith({ customers: [sample.customerLabel] })).every(
        (row) => row.customerLabel === sample.customerLabel,
      ),
    ).toBe(true)
    expect(
      applySalesTableFilters(rows, filtersWith({ sellers: ['vnd-ana-maria'] })).every(
        (row) => row.sellerId === 'vnd-ana-maria',
      ),
    ).toBe(true)
    expect(
      applySalesTableFilters(rows, filtersWith({ cities: ['piracaia'] })).every(
        (row) => row.cityId === 'piracaia',
      ),
    ).toBe(true)
    expect(
      applySalesTableFilters(rows, filtersWith({ plans: ['1 Giga'] })).every(
        (row) => row.planName === '1 Giga',
      ),
    ).toBe(true)

    const indicacao = applySalesTableFilters(rows, filtersWith({ origins: ['indicacao'] }))
    expect(indicacao.length).toBeGreaterThan(0)
    expect(indicacao.length).toBeLessThan(rows.length)
    expect(indicacao.every((row) => row.origin === 'indicacao')).toBe(true)
  })

  it('aceita seleção múltipla dentro da mesma coluna', () => {
    const filtered = applySalesTableFilters(
      rows,
      filtersWith({ cities: ['piracaia', 'joanopolis'] }),
    )

    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((row) => ['piracaia', 'joanopolis'].includes(row.cityId))).toBe(true)
    expect(filtered.some((row) => row.cityId === 'piracaia')).toBe(true)
    expect(filtered.some((row) => row.cityId === 'joanopolis')).toBe(true)
  })

  it('selecionar as duas origens equivale a não filtrar por origem', () => {
    expect(
      applySalesTableFilters(rows, filtersWith({ origins: ['indicacao', 'vendedores'] })),
    ).toHaveLength(rows.length)
  })

  it('combina colunas diferentes com E lógico', () => {
    const filters = filtersWith({ cities: ['atibaia'], plans: ['1 Giga'] })
    const combined = applySalesTableFilters(rows, filters)
    const onlyCity = applySalesTableFilters(rows, filtersWith({ cities: ['atibaia'] }))

    expect(combined.length).toBeGreaterThan(0)
    expect(combined.length).toBeLessThan(onlyCity.length)
    expect(
      combined.every((row) => row.cityId === 'atibaia' && row.planName === '1 Giga'),
    ).toBe(true)
  })

  it('combina origem com outra coluna sem ampliar o conjunto', () => {
    const onlyOrigin = applySalesTableFilters(rows, filtersWith({ origins: ['indicacao'] }))
    const combined = applySalesTableFilters(
      rows,
      filtersWith({ origins: ['indicacao'], cities: ['atibaia'] }),
    )

    expect(combined.length).toBeLessThanOrEqual(onlyOrigin.length)
    expect(
      combined.every((row) => row.origin === 'indicacao' && row.cityId === 'atibaia'),
    ).toBe(true)
  })

  it('aplica a faixa de valor pelos dois lados', () => {
    const range = applySalesTableFilters(rows, filtersWith({ minValue: 150, maxValue: 300 }))

    expect(range.length).toBeGreaterThan(0)
    expect(range.every((row) => row.monthlyValue >= 150 && row.monthlyValue <= 300)).toBe(true)
    expect(rows.some((row) => row.monthlyValue < 150)).toBe(true)
    expect(rows.some((row) => row.monthlyValue > 300)).toBe(true)
  })
})

describe('filtro de Data de Início', () => {
  const ordered = [...rows].map((row) => row.startDate).sort()
  const earliest = ordered[0]
  const latest = ordered[ordered.length - 1]
  const middle = ordered[Math.floor(ordered.length / 2)]

  it('aceita faixa aberta só com a data inicial', () => {
    const filtered = applySalesTableFilters(rows, filtersWith({ startDateFrom: middle }))

    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.length).toBeLessThan(rows.length)
    expect(filtered.every((row) => row.startDate >= middle)).toBe(true)
  })

  it('aceita faixa aberta só com a data final', () => {
    const filtered = applySalesTableFilters(rows, filtersWith({ startDateTo: middle }))

    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.length).toBeLessThan(rows.length)
    expect(filtered.every((row) => row.startDate <= middle)).toBe(true)
  })

  it('recorta pelo intervalo completo, com as duas pontas inclusivas', () => {
    const filtered = applySalesTableFilters(
      rows,
      filtersWith({ startDateFrom: earliest, startDateTo: latest }),
    )

    expect(filtered).toHaveLength(rows.length)
    expect(
      applySalesTableFilters(rows, filtersWith({ startDateFrom: earliest, startDateTo: earliest }))
        .every((row) => row.startDate === earliest),
    ).toBe(true)
  })

  it('reconhece intervalo invertido', () => {
    expect(isDateRangeInvalid(latest, earliest)).toBe(true)
    expect(isDateRangeInvalid(earliest, latest)).toBe(false)
    expect(isDateRangeInvalid(earliest, earliest)).toBe(false)
    expect(isDateRangeInvalid(null, latest)).toBe(false)
    expect(isDateRangeInvalid(earliest, null)).toBe(false)
    expect(isDateRangeInvalid(null, null)).toBe(false)
  })

  it('lê o campo de data e trata o rascunho incompleto como faixa aberta', () => {
    expect(parseDateInput('2025-03-14')).toBe('2025-03-14')
    expect(parseDateInput(' 2025-03-14 ')).toBe('2025-03-14')
    expect(parseDateInput('')).toBeNull()
    expect(parseDateInput('2025-03')).toBeNull()
    expect(parseDateInput('14/03/2025')).toBeNull()
  })
})

describe('filtro de Contrato', () => {
  it('encontra o contrato com ou sem o caractere #', () => {
    const sample = rows[0].contractCode
    const semCerquilha = sample.replace('#', '')

    expect(applySalesTableFilters(rows, filtersWith({ contract: sample }))).toHaveLength(1)
    expect(applySalesTableFilters(rows, filtersWith({ contract: semCerquilha }))).toHaveLength(1)
    expect(
      applySalesTableFilters(rows, filtersWith({ contract: sample }))[0].contractCode,
    ).toBe(sample)
  })

  it('aceita busca parcial', () => {
    const partial = rows[0].contractCode.slice(-4)
    const filtered = applySalesTableFilters(rows, filtersWith({ contract: partial }))

    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((row) => row.contractCode.includes(partial))).toBe(true)
  })

  it('normaliza sem alterar o código exibido', () => {
    const sample = rows[0].contractCode

    expect(sample.startsWith('#')).toBe(true)
    expect(normalizeContract(sample)).toBe(sample.slice(1).toLowerCase())
    expect(matchesContractSearch(sample, '#')).toBe(true)
    expect(matchesContractSearch(sample, '')).toBe(true)
    expect(matchesContractSearch(sample, 'zzzz')).toBe(false)
  })
})

describe('opções dos painéis', () => {
  it('só oferece valores existentes nas linhas do recorte', () => {
    const options = buildSalesTableOptions(rows, initialSalesTableFilters())
    const cityIds = new Set(rows.map((row) => row.cityId))
    const planNames = new Set(rows.map((row) => row.planName))

    expect(options.cities.map((option) => option.value).sort()).toEqual([...cityIds].sort())
    expect(options.plans.map((option) => option.value).sort()).toEqual([...planNames].sort())
  })

  it('oferece as duas origens do recorte, com o rótulo aprovado', () => {
    const options = buildSalesTableOptions(rows, initialSalesTableFilters())

    expect(options.origins).toEqual([
      { value: 'indicacao', label: salesPeriodOriginLabels.indicacao },
      { value: 'vendedores', label: salesPeriodOriginLabels.vendedores },
    ])
  })

  it('leva o CPF do cliente como texto secundário pesquisável', () => {
    const options = buildSalesTableOptions(rows, initialSalesTableFilters())
    const first = options.customers[0]

    expect(first.hint).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
    expect(matchesOptionSearch(first, first.hint ?? '')).toBe(true)
    expect(matchesOptionSearch(first, first.label)).toBe(true)
    expect(matchesOptionSearch(first, 'inexistente')).toBe(false)
  })

  it('reduz as opções de uma coluna conforme os filtros das outras', () => {
    const semFiltro = buildSalesTableOptions(rows, initialSalesTableFilters())
    const comCidade = buildSalesTableOptions(rows, filtersWith({ cities: ['terra-preta'] }))

    expect(comCidade.sellers.length).toBeLessThan(semFiltro.sellers.length)
    expect(comCidade.sellers.length).toBeGreaterThan(0)
  })

  it('ignora o filtro da própria coluna ao montar a lista dela', () => {
    const filters = filtersWith({ cities: ['piracaia'] })
    const options = buildSalesTableOptions(rows, filters)

    // A lista de cidades continua completa, para o usuário poder ampliar a
    // seleção sem antes precisar limpar o filtro.
    expect(options.cities.length).toBeGreaterThan(1)
    expect(options.cities.some((option) => option.value === 'atibaia')).toBe(true)
    // As demais colunas respeitam o recorte de Piracaia.
    expect(
      options.sellers.length <
        buildSalesTableOptions(rows, initialSalesTableFilters()).sellers.length,
    ).toBe(true)
  })

  it('respeita os filtros de data e de contrato ao montar as listas', () => {
    const semFiltro = buildSalesTableOptions(rows, initialSalesTableFilters())
    const comContrato = buildSalesTableOptions(rows, filtersWith({ contract: rows[0].contractCode }))

    expect(comContrato.customers).toHaveLength(1)
    expect(comContrato.customers[0].value).toBe(rows[0].customerLabel)
    expect(semFiltro.customers.length).toBeGreaterThan(1)
  })

  it('ordena as opções pelo rótulo em português', () => {
    const options = buildSalesTableOptions(rows, initialSalesTableFilters())
    const labels = options.cities.map((option) => option.label)

    expect(labels).toEqual([...labels].sort((a, b) => collator.compare(a, b)))
  })
})

describe('ordenação local', () => {
  it('preserva a ordem padrão sem ordenação escolhida', () => {
    expect(sortSalesTableRows(rows, null).map((row) => row.id)).toEqual(rows.map((row) => row.id))
  })

  it('aponta a coluna de cada ordenação', () => {
    expect(salesTableSortColumn(null)).toBeNull()
    expect(salesTableSortColumn('data-desc')).toBe('startDate')
    expect(salesTableSortColumn('contrato-asc')).toBe('contract')
    expect(salesTableSortColumn('cliente-desc')).toBe('customers')
    expect(salesTableSortColumn('vendedor-asc')).toBe('sellers')
    expect(salesTableSortColumn('cidade-asc')).toBe('cities')
    expect(salesTableSortColumn('plano-asc')).toBe('plans')
    expect(salesTableSortColumn('valor-desc')).toBe('value')
    expect(salesTableSortColumn('origem-asc')).toBe('origins')
  })

  it('ordena a Data de Início nos dois sentidos', () => {
    expect(isSortedBy(sortSalesTableRows(rows, 'data-asc'), (row) => row.startDate, 'asc')).toBe(
      true,
    )
    expect(isSortedBy(sortSalesTableRows(rows, 'data-desc'), (row) => row.startDate, 'desc')).toBe(
      true,
    )
  })

  it('ordena o contrato como identificador, nos dois sentidos', () => {
    const ascending = sortSalesTableRows(rows, 'contrato-asc')
    const descending = sortSalesTableRows(rows, 'contrato-desc')

    expect(isSortedByText(ascending, (row) => normalizeContract(row.contractCode), 'asc')).toBe(true)
    expect(isSortedByText(descending, (row) => normalizeContract(row.contractCode), 'desc')).toBe(
      true,
    )
    expect(descending.map((row) => row.id)).toEqual([...ascending].reverse().map((row) => row.id))
  })

  it('ordena as colunas textuais em A–Z e Z–A', () => {
    const casos = [
      ['cliente-asc', 'cliente-desc', (row: ActiveSaleRow) => row.customerLabel],
      ['vendedor-asc', 'vendedor-desc', (row: ActiveSaleRow) => row.sellerName],
      ['cidade-asc', 'cidade-desc', (row: ActiveSaleRow) => row.cityName],
      ['plano-asc', 'plano-desc', (row: ActiveSaleRow) => row.planName],
      ['origem-asc', 'origem-desc', (row: ActiveSaleRow) => salesPeriodOriginLabels[row.origin]],
    ] as const

    for (const [asc, desc, pick] of casos) {
      expect(isSortedByText(sortSalesTableRows(rows, asc), pick, 'asc')).toBe(true)
      expect(isSortedByText(sortSalesTableRows(rows, desc), pick, 'desc')).toBe(true)
    }
  })

  it('compara texto sem se prender a caixa nem a acento', () => {
    expect(collator.compare('Ávila', 'avila')).toBe(0)
    // Os nomes acentuados entram no meio da lista, e não nas pontas.
    const nomes = sortSalesTableRows(rows, 'cliente-asc').map((row) => row.customerLabel)
    const acentuado = nomes.findIndex((nome) => /[À-ÿ]/.test(nome))

    if (acentuado !== -1) {
      expect(acentuado).toBeGreaterThan(0)
      expect(acentuado).toBeLessThan(nomes.length - 1)
    }
  })

  it('ordena pelo valor mensal contratado nos dois sentidos', () => {
    const ascending = sortSalesTableRows(rows, 'valor-asc')
    const descending = sortSalesTableRows(rows, 'valor-desc')

    expect(isSortedBy(ascending, (row) => row.monthlyValue, 'asc')).toBe(true)
    expect(isSortedBy(descending, (row) => row.monthlyValue, 'desc')).toBe(true)
    expect(ascending).toHaveLength(rows.length)
    expect(descending).toHaveLength(rows.length)
  })

  it('desempata pela ordem padrão da página', () => {
    const ascending = sortSalesTableRows(rows, 'valor-asc')
    const posicaoPadrao = new Map(rows.map((row, index) => [row.id, index]))

    for (let index = 1; index < ascending.length; index += 1) {
      const previous = ascending[index - 1]
      const current = ascending[index]
      if (previous.monthlyValue !== current.monthlyValue) continue

      expect(posicaoPadrao.get(previous.id)).toBeLessThan(posicaoPadrao.get(current.id) ?? -1)
    }
  })

  it('é determinística: a mesma entrada produz sempre a mesma saída', () => {
    const chaves: SalesTableSort[] = ['data-asc', 'contrato-desc', 'cidade-asc', 'valor-desc']

    for (const chave of chaves) {
      expect(sortSalesTableRows(rows, chave).map((row) => row.id)).toEqual(
        sortSalesTableRows(rows, chave).map((row) => row.id),
      )
    }
  })

  it('não altera o conjunto de linhas, apenas a ordem', () => {
    const ids = new Set(rows.map((row) => row.id))

    for (const chave of ['data-asc', 'contrato-asc', 'cliente-desc', 'valor-desc'] as const) {
      const sorted = sortSalesTableRows(rows, chave)
      expect(sorted).toHaveLength(rows.length)
      expect(new Set(sorted.map((row) => row.id))).toEqual(ids)
    }
  })

  it('não mexe na lista recebida', () => {
    const antes = rows.map((row) => row.id)
    sortSalesTableRows(rows, 'valor-desc')

    expect(rows.map((row) => row.id)).toEqual(antes)
  })
})

function isSortedBy(
  list: readonly ActiveSaleRow[],
  pick: (row: ActiveSaleRow) => string | number,
  direction: 'asc' | 'desc',
): boolean {
  return list.every((row, index) => {
    if (index === 0) return true
    const previous = pick(list[index - 1])
    return direction === 'asc' ? previous <= pick(row) : previous >= pick(row)
  })
}

function isSortedByText(
  list: readonly ActiveSaleRow[],
  pick: (row: ActiveSaleRow) => string,
  direction: 'asc' | 'desc',
): boolean {
  return list.every((row, index) => {
    if (index === 0) return true
    const comparison = collator.compare(pick(list[index - 1]), pick(row))
    return direction === 'asc' ? comparison <= 0 : comparison >= 0
  })
}

describe('leitura dos campos de valor', () => {
  it('aceita os formatos monetários usados pela interface', () => {
    expect(parseCurrencyInput('R$ 1.234,56')).toEqual({ kind: 'value', value: 1234.56 })
    expect(parseCurrencyInput('1.234,56')).toEqual({ kind: 'value', value: 1234.56 })
    expect(parseCurrencyInput('1234,56')).toEqual({ kind: 'value', value: 1234.56 })
    expect(parseCurrencyInput('129.9')).toEqual({ kind: 'value', value: 129.9 })
    expect(parseCurrencyInput('129')).toEqual({ kind: 'value', value: 129 })
    expect(parseCurrencyInput('1.234')).toEqual({ kind: 'value', value: 1234 })
  })

  it('distingue campo vazio de valor inválido', () => {
    expect(parseCurrencyInput('')).toEqual({ kind: 'empty' })
    expect(parseCurrencyInput('   ')).toEqual({ kind: 'empty' })
    expect(parseCurrencyInput('R$')).toEqual({ kind: 'empty' })
    expect(parseCurrencyInput('abc')).toEqual({ kind: 'invalid' })
    expect(parseCurrencyInput('12,3,4')).toEqual({ kind: 'invalid' })
  })

  it('reconhece faixa invertida sem limpar a tabela em silêncio', () => {
    expect(isValueRangeInvalid(300, 150)).toBe(true)
    expect(isValueRangeInvalid(150, 300)).toBe(false)
    expect(isValueRangeInvalid(null, 300)).toBe(false)
    expect(isValueRangeInvalid(150, null)).toBe(false)
    expect(isValueRangeInvalid(null, null)).toBe(false)
  })
})
