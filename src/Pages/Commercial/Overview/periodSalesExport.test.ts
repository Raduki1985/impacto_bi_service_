import { describe, expect, it } from 'vitest'

import type { CommercialPeriodSaleRecord } from '../../../data/api/commercialRecordsSource'
import {
  buildPeriodSalesRows,
  periodSalesDownloadLabel,
  periodSalesExportHead,
  periodSalesExtraColumns,
  periodSalesFileName,
} from './periodSalesExport'
import { buildSalesWorkbook, salesExportInfoTail } from './todaySalesExport'

/**
 * Teste espelho da planilha do período inteiro da Visão Geral Comercial.
 *
 * Desde 01/10/2026 QUAIS contratos entram (vendidos OU ativados no período,
 * uma vez cada, com os filtros da página), por qual régua e em que ordem é
 * decidido no serviço, e provado lá contra o gabarito do código que rodava
 * aqui (`tests/test_bi_commercial_live.py`). O que fica aqui: as duas colunas
 * Sim/Não levam a régua que o serviço marcou, a ordem é a que chegou, e a aba
 * Filtros explica como chegar a cada card.
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

describe('colunas e ordem da planilha', () => {
  const records = [both, soldOnly, activatedOnly]
  const extra = periodSalesExtraColumns(records)
  const rows = buildPeriodSalesRows(records, TODAY)

  it('as duas colunas dizem por qual régua o serviço marcou o contrato', () => {
    expect(extra.columns.map((column) => column.header)).toEqual(['Vendida no período', 'Ativada no período'])
    expect(extra.values(rows.find((row) => row.id === both.id)!)).toEqual(['Sim', 'Sim'])
    expect(extra.values(rows.find((row) => row.id === soldOnly.id)!)).toEqual(['Sim', 'Não'])
    expect(extra.values(rows.find((row) => row.id === activatedOnly.id)!)).toEqual(['Não', 'Sim'])
  })

  it('a ordem é a que o serviço mandou (a venda mais recente primeiro)', () => {
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
        'Ativada no período = Sim fecha com o card Vendas ativadas; Vendida no período = Sim fecha com o vendido da Safra quando o período é um mês inteiro',
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
