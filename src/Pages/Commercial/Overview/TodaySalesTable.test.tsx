import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import { TodaySalesTable } from './TodaySalesTable'
import { buildTodaySalesRows } from './todaySalesModel'

/**
 * A dica da célula Detalhe: o fora do prazo diz a regra, e a venda resolvida
 * fora do fluxo do SGI (28/09/2026) explica o Detalhe curto e o que fazer.
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
    contractedOn: '2026-09-10',
    signedOn: null,
    createdAt: '2026-09-10T08:57:38-03:00',
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
    ...overrides,
  }
}

function render(records: CommercialSaleRecord[]): string {
  const rows = buildTodaySalesRows(records, { box: 'pending', late: false }, TODAY)

  return renderToStaticMarkup(
    <TodaySalesTable colorOf={() => '#d97706'} description="Pendentes" label="Pendentes" rows={rows} />,
  )
}

describe('dica do Detalhe', () => {
  it('no fora do prazo, a regra do prazo', () => {
    expect(render([record()])).toContain(
      'title="15 dias sem assinar. Fora do prazo: a próxima etapa não aconteceu a tempo, sem contar domingo."',
    )
  })

  it('na venda com sinal ou refeita, a frase inteira por trás do Detalhe curto', () => {
    const html = render([
      record({ id: '01000001', signalEvidence: ['equipment_online'] }),
      record({ id: '01000002', replacedBy: '01441111' }),
    ])

    expect(html).toContain('>Com sinal, falta ativar<')
    expect(html).toContain('title="O cliente já tem sinal por este contrato (equipamento online), mas o SGI')
    expect(html).toContain('>Refeita no 01441111<')
    expect(html).toContain('title="A venda foi refeita no contrato 01441111, do mesmo cliente')
    // Sem marca de atenção: não estão fora do prazo.
    expect(html).not.toContain(', fora do prazo</span>')
  })
})
