import { describe, expect, it } from 'vitest'

import {
  ACTIVE_SALES_LOCAL_RULE,
  ACTIVE_SALES_RULE,
  activeSalesOriginAccessible,
  activeSalesOriginDetail,
  activeSalesRuleReading,
} from './overviewActiveSalesModel'

describe('overviewActiveSalesModel: régua e origem das vendas ativadas', () => {
  it('sem a medida da origem, diz só a régua da base sintética', () => {
    expect(activeSalesRuleReading(883, null)).toBe(ACTIVE_SALES_LOCAL_RULE)
    expect(ACTIVE_SALES_LOCAL_RULE).toContain('com o contrato ainda ativo')
  })

  it('com a medida, separa a venda do próprio período da herdada', () => {
    // Setembro/2026 (1 a 17) em produção: 378 ativadas, 67 vendidas antes.
    expect(activeSalesRuleReading(378, 67)).toBe(
      `${ACTIVE_SALES_RULE} Dessas 378, 311 são do próprio período e 67 vieram de vendas de períodos anteriores.`,
    )
  })

  it('não repete a conta quando uma parcela é tudo', () => {
    expect(activeSalesRuleReading(120, 0)).toBe(
      `${ACTIVE_SALES_RULE} Todas as 120 são vendas do próprio período.`,
    )
    expect(activeSalesRuleReading(5, 5)).toBe(
      `${ACTIVE_SALES_RULE} Todas as 5 vieram de vendas de períodos anteriores.`,
    )
  })

  it('fala em português também com zero e com um', () => {
    expect(activeSalesRuleReading(0, 0)).toBe(ACTIVE_SALES_RULE)
    expect(activeSalesRuleReading(1, 0)).toBe(
      `${ACTIVE_SALES_RULE} A única venda ativada é do próprio período.`,
    )
    expect(activeSalesRuleReading(1, 1)).toBe(
      `${ACTIVE_SALES_RULE} A única venda ativada veio de um período anterior.`,
    )
    expect(activeSalesRuleReading(2, 1)).toBe(
      `${ACTIVE_SALES_RULE} Dessas 2, 1 é do próprio período e 1 veio de venda de período anterior.`,
    )
  })

  it('formata em pt-BR e não usa travessão', () => {
    const leitura = activeSalesRuleReading(1234, 100)

    expect(leitura).toContain('Dessas 1.234, 1.134 são do próprio período')
    expect(leitura).not.toContain('—')
  })

  it('a régua diz que cancelamento posterior não tira a venda do mês', () => {
    expect(ACTIVE_SALES_RULE).toContain('mesmo que o contrato tenha sido cancelado ou bloqueado depois')
    expect(ACTIVE_SALES_RULE).not.toContain('ainda ativo')
  })
})

