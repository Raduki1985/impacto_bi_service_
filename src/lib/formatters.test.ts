import { describe, expect, it } from 'vitest'

import {
  formatDateBr,
  formatDateTimeBr,
  formatIsoDateTimeBr,
  formatNumber,
  formatPercent,
} from './formatters'

describe('formatadores em pt-BR', () => {
  it('escreve a data ISO no formato brasileiro, sem passar pelo relógio da máquina', () => {
    expect(formatDateBr('2026-09-18')).toBe('18/09/2026')
    expect(formatDateBr('2026-01-05')).toBe('05/01/2026')
  })

  it('escreve data e hora de um momento na hora local, com zeros à esquerda', () => {
    expect(formatDateTimeBr(new Date(2026, 8, 4, 9, 5))).toBe('04/09/2026 09:05')
  })

  it('lê data e hora do próprio texto do serviço, sem converter o fuso', () => {
    expect(formatIsoDateTimeBr('2026-09-24T08:02:11.123-03:00')).toBe('24/09/2026 08:02')
    expect(formatIsoDateTimeBr('2026-09-24')).toBeNull()
  })

  it('separa milhar com ponto e percentual com vírgula', () => {
    expect(formatNumber(1248)).toBe('1.248')
    expect(formatPercent(0.841)).toBe('84,1%')
    expect(formatPercent(0)).toBe('0,0%')
  })
})
