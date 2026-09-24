import { describe, expect, it } from 'vitest'

import { formatDateBr, formatNumber, formatPercent } from './formatters'

describe('formatadores em pt-BR', () => {
  it('escreve a data ISO no formato brasileiro, sem passar pelo relógio da máquina', () => {
    expect(formatDateBr('2026-09-18')).toBe('18/09/2026')
    expect(formatDateBr('2026-01-05')).toBe('05/01/2026')
  })

  it('separa milhar com ponto e percentual com vírgula', () => {
    expect(formatNumber(1248)).toBe('1.248')
    expect(formatPercent(0.841)).toBe('84,1%')
    expect(formatPercent(0)).toBe('0,0%')
  })
})
