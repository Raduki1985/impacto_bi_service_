import { describe, expect, it } from 'vitest'

import type { CommercialPeriodSaleRecord } from '../../../data/api/commercialRecordsSource'
import {
  buildPeriodSalesRows,
  PERIOD_DOWNLOAD_LABEL,
  periodSalesExportHead,
  periodSalesExtraColumns,
  periodSalesFileName,
} from './periodSalesExport'
import { buildSalesWorkbook, salesExportInfoTail } from './todaySalesExport'

/**
 * Teste espelho da planilha dos contratos do período, o botão do título
 * Resultado do período (06/10/2026).
 *
 * O serviço manda os vendidos OU ativados no período, cada um com as duas
 * réguas, e prova a régua lá (`tests/test_bi_commercial_live.py`). O que fica
 * aqui: o botão não diz número, a planilha leva as duas colunas que refazem
 * os dois cards, e a aba Filtros explica como.
 */

const TODAY = '2026-10-06'
const range = { dateFrom: '2026-09-01', dateTo: '2026-09-30' }

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

// Na ordem em que o serviço manda: a venda mais recente primeiro.
const waiting = record({
  contractedOn: '2026-09-20',
  createdAt: '2026-09-20T10:00:00-03:00',
  status: 'pendente',
  stage: 'pendente',
  activated: false,
  startedOn: null,
  startedAt: null,
  activatedInPeriod: false,
})
const own = record()
const earlier = record({
  contractedOn: '2026-08-28',
  createdAt: '2026-08-28T09:00:00-03:00',
  startedOn: '2026-09-20',
  startedAt: '2026-09-20T09:00:00-03:00',
  soldInPeriod: false,
})
const records = [waiting, own, earlier]

describe('botão e nome do arquivo', () => {
  it('o botão não diz número: cada régua tem o seu card', () => {
    expect(PERIOD_DOWNLOAD_LABEL).toBe('Baixar contratos do período em Excel')
    expect(PERIOD_DOWNLOAD_LABEL).not.toMatch(/\d/)
  })

  it('o arquivo leva o período no nome', () => {
    expect(periodSalesFileName(range)).toBe('contratos-2026-09-01-a-2026-09-30.xlsx')
  })
})

describe('planilha', () => {
  const rows = buildPeriodSalesRows(records, TODAY)
  const extra = periodSalesExtraColumns(records)

  it('mantém a ordem do serviço e leva todos os contratos, vendidos ou ativados', () => {
    expect(rows.map((row) => row.id)).toEqual([waiting.id, own.id, earlier.id])
  })

  it('as duas colunas a mais dizem por qual régua o contrato está no período', () => {
    expect(extra.columns.map((column) => column.header)).toEqual(['Vendida no período', 'Ativada no período'])
    expect(rows.map((row) => extra.values(row))).toEqual([
      ['Sim', 'Não'],
      ['Sim', 'Sim'],
      ['Não', 'Sim'],
    ])
  })

  it('a aba dos contratos ganha as duas colunas no fim: 20 colunas', () => {
    const text = new TextDecoder().decode(buildSalesWorkbook(rows, [['Seleção', 'x']], extra))

    expect(text).toContain('name="Contratos" displayName="Contratos" ref="A1:T4"')
  })

  it('a aba Filtros diz a seleção, a régua e como refazer os dois cards', () => {
    expect([
      ...periodSalesExportHead(range),
      ...salesExportInfoTail({ pageFilters: null, readAt: null, generatedAt: '06/10/2026 11:00' }, 3),
    ]).toEqual([
      ['Seleção', 'Contratos do período'],
      ['Período', 'Setembro de 2026: contratos vendidos ou ativados de 01/09/2026 a 30/09/2026'],
      [
        'Como usar',
        'Vendida no período = Sim refaz o Total de Vendas (pela data da venda). Ativada no período = Sim refaz o Vendas ativadas (pelo dia do sinal ligado). As duas = Sim são as vendidas e ativadas no período; só Ativada = Sim são as ativadas de vendas anteriores ao período',
      ],
      ['Filtros da página', 'Nenhum'],
      ['Contratos na planilha', '3'],
      ['Fonte', 'SGI, pelo serviço de BI'],
      ['Gerada em', '06/10/2026 11:00'],
    ])
  })
})
