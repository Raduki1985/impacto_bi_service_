import { describe, expect, it } from 'vitest'

import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import type { CommercialOverviewFilters } from './overviewModel'
import {
  applyTodaySalesFilters,
  buildTodaySalesRows,
  buildTodaySalesSummary,
  hasTodaySalesFilters,
  inBox,
  isLate,
  lateCornerLabel,
  queueBoxOf,
  todaySalesListLabel,
  todaySalesSelectionKey,
  workingDaysSince,
} from './todaySalesModel'

// Sexta-feira, 25/09/2026.
const TODAY = '2026-09-25'

function record(overrides: Partial<CommercialSaleRecord> = {}): CommercialSaleRecord {
  return {
    id: '01757155',
    status: 'pendente',
    statusKey: 'pending',
    stage: 'pendente',
    activated: false,
    contractedOn: TODAY,
    signedOn: null,
    createdAt: '2026-09-25T08:57:38-03:00',
    startedOn: null,
    startedAt: null,
    monthlyValue: 129.9,
    planName: 'res_600mb solo',
    cityId: 'atibaia',
    cityLabel: 'Atibaia',
    sellerId: 'v1',
    sellerName: 'Ana Maria dos Santos',
    team: 'comercial',
    teams: ['comercial'],
    indicated: false,
    customerKind: null,
    personType: 'pf',
    hasOpenOrder: false,
    hasInstallationOrder: false,
    hasUnproductiveOrder: false,
    nextVisitOn: null,
    lastVisitOn: null,
    lastOrderStatus: null,
    ...overrides,
  }
}

const pending = (contractedOn: string, overrides: Partial<CommercialSaleRecord> = {}) =>
  record({ contractedOn, ...overrides })

const signed = (signedOn: string | null, overrides: Partial<CommercialSaleRecord> = {}) =>
  record({ status: 'assinada', statusKey: 'signed', stage: 'assinada', contractedOn: '2026-09-20', signedOn, ...overrides })

const scheduled = (overrides: Partial<CommercialSaleRecord> = {}) =>
  record({
    status: 'agendada',
    statusKey: 'scheduled',
    stage: 'agendada',
    contractedOn: '2026-09-20',
    hasInstallationOrder: true,
    ...overrides,
  })

const activated = (overrides: Partial<CommercialSaleRecord> = {}) =>
  record({
    id: '01757100',
    status: 'ativa',
    statusKey: 'active',
    stage: null,
    activated: true,
    contractedOn: '2026-09-24',
    startedOn: TODAY,
    startedAt: '2026-09-25T14:05:00-03:00',
    customerKind: 'novo',
    ...overrides,
  })

const filters: CommercialOverviewFilters = {
  startDate: '2026-09-01',
  endDate: '2026-09-24',
  cityId: null,
  team: 'todos',
  sellerId: null,
  personType: 'todos',
}

describe('workingDaysSince', () => {
  it('conta os dias depois da data até hoje, sem domingo', () => {
    // Quinta 24 -> sexta 25: 1.
    expect(workingDaysSince('2026-09-24', TODAY)).toBe(1)
    // Sexta 25 -> segunda 28: sábado e segunda, o domingo não conta.
    expect(workingDaysSince('2026-09-25', '2026-09-28')).toBe(2)
    // Sábado 26 -> segunda 28: só a segunda.
    expect(workingDaysSince('2026-09-26', '2026-09-28')).toBe(1)
    // Mesmo dia, ou data no futuro: zero.
    expect(workingDaysSince(TODAY, TODAY)).toBe(0)
    expect(workingDaysSince('2026-09-28', TODAY)).toBe(0)
  })
})

