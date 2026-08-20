import { describe, expect, it } from 'vitest'

import { getCommercialDataset } from '../../../data/mockCommercialData'
import {
  buildActiveSalesSnapshot,
  initialActiveSalesFilters,
  type ActiveSaleRow,
} from './salesPeriodModel'
import {
  activeSalesTableColumns,
  applySalesTableFilters,
  buildSalesTableOptions,
  hasActiveSalesTableFilters,
  initialSalesTableFilters,
  isValueRangeInvalid,
  matchesOptionSearch,
  parseCurrencyInput,
  sortSalesTableRows,
  type SalesTableFilters,
} from './salesPeriodTableModel'

const dataset = getCommercialDataset()
const rows = buildActiveSalesSnapshot(dataset, initialActiveSalesFilters()).rows

function filtersWith(overrides: Partial<SalesTableFilters> = {}): SalesTableFilters {
  return { ...initialSalesTableFilters(), ...overrides }
}

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
    expect(activeSalesTableColumns(filtersWith({ cities: ['atibaia'], plans: ['1 Giga'] })).size).toBe(
      2,
    )
  })
})

describe('composição dos filtros locais', () => {
  it('filtra por cliente, vendedor, cidade, plano e status', () => {
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
    expect(
      applySalesTableFilters(rows, filtersWith({ statuses: ['ativa'] })),
    ).toHaveLength(rows.length)
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

  it('aplica a faixa de valor pelos dois lados', () => {
    const range = applySalesTableFilters(rows, filtersWith({ minValue: 150, maxValue: 300 }))

    expect(range.length).toBeGreaterThan(0)
    expect(range.every((row) => row.monthlyValue >= 150 && row.monthlyValue <= 300)).toBe(true)
    expect(rows.some((row) => row.monthlyValue < 150)).toBe(true)
    expect(rows.some((row) => row.monthlyValue > 300)).toBe(true)
  })
})

describe('opções dos painéis', () => {
  it('só oferece valores existentes nas linhas do recorte', () => {
    const options = buildSalesTableOptions(rows, initialSalesTableFilters())
    const cityIds = new Set(rows.map((row) => row.cityId))
    const planNames = new Set(rows.map((row) => row.planName))

    expect(options.cities.map((option) => option.value).sort()).toEqual([...cityIds].sort())
    expect(options.plans.map((option) => option.value).sort()).toEqual([...planNames].sort())
    // O universo da página é fixo em vendas ativas, então Ativa é o único status.
    expect(options.statuses).toHaveLength(1)
    expect(options.statuses[0]).toEqual({ value: 'ativa', label: 'Ativa' })
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

  it('ordena as opções pelo rótulo em português', () => {
    const options = buildSalesTableOptions(rows, initialSalesTableFilters())
    const labels = options.cities.map((option) => option.label)

    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })
})

describe('ordenação local', () => {
  it('preserva a ordem padrão sem ordenação escolhida', () => {
    expect(sortSalesTableRows(rows, null).map((row) => row.id)).toEqual(rows.map((row) => row.id))
  })

  it('ordena pelo valor mensal contratado nos dois sentidos', () => {
    const ascending = sortSalesTableRows(rows, 'valor-asc')
    const descending = sortSalesTableRows(rows, 'valor-desc')

    expect(isSorted(ascending, 'asc')).toBe(true)
    expect(isSorted(descending, 'desc')).toBe(true)
    expect(ascending).toHaveLength(rows.length)
    expect(descending).toHaveLength(rows.length)
  })

  it('desempata de forma estável dentro do mesmo valor', () => {
    const ascending = sortSalesTableRows(rows, 'valor-asc')

    for (let index = 1; index < ascending.length; index += 1) {
      const previous = ascending[index - 1]
      const current = ascending[index]
      if (previous.monthlyValue !== current.monthlyValue) continue

      expect(
        previous.startDate > current.startDate ||
          (previous.startDate === current.startDate && previous.id > current.id),
      ).toBe(true)
    }
  })

  it('não altera o conjunto de linhas, apenas a ordem', () => {
    const ids = new Set(rows.map((row) => row.id))
    const sorted = sortSalesTableRows(rows, 'valor-desc')

    expect(new Set(sorted.map((row) => row.id))).toEqual(ids)
  })
})

function isSorted(list: readonly ActiveSaleRow[], direction: 'asc' | 'desc'): boolean {
  return list.every((row, index) => {
    if (index === 0) return true
    const previous = list[index - 1].monthlyValue
    return direction === 'asc' ? previous <= row.monthlyValue : previous >= row.monthlyValue
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
