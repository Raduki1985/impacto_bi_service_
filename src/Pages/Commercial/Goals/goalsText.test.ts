import { describe, expect, it } from 'vitest'

import {
  activeSalesText,
  agreeWith,
  goalScopeSummary,
  internalSellersText,
  pluralize,
  salesText,
} from './goalsText'

/**
 * Concordância de número dos textos da página.
 *
 * Quantidade 1 aparece de verdade no produto: Joanópolis tem um único vendedor
 * interno, e o filtro Vendedor aceita uma pessoa só. Estes testes travam as
 * formas no singular sem perder as formas no plural.
 */
describe('concordância de número', () => {
  it('usa singular apenas para a quantidade 1', () => {
    expect(salesText(1)).toBe('1 venda')
    expect(salesText(0)).toBe('0 vendas')
    expect(salesText(2)).toBe('2 vendas')
    expect(salesText(1000)).toBe('1.000 vendas')
  })

  it('concorda também em venda ativa e vendedor interno', () => {
    expect(activeSalesText(1)).toBe('1 venda ativa')
    expect(activeSalesText(5)).toBe('5 vendas ativas')
    expect(internalSellersText(1)).toBe('1 vendedor interno')
    expect(internalSellersText(8)).toBe('8 vendedores internos')
  })

  it('escolhe a forma verbal sem repetir o número', () => {
    expect(agreeWith(1, 'Falta', 'Faltam')).toBe('Falta')
    expect(agreeWith(0, 'Falta', 'Faltam')).toBe('Faltam')
    expect(agreeWith(12, 'Falta', 'Faltam')).toBe('Faltam')
  })

  it('aceita singular e plural livres em pluralize', () => {
    expect(pluralize(1, 'vendedor ficou', 'vendedores ficaram')).toBe('1 vendedor ficou')
    expect(pluralize(8, 'vendedor ficou', 'vendedores ficaram')).toBe('8 vendedores ficaram')
  })
})

describe('origem da meta no KPI', () => {
  it('descreve a meta empresarial sem depender de quantidade', () => {
    expect(goalScopeSummary('consolidado', 15)).toBe('Meta empresarial fixa do mês')
  })

  it('usa singular com um único vendedor interno na cidade', () => {
    expect(goalScopeSummary('cidade', 1)).toBe('1 vendedor interno na cidade')
    expect(goalScopeSummary('cidade', 8)).toBe('8 vendedores internos na cidade')
  })

  it('usa singular com um único vendedor interno selecionado', () => {
    expect(goalScopeSummary('selecao', 1)).toBe('1 vendedor interno selecionado')
    expect(goalScopeSummary('selecao', 3)).toBe('3 vendedores internos selecionados')
  })

  it('informa a ausência de vendedor interno elegível', () => {
    expect(goalScopeSummary('sem-meta', 0)).toBe('Sem vendedor interno elegível')
  })
})
