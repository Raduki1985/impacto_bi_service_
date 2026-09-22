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

describe('overviewActiveSalesModel: linha de detalhe da frente do card', () => {
  it('mostra as duas parcelas que somam o valor em destaque', () => {
    // Setembro/2026 (1 a 17) em produção: 378 ativadas, 67 vendidas antes.
    expect(activeSalesOriginDetail(378, 67)).toBe('311 do período, 67 de vendas anteriores')
    expect(activeSalesOriginDetail(1234, 100)).toBe('1.134 do período, 100 de vendas anteriores')
  })

  it('afirma a origem única em vez de escrever zero', () => {
    expect(activeSalesOriginDetail(120, 0)).toBe('Todas vendidas no período')
    expect(activeSalesOriginDetail(5, 5)).toBe('Todas de vendas anteriores')
  })

  it('fala português com uma venda só', () => {
    expect(activeSalesOriginDetail(1, 0)).toBe('Vendida no período')
    expect(activeSalesOriginDetail(1, 1)).toBe('De venda anterior')
    expect(activeSalesOriginDetail(2, 1)).toBe('1 do período, 1 de venda anterior')
  })

  it('some quando não há divisão a mostrar', () => {
    // Base sintética: a fonte não separa a origem da venda.
    expect(activeSalesOriginDetail(883, null)).toBeUndefined()
    // Recorte sem nenhuma ativação: um "0 do período" só ocuparia espaço.
    expect(activeSalesOriginDetail(0, 0)).toBeUndefined()
  })

  it('não usa travessão', () => {
    expect(activeSalesOriginDetail(378, 67)).not.toContain('—')
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

  it('acompanha a linha de detalhe nos casos de borda', () => {
    expect(activeSalesOriginAccessible(1, 0)).toBe('A única venda ativada é do próprio período.')
    expect(activeSalesOriginAccessible(883, null)).toBeUndefined()
    expect(activeSalesOriginAccessible(0, 0)).toBeUndefined()
  })
})
