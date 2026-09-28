import { describe, expect, it } from 'vitest'

import {
  daysBetween,
  lastDayOfMonth,
  mondayOf,
  previousMonthStart,
  shiftISODate,
  weekdayNameOf,
  weekdayOf,
} from './isoDate'

/**
 * Teste espelho das contas de data ISO.
 *
 * O que ele protege: nenhuma conta passa pelo fuso do computador, então o dia
 * nunca escorrega para a véspera, e a semana vai de segunda a domingo, que é
 * a dos atalhos de período e da planilha de OS.
 */
describe('contas com datas ISO', () => {
  it('desloca em dias, inclusive na virada de mês e de ano', () => {
    expect(shiftISODate('2026-09-22', -1)).toBe('2026-09-21')
    expect(shiftISODate('2026-09-01', -1)).toBe('2026-08-31')
    expect(shiftISODate('2026-12-31', 1)).toBe('2027-01-01')
    expect(daysBetween('2026-09-21', '2026-09-27')).toBe(6)
    expect(daysBetween('2026-09-27', '2026-09-21')).toBe(-6)
  })

  it('a semana começa na segunda-feira, e o domingo pertence à semana anterior', () => {
    // 21/09/2026 é segunda-feira; 27/09/2026 é domingo.
    expect(weekdayOf('2026-09-21')).toBe(1)
    expect(weekdayOf('2026-09-27')).toBe(0)
    expect(mondayOf('2026-09-24')).toBe('2026-09-21')
    expect(mondayOf('2026-09-27')).toBe('2026-09-21')
    expect(mondayOf('2026-09-21')).toBe('2026-09-21')
  })

  it('acha o começo do mês anterior e o fim do mês, com fevereiro e a virada do ano', () => {
    expect(previousMonthStart('2026-09-15')).toBe('2026-08-01')
    expect(previousMonthStart('2027-01-10')).toBe('2026-12-01')
    expect(lastDayOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29')
    expect(lastDayOfMonth('2026-12-01')).toBe('2026-12-31')
  })

  it('escreve o dia da semana por extenso ou curto, a partir da data ISO', () => {
    expect(weekdayNameOf('2026-09-21')).toBe('segunda-feira')
    expect(weekdayNameOf('2026-09-21', 'short')).toBe('segunda')
    expect(weekdayNameOf('2026-09-26')).toBe('sábado')
    expect(weekdayNameOf('2026-09-27', 'short')).toBe('domingo')
    expect(weekdayNameOf('2026-08-14', 'short')).toBe('sexta')
  })
})
