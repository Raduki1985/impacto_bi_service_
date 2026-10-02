import { describe, expect, it } from 'vitest'

import type { CommercialSaleRecord, CommercialTodayCount } from '../../../data/api/commercialRecordsSource'
import type { CommercialOverviewFilters } from './overviewModel'
import {
  buildTodaySalesRows,
  buildTodaySalesSummary,
  hasTodaySalesFilters,
  lateCornerLabel,
  queueBoxOf,
  todaySalesListLabel,
  todaySalesSelectionKey,
} from './todaySalesModel'

/**
 * Teste espelho do TEXTO da faixa Hoje ao vivo da Visão Geral Comercial.
 *
 * Desde 01/10/2026 a regra (o que cada caixa conta, o prazo de cada etapa
 * em dias de trabalho, a venda resolvida fora do fluxo, os filtros e a ordem
 * das listas) mora no serviço e é provada lá contra o gabarito do código que
 * rodava aqui (`tests/test_bi_commercial_live.py`). Aqui fica o que o portal
 * ainda decide: o nome e o texto de cada caixa a partir das contagens, o
 * Detalhe e a dica de cada contrato, e que a marca de fora do prazo da linha
 * é a que o serviço mandou.
 */

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
    signalEvidence: [],
    replacedBy: null,
    late: false,
    outsideFlow: null,
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

const detailOf = (item: CommercialSaleRecord) => buildTodaySalesRows([item], TODAY)[0]!.detail

describe('marca de fora do prazo', () => {
  it('a linha leva a marca que o serviço decidiu, sem recalcular', () => {
    const rows = buildTodaySalesRows(
      [pending('2026-09-10', { id: 'vencida', late: true }), pending('2026-09-24', { id: 'no-prazo' })],
      TODAY,
    )

    expect(rows.map((row) => [row.id, row.late])).toEqual([
      ['vencida', true],
      ['no-prazo', false],
    ])
  })

  it('a lista fica na ordem em que o serviço mandou', () => {
    const rows = buildTodaySalesRows(
      [pending(TODAY, { id: 'hoje' }), pending('2026-09-10', { id: 'antiga' }), pending('2026-09-24', { id: 'ontem' })],
      TODAY,
    )

    expect(rows.map((row) => row.id)).toEqual(['hoje', 'antiga', 'ontem'])
  })

  it('a caixa da esteira sai da etapa; a cancelada não está na esteira', () => {
    expect(queueBoxOf(pending(TODAY))).toBe('pending')
    expect(queueBoxOf(signed(TODAY))).toBe('signed')
    expect(queueBoxOf(scheduled())).toBe('scheduled')
    expect(queueBoxOf(record({ stage: 'cancelada' }))).toBeNull()
    expect(queueBoxOf(activated())).toBeNull()
  })
})

