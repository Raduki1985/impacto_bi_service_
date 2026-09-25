import { describe, expect, it } from 'vitest'

import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import { initialCommercialOverviewFilters, type CommercialOverviewFilters } from './overviewModel'
import {
  buildPeriodSalesRows,
  periodSalesDownloadLabel,
  periodSalesExportHead,
  periodSalesExtraColumns,
  periodSalesFileName,
  selectPeriodSales,
} from './periodSalesExport'
import { buildSalesWorkbook, salesExportInfoTail } from './todaySalesExport'

/**
 * Teste espelho da planilha do período inteiro da Visão Geral Comercial.
 *
 * O que ele protege: entram os vendidos OU ativados no período, uma vez
 * cada, com os filtros da página; as duas colunas Sim/Não dizem por qual
 * régua; e a aba Filtros explica como chegar a cada card.
 */

const TODAY = '2026-09-25'
const filters: CommercialOverviewFilters = {
  ...initialCommercialOverviewFilters(),
  startDate: '2026-09-01',
  endDate: '2026-09-24',
}
const range = { dateFrom: '2026-09-01', dateTo: '2026-09-24' }

let sequence = 0

function record(overrides: Partial<CommercialSaleRecord> = {}): CommercialSaleRecord {
  sequence += 1

  return {
    id: String(3000 + sequence),
    status: 'ativa',
    statusKey: 'active',
    stage: null,
    activated: true,
    contractedOn: '2026-09-10',
    signedOn: '2026-09-10',
    createdAt: '2026-09-10T10:00:00-03:00',
    startedOn: '2026-09-11',
    startedAt: '2026-09-11T14:00:00-03:00',
    monthlyValue: 99.9,
    planName: 'res_600mb solo',
    cityId: 'atibaia',
    cityLabel: 'Atibaia',
    sellerId: 'v1',
    sellerName: 'Ana Souza',
    team: 'comercial',
    teams: ['comercial'],
    indicated: false,
    customerKind: 'novo',
    personType: 'pf',
    hasOpenOrder: false,
    hasInstallationOrder: true,
    hasUnproductiveOrder: false,
    nextVisitOn: null,
    lastVisitOn: '2026-09-11',
    lastOrderStatus: 'completed',
    ...overrides,
  }
}

// Vendida e ativada no período.
const both = record()
// Vendida no período, ainda na fila.
const soldOnly = record({ status: 'pendente', stage: 'pendente', activated: false, startedOn: null, startedAt: null })
// Vendida em agosto, sinal ligado no período.
const activatedOnly = record({ contractedOn: '2026-08-28', createdAt: '2026-08-28T09:00:00-03:00' })
// Vendida em agosto, com sinal gravado no período, mas na fila: não conta como ativada.
const signalInQueue = record({ contractedOn: '2026-08-20', status: 'agendada', stage: 'agendada', activated: false })
// Vendida e ativada depois do período (hoje).
const afterPeriod = record({ contractedOn: '2026-09-25', startedOn: '2026-09-25' })
const otherCity = record({ cityId: 'piracaia', cityLabel: 'Piracaia' })

const records = [both, soldOnly, activatedOnly, signalInQueue, afterPeriod, otherCity]

