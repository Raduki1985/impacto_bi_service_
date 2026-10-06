import { describe, expect, it } from 'vitest'

import type { CommercialPeriodSaleRecord } from '../../../data/api/commercialRecordsSource'
import {
  buildPeriodChips,
  inPeriodPart,
  periodCounts,
  periodExportHead,
  periodExtraColumns,
  periodListContext,
  periodListLabel,
  periodOpenLabel,
  periodPartRecords,
} from './periodSalesExport'
import { toSaleRow } from './todaySalesModel'
import { buildSalesWorkbook, salesExportInfoTail } from './todaySalesExport'

/**
 * Teste espelho da janela do card Vendas ativadas (06/10/2026).
 *
 * O serviço manda os vendidos OU ativados no período, cada um com as duas
 * réguas, e prova a régua lá (`tests/test_bi_commercial_live.py`). O que fica
 * aqui: a janela só lista quem ligou o sinal no período, repartido pela data
 * da venda como a frente do card, os três atalhos somam, e a planilha leva a
 * coluna que refaz a conta.
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
// Vendida em 20/09 e ainda na fila: só vendida, não entra na janela.
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
// Vendida em 15/09, sinal em 25/09, o mais recente.
const latest = record({
  contractedOn: '2026-09-15',
  createdAt: '2026-09-15T10:00:00-03:00',
  startedOn: '2026-09-25',
  startedAt: '2026-09-25T16:00:00-03:00',
})
// Vendida em 10/09, sinal em 11/09.
const own = record()
// Vendida em agosto, sinal em 20/09: vendida antes do período.
const earlier = record({
  contractedOn: '2026-08-28',
  createdAt: '2026-08-28T09:00:00-03:00',
  startedOn: '2026-09-20',
  startedAt: '2026-09-20T09:00:00-03:00',
  soldInPeriod: false,
})
// Vendida em 17/09, sinal só em 02/10: ativou depois do período, não entra.
const later = record({
  contractedOn: '2026-09-17',
  createdAt: '2026-09-17T10:00:00-03:00',
  startedOn: '2026-10-02',
  startedAt: '2026-10-02T10:00:00-03:00',
  activatedInPeriod: false,
})
const records = [waiting, later, latest, own, earlier]

describe('a conta da janela', () => {
  it('total ativado: quem ligou o sinal no período, o mais recente primeiro, venda anterior inclusive', () => {
    expect(periodPartRecords(records, 'activated', range).map((item) => item.id)).toEqual([
      latest.id,
      earlier.id,
      own.id,
    ])
  })

  it('reparte o total pela data da venda, como a frente do card', () => {
    expect(periodPartRecords(records, 'soldActivated', range).map((item) => item.id)).toEqual([latest.id, own.id])
    expect(periodPartRecords(records, 'earlier', range).map((item) => item.id)).toEqual([earlier.id])
  })

  it('"antes do período" é a régua do card: venda antes do primeiro dia; sem data ou depois do fim, do próprio período', () => {
    // A venda sem data, e a rara venda registrada depois do sinal (06/10,
    // fora do período), contam no próprio período, como `sold_earlier_count`
    // no serviço; a marca `soldInPeriod` diria o contrário.
    const semData = record({ contractedOn: null, soldInPeriod: false })
    const depois = record({ contractedOn: '2026-10-06', createdAt: '2026-10-06T10:00:00-03:00', soldInPeriod: false })

    expect(inPeriodPart(semData, 'soldActivated', range)).toBe(true)
    expect(inPeriodPart(depois, 'soldActivated', range)).toBe(true)
    expect(inPeriodPart(earlier, 'earlier', range)).toBe(true)
    expect(inPeriodPart(earlier, 'soldActivated', range)).toBe(false)
  })

  it('quem só vendeu, ou ativou depois do período, fica fora de todos os números', () => {
    for (const part of ['activated', 'soldActivated', 'earlier'] as const) {
      expect(inPeriodPart(waiting, part, range)).toBe(false)
      expect(inPeriodPart(later, part, range)).toBe(false)
    }
  })

  it('ativou no período e cancelou depois continua no total, a regra do card', () => {
    expect(inPeriodPart(record({ status: 'cancelada' }), 'activated', range)).toBe(true)
  })

  it('sinal sem a hora vai para o fim da lista, e o empate desempata pelo número do contrato', () => {
    const semHora = record({ id: '9001', startedAt: null })
    const empateA = record({ id: '9003', startedAt: '2026-09-25T16:00:00-03:00', startedOn: '2026-09-25' })
    const empateB = record({ id: '9002', startedAt: '2026-09-25T16:00:00-03:00', startedOn: '2026-09-25' })

    expect(periodPartRecords([semHora, empateA, own, empateB], 'activated', range).map((item) => item.id)).toEqual([
      '9002',
      '9003',
      own.id,
      '9001',
    ])
  })

  it('as contagens fecham: vendidas no período + vendidas antes = total ativado', () => {
    const counts = periodCounts(records, range)

    expect(counts).toEqual({ activated: 3, soldActivated: 2, earlier: 1 })
    expect(counts.soldActivated + counts.earlier).toBe(counts.activated)
    // Recorte vazio: três zeros, e não uma conta impossível.
    expect(periodCounts([], range)).toEqual({ activated: 0, soldActivated: 0, earlier: 0 })
  })

  it('os três atalhos vêm sempre, na ordem da leitura do card, com o vocabulário da frente dele', () => {
    expect(buildPeriodChips(periodCounts(records, range))).toEqual([
      { part: 'activated', label: 'Total ativado', count: 3 },
      { part: 'soldActivated', label: 'Vendidas no período', count: 2 },
      { part: 'earlier', label: 'Vendidas antes do período', count: 1 },
    ])
    // Parcela zerada fica à vista: é metade de uma conta.
    expect(buildPeriodChips(periodCounts([own], range))).toEqual([
      { part: 'activated', label: 'Total ativado', count: 1 },
      { part: 'soldActivated', label: 'Vendidas no período', count: 1 },
      { part: 'earlier', label: 'Vendidas antes do período', count: 0 },
    ])
  })
})

describe('textos', () => {
  it('o ícone do card diz quantos contratos abre', () => {
    expect(periodOpenLabel(651)).toBe('Ver e baixar os 651 contratos ativados no período')
    expect(periodOpenLabel(1)).toBe('Ver e baixar o contrato ativado no período')
  })

  it('a janela diz o período e os filtros, e a lista diz o número escolhido', () => {
    expect(periodListLabel(range, 'earlier')).toBe('Setembro de 2026 · Vendidas antes do período e ativadas nele')
    expect(periodListLabel(range, 'soldActivated')).toBe('Setembro de 2026 · Vendidas e ativadas no período')
    expect(periodListContext(range, null)).toBe('Setembro de 2026 · sem outros filtros')
    expect(periodListContext(range, 'Cidade: Atibaia')).toBe('Setembro de 2026 · Cidade: Atibaia')
  })

  it('a planilha diz a régua do número escolhido', () => {
    expect(periodExportHead(range, 'activated')[1]).toEqual(['Período', 'Sinal ligado de 01/09/2026 a 30/09/2026'])
    expect(periodExportHead(range, 'soldActivated')[1]).toEqual([
      'Período',
      'Sinal ligado de 01/09/2026 a 30/09/2026, vendidas no mesmo período',
    ])
    expect(periodExportHead(range, 'earlier')[1]).toEqual([
      'Período',
      'Sinal ligado de 01/09/2026 a 30/09/2026, vendidas antes de 01/09/2026',
    ])
  })

  it('a aba Filtros da planilha diz a seleção com o nome do card', () => {
    expect([
      ...periodExportHead(range, 'activated'),
      ...salesExportInfoTail({ pageFilters: null, readAt: null, generatedAt: '06/10/2026 11:00' }, 3),
    ]).toEqual([
      ['Seleção', 'Vendas ativadas · Total ativado no período'],
      ['Período', 'Sinal ligado de 01/09/2026 a 30/09/2026'],
      ['Filtros da página', 'Nenhum'],
      ['Contratos na planilha', '3'],
      ['Fonte', 'SGI, pelo serviço de BI'],
      ['Gerada em', '06/10/2026 11:00'],
    ])
  })
})

describe('planilha', () => {
  const activated = periodPartRecords(records, 'activated', range)
  const rows = activated.map((item) => toSaleRow(item, TODAY))
  const extra = periodExtraColumns(activated, range)

  it('a coluna a mais diz se o contrato foi vendido no período ou antes dele', () => {
    expect(extra.columns.map((column) => column.header)).toEqual(['Vendida no período'])
    expect(rows.map((row) => extra.values(row))).toEqual([['Sim'], ['Não'], ['Sim']])
  })

  it('a aba dos contratos ganha a coluna no fim: 19 colunas', () => {
    const text = new TextDecoder().decode(buildSalesWorkbook(rows, [['Seleção', 'x']], extra))

    expect(text).toContain('name="Contratos" displayName="Contratos" ref="A1:S4"')
  })
})
