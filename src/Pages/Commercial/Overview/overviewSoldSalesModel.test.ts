import { describe, expect, it } from 'vitest'

import {
  SOLD_SALES_BRIDGE,
  SOLD_SALES_OBSERVE,
  soldSalesChangeReading,
  soldSalesPaceDetail,
  soldSalesReadingText,
  soldSalesReadingTitle,
} from './overviewSoldSalesModel'

// Outubro/2026 até o dia 5 em produção: 114 vendidas.
const OUT = { from: '2026-10-01', to: '2026-10-05' }
const setembro = { long: 'versus setembro até o dia 5', within: 'em setembro até o dia 5' }

describe('overviewSoldSalesModel: título da leitura', () => {
  it('diz quantos contratos foram vendidos, quando, e pela régua da data da venda', () => {
    expect(soldSalesReadingTitle(114, OUT.from, OUT.to)).toBe(
      '114 contratos foram vendidos de 01 a 05/10, pela data da venda.',
    )
    expect(soldSalesReadingTitle(1234, '2026-09-28', '2026-10-05')).toBe(
      '1.234 contratos foram vendidos de 28/09 a 05/10, pela data da venda.',
    )
  })

  it('fala português com um e com nenhum', () => {
    expect(soldSalesReadingTitle(1, '2026-10-05', '2026-10-05')).toBe('1 contrato foi vendido em 05/10, pela data da venda.')
    expect(soldSalesReadingTitle(0, OUT.from, OUT.to)).toBe('Nenhum contrato foi vendido de 01 a 05/10.')
  })
})

describe('overviewSoldSalesModel: ritmo de venda na frente do card', () => {
  it('divide pelos dias corridos, com uma casa decimal para a calculadora conferir', () => {
    // Outubro até o dia 5: 114 em 5 dias = 22,8.
    expect(soldSalesPaceDetail(114, 5)).toBe('22,8 vendas por dia, em 5 dias')
    expect(soldSalesPaceDetail(1145, 31)).toBe('36,9 vendas por dia, em 31 dias')
    expect(soldSalesPaceDetail(45, 2)).toBe('22,5 vendas por dia, em 2 dias')
  })

  it('fala português com uma venda por dia, e não esconde o ritmo baixo', () => {
    expect(soldSalesPaceDetail(7, 7)).toBe('1 venda por dia, em 7 dias')
    expect(soldSalesPaceDetail(2, 10)).toBe('0,2 vendas por dia, em 10 dias')
  })

  it('some num dia só e sem venda', () => {
    expect(soldSalesPaceDetail(30, 1)).toBeUndefined()
    expect(soldSalesPaceDetail(0, 5)).toBeUndefined()
  })
})

describe('overviewSoldSalesModel: a leitura', () => {
  it('abre separando vendido de faturado e fecha com a variação em vendas, com o número anterior', () => {
    expect(soldSalesReadingText(-0.088, setembro, 125)).toBe(
      `${SOLD_SALES_BRIDGE} Recuou {8,8%}: eram {125} vendas em setembro até o dia 5.`,
    )
    expect(SOLD_SALES_BRIDGE).toContain('no card Vendas ativadas')
  })

  it('sem taxa, diz o motivo: janela sem venda, fonte sem o vendido anterior, ou sem janela comparável', () => {
    expect(soldSalesChangeReading(null, setembro, 0)).toBe(
      'O período comparado não teve venda, então não há variação para mostrar.',
    )
    // Serviço anterior a 06/10/2026: a janela existe, o número dela não veio.
    expect(soldSalesChangeReading(null, setembro, null)).toBe(
      'A fonte em uso não informa o vendido do período anterior.',
    )
    expect(soldSalesChangeReading(null, undefined, null)).toBe('Ainda não há base anterior comparável.')
  })

  it('não fala de ativação na frente nem na leitura, só na ponte para o card vizinho', () => {
    const leitura = soldSalesReadingText(0.1, setembro, 100)

    expect(leitura).not.toContain('ativaram')
    expect(leitura).not.toContain('ativadas em')
    expect(SOLD_SALES_OBSERVE).toContain('Evolução mensal das vendas')
  })

  it('não usa travessão', () => {
    expect(`${soldSalesReadingTitle(114, OUT.from, OUT.to)} ${soldSalesReadingText(0, setembro, 114)} ${SOLD_SALES_OBSERVE}`).not.toMatch(
      /[—–]/,
    )
  })
})