describe('overviewActiveSalesModel: linhas de detalhe da frente do card', () => {
  it('sem o vendido, mostra as duas parcelas que somam o valor em destaque', () => {
    // Setembro/2026 (1 a 17) em produção: 378 ativadas, 67 vendidas antes.
    expect(activeSalesOriginDetail(378, 67)).toEqual({
      main: '311 do período',
      note: '67 de vendas anteriores',
    })
    expect(activeSalesOriginDetail(1234, 100)).toEqual({
      main: '1.134 do período',
      note: '100 de vendas anteriores',
    })
  })

  it('com o vendido, a primeira linha diz quantas das vendidas no período ativaram', () => {
    // Outubro/2026 até o dia 5 em produção: 87 ativadas, 28 herdadas, 114 vendidas.
    expect(activeSalesOriginDetail(87, 28, 114)).toEqual({
      main: '59 das 114 vendidas no período',
      note: '28 de vendas anteriores',
    })
    expect(activeSalesOriginDetail(1300, 100, 1500)).toEqual({
      main: '1.200 das 1.500 vendidas no período',
      note: '100 de vendas anteriores',
    })
  })

  it('a conta da frente fecha com o valor em destaque', () => {
    const lines = activeSalesOriginDetail(87, 28, 114)
    const own = Number(lines?.main.split(' ')[0])
    const earlier = Number(lines?.note?.split(' ')[0])
    expect(own + earlier).toBe(87)
  })

  it('com o vendido, afirma o caso inteiro em vez de escrever zero', () => {
    expect(activeSalesOriginDetail(114, 0, 114)).toEqual({ main: 'Todas as 114 vendidas no período' })
    expect(activeSalesOriginDetail(28, 28, 114)).toEqual({
      main: 'Nenhuma das 114 vendidas no período ativou',
      note: '28 de vendas anteriores',
    })
    // Período sem ativação nenhuma, mas com venda: a linha ainda diz o vendido.
    expect(activeSalesOriginDetail(0, 0, 9)).toEqual({ main: 'Nenhuma das 9 vendidas no período ativou' })
  })

  it('com o vendido, fala português com uma venda só', () => {
    expect(activeSalesOriginDetail(1, 0, 1)).toEqual({ main: 'A única vendida no período' })
    expect(activeSalesOriginDetail(1, 1, 1)).toEqual({
      main: 'A única vendida no período não ativou',
      note: '1 de venda anterior',
    })
    expect(activeSalesOriginDetail(2, 1, 114)).toEqual({
      main: '1 das 114 vendidas no período',
      note: '1 de venda anterior',
    })
  })

  it('ignora o vendido que não fecha a conta, em vez de escrever uma conta impossível', () => {
    // 59 ativadas do período não podem sair de 40 vendidas.
    expect(activeSalesOriginDetail(87, 28, 40)).toEqual({
      main: '59 do período',
      note: '28 de vendas anteriores',
    })
    expect(activeSalesOriginDetail(87, 28, 0)).toEqual({
      main: '59 do período',
      note: '28 de vendas anteriores',
    })
  })

  it('sem o vendido, afirma a origem única em vez de escrever zero', () => {
    expect(activeSalesOriginDetail(120, 0)).toEqual({ main: 'Todas vendidas no período' })
    expect(activeSalesOriginDetail(5, 5)).toEqual({ main: 'Todas de vendas anteriores' })
  })

  it('sem o vendido, fala português com uma venda só', () => {
    expect(activeSalesOriginDetail(1, 0)).toEqual({ main: 'Vendida no período' })
    expect(activeSalesOriginDetail(1, 1)).toEqual({ main: 'De venda anterior' })
    expect(activeSalesOriginDetail(2, 1)).toEqual({ main: '1 do período', note: '1 de venda anterior' })
  })

  it('some quando não há divisão a mostrar', () => {
    // Base sintética: a fonte não separa a origem da venda.
    expect(activeSalesOriginDetail(883, null)).toBeUndefined()
    expect(activeSalesOriginDetail(883, null, 900)).toBeUndefined()
    // Recorte sem ativação e sem venda: um "0 do período" só ocuparia espaço.
    expect(activeSalesOriginDetail(0, 0)).toBeUndefined()
    expect(activeSalesOriginDetail(0, 0, 0)).toBeUndefined()
  })

  it('não usa travessão', () => {
    expect(JSON.stringify(activeSalesOriginDetail(87, 28, 114))).not.toMatch(/[—–]/)
  })
})

describe('overviewActiveSalesModel: origem para leitor de tela', () => {
  it('repete a frase por extenso da leitura, e não a linha telegráfica', () => {
    expect(activeSalesOriginAccessible(378, 67)).toBe(
      'Dessas 378, 311 são do próprio período e 67 vieram de vendas de períodos anteriores.',
    )
    expect(activeSalesRuleReading(378, 67)).toContain(
      activeSalesOriginAccessible(378, 67) as string,
    )
  })

  it('diz o vendido no período por extenso quando ele é conhecido', () => {
    expect(activeSalesOriginAccessible(87, 28, 114)).toBe(
      'Dessas 87, 59 são do próprio período e 28 vieram de vendas de períodos anteriores. Das 114 vendas do período, 59 já ativaram.',
    )
    expect(activeSalesOriginAccessible(0, 0, 9)).toBe('Das 9 vendas do período, nenhuma ativou.')
    expect(activeSalesOriginAccessible(1, 0, 1)).toBe(
      'A única venda ativada é do próprio período. A única venda do período já ativou.',
    )
  })

  it('acompanha a linha de detalhe nos casos de borda', () => {
    expect(activeSalesOriginAccessible(1, 0)).toBe('A única venda ativada é do próprio período.')
    expect(activeSalesOriginAccessible(883, null)).toBeUndefined()
    expect(activeSalesOriginAccessible(0, 0)).toBeUndefined()
    expect(activeSalesOriginAccessible(87, 28, 40)).not.toContain('40')
  })
})
