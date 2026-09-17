import { describe, expect, it } from 'vitest'

import {
  ACTIVE_SALES_LOCAL_RULE,
  ACTIVE_SALES_RULE,
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
