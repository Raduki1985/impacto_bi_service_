import { describe, expect, it } from 'vitest'

import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import { monthlyTeamsShown, OVERVIEW_SERIES_COLORS } from './overviewChartOptions'
import { cohortPalette } from './overviewCohortChartOptions'
import { initialCommercialOverviewFilters } from './overviewModel'
import {
  buildSalesListChips,
  buildSalesListRows,
  cohortBucketOf,
  monthlyTeamOf,
  salesListContext,
  salesListExportHead,
  salesListFileLabel,
  salesListMonthRange,
  salesListMonthRecords,
  salesListSelectionKey,
  salesListSelectionLabel,
  type CohortBucket,
  type SalesListSelection,
} from './salesListModel'

/**
 * Teste espelho da regra da janela de contratos da Visão Geral Comercial.
 *
 * O que ele protege: na Safra, a fatia de cada contrato é a do serviço
 * (`cohort_bucket`) e o mês é o da data da venda; na Evolução mensal, a
 * ativação entra pelo mês do sinal e o grupo é o time principal, só dos
 * times que o gráfico desenha; os atalhos somam o "Todas"; e a ordem da
 * lista é a de cada painel.
 */

const TODAY = '2026-09-25'
const filters = initialCommercialOverviewFilters()

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
    ...overrides,
  }
}

const cohort = (month: string, bucket: CohortBucket | null): SalesListSelection => ({
  kind: 'cohort',
  month,
  bucket,
})

const inMonth = record()
const later = record({ contractedOn: '2026-07-30', startedOn: '2026-08-02', startedAt: '2026-08-02T09:00:00-03:00' })
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
const pendingOld = record({
  status: 'pendente',
  statusKey: 'pending',
  stage: 'pendente',
  activated: false,
  contractedOn: '2026-07-02',
  signedOn: null,
  startedOn: null,
  startedAt: null,
})
const cancelled = record({
  status: 'cancelada',
  statusKey: 'cancelled',
  stage: 'cancelada',
  activated: false,
  contractedOn: '2026-07-20',
  startedOn: null,
  startedAt: null,
})
const courtesy = record({ status: 'cortesia', statusKey: 'courtesy', activated: false, contractedOn: '2026-07-21' })
// Ativada em julho, mas vendida em junho: é da safra de junho, e da barra de julho da Evolução mensal.
const junSale = record({ contractedOn: '2026-06-28', startedOn: '2026-07-01', startedAt: '2026-07-01T08:00:00-03:00' })

const records = [inMonth, later, awaiting, pendingOld, cancelled, courtesy, junSale]

describe('Safra: fatia de cada contrato, a regra do serviço', () => {
  it('ativou no mês, ativou depois, aguarda, cancelou antes e outras situações', () => {
    expect(cohortBucketOf(inMonth)).toBe('activatedInMonth')
    expect(cohortBucketOf(later)).toBe('activatedLater')
    expect(cohortBucketOf(awaiting)).toBe('awaiting')
    expect(cohortBucketOf(pendingOld)).toBe('awaiting')
    expect(cohortBucketOf(cancelled)).toBe('cancelledBefore')
    expect(cohortBucketOf(courtesy)).toBe('other')
  })

  it('cancelada depois do sinal não é "cancelou antes": conta como ativada', () => {
    const afterSignal = record({ status: 'cancelada', statusKey: 'cancelled', stage: null, activated: true })

    expect(cohortBucketOf(afterSignal)).toBe('activatedInMonth')
  })

  it('sinal gravado em contrato que o serviço não conta como ativado é outra situação', () => {
    expect(cohortBucketOf(record({ activated: false, stage: null }))).toBe('other')
  })

  it('ativado sem dia do sinal é outra situação, como no serviço', () => {
    expect(cohortBucketOf(record({ startedOn: null, startedAt: null }))).toBe('other')
  })

  it('venda registrada depois do sinal conta no próprio mês', () => {
    expect(cohortBucketOf(record({ contractedOn: '2026-07-20', startedOn: '2026-06-30' }))).toBe(
      'activatedInMonth',
    )
  })

  it('na virada do ano, o sinal de janeiro é "ativou depois" da venda de dezembro', () => {
    expect(cohortBucketOf(record({ contractedOn: '2026-12-28', startedOn: '2027-01-03' }))).toBe(
      'activatedLater',
    )
  })
})