describe('prazos da esteira, a regra do Mário', () => {
  it('Pendente: fora do prazo 2 dias de trabalho depois da venda sem assinatura', () => {
    expect(isLate(pending('2026-09-24'), TODAY)).toBe(false)
    expect(isLate(pending('2026-09-23'), TODAY)).toBe(true)
    // Vendeu na sexta: sábado conta, domingo não; acende na segunda.
    expect(isLate(pending('2026-09-25'), '2026-09-27')).toBe(false)
    expect(isLate(pending('2026-09-25'), '2026-09-28')).toBe(true)
  })

  it('Assinada: o Detalhe conta da assinatura, e no mesmo dia diz o que aguarda', () => {
    const detail = (overrides: Partial<CommercialSaleRecord>) =>
      buildTodaySalesRows([signed(null, overrides)], { box: 'signed', late: false }, TODAY)[0]!.detail

    expect(detail({ signedOn: TODAY })).toBe('Aguarda agendamento')
    expect(detail({ signedOn: '2026-09-20' })).toBe('5 dias sem agendar')
  })

  it('Assinada: fora do prazo 2 dias depois da ASSINATURA sem instalação marcada', () => {
    expect(isLate(signed('2026-09-24'), TODAY)).toBe(false)
    expect(isLate(signed('2026-09-23'), TODAY)).toBe(true)
    // Sem assinatura registrada, o relógio é a venda (20/09).
    expect(isLate(signed(null), TODAY)).toBe(true)
  })

  it('Agendada: fora do prazo 1 dia depois da data da visita, sem sinal e sem outra visita', () => {
    // Visita hoje: é o dia da faixa de OS, sem alerta ainda.
    expect(isLate(scheduled({ hasOpenOrder: true, nextVisitOn: TODAY, lastVisitOn: TODAY }), TODAY)).toBe(false)
    // Visita marcada para depois: está andando.
    expect(isLate(scheduled({ hasOpenOrder: true, nextVisitOn: '2026-09-29', lastVisitOn: '2026-09-29' }), TODAY)).toBe(false)
    // Improdutiva ontem e nenhuma nova visita: acende hoje.
    expect(isLate(scheduled({ lastVisitOn: '2026-09-24', lastOrderStatus: 'unproductive', hasUnproductiveOrder: true }), TODAY)).toBe(true)
    // Improdutiva hoje: ainda não.
    expect(isLate(scheduled({ lastVisitOn: TODAY, lastOrderStatus: 'unproductive' }), TODAY)).toBe(false)
    // Improdutiva no sábado, hoje segunda: domingo não conta, acende na segunda.
    expect(isLate(scheduled({ lastVisitOn: '2026-09-26', lastOrderStatus: 'unproductive' }), '2026-09-28')).toBe(true)
    // Nova visita marcada depois da improdutiva: apaga o alerta.
    expect(isLate(scheduled({ lastVisitOn: '2026-09-29', nextVisitOn: '2026-09-29', hasOpenOrder: true, hasUnproductiveOrder: true }), TODAY)).toBe(false)
  })

  it('quem não está na esteira nunca fica fora do prazo', () => {
    expect(isLate(activated(), TODAY)).toBe(false)
    expect(isLate(record({ stage: 'cancelada', status: 'cancelada' }), TODAY)).toBe(false)
    expect(queueBoxOf(record({ stage: 'cancelada' }))).toBeNull()
  })
})

describe('caixas', () => {
  const records = [
    pending(TODAY, { id: 'p-hoje' }),
    pending('2026-09-10', { id: 'p-antiga' }),
    signed('2026-09-24', { id: 's-ok' }),
    scheduled({ id: 'a-hoje', hasOpenOrder: true, nextVisitOn: TODAY, lastVisitOn: TODAY }),
    scheduled({ id: 'a-improdutiva', lastVisitOn: '2026-09-22', lastOrderStatus: 'unproductive' }),
    activated({ id: 'at-ontem' }),
    activated({ id: 'at-hoje', contractedOn: TODAY, createdAt: '2026-09-25T08:10:00-03:00', startedAt: '2026-09-25T16:40:00-03:00' }),
    // Vendida hoje e cancelada antes de ativar: entrou hoje, não está na esteira.
    record({ id: 'c-hoje', stage: 'cancelada', status: 'cancelada' }),
  ]

  it('cinco caixas em três grupos, com o fora do prazo só na esteira', () => {
    const summary = buildTodaySalesSummary(records, TODAY)

    expect(summary.empty).toBe(false)
    expect(summary.boxes.map((box) => [box.key, box.group, box.count, box.late, box.detail])).toEqual([
      ['sold', 'in', 3, null, 'contratos fechados hoje'],
      ['pending', 'queue', 2, 1, 'sem assinatura'],
      ['signed', 'queue', 1, 0, 'sem instalação marcada'],
      ['scheduled', 'queue', 2, 1, '1 com visita hoje'],
      ['activated', 'out', 2, null, '1 de dias anteriores'],
    ])
  })

  it('a venda de hoje ainda na fila está nas Vendidas e também na esteira', () => {
    expect(inBox(records[0]!, 'sold', TODAY)).toBe(true)
    expect(inBox(records[0]!, 'pending', TODAY)).toBe(true)
  })

  it('as linhas de apoio acompanham o singular e o vazio', () => {
    const one = buildTodaySalesSummary([pending(TODAY)], TODAY)

    expect(one.boxes[0]!.detail).toBe('contrato fechado hoje')
    expect(one.boxes[3]!.detail).toBe('nenhuma visita hoje')
    expect(one.boxes[4]!.detail).toBe('nenhum sinal ligado ainda')
    expect(buildTodaySalesSummary([activated({ contractedOn: TODAY })], TODAY).boxes[4]!.detail).toBe('vendidas hoje')
    expect(buildTodaySalesSummary([], TODAY).empty).toBe(true)
  })
})

