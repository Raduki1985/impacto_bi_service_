import { describe, expect, it } from 'vitest'

import type { CommercialMonthChipCount, CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import { OVERVIEW_SERIES_COLORS } from './overviewChartOptions'
import { cohortPalette } from './overviewCohortChartOptions'
import {
  buildSalesListChips,
  buildSalesListRows,
  salesListApiSlice,
  salesListContext,
  salesListExportHead,
  salesListFileLabel,
  salesListMonthRange,
  salesListSelectionKey,
  salesListSelectionLabel,
  type CohortBucket,
  type SalesListSelection,
} from './salesListModel'

/**
 * Teste espelho do texto da janela de contratos da Visão Geral Comercial.
 *
 * Desde 01/10/2026 a regra (o mês de cada painel, a fatia de cada contrato,
 * os filtros da página, a contagem de cada barra e a ordem da lista) mora no
 * serviço e é provada lá contra o gabarito do código que rodava aqui
 * (`tests/test_bi_commercial_live.py`). O que fica aqui: a barra escolhida
 * vai ao serviço no nome dele, cada atalho ganha o nome e a cor do painel, a
 * lista fica na ordem em que chegou, e os textos da janela e da planilha.
 */

const TODAY = '2026-09-25'

let sequence = 0

function record(overrides: Partial<CommercialSaleRecord> = {}): CommercialSaleRecord {
  sequence += 1

  return {
    id: String(1000 + sequence),
    status: 'ativa',
    statusKey: 'active',
    stage: null,
    activated: true,
    contractedOn: '2026-07-10',
    signedOn: '2026-07-10',
    createdAt: '2026-07-10T10:00:00-03:00',
    startedOn: '2026-07-11',
    startedAt: '2026-07-11T14:00:00-03:00',
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
    lastVisitOn: '2026-07-11',
    lastOrderStatus: 'completed',
    signalEvidence: [],
    replacedBy: null,
    late: false,
    outsideFlow: null,
    ...overrides,
  }
}

const cohort = (month: string, bucket: CohortBucket | null): SalesListSelection => ({
  kind: 'cohort',
  month,
  bucket,
})

const julyCohortCounts: CommercialMonthChipCount[] = [
  { slice: null, count: 6 },
  { slice: 'activated_in_month', count: 1 },
  { slice: 'activated_later', count: 1 },
  { slice: 'awaiting', count: 2 },
  { slice: 'cancelled', count: 1 },
  { slice: 'other', count: 1 },
]

describe('a barra escolhida vai ao serviço no nome dele', () => {
  it('Safra: cada fatia do portal tem o seu nome no serviço; o mês inteiro não leva barra', () => {
    expect(salesListApiSlice(cohort('2026-07', 'activatedInMonth'))).toBe('activated_in_month')
    expect(salesListApiSlice(cohort('2026-07', 'activatedLater'))).toBe('activated_later')
    expect(salesListApiSlice(cohort('2026-07', 'awaiting'))).toBe('awaiting')
    expect(salesListApiSlice(cohort('2026-07', 'cancelled'))).toBe('cancelled')
    expect(salesListApiSlice(cohort('2026-07', 'other'))).toBe('other')
    expect(salesListApiSlice(cohort('2026-07', null))).toBeNull()
  })

  it('Evolução mensal: o grupo já tem o nome do serviço', () => {
    expect(salesListApiSlice({ kind: 'monthly', month: '2026-07', team: 'unassigned' })).toBe('unassigned')
    expect(salesListApiSlice({ kind: 'monthly', month: '2026-07', team: null })).toBeNull()
  })

  it('o mês vai do dia 1 ao último dia', () => {
    expect(salesListMonthRange('2026-02')).toEqual({ dateFrom: '2026-02-01', dateTo: '2026-02-28' })
    expect(salesListMonthRange('2026-07')).toEqual({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })
  })
})

describe('Safra: atalhos da janela', () => {
  const chips = buildSalesListChips(julyCohortCounts, cohort('2026-07', 'awaiting'), 'light')

  it('"Todas" primeiro, com o mês inteiro, e as fatias na ordem em que o serviço mandou', () => {
    expect(chips.map((chip) => [chip.label, chip.count])).toEqual([
      ['Todas', 6],
      ['Ativou no mês', 1],
      ['Ativou depois', 1],
      ['Aguarda hoje', 2],
      ['Cancelou', 1],
      ['Outras situações', 1],
    ])
    expect(chips.map((chip) => salesListSelectionKey(chip.selection))).toEqual([
      'cohort:2026-07:all',
      'cohort:2026-07:activatedInMonth',
      'cohort:2026-07:activatedLater',
      'cohort:2026-07:awaiting',
      'cohort:2026-07:cancelled',
      'cohort:2026-07:other',
    ])
  })

  it('a fatia leva a cor do painel; "Todas" e as outras situações não levam cor', () => {
    expect(chips[0].color).toBeNull()
    expect(chips[3].color).toBe(cohortPalette.light.awaiting)
    expect(chips[5].color).toBeNull()
    expect(buildSalesListChips(julyCohortCounts, cohort('2026-07', null), 'dark')[1].color).toBe(
      cohortPalette.dark.activatedInMonth,
    )
  })

  it('mês sem venda não tem atalho nenhum', () => {
    expect(buildSalesListChips([], cohort('2026-05', null), 'light')).toEqual([])
  })
})

describe('Evolução mensal: atalhos da janela', () => {
  const july: SalesListSelection = { kind: 'monthly', month: '2026-07', team: null }

  it('"Todas" e os grupos na ordem da legenda, com a cor da barra', () => {
    const chips = buildSalesListChips(
      [
        { slice: null, count: 4 },
        { slice: 'comercial', count: 2 },
        { slice: 'corporativo', count: 1 },
        { slice: 'unassigned', count: 1 },
      ],
      july,
      'light',
    )

    expect(chips.map((chip) => [chip.label, chip.count])).toEqual([
      ['Todas', 4],
      ['Comercial', 2],
      ['Corporativo', 1],
      ['Sem time', 1],
    ])
    expect(chips[2].color).toBe(OVERVIEW_SERIES_COLORS.corporativo.light)
    expect(chips[3].color).toBe(OVERVIEW_SERIES_COLORS.semTime.light)
    expect(salesListSelectionKey(chips[3].selection)).toBe('monthly:2026-07:unassigned')
  })

  it('barra que não é deste painel não vira atalho', () => {
    expect(buildSalesListChips([{ slice: null, count: 2 }, { slice: 'awaiting', count: 2 }], july, 'light')).toHaveLength(1)
  })
})

describe('lista e textos da janela', () => {
  it('a lista fica na ordem do serviço, com o Detalhe e a marca da esteira do Hoje ao vivo', () => {
    const pendingOld = record({
      status: 'pendente',
      statusKey: 'pending',
      stage: 'pendente',
      activated: false,
      contractedOn: '2026-07-02',
      signedOn: null,
      startedOn: null,
      startedAt: null,
      late: true,
    })
    const awaiting = record({
      status: 'agendada',
      statusKey: 'scheduled',
      stage: 'agendada',
      activated: false,
      contractedOn: '2026-07-05',
      startedOn: null,
      startedAt: null,
      lastVisitOn: '2026-07-08',
      lastOrderStatus: 'unproductive',
    })
    const rows = buildSalesListRows([pendingOld, awaiting], TODAY)

    expect(rows.map((row) => row.id)).toEqual([pendingOld.id, awaiting.id])
    expect(rows[1].detail).toBe('Improdutiva em 08/07')
    expect(rows.map((row) => row.late)).toEqual([true, false])
  })

  it('na Evolução mensal, o Detalhe é o dia do sinal', () => {
    const [row] = buildSalesListRows([record({ startedOn: '2026-07-20', startedAt: '2026-07-20T10:00:00-03:00' })], TODAY)

    expect(row.detail).toBe('Sinal em 20/07')
  })

  it('a chave distingue o painel, o mês inteiro e cada barra', () => {
    expect(salesListSelectionKey(cohort('2026-07', null))).toBe('cohort:2026-07:all')
    expect(salesListSelectionKey(cohort('2026-07', 'awaiting'))).toBe('cohort:2026-07:awaiting')
    expect(salesListSelectionKey({ kind: 'monthly', month: '2026-07', team: 'unassigned' })).toBe(
      'monthly:2026-07:unassigned',
    )
  })

  it('o nome da lista diz o mês e a barra', () => {
    expect(salesListSelectionLabel(cohort('2026-07', 'awaiting'))).toBe('Julho de 2026 · Aguarda hoje')
    expect(salesListSelectionLabel(cohort('2026-07', null))).toBe('Julho de 2026 · Todas as vendas')
    expect(salesListSelectionLabel({ kind: 'monthly', month: '2026-07', team: 'unassigned' })).toBe(
      'Julho de 2026 · Sem time',
    )
    expect(salesListSelectionLabel({ kind: 'monthly', month: '2026-07', team: null })).toBe(
      'Julho de 2026 · Todas as ativações',
    )
  })

  it('a linha de contexto diz o mês, a régua do painel e os filtros', () => {
    expect(salesListContext(cohort('2026-07', null), null)).toBe(
      'Vendidas em julho de 2026, na situação de hoje · sem outros filtros',
    )
    expect(salesListContext({ kind: 'monthly', month: '2026-07', team: null }, 'Cidade: Atibaia')).toBe(
      'Sinal ligado em julho de 2026 · Cidade: Atibaia',
    )
  })

  it('a planilha diz a seleção e o mês por extenso, e o arquivo diz o painel', () => {
    expect(salesListExportHead(cohort('2026-07', 'cancelled'))).toEqual([
      ['Seleção', 'Safra de vendas por mês · Cancelou'],
      ['Período', 'Vendidas de 01/07/2026 a 31/07/2026, pela data da venda, na situação de hoje'],
    ])
    expect(salesListExportHead({ kind: 'monthly', month: '2026-07', team: 'comercial' })).toEqual([
      ['Seleção', 'Evolução mensal das vendas · Comercial'],
      ['Período', 'Sinal ligado de 01/07/2026 a 31/07/2026, vendas ativadas pela regra da página'],
    ])
    expect(salesListFileLabel({ kind: 'monthly', month: '2026-07', team: 'comercial' })).toBe(
      'ativacoes Julho de 2026 · Comercial',
    )
  })
})
