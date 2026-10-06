import { describe, expect, it } from 'vitest'

import {
  ACTIVE_SALES_LOCAL_RULE,
  ACTIVE_SALES_RULE,
  activeSalesChangeReading,
  activeSalesObserve,
  activeSalesOriginAccessible,
  activeSalesOriginDetail,
  activeSalesReadingTitle,
  activeSalesRuleReading,
} from './overviewActiveSalesModel'

// Outubro/2026 até o dia 5 em produção: 87 ativadas, 28 vendidas antes.
const OUT = { from: '2026-10-01', to: '2026-10-05' }

describe('overviewActiveSalesModel: título da leitura', () => {
  it('diz quantos contratos ligaram o sinal, e quando', () => {
    expect(activeSalesReadingTitle(87, OUT.from, OUT.to)).toBe('87 contratos ligaram o sinal de 01 a 05/10.')
    expect(activeSalesReadingTitle(1234, '2026-09-28', '2026-10-05')).toBe(
      '1.234 contratos ligaram o sinal de 28/09 a 05/10.',
    )
  })

  it('fala português com um e com nenhum', () => {
    expect(activeSalesReadingTitle(1, '2026-10-05', '2026-10-05')).toBe('1 contrato ligou o sinal em 05/10.')
    expect(activeSalesReadingTitle(0, OUT.from, OUT.to)).toBe('Nenhum contrato ligou o sinal de 01 a 05/10.')
  })
})

describe('overviewActiveSalesModel: composição e régua das vendas ativadas', () => {
  it('sem a medida da origem, diz só a régua da base sintética', () => {
    expect(activeSalesRuleReading(883, null, '2026-07-01')).toBe(ACTIVE_SALES_LOCAL_RULE)
    expect(ACTIVE_SALES_LOCAL_RULE).toContain('com o contrato ainda ativo')
  })

  it('abre pela composição, com o verbo "vendidos" nas duas parcelas, e fecha com a régua', () => {
    expect(activeSalesRuleReading(87, 28, OUT.from)).toBe(
      `Dessas 87 ativações, 59 são de contratos vendidos no próprio período e 28 de contratos vendidos antes de 01/10. ${ACTIVE_SALES_RULE}`,
    )
    // Setembro/2026 (1 a 17) em produção: 378 ativadas, 67 vendidas antes.
    expect(activeSalesRuleReading(378, 67, '2026-09-01')).toContain(
      'Dessas 378 ativações, 311 são de contratos vendidos no próprio período e 67 de contratos vendidos antes de 01/09.',
    )
  })

  it('não repete a conta quando uma parcela é tudo', () => {
    expect(activeSalesRuleReading(120, 0, OUT.from)).toBe(
      `Todas as 120 ativações são de contratos vendidos no próprio período. ${ACTIVE_SALES_RULE}`,
    )
    expect(activeSalesRuleReading(5, 5, OUT.from)).toBe(
      `Todas as 5 ativações são de contratos vendidos antes de 01/10. ${ACTIVE_SALES_RULE}`,
    )
  })

  it('fala em português também com zero e com um', () => {
    expect(activeSalesRuleReading(0, 0, OUT.from)).toBe(ACTIVE_SALES_RULE)
    expect(activeSalesRuleReading(1, 0, OUT.from)).toBe(
      `A única ativação é de um contrato vendido no próprio período. ${ACTIVE_SALES_RULE}`,
    )
    expect(activeSalesRuleReading(1, 1, OUT.from)).toBe(
      `A única ativação é de um contrato vendido antes de 01/10. ${ACTIVE_SALES_RULE}`,
    )
    expect(activeSalesRuleReading(2, 1, OUT.from)).toBe(
      `Dessas 2 ativações, 1 é de contrato vendido no próprio período e 1 de contrato vendido antes de 01/10. ${ACTIVE_SALES_RULE}`,
    )
  })

  it('formata em pt-BR e não usa travessão', () => {
    const leitura = activeSalesRuleReading(1234, 100, OUT.from)

    expect(leitura).toContain('Dessas 1.234 ativações, 1.134 são de contratos vendidos')
    expect(leitura).not.toContain('—')
  })

  it('a régua diz que cancelamento posterior não tira a venda do mês', () => {
    expect(ACTIVE_SALES_RULE).toContain('mesmo que o contrato tenha sido cancelado ou bloqueado depois')
    expect(ACTIVE_SALES_RULE).not.toContain('ainda ativo')
  })
})

describe('overviewActiveSalesModel: variação por último, em ativações', () => {
  // Os ramos da frase (cresceu, recuou, estável, sem janela, sem contagem)
  // são de `overviewReadingPhrases`, provados lá; aqui só a unidade do card.
  it('escreve a unidade no plural e no singular', () => {
    const setembro = { long: 'versus setembro até o dia 5', within: 'em setembro até o dia 5' }

    // Outubro até o dia 5: 87 contra 137 em setembro até o dia 5.
    expect(activeSalesChangeReading(-0.365, setembro, 137)).toBe(
      'Recuou {36,5%}: eram {137} ativações em setembro até o dia 5.',
    )
    expect(activeSalesChangeReading(1, setembro, 1)).toBe('Cresceu {100,0%}: era {1} ativação em setembro até o dia 5.')
  })
})