describe('Safra: o mês é o da data da venda', () => {
  it('a ativação de julho vendida em junho fica fora do mês de julho', () => {
    const july = salesListMonthRecords(records, cohort('2026-07', null), filters)
    const june = salesListMonthRecords(records, cohort('2026-06', null), filters)

    expect(july).not.toContain(junSale)
    expect(june).toEqual([junSale])
  })

  it('contrato sem data de venda não entra em mês nenhum', () => {
    const undated = record({ contractedOn: null })

    expect(salesListMonthRecords([undated], cohort('2026-07', null), filters)).toEqual([])
  })

  it('o mês pedido ao serviço vai do dia 1 ao último dia', () => {
    expect(salesListMonthRange('2026-02')).toEqual({ dateFrom: '2026-02-01', dateTo: '2026-02-28' })
    expect(salesListMonthRange('2026-07')).toEqual({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })
  })
})

describe('Safra: atalhos da janela', () => {
  const july = salesListMonthRecords(records, cohort('2026-07', null), filters)
  const chips = buildSalesListChips(july, cohort('2026-07', 'awaiting'), 'light')

  it('"Todas" primeiro, com o mês inteiro, e as fatias na ordem da legenda', () => {
    expect(chips.map((chip) => [chip.label, chip.count])).toEqual([
      ['Todas', 6],
      ['Ativou no mês', 1],
      ['Ativou depois', 1],
      ['Aguarda hoje', 2],
      ['Cancelou antes de ativar', 1],
      ['Outras situações', 1],
    ])
  })

  it('os atalhos das fatias somam o "Todas"', () => {
    const [all, ...slices] = chips

    expect(slices.reduce((total, chip) => total + chip.count, 0)).toBe(all.count)
  })

  it('a fatia leva a cor do painel; "Todas" e as outras situações não levam cor', () => {
    expect(chips[0].color).toBeNull()
    expect(chips[3].color).toBe(cohortPalette.light.awaiting)
    expect(chips[5].color).toBeNull()
    expect(buildSalesListChips(july, cohort('2026-07', null), 'dark')[1].color).toBe(
      cohortPalette.dark.activatedInMonth,
    )
  })

  it('fatia zerada não vira atalho, e mês sem venda não tem atalho nenhum', () => {
    const june = salesListMonthRecords(records, cohort('2026-06', null), filters)

    expect(buildSalesListChips(june, cohort('2026-06', null), 'light').map((chip) => chip.label)).toEqual([
      'Todas',
      'Ativou depois',
    ])
    expect(buildSalesListChips([], cohort('2026-05', null), 'light')).toEqual([])
  })
})

