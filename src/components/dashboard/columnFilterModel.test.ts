import { describe, expect, it } from 'vitest'

import { matchesColumnOption } from './columnFilterModel'

/**
 * Teste espelho da busca dos painéis de coluna.
 *
 * Ela atende duas tabelas com vocabulários diferentes: em Vendas por Período a
 * dica é o CPF do cliente, e na lista de OS não há dica nenhuma. O que não
 * pode mudar é o comportamento de quem digita: sem acento, sem caixa e por
 * pedaço do texto.
 */

const cliente = { value: 'c-1', label: 'João Conceição', hint: '123.456.789-00' }
const cidade = { value: 'Atibaia', label: 'Atibaia', count: 42 }

describe('busca do painel de coluna', () => {
  it('campo vazio não recorta nada', () => {
    expect(matchesColumnOption(cliente, '')).toBe(true)
    expect(matchesColumnOption(cliente, '   ')).toBe(true)
  })

  it('acha por pedaço do rótulo, ignorando acento e caixa', () => {
    expect(matchesColumnOption(cliente, 'joao')).toBe(true)
    expect(matchesColumnOption(cliente, 'CONCEICAO')).toBe(true)
    expect(matchesColumnOption(cidade, 'atib')).toBe(true)
  })

  it('acha também pela dica, que é o CPF na tabela de vendas', () => {
    expect(matchesColumnOption(cliente, '123.456')).toBe(true)
  })

  it('não inventa correspondência', () => {
    expect(matchesColumnOption(cliente, 'maria')).toBe(false)
    // Opção sem dica não pode achar por um texto que não está no rótulo.
    expect(matchesColumnOption(cidade, '42')).toBe(false)
  })
})