describe('overviewActiveSalesModel: o OBSERVAR', () => {
  it('diz quanto do resultado é herança e onde está o resto da história', () => {
    expect(activeSalesObserve(87, 28)).toBe(
      '28 das 87 ativações (32,2%) vêm de vendas de antes do período. O destino das vendas de cada mês está na Safra.',
    )
    expect(activeSalesObserve(1234, 100)).toContain('100 das 1.234 ativações (8,1%) vêm')
  })

  it('afirma o caso inteiro em vez de escrever zero ou cem por cento', () => {
    expect(activeSalesObserve(87, 0)).toBe(
      'Todas as 87 ativações são de venda do próprio período. O destino das vendas de cada mês está na Safra.',
    )
    expect(activeSalesObserve(87, 87)).toBe(
      'Todas as 87 ativações vêm de vendas de antes do período. O destino das vendas de cada mês está na Safra.',
    )
  })

  it('fala português com uma ativação só', () => {
    expect(activeSalesObserve(87, 1)).toContain('1 das 87 ativações (1,1%) vem de venda de antes do período.')
    expect(activeSalesObserve(1, 0)).toContain('A única ativação é de venda do próprio período.')
    expect(activeSalesObserve(1, 1)).toContain('A única ativação vem de venda de antes do período.')
  })

  it('sem a medida da origem ou sem ativação, volta ao genérico', () => {
    const generico = 'Evolução do volume de vendas ativadas frente ao período anterior.'

    expect(activeSalesObserve(883, null)).toBe(generico)
    expect(activeSalesObserve(0, 0)).toBe(generico)
  })
})

describe('overviewActiveSalesModel: linhas de detalhe da frente do card', () => {
  it('duas linhas com a mesma estrutura, só muda o quando, e a soma fecha com o valor em destaque', () => {
    expect(activeSalesOriginDetail(87, 28)).toEqual({
      main: '59 vendidas no período',
      note: '28 vendidas antes do período',
    })
    expect(activeSalesOriginDetail(1234, 100)).toEqual({
      main: '1.134 vendidas no período',
      note: '100 vendidas antes do período',
    })

    const lines = activeSalesOriginDetail(87, 28)
    const own = Number(lines?.main.split(' ')[0])
    const earlier = Number(lines?.note?.split(' ')[0])
    expect(own + earlier).toBe(87)
  })

  it('afirma a origem única em vez de escrever zero', () => {
    expect(activeSalesOriginDetail(120, 0)).toEqual({ main: 'Todas vendidas no período' })
    expect(activeSalesOriginDetail(5, 5)).toEqual({ main: 'Todas vendidas antes do período' })
  })

  it('fala português com uma venda só', () => {
    expect(activeSalesOriginDetail(1, 0)).toEqual({ main: 'Vendida no período' })
    expect(activeSalesOriginDetail(1, 1)).toEqual({ main: 'Vendida antes do período' })
    expect(activeSalesOriginDetail(2, 1)).toEqual({
      main: '1 vendida no período',
      note: '1 vendida antes do período',
    })
  })

  it('some quando não há divisão a mostrar', () => {
    // Base sintética: a fonte não separa a origem da venda.
    expect(activeSalesOriginDetail(883, null)).toBeUndefined()
    // Recorte sem ativação: um "0 vendidas no período" só ocuparia espaço.
    expect(activeSalesOriginDetail(0, 0)).toBeUndefined()
  })

  it('não usa travessão', () => {
    expect(JSON.stringify(activeSalesOriginDetail(87, 28))).not.toMatch(/[—–]/)
  })
})

describe('overviewActiveSalesModel: origem para leitor de tela', () => {
  it('repete a frase por extenso da leitura, e não a linha telegráfica', () => {
    expect(activeSalesOriginAccessible(378, 67, '2026-09-01')).toBe(
      'Dessas 378 ativações, 311 são de contratos vendidos no próprio período e 67 de contratos vendidos antes de 01/09.',
    )
    expect(activeSalesRuleReading(378, 67, '2026-09-01')).toContain(
      activeSalesOriginAccessible(378, 67, '2026-09-01') as string,
    )
  })

  it('acompanha a linha de detalhe nos casos de borda', () => {
    expect(activeSalesOriginAccessible(1, 0, OUT.from)).toBe(
      'A única ativação é de um contrato vendido no próprio período.',
    )
    expect(activeSalesOriginAccessible(883, null, OUT.from)).toBeUndefined()
    expect(activeSalesOriginAccessible(0, 0, OUT.from)).toBeUndefined()
  })
})
