import { describe, expect, it } from 'vitest'

import type { CommercialPeriodSaleRecord } from '../../../data/api/commercialRecordsSource'
import {
  buildPeriodSalesRows,
  periodSalesDownloadLabel,
  periodSalesExportHead,
  periodSalesExtraColumns,
  periodSalesFileName,
  periodSoldRecords,
} from './periodSalesExport'
import { buildSalesWorkbook, salesExportInfoTail } from './todaySalesExport'

/**
 * Teste espelho da planilha das vendas do período da Visão Geral Comercial.
 *
 * Desde 01/10/2026 o serviço manda os contratos vendidos OU ativados no
 * período, uma vez cada, com os filtros da página, a régua de cada um e a
 * ordem, provados lá (`tests/test_bi_commercial_live.py`). Desde 02/10/2026
 * a planilha leva só os vendidos. O que fica aqui: o ativado vendido antes
 * do período sai, a coluna Sim/Não leva a régua que o serviço marcou, a
 * ordem é a que chegou, e a aba Filtros explica como ler a planilha.
 */

const TODAY = '2026-09-25'
const range = { dateFrom: '2026-09-01', dateTo: '2026-09-24' }

let sequence = 0

function record(overrides: Partial<CommercialPeriodSaleRecord> = {}): CommercialPeriodSaleRecord {
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
    signalEvidence: [],
    replacedBy: null,
    late: false,
    outsideFlow: null,
    soldInPeriod: true,
    activatedInPeriod: true,
    ...overrides,
  }
}

// Vendida e ativada no período.
const both = record()
// Vendida no período, ainda na fila.
const soldOnly = record({
  status: 'pendente',
  stage: 'pendente',
  activated: false,
  startedOn: null,
  startedAt: null,
  activatedInPeriod: false,
})
// Vendida em agosto, sinal ligado no período.
const activatedOnly = record({ contractedOn: '2026-08-28', createdAt: '2026-08-28T09:00:00-03:00', soldInPeriod: false })

describe('contratos, colunas e ordem da planilha', () => {
  const sold = periodSoldRecords([both, soldOnly, activatedOnly])
  const extra = periodSalesExtraColumns(sold)
  const rows = buildPeriodSalesRows(sold, TODAY)

  it('só as vendidas no período entram: a ativada vendida em agosto sai', () => {
    expect(sold.map((record) => record.id)).toEqual([both.id, soldOnly.id])
  })

  it('a coluna a mais diz se a venda ligou o sinal no período', () => {
    expect(extra.columns.map((column) => column.header)).toEqual(['Ativada no período'])
    expect(extra.values(rows.find((row) => row.id === both.id)!)).toEqual(['Sim'])
    expect(extra.values(rows.find((row) => row.id === soldOnly.id)!)).toEqual(['Não'])
  })

  it('a ordem é a que o serviço mandou (a venda mais recente primeiro)', () => {
    expect(rows.map((row) => row.id)).toEqual([both.id, soldOnly.id])
  })

  it('a aba dos contratos ganha a coluna no fim: 19 colunas', () => {
    const text = new TextDecoder().decode(buildSalesWorkbook(rows, [['Seleção', 'x']], extra))

    expect(text).toContain('name="Contratos" displayName="Contratos" ref="A1:S3"')
    expect(text).toContain('Ativada no período')
    expect(text).not.toContain('Vendida no período')
  })
})

describe('textos', () => {
  it('o botão diz quantas vendidas, com a palavra da linha do card Vendas ativadas', () => {
    expect(periodSalesDownloadLabel(707)).toBe('Baixar as 707 vendidas em Excel')
    expect(periodSalesDownloadLabel(1)).toBe('Baixar a única vendida em Excel')
    expect(periodSalesDownloadLabel(1200)).toBe('Baixar as 1.200 vendidas em Excel')
  })

  it('a aba Filtros diz a seleção, o período, como ler a planilha, e não fala de lista', () => {
    const info = [
      ...periodSalesExportHead(range),
      ...salesExportInfoTail({ pageFilters: null, readAt: null, generatedAt: '25/09/2026 17:40' }, 647),
    ]

    expect(info).toEqual([
      ['Seleção', 'Vendas do período'],
      ['Período', 'Setembro de 2026, até o dia 24: contratos vendidos de 01/09/2026 a 24/09/2026'],
      [
        'Como usar',
        'Num mês inteiro, o total fecha com o vendido da Safra. Ativada no período = Sim: a venda já ligou o sinal dentro do período. O card Vendas ativadas conta também o sinal ligado de vendas anteriores ao período, que não entram aqui',
      ],
      ['Filtros da página', 'Nenhum'],
      ['Contratos na planilha', '647'],
      ['Fonte', 'SGI, pelo serviço de BI'],
      ['Gerada em', '25/09/2026 17:40'],
    ])
  })

  it('o nome do arquivo diz o período', () => {
    expect(periodSalesFileName(range)).toBe('vendas-2026-09-01-a-2026-09-24.xlsx')
  })
})
