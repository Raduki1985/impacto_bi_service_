import { describe, expect, it } from 'vitest'

import { defaultPeriodFor, todayISO } from './defaultPeriod'

describe('período de abertura das páginas', () => {
  it('abre no dia 1 do mês corrente até hoje quando a fonte cobre hoje', () => {
    const period = defaultPeriodFor({ start: '2026-01-01', end: '2026-09-30' }, '2026-09-11')

    expect(period).toEqual({ start: '2026-09-01', end: '2026-09-11' })
  })

  it('recua o fim para a última data com dado quando a carga está atrasada', () => {
    const period = defaultPeriodFor({ start: '2026-04-06', end: '2026-08-21' }, '2026-09-11')

    expect(period).toEqual({ start: '2026-08-01', end: '2026-08-21' })
  })

  it('não começa antes da cobertura quando a base abre no meio do mês', () => {
    const period = defaultPeriodFor({ start: '2026-09-05', end: '2026-09-30' }, '2026-09-11')

    expect(period).toEqual({ start: '2026-09-05', end: '2026-09-11' })
  })

  it('cobertura inteiramente futura abre no primeiro dia disponível', () => {
    const period = defaultPeriodFor({ start: '2026-10-01', end: '2026-10-31' }, '2026-09-11')

    expect(period).toEqual({ start: '2026-10-01', end: '2026-10-01' })
  })

  it('fonte de um dia só abre nesse dia', () => {
    const period = defaultPeriodFor({ start: '2026-09-11', end: '2026-09-11' }, '2026-09-11')

    expect(period).toEqual({ start: '2026-09-11', end: '2026-09-11' })
  })

  it('hoje sai do relógio local, e não do horário de Greenwich', () => {
    // 31/12/2026 às 23h no fuso de Brasília já é 01/01/2027 em Greenwich. O
    // portal precisa do dia que a pessoa vê no calendário dela.
    expect(todayISO(new Date(2026, 11, 31, 23, 0, 0))).toBe('2026-12-31')
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('sem data informada, usa o relógio do computador', () => {
    expect(defaultPeriodFor({ start: '2026-01-01', end: '2099-12-31' }).end).toBe(todayISO())
  })
})
