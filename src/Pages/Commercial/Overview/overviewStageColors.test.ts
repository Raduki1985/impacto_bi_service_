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

  it('ativado, o verde de "ativou no mês" da Safra', () => {
    expect(saleStatusColor(record({}), 'light')).toBe(cohortPalette.light.activatedInMonth)
    expect(saleStatusColor(record({}), 'dark')).toBe(cohortPalette.dark.activatedInMonth)
  })

  it('cancelada antes de ativar, o cinza da Safra, e não o degrau da etapa', () => {
    const cancelled = record({ stage: 'cancelada', status: 'cancelada', activated: false, startedOn: null })

    expect(saleStatusColor(cancelled, 'light')).toBe(cohortPalette.light.cancelledBefore)
  })

  it('o que não é fila nem ativação leva a terracota', () => {
    expect(saleStatusColor(record({ status: 'cortesia', activated: false }), 'light')).toBe('#b5652f')
  })
})