describe('Evolução mensal: a ativação entra pelo mês do sinal', () => {
  const july: SalesListSelection = { kind: 'monthly', month: '2026-07', team: null }
  const unassigned = record({ team: null, teams: [], sellerId: null, sellerName: null, startedOn: '2026-07-15', startedAt: '2026-07-15T10:00:00-03:00' })
  const corporate = record({ team: 'corporativo', teams: ['corporativo'], startedOn: '2026-07-20', startedAt: '2026-07-20T10:00:00-03:00' })
  const all = [...records, unassigned, corporate]

  it('conta os ativados com sinal no mês, vendidos em qualquer mês, e nada da fila', () => {
    const monthRecords = salesListMonthRecords(all, july, filters)

    expect(monthRecords).toEqual(expect.arrayContaining([inMonth, junSale, unassigned, corporate]))
    // A venda de 30/07 ligou em agosto; aguardando, cancelada e cortesia não são ativação.
    expect(monthRecords).toHaveLength(4)
  })

  it('o grupo é o time principal do vendedor; sem time é o resto', () => {
    expect(monthlyTeamOf(inMonth)).toBe('comercial')
    expect(monthlyTeamOf(corporate)).toBe('corporativo')
    expect(monthlyTeamOf(unassigned)).toBe('unassigned')
    expect(monthlyTeamOf(record({ team: 'outra-equipe' }))).toBe('unassigned')
  })

  it('atalhos: "Todas" e os grupos na ordem da legenda, com a cor da barra', () => {
    const chips = buildSalesListChips(salesListMonthRecords(all, july, filters), july, 'light')

    expect(chips.map((chip) => [chip.label, chip.count])).toEqual([
      ['Todas', 4],
      ['Comercial', 2],
      ['Corporativo', 1],
      ['Sem time', 1],
    ])
    expect(chips[2].color).toBe(OVERVIEW_SERIES_COLORS.corporativo.light)
    expect(chips[3].color).toBe(OVERVIEW_SERIES_COLORS.semTime.light)
  })

  it('com um time escolhido, só o grupo que o gráfico desenha', () => {
    // Vendedor dos dois times, com o Corporativo como principal: entra no
    // filtro Comercial, mas o gráfico filtrado só desenha a barra Comercial.
    const both = record({ team: 'corporativo', teams: ['comercial', 'corporativo'] })
    const onlyCommercial = { ...filters, team: 'comercial' as const }

    expect(monthlyTeamsShown('comercial')).toEqual(['comercial'])
    expect(monthlyTeamsShown('todos')).toEqual(['comercial', 'corporativo', 'unassigned'])
    expect(salesListMonthRecords([inMonth, both, unassigned], july, onlyCommercial)).toEqual([inMonth])
  })

  it('o espelho: filtro Corporativo com vendedor dos dois times e o Comercial como principal', () => {
    const both = record({ team: 'comercial', teams: ['comercial', 'corporativo'] })
    const onlyCorporate = { ...filters, team: 'corporativo' as const }

    expect(salesListMonthRecords([both, corporate], july, onlyCorporate)).toEqual([corporate])
  })

  it('cancelada depois do sinal continua na barra do mês do sinal', () => {
    const afterSignal = record({ status: 'cancelada', statusKey: 'cancelled', stage: null, activated: true })

    expect(salesListMonthRecords([afterSignal], july, filters)).toEqual([afterSignal])
  })

  it('mês sem ativação, ou time sem contrato, dá lista vazia e nenhum atalho', () => {
    // Junho só tem venda; o sinal dela ligou em julho.
    const june: SalesListSelection = { kind: 'monthly', month: '2026-06', team: null }
    const empty = salesListMonthRecords([awaiting, pendingOld], july, filters)

    expect(empty).toEqual([])
    expect(buildSalesListChips(empty, july, 'light')).toEqual([])
    expect(salesListMonthRecords([unassigned], july, { ...filters, team: 'comercial' })).toEqual([])
    expect(salesListMonthRecords(all, june, filters)).toEqual([])
  })

  it('a lista abre com o sinal mais recente no topo', () => {
    const rows = buildSalesListRows(salesListMonthRecords(all, july, filters), july, TODAY)

    expect(rows.map((row) => row.id)).toEqual([corporate.id, unassigned.id, inMonth.id, junSale.id])
    expect(rows[0].detail).toBe('Sinal em 20/07')
  })

  it('no mesmo dia decide a hora do sinal, e no mesmo instante o código do contrato', () => {
    const morning = record({ id: '0200', startedOn: '2026-07-22', startedAt: '2026-07-22T09:00:00-03:00' })
    const afternoon = record({ id: '0300', startedOn: '2026-07-22', startedAt: '2026-07-22T15:00:00-03:00' })
    const sameInstant = record({ id: '0100', startedOn: '2026-07-22', startedAt: '2026-07-22T09:00:00-03:00' })
    const rows = buildSalesListRows([morning, afternoon, sameInstant], july, TODAY)

    expect(rows.map((row) => row.id)).toEqual(['0300', '0100', '0200'])
  })
})

describe('lista e textos da janela', () => {
  it('Safra: abre com a venda mais antiga do mês no topo', () => {
    const selection = cohort('2026-07', 'awaiting')
    const rows = buildSalesListRows(salesListMonthRecords(records, selection, filters), selection, TODAY)

    expect(rows.map((row) => row.id)).toEqual([pendingOld.id, awaiting.id])
    // O mesmo Detalhe da esteira do Hoje ao vivo.
    expect(rows[1].detail).toBe('Improdutiva em 08/07')
    expect(rows[0].late).toBe(true)
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
    expect(salesListExportHead(cohort('2026-07', 'cancelledBefore'))).toEqual([
      ['Seleção', 'Safra de vendas por mês · Cancelou antes de ativar'],
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
