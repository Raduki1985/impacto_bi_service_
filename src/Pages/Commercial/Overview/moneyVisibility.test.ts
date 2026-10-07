import { describe, expect, it } from 'vitest'

import { canRevealMoney, HIDDEN_MONEY, moneyText } from './moneyVisibility'

/**
 * Teste espelho da regra dos valores em reais da Visão Geral Comercial
 * (Mário, 28/09/2026): Administrador e Executivo abrem com o olho, Analista
 * nunca vê, e sem usuário conhecido nada se abre.
 */
describe('quem pode ver os valores em reais', () => {
  it('Administrador e Executivo podem abrir; Analista não', () => {
    expect(canRevealMoney('adm')).toBe(true)
    expect(canRevealMoney('executive')).toBe(true)
    expect(canRevealMoney('analyst')).toBe(false)
  })

  it('sem usuário conhecido, o valor fica escondido', () => {
    expect(canRevealMoney(null)).toBe(false)
    expect(canRevealMoney(undefined)).toBe(false)
  })

  it('o texto do valor só aparece à vista; escondido, vira a máscara', () => {
    expect(moneyText('R$ 1.299,90', true)).toBe('R$ 1.299,90')
    expect(moneyText('R$ 1.299,90', false)).toBe(HIDDEN_MONEY)
    expect(HIDDEN_MONEY).toBe('R$ •••••')
  })
})
