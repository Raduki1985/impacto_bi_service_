import { describe, expect, it } from 'vitest'

import { canRevealMoney, HIDDEN_MONEY, moneyText } from './moneyVisibility'

/**
 * Teste espelho da regra dos valores em reais da Visão Geral Comercial
 * (Mário, 28/09/2026, revista em 08/10/2026): os três perfis abrem com o
 * olho, e sem usuário conhecido nada se abre.
 */
describe('quem pode ver os valores em reais', () => {
  it('Administrador, Executivo e Analista podem abrir', () => {
    expect(canRevealMoney('adm')).toBe(true)
    expect(canRevealMoney('executive')).toBe(true)
    expect(canRevealMoney('analyst')).toBe(true)
  })

  it('perfil que o portal não conhece não abre', () => {
    expect(canRevealMoney('visitante')).toBe(false)
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