describe('quais contratos entram', () => {
  it('vendidos ou ativados no período, uma vez cada', () => {
    expect(selectPeriodSales(records, filters)).toEqual([both, soldOnly, activatedOnly, otherCity])
  })

  it('sinal gravado em contrato que ainda está na fila, vendido antes, não entra', () => {
    expect(selectPeriodSales(records, filters)).not.toContain(signalInQueue)
  })

  it('as bordas da janela entram, e o dia de fora não', () => {
    const firstDay = record({ contractedOn: '2026-09-01', startedOn: '2026-09-02' })
    const lastDay = record({ contractedOn: '2026-09-24', startedOn: '2026-09-24' })
    const dayBefore = record({ contractedOn: '2026-08-30', startedOn: '2026-08-31' })

    expect(selectPeriodSales([firstDay, lastDay, dayBefore], filters)).toEqual([firstDay, lastDay])
  })

  it('vendida no último dia com sinal no dia seguinte: vendida sim, ativada não', () => {
    const lateSignal = record({ contractedOn: '2026-09-24', startedOn: '2026-09-25' })
    const extra = periodSalesExtraColumns(range)

    expect(selectPeriodSales([lateSignal], filters)).toEqual([lateSignal])
    expect(extra.values(buildPeriodSalesRows([lateSignal], TODAY)[0])).toEqual(['Sim', 'Não'])
  })

  it('período de um dia só, e contrato sem data de venda que só entra pelo sinal', () => {
    const oneDay = { ...filters, startDate: '2026-09-11', endDate: '2026-09-11' }
    const undated = record({ contractedOn: null, startedOn: '2026-09-11' })
    const undatedQueue = record({ contractedOn: null, stage: 'pendente', activated: false, startedOn: null })

    expect(selectPeriodSales([both, undated, undatedQueue, soldOnly], oneDay)).toEqual([both, undated])
  })

  it('os filtros da página valem', () => {
    expect(selectPeriodSales(records, { ...filters, cityId: 'piracaia' })).toEqual([otherCity])
    expect(selectPeriodSales(records, { ...filters, cityId: 'joanopolis' })).toEqual([])
  })
})

describe('colunas e ordem da planilha', () => {
  const extra = periodSalesExtraColumns(range)
  const rows = buildPeriodSalesRows([activatedOnly, both, soldOnly], TODAY)

  it('as duas colunas dizem por qual régua o contrato entrou', () => {
    expect(extra.columns.map((column) => column.header)).toEqual(['Vendida no período', 'Ativada no período'])
    expect(extra.values(rows.find((row) => row.id === both.id)!)).toEqual(['Sim', 'Sim'])
    expect(extra.values(rows.find((row) => row.id === soldOnly.id)!)).toEqual(['Sim', 'Não'])
    expect(extra.values(rows.find((row) => row.id === activatedOnly.id)!)).toEqual(['Não', 'Sim'])
  })

  it('a venda mais recente primeiro', () => {
    // As duas vendidas em 10/09 empatam no dia e na hora: decide o código.
    expect(rows.map((row) => row.id)).toEqual([both.id, soldOnly.id, activatedOnly.id])
  })

  it('a aba dos contratos ganha as duas colunas no fim: 20 colunas', () => {
    const text = new TextDecoder().decode(buildSalesWorkbook(rows, [['Seleção', 'x']], extra))

    expect(text).toContain('name="Contratos" displayName="Contratos" ref="A1:T4"')
    expect(text).toContain('Vendida no período')
  })
})

describe('textos', () => {
  it('o botão diz quantos contratos', () => {
    expect(periodSalesDownloadLabel(647)).toBe('Baixar 647 contratos em Excel')
    expect(periodSalesDownloadLabel(1)).toBe('Baixar 1 contrato em Excel')
    expect(periodSalesDownloadLabel(1200)).toBe('Baixar 1.200 contratos em Excel')
  })

  it('a aba Filtros diz a seleção, o período, como chegar aos cards, e não fala de lista', () => {
    const info = [
      ...periodSalesExportHead(range),
      ...salesExportInfoTail({ pageFilters: null, readAt: null, generatedAt: '25/09/2026 17:40' }, 647),
    ]

    expect(info).toEqual([
      ['Seleção', 'Todos os contratos do período'],
      ['Período', 'Setembro de 2026, até o dia 24: vendidos ou com sinal ligado de 01/09/2026 a 24/09/2026'],
      [
        'Como usar',
        'Ativada no período = Sim fecha com o card Vendas ativadas; Vendida no período = Sim fecha com os vendidos do card Aguardando Ativação',
      ],
      ['Filtros da página', 'Nenhum'],
      ['Contratos na planilha', '647'],
      ['Fonte', 'SGI, pelo serviço de BI'],
      ['Gerada em', '25/09/2026 17:40'],
    ])
  })

  it('o nome do arquivo diz o período', () => {
    expect(periodSalesFileName(range)).toBe('contratos-2026-09-01-a-2026-09-24.xlsx')
  })
})
