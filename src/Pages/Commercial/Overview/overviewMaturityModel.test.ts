import { describe, expect, it } from 'vitest'

import {
  firstMeasuredPeriodStart,
  maturityDelta,
  maturityDetail,
  maturityEmptyReading,
  maturityMissingReading,
  maturityParts,
  maturityRate,
  maturityReadingText,
  maturityReadingTitle,
  maturityWindow,
} from './overviewMaturityModel'
import type { OverviewMaturity } from './overviewModel'

/** Setembro de 01 a 27, medido em produção em 28/09/2026. */
const setembro: OverviewMaturity = {
  days: 90,
  activatedFrom: '2026-06-03',
  activatedTo: '2026-06-29',
  sales: 594,
  blocked: 71,
  cancelled: 5,
}
/** Agosto de 01 a 27, o período anterior de setembro. */
const agosto: OverviewMaturity = {
  days: 90,
  activatedFrom: '2026-05-03',
  activatedTo: '2026-05-29',
  sales: 607,
  blocked: 61,
  cancelled: 11,
}

const comparacao = { label: 'vs. agosto até o dia 27', long: 'versus agosto até o dia 27' }

describe('card de bloqueio ou cancelamento em 90 dias', () => {
  it('a parcela em destaque soma bloqueadas e canceladas sobre as vendas julgadas', () => {
    expect(maturityRate(setembro)).toBeCloseTo(76 / 594)
    expect(maturityRate({ ...setembro, sales: 0, blocked: 0, cancelled: 0 })).toBeNull()
  })

  it('a linha de detalhe diz quantas de quantas e de quando é o sinal', () => {
    expect(maturityDetail(setembro)).toBe('76 de 594 ativadas de 03 a 29/06')
    expect(maturityWindow({ ...setembro, activatedTo: '2026-06-03' })).toBe('em 03/06')
    expect(maturityWindow({ ...setembro, activatedTo: '2026-07-02' })).toBe('de 03/06 a 02/07')
  })

  it('compara em pontos, e subir é desfavorável', () => {
    const delta = maturityDelta(setembro, agosto, comparacao)

    // 12,8% contra 11,9%: 0,9 ponto a mais.
    expect(delta.label).toBe('▲ 0,9 p.p. vs. agosto até o dia 27')
    expect(delta.tone).toBe('desfavoravel')
    expect(delta.accessibleLabel).toBe(
      'A parcela bloqueada ou cancelada no 90º dia cresceu 0,9 ponto percentual versus agosto até o dia 27',
    )
    expect(maturityDelta(agosto, setembro, comparacao).tone).toBe('favoravel')
    expect(maturityDelta(setembro, setembro, comparacao).label).toBe('Estável vs. agosto até o dia 27')
  })

  it('sem medida no período anterior, nenhum número é inventado', () => {
    expect(maturityDelta(setembro, null).label).toBe('Sem período anterior')
    const semVendas = maturityDelta(setembro, { ...agosto, sales: 0, blocked: 0, cancelled: 0 })
    expect(semVendas.label).toBe('Sem vendas no período anterior')
    expect(semVendas.tone).toBe('indisponivel')
  })

  it('a leitura diz o número por extenso, a divisão e o que fica fora', () => {
    expect(maturityReadingTitle(setembro)).toBe(
      '76 das 594 vendas estavam bloqueadas ou canceladas no 90º dia.',
    )
    expect(maturityReadingText(setembro)).toBe(
      '594 vendas com sinal ligado {de 03 a 29/06}: {71 em bloqueio financeiro} e {5 canceladas} no 90º dia. Venda cancelada sem chegar a instalar fica fora da conta.',
    )
    expect(maturityReadingText({ ...setembro, sales: 1, blocked: 1, cancelled: 0 })).toContain(
      '1 venda com sinal ligado',
    )
    expect(maturityReadingText({ ...setembro, blocked: 1, cancelled: 1 })).toContain(
      '{1 em bloqueio financeiro} e {1 cancelada}',
    )
  })

  it('recorte pequeno continua em português', () => {
    expect(maturityReadingTitle({ ...setembro, blocked: 0, cancelled: 0 })).toBe(
      'Nenhuma das 594 vendas estava bloqueada ou cancelada no 90º dia.',
    )
    expect(maturityReadingTitle({ ...setembro, sales: 1, blocked: 0, cancelled: 0 })).toBe(
      'A venda que completou 90 dias estava em dia.',
    )
    expect(maturityReadingTitle({ ...setembro, sales: 1, blocked: 0, cancelled: 1 })).toBe(
      'A venda que completou 90 dias estava bloqueada ou cancelada.',
    )
    expect(maturityReadingTitle({ ...setembro, blocked: 1, cancelled: 0 })).toBe(
      '1 das 594 vendas estava bloqueada ou cancelada no 90º dia.',
    )
    expect(maturityDetail({ ...setembro, sales: 1, blocked: 0, cancelled: 0, activatedTo: '2026-06-03' })).toBe(
      '0 de 1 ativada em 03/06',
    )
  })

  it('sem medida, distingue período cedo demais de fonte sem histórico', () => {
    expect(firstMeasuredPeriodStart()).toBe('2026-04-01')
    expect(maturityMissingReading('2026-03-01').title).toBe(
      'O card mede períodos a partir de 01/04/2026.',
    )
    expect(maturityMissingReading('2026-04-01').title).toBe(
      'Sem a situação no 90º dia para este recorte.',
    )
  })

  it('recorte sem venda julgada diz de quando seria o sinal', () => {
    expect(maturityEmptyReading({ ...setembro, sales: 0, blocked: 0, cancelled: 0 }).text).toBe(
      'Com os filtros escolhidos, nenhuma venda teve o sinal ligado de 03 a 29/06.',
    )
  })

  it('a barra divide o número em destaque em bloqueio e cancelamento, nessa ordem', () => {
    const partes = maturityParts(setembro)

    expect(partes.map((parte) => [parte.label, parte.count])).toEqual([
      ['Em bloqueio', 71],
      ['Canceladas', 5],
    ])
    expect(partes[0].share + partes[1].share).toBeCloseTo(1)
    expect(maturityParts({ ...setembro, blocked: 0, cancelled: 0 }).map((parte) => parte.share)).toEqual([0, 0])
  })
})