describe('Detalhe de cada contrato', () => {
  it('Assinada: conta da assinatura, e no mesmo dia diz o que aguarda', () => {
    expect(detailOf(signed(TODAY))).toBe('Aguarda agendamento')
    expect(detailOf(signed('2026-09-20'))).toBe('5 dias sem agendar')
  })

  it('Pendente: há quanto tempo espera, no calendário', () => {
    expect(detailOf(pending('2026-09-10'))).toBe('15 dias sem assinar')
    expect(detailOf(pending('2026-09-24'))).toBe('1 dia sem assinar')
    expect(detailOf(pending(TODAY))).toBe('Aguarda assinatura')
  })

  it('a agendada diz a visita marcada ou o que aconteceu na última', () => {
    expect(detailOf(scheduled({ nextVisitOn: TODAY, lastVisitOn: TODAY, hasOpenOrder: true }))).toBe('Visita hoje')
    expect(detailOf(scheduled({ nextVisitOn: '2026-09-29', lastVisitOn: '2026-09-29', hasOpenOrder: true }))).toBe(
      'Visita em 29/09',
    )
    expect(detailOf(scheduled({ lastVisitOn: '2026-09-22', lastOrderStatus: 'unproductive' }))).toBe(
      'Improdutiva em 22/09',
    )
    expect(detailOf(scheduled({ lastVisitOn: '2026-09-22', lastOrderStatus: 'closed' }))).toBe('OS encerrada em 22/09')
    expect(detailOf(scheduled({ lastVisitOn: '2026-09-22', lastOrderStatus: 'expired' }))).toBe('OS vencida em 22/09')
    expect(detailOf(scheduled({ lastVisitOn: '2026-09-22', lastOrderStatus: 'completed' }))).toBe('Concluída, sem sinal')
    expect(detailOf(scheduled({ lastVisitOn: '2026-09-22', lastOrderStatus: 'rescheduled' }))).toBe('Aberta desde 22/09')
    expect(detailOf(scheduled())).toBe('Sem visita marcada')
  })

  it('nas Ativadas, a hora do sinal, sem hora quando o SGI só gravou a data', () => {
    expect(detailOf(activated({ startedAt: '2026-09-25T16:40:00-03:00' }))).toBe('Sinal às 16h40')
    expect(detailOf(activated({ startedAt: '2026-09-25T00:00:00-03:00' }))).toBe('Sinal ligado')
    expect(detailOf(activated({ startedOn: '2026-09-22' }))).toBe('Sinal em 22/09')
  })

  it('nas Vendidas, a hora da venda e a situação por extenso', () => {
    const rows = buildTodaySalesRows(
      [
        activated({ id: 'at', contractedOn: TODAY, createdAt: '2026-09-25T10:00:00-03:00' }),
        record({ id: 'c', stage: 'cancelada', status: 'cancelada', createdAt: '2026-09-25T09:00:00-03:00' }),
      ],
      TODAY,
    )

    expect(rows.map((row) => [row.id, row.time, row.status, row.detail])).toEqual([
      ['at', '10h00', 'Ativa', 'Sinal às 14h05'],
      ['c', '09h00', 'Cancelada', null],
    ])
  })

  it('situação fora do de-para sai crua, e time fora dos dois também', () => {
    const [row] = buildTodaySalesRows([record({ status: 'on_hold', team: 'pap', teams: ['pap'] })], TODAY)

    expect(row).toMatchObject({ status: 'on_hold', team: 'pap' })
  })
})