describe('filtros da página sobre a faixa', () => {
  const rows = [
    record({ id: 'a' }),
    record({ id: 'b', cityId: 'piracaia', cityLabel: 'Piracaia', team: 'corporativo', teams: ['corporativo'], sellerId: 'v2', personType: 'pj' }),
    // Venda indicada, registrada pela vendedora v1: não é dela.
    record({ id: 'c', indicated: true }),
    record({ id: 'd', team: null, teams: [], sellerId: null, sellerName: null }),
  ]

  it('cidade, time, vendedor e tipo de cliente recortam; o período nunca', () => {
    const ids = (recorte: CommercialSaleRecord[]) => recorte.map((row) => row.id)

    expect(ids(applyTodaySalesFilters(rows, filters))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(applyTodaySalesFilters(rows, { ...filters, cityId: 'piracaia' }))).toEqual(['b'])
    expect(ids(applyTodaySalesFilters(rows, { ...filters, team: 'comercial' }))).toEqual(['a', 'c'])
    expect(ids(applyTodaySalesFilters(rows, { ...filters, sellerId: 'v1' }))).toEqual(['a'])
    expect(ids(applyTodaySalesFilters(rows, { ...filters, personType: 'pj' }))).toEqual(['b'])
    expect(ids(applyTodaySalesFilters(rows, { ...filters, startDate: '2026-01-01', endDate: '2026-01-31' }))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('sabe quando há filtro valendo para hoje', () => {
    expect(hasTodaySalesFilters(filters)).toBe(false)
    expect(hasTodaySalesFilters({ ...filters, startDate: '2026-01-01' })).toBe(false)
    expect(hasTodaySalesFilters({ ...filters, team: 'corporativo' })).toBe(true)
    expect(hasTodaySalesFilters({ ...filters, sellerId: 'v1' })).toBe(true)
  })
})

describe('buildTodaySalesRows', () => {
  it('nas Vendidas, a venda mais recente primeiro, com o detalhe de cada situação', () => {
    const rows = buildTodaySalesRows(
      [
        pending(TODAY, { id: 'p', createdAt: '2026-09-25T08:16:00-03:00' }),
        activated({ id: 'at', contractedOn: TODAY, createdAt: '2026-09-25T10:00:00-03:00' }),
        record({ id: 'c', stage: 'cancelada', status: 'cancelada', createdAt: '2026-09-25T09:00:00-03:00' }),
      ],
      { box: 'sold', late: false },
      TODAY,
    )

    expect(rows.map((row) => [row.id, row.time, row.status, row.detail, row.late])).toEqual([
      ['at', '10h00', 'Ativa', 'Sinal às 14h05', false],
      ['c', '09h00', 'Cancelada', null, false],
      ['p', '08h16', 'Pendente', 'Aguarda assinatura', false],
    ])
  })

  it('na esteira, a venda mais antiga primeiro, com há quanto tempo a etapa espera', () => {
    const rows = buildTodaySalesRows(
      [
        pending('2026-09-24', { id: 'ontem' }),
        pending('2026-09-10', { id: 'antiga' }),
        pending(TODAY, { id: 'hoje' }),
      ],
      { box: 'pending', late: false },
      TODAY,
    )

    expect(rows.map((row) => [row.id, row.soldOn, row.detail, row.late])).toEqual([
      ['antiga', '2026-09-10', '15 dias sem assinar', true],
      ['ontem', '2026-09-24', '1 dia sem assinar', false],
      ['hoje', TODAY, 'Aguarda assinatura', false],
    ])
  })

  it('o atalho abre só as fora do prazo', () => {
    const rows = buildTodaySalesRows(
      [pending('2026-09-24', { id: 'ontem' }), pending('2026-09-10', { id: 'antiga' })],
      { box: 'pending', late: true },
      TODAY,
    )

    expect(rows.map((row) => row.id)).toEqual(['antiga'])
  })

  it('a agendada diz a visita marcada ou o que aconteceu na última', () => {
    const detail = (overrides: Partial<CommercialSaleRecord>) =>
      buildTodaySalesRows([scheduled(overrides)], { box: 'scheduled', late: false }, TODAY)[0]!.detail

    expect(detail({ nextVisitOn: TODAY, lastVisitOn: TODAY, hasOpenOrder: true })).toBe('Visita hoje')
    expect(detail({ nextVisitOn: '2026-09-29', lastVisitOn: '2026-09-29', hasOpenOrder: true })).toBe('Visita em 29/09')
    expect(detail({ lastVisitOn: '2026-09-22', lastOrderStatus: 'unproductive' })).toBe('Improdutiva em 22/09')
    expect(detail({ lastVisitOn: '2026-09-22', lastOrderStatus: 'closed' })).toBe('OS encerrada em 22/09')
    expect(detail({ lastVisitOn: '2026-09-22', lastOrderStatus: 'expired' })).toBe('OS vencida em 22/09')
    expect(detail({ lastVisitOn: '2026-09-22', lastOrderStatus: 'completed' })).toBe('Concluída, sem sinal')
    expect(detail({ lastVisitOn: '2026-09-22', lastOrderStatus: 'rescheduled' })).toBe('Aberta desde 22/09')
    expect(detail({})).toBe('Sem visita marcada')
  })

  it('nas Ativadas, o sinal mais recente primeiro, sem hora quando o SGI só gravou a data', () => {
    const rows = buildTodaySalesRows(
      [
        activated({ id: 'manha', startedAt: '2026-09-25T09:30:00-03:00' }),
        activated({ id: 'tarde', startedAt: '2026-09-25T16:40:00-03:00' }),
        activated({ id: 'sem-hora', startedAt: '2026-09-25T00:00:00-03:00' }),
      ],
      { box: 'activated', late: false },
      TODAY,
    )

    expect(rows.map((row) => [row.id, row.detail])).toEqual([
      ['tarde', 'Sinal às 16h40'],
      ['manha', 'Sinal às 09h30'],
      ['sem-hora', 'Sinal ligado'],
    ])
  })

  it('situação fora do de-para sai crua, e time fora dos dois também', () => {
    const [row] = buildTodaySalesRows(
      [record({ status: 'on_hold', team: 'pap', teams: ['pap'] })],
      { box: 'sold', late: false },
      TODAY,
    )

    expect(row).toMatchObject({ status: 'on_hold', team: 'pap' })
  })
})

describe('textos da faixa', () => {
  it('o atalho diz o número e o fora do prazo, com a regra inteira na dica', () => {
    expect(lateCornerLabel('pending', 181)).toEqual({
      label: '181 fora do prazo',
      title: '181 vendas sem assinatura há 2 dias ou mais, sem contar domingo. Abrir a lista.',
      accessibleLabel: '181 vendas sem assinatura há 2 dias ou mais, fora do prazo, ver na lista',
      attention: true,
    })
    expect(lateCornerLabel('signed', 1)?.title).toBe(
      '1 venda assinada há 2 dias ou mais sem instalação marcada, sem contar domingo. Abrir a lista.',
    )
    expect(lateCornerLabel('scheduled', 56)?.label).toBe('56 fora do prazo')
    expect(lateCornerLabel('pending', 0)).toBeNull()
  })

  it('nomeia a lista aberta e dá identidade própria à lista do atalho', () => {
    expect(todaySalesListLabel({ box: 'sold', late: false })).toBe('Vendidas')
    expect(todaySalesListLabel({ box: 'pending', late: true })).toBe('Pendentes fora do prazo')
    expect(todaySalesSelectionKey({ box: 'pending', late: false })).toBe('pending')
    expect(todaySalesSelectionKey({ box: 'pending', late: true })).toBe('pending:late')
  })
})
