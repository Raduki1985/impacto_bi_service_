import { describe, expect, it } from 'vitest'

import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import { cohortPalette } from './overviewCohortChartOptions'
import { awaitingColors, saleStatusColor } from './overviewStageColors'

/**
 * Teste espelho da cor de situação nas listas de contratos da página: a
 * mesma na faixa Hoje ao vivo e na janela de contratos (Safra e Evolução mensal).
 */

function record(overrides: Partial<CommercialSaleRecord>): CommercialSaleRecord {
  return {
    id: '01000001',
    status: 'ativa',
    statusKey: 'active',
    stage: null,
    activated: true,
    contractedOn: '2026-09-01',
    signedOn: null,
    createdAt: null,
    startedOn: '2026-09-02',
    startedAt: null,
    monthlyValue: 99.9,
    planName: 'res_300mb solo',
    cityId: 'atibaia',
    cityLabel: 'Atibaia',
    sellerId: null,
    sellerName: null,
    team: null,
    teams: [],
    indicated: false,
    customerKind: null,
    personType: null,
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

describe('saleStatusColor', () => {
  it('na fila, o degrau da etapa, em cada tema', () => {
    const pending = record({ stage: 'pendente', activated: false, startedOn: null })

    expect(saleStatusColor(pending, 'light')).toBe(awaitingColors.light.pendente)
    expect(saleStatusColor(pending, 'dark')).toBe(awaitingColors.dark.pendente)
    expect(saleStatusColor(record({ stage: 'agendada', activated: false }), 'light')).toBe(
      awaitingColors.light.agendada,
    )
  })

  it('ativa, o verde de "ativou no mês" da Safra', () => {
    expect(saleStatusColor(record({}), 'light')).toBe(cohortPalette.light.activatedInMonth)
    expect(saleStatusColor(record({}), 'dark')).toBe(cohortPalette.dark.activatedInMonth)
  })

  it('bloqueada ou suspensa depois de ativar, o vermelho, e não o verde da ativação', () => {
    for (const status of ['bloqueio-financeiro', 'bloqueio-administrativo', 'suspensa']) {
      expect(saleStatusColor(record({ status }), 'light')).toBe('#e5384e')
      expect(saleStatusColor(record({ status }), 'dark')).toBe('#ff4d6a')
    }
  })

  it('cancelada depois de ativar, o cinza, e não o verde da ativação', () => {
    // A lista segue cinza na cancelada; a fatia Cancelou da Safra é vermelha
    // desde 02/10/2026, e o vermelho da lista continua sendo o do bloqueio.
    const cancelled = record({ status: 'cancelada' })

    expect(saleStatusColor(cancelled, 'light')).toBe('#64748b')
    expect(saleStatusColor(cancelled, 'dark')).toBe('#94a3b8')
  })

  it('cancelada antes de ativar e reprovada, o mesmo cinza, e não o degrau da etapa', () => {
    const cancelled = record({ stage: 'cancelada', status: 'cancelada', activated: false, startedOn: null })
    const rejected = record({ status: 'reprovada', activated: false, startedOn: null })

    expect(saleStatusColor(cancelled, 'light')).toBe('#64748b')
    expect(saleStatusColor(rejected, 'light')).toBe('#64748b')
  })

  it('cortesia e situação que o portal não conhece levam a terracota', () => {
    expect(saleStatusColor(record({ status: 'cortesia', activated: false }), 'light')).toBe('#b5652f')
    expect(saleStatusColor(record({ status: 'situação nova' }), 'dark')).toBe('#b5652f')
  })
})