describe('venda resolvida fora do fluxo do SGI (28/09/2026)', () => {
  it('o Detalhe diz o motivo em poucas palavras, e a dica explica o que fazer', () => {
    const rows = buildTodaySalesRows(
      [
        signed('2026-09-20', {
          id: '01000001',
          outsideFlow: 'signal',
          signalEvidence: ['installation_completed', 'equipment_online', 'invoice_issued'],
        }),
        signed('2026-09-20', { id: '01000002', outsideFlow: 'replaced', replacedBy: '01441111' }),
        signed('2026-09-20', { id: '01000003', late: true }),
      ],
      TODAY,
    )

    expect(rows.map((row) => [row.id, row.detail, row.late])).toEqual([
      ['01000001', 'Com sinal, falta ativar', false],
      ['01000002', 'Refeita no 01441111', false],
      ['01000003', '5 dias sem agendar', true],
    ])
    expect(rows[0]!.detailNote).toBe(
      'O cliente já tem sinal por este contrato (instalação concluída, equipamento online e fatura emitida), ' +
        'mas o SGI não mudou a situação para Ativa. Não conta como fora do prazo: a correção é no SGI.',
    )
    // A dica nomeia os dois contratos, e o que se confere é o da linha.
    expect(rows[1]!.detailNote).toBe(
      'A venda foi refeita no contrato 01441111, do mesmo cliente e no mesmo endereço, que já está com sinal. ' +
        'Não conta como fora do prazo: confira no SGI se o contrato 01000002 sobrou e, se sim, encerre.',
    )
    expect(rows[2]!.detailNote).toBeNull()
  })

  it('com prova E refeita, o Detalhe não manda ativar, e a dica cita os dois contratos', () => {
    const [row] = buildTodaySalesRows(
      [
        pending('2026-09-10', {
          id: '01000004',
          outsideFlow: 'both',
          signalEvidence: ['equipment_online'],
          replacedBy: '01441111',
        }),
      ],
      TODAY,
    )

    expect([row!.detail, row!.late]).toEqual(['Com sinal e refeita', false])
    expect(row!.detailNote).toBe(
      'Este contrato tem sinal (equipamento online), e a venda também foi refeita no contrato 01441111, do ' +
        'mesmo cliente e no mesmo endereço, que já está com sinal. Não conta como fora do prazo: confira no ' +
        'SGI qual dos dois fica antes de ativar ou encerrar.',
    )
  })

  it('na agendada com visita marcada, a visita continua na frente, com o motivo junto', () => {
    const rows = buildTodaySalesRows(
      [
        scheduled({
          id: '01000005',
          hasOpenOrder: true,
          nextVisitOn: TODAY,
          lastVisitOn: TODAY,
          outsideFlow: 'replaced',
          replacedBy: '01441111',
        }),
        scheduled({
          id: '01000006',
          hasOpenOrder: true,
          nextVisitOn: '2026-09-30',
          lastVisitOn: '2026-09-30',
          outsideFlow: 'signal',
          signalEvidence: ['invoice_issued'],
        }),
      ],
      TODAY,
    )

    expect(rows.map((row) => [row.id, row.detail])).toEqual([
      ['01000005', 'Visita hoje, refeita'],
      ['01000006', 'Visita em 30/09, com sinal'],
    ])
    expect(rows[0]!.detailNote).toMatch(
      /^Visita marcada para hoje: confira antes de mandar o técnico\. A venda foi refeita no contrato 01441111/,
    )
    expect(rows[1]!.detailNote).toMatch(/^Visita marcada para 30\/09: confira antes de mandar o técnico\. O cliente/)
  })

  it('a dica nomeia uma prova só sem vírgula nem "e"', () => {
    const [row] = buildTodaySalesRows(
      [pending('2026-09-10', { outsideFlow: 'signal', signalEvidence: ['remote_activation'] })],
      TODAY,
    )

    expect(row!.detailNote).toContain('por este contrato (OS de Ativação Remota concluída ou encerrada), mas')
  })
})

describe('caixas', () => {
  const counts: CommercialTodayCount[] = [
    { key: 'sold', count: 3, late: null, deadlineDays: null, visitsToday: null, soldEarlier: null },
    { key: 'pending', count: 2, late: 1, deadlineDays: 2, visitsToday: null, soldEarlier: null },
    { key: 'signed', count: 1, late: 0, deadlineDays: 2, visitsToday: null, soldEarlier: null },
    { key: 'scheduled', count: 2, late: 1, deadlineDays: 1, visitsToday: 1, soldEarlier: null },
    { key: 'activated', count: 2, late: null, deadlineDays: null, visitsToday: null, soldEarlier: 1 },
  ]

  it('cinco caixas em três grupos, com o fora do prazo e o prazo só na esteira', () => {
    const summary = buildTodaySalesSummary(counts)

    expect(summary.empty).toBe(false)
    expect(summary.boxes.map((box) => [box.key, box.group, box.count, box.late, box.deadlineDays, box.detail])).toEqual([
      ['sold', 'in', 3, null, null, 'contratos fechados hoje'],
      ['pending', 'queue', 2, 1, 2, 'sem assinatura'],
      ['signed', 'queue', 1, 0, 2, 'sem instalação marcada'],
      ['scheduled', 'queue', 2, 1, 1, '1 com visita hoje'],
      ['activated', 'out', 2, null, null, '1 de dias anteriores'],
    ])
  })

  it('as linhas de apoio acompanham o singular e o vazio', () => {
    const zero = (key: CommercialTodayCount['key']) => counts.find((item) => item.key === key)!
    const one = buildTodaySalesSummary([
      { ...zero('sold'), count: 1 },
      { ...zero('scheduled'), count: 3, visitsToday: 0 },
      { ...zero('activated'), count: 0, soldEarlier: 0 },
    ])

    expect(one.boxes[0]!.detail).toBe('contrato fechado hoje')
    expect(one.boxes[3]!.detail).toBe('nenhuma visita hoje')
    expect(one.boxes[4]!.detail).toBe('nenhum sinal ligado ainda')
    expect(buildTodaySalesSummary([{ ...zero('activated'), count: 2, soldEarlier: 0 }]).boxes[4]!.detail).toBe(
      'vendidas hoje',
    )
  })

  it('sem contagem nenhuma, a faixa sabe que está vazia', () => {
    const summary = buildTodaySalesSummary([])

    expect(summary.empty).toBe(true)
    expect(summary.boxes.map((box) => [box.key, box.count])).toEqual([
      ['sold', 0],
      ['pending', 0],
      ['signed', 0],
      ['scheduled', 0],
      ['activated', 0],
    ])
  })
})

