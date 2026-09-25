import { describe, expect, it } from 'vitest'

import {
  filterListRows,
  listColumnOptions,
  listTableMinWidth,
  sortListRows,
} from '../../../components/dashboard/listTableModel'
import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import type { TodaySaleRow } from './todaySalesModel'
import {
  TODAY_SALES_COLUMNS,
  TODAY_SALES_TABLE_RULES,
  todaySalesCellText,
} from './todaySalesTableModel'
import { TODAY_COLUMNS } from '../../Overview/todayOsTableModel'

const source = {} as CommercialSaleRecord

function row(overrides: Partial<TodaySaleRow> = {}): TodaySaleRow {
  return {
    id: '01757155',
    soldOn: '2026-09-25',
    time: '08h57',
    seller: 'Ana Maria dos Santos',
    team: 'Comercial',
    city: 'Atibaia',
    plan: 'res_600mb solo',
    value: 129.9,
    personType: 'pf',
    status: 'Pendente',
    detail: 'Aguarda assinatura',
    late: false,
    source,
    ...overrides,
  }
}

describe('colunas da lista de contratos da faixa', () => {
  it('tem as onze colunas na ordem da tela, sem passar da largura da lista de OS', () => {
    expect(TODAY_SALES_COLUMNS.map((column) => column.label)).toEqual([
      'Contrato', 'Venda', 'Hora', 'Vendedor', 'Time', 'Cidade', 'Plano', 'Valor', 'Tipo', 'Situação', 'Detalhe',
    ])
    // Cabe na faixa sem rolar para o lado, como a lista de OS de hoje.
    expect(listTableMinWidth(TODAY_SALES_COLUMNS)).toBeLessThanOrEqual(listTableMinWidth(TODAY_COLUMNS))
    // Contrato e valor ordenam sem filtrar; Detalhe não faz nem uma coisa nem outra.
    expect(TODAY_SALES_COLUMNS.find((column) => column.key === 'id')).toMatchObject({ filterable: false, sortable: true })
    expect(TODAY_SALES_COLUMNS.find((column) => column.key === 'value')).toMatchObject({ filterable: false, sortable: true })
    expect(TODAY_SALES_COLUMNS.find((column) => column.key === 'detail')).toMatchObject({ filterable: false, sortable: false })
    expect(TODAY_SALES_COLUMNS.find((column) => column.key === 'soldOn')).toMatchObject({ sortKind: 'date' })
  })

  it('escreve a célula, com a ausência por extenso e o valor em reais', () => {
    const full = row()
    const empty = row({ soldOn: null, time: null, seller: null, team: null, personType: null, detail: null })

    expect(todaySalesCellText(full, 'soldOn')).toBe('25/09/2026')
    expect(todaySalesCellText(full, 'value')).toBe('R$ 129,90')
    expect(todaySalesCellText(full, 'personType')).toBe('PF')
    expect(todaySalesCellText(empty, 'soldOn')).toBe('Sem data')
    expect(todaySalesCellText(empty, 'time')).toBe('Sem hora')
    expect(todaySalesCellText(empty, 'seller')).toBe('Sem vendedor')
    expect(todaySalesCellText(empty, 'team')).toBe('Sem time')
    expect(todaySalesCellText(empty, 'personType')).toBe('Sem tipo')
    expect(todaySalesCellText(empty, 'detail')).toBe('·')
  })

  it('ordena valor pelo número, contrato pelo número do código e venda pelo calendário', () => {
    const rows = [
      row({ id: '9', value: 1299.9, soldOn: '2026-08-30' }),
      row({ id: '10', value: 89.9, seller: null, soldOn: '2026-09-02' }),
      row({ id: '2', value: 129.9, soldOn: '2026-03-19' }),
    ]

    const byValue = sortListRows(rows, TODAY_SALES_COLUMNS, { column: 'value', direction: 'desc' }, TODAY_SALES_TABLE_RULES)
    expect(byValue.map((item) => item.id)).toEqual(['9', '2', '10'])

    const byCode = sortListRows(rows, TODAY_SALES_COLUMNS, { column: 'id', direction: 'asc' }, TODAY_SALES_TABLE_RULES)
    expect(byCode.map((item) => item.id)).toEqual(['2', '9', '10'])

    const bySale = sortListRows(rows, TODAY_SALES_COLUMNS, { column: 'soldOn', direction: 'asc' }, TODAY_SALES_TABLE_RULES)
    expect(bySale.map((item) => item.id)).toEqual(['2', '9', '10'])

    const bySeller = sortListRows(rows, TODAY_SALES_COLUMNS, { column: 'seller', direction: 'desc' }, TODAY_SALES_TABLE_RULES)
    expect(bySeller.at(-1)?.id).toBe('10')
  })

  it('as opções de uma coluna saem do recorte das outras, e a ausência é opção', () => {
    const rows = [
      row({ id: '1', seller: 'Ana', status: 'Pendente' }),
      row({ id: '2', seller: 'Bia', status: 'Agendada' }),
      row({ id: '3', seller: null, status: 'Agendada' }),
    ]

    expect(listColumnOptions(rows, TODAY_SALES_COLUMNS, 'seller', {}, TODAY_SALES_TABLE_RULES)).toEqual([
      { value: 'Ana', count: 1 },
      { value: 'Bia', count: 1 },
      { value: 'Sem vendedor', count: 1 },
    ])
    expect(listColumnOptions(rows, TODAY_SALES_COLUMNS, 'seller', { status: ['Agendada'] }, TODAY_SALES_TABLE_RULES)).toEqual([
      { value: 'Bia', count: 1 },
      { value: 'Sem vendedor', count: 1 },
    ])
    expect(filterListRows(rows, TODAY_SALES_COLUMNS, { seller: ['Sem vendedor'] }).map((item) => item.id)).toEqual(['3'])
  })
})