describe('filtros da página sobre a faixa', () => {
  it('sabe quando há filtro valendo para hoje; o período nunca vale', () => {
    expect(hasTodaySalesFilters(filters)).toBe(false)
    expect(hasTodaySalesFilters({ ...filters, startDate: '2026-01-01' })).toBe(false)
    expect(hasTodaySalesFilters({ ...filters, team: 'corporativo' })).toBe(true)
    expect(hasTodaySalesFilters({ ...filters, sellerId: 'v1' })).toBe(true)
    expect(hasTodaySalesFilters({ ...filters, cityId: 'piracaia' })).toBe(true)
    expect(hasTodaySalesFilters({ ...filters, personType: 'pj' })).toBe(true)
  })
})

describe('textos da faixa', () => {
  it('o atalho diz o número e o fora do prazo, com a regra inteira e o prazo do serviço na dica', () => {
    // A dica leva a exceção de 28/09/2026: sem ela, quem confere no SGI acha
    // mais contratos parados do que o número do atalho.
    expect(lateCornerLabel('pending', 181, 2)).toEqual({
      label: '181 fora do prazo',
      title:
        '181 vendas sem assinatura há 2 dias ou mais, sem contar domingo nem a venda com sinal ou refeita ' +
        'em outro contrato. Abrir a lista.',
      accessibleLabel: '181 vendas sem assinatura há 2 dias ou mais, fora do prazo, ver na lista',
      attention: true,
    })
    expect(lateCornerLabel('signed', 1, 2)?.title).toBe(
      '1 venda assinada há 2 dias ou mais sem instalação marcada, sem contar domingo nem a venda com sinal ' +
        'ou refeita em outro contrato. Abrir a lista.',
    )
    // O prazo é o que o serviço mede: mudou lá, a dica acompanha.
    expect(lateCornerLabel('pending', 3, 1)?.accessibleLabel).toBe(
      '3 vendas sem assinatura há 1 dia ou mais, fora do prazo, ver na lista',
    )
    expect(lateCornerLabel('scheduled', 56, 1)?.label).toBe('56 fora do prazo')
    expect(lateCornerLabel('pending', 0, 2)).toBeNull()
  })

  it('nomeia a lista aberta e dá identidade própria à lista do atalho', () => {
    expect(todaySalesListLabel({ box: 'sold', late: false })).toBe('Vendidas')
    expect(todaySalesListLabel({ box: 'pending', late: true })).toBe('Pendentes fora do prazo')
    expect(todaySalesSelectionKey({ box: 'pending', late: false })).toBe('pending')
    expect(todaySalesSelectionKey({ box: 'pending', late: true })).toBe('pending:late')
  })
})
