import { describe, expect, it } from 'vitest'

import {
  activePeriodPreset,
  PERIOD_PRESETS,
  periodPresetNotStartedReason,
  periodPresetRange,
  periodRangeText,
  periodWithinCoverage,
} from './periodPresets'

/**
 * Teste espelho dos atalhos de período do portal.
 *
 * O que ele protege: cada atalho mostra dias fechados, o atalho aceso é
 * reconhecido pelas datas (e o clicado vence no empate), e o texto do
 * período diz o dia da semana quando é um dia só. Os casos vieram de
 * `overviewOsFilters.test.ts` em 24/09/2026, junto com as funções.
 */
describe('atalhos de período', () => {
  const terca = '2026-09-22'

  it('cada atalho mostra dias fechados', () => {
    expect(periodPresetRange('yesterday', terca)).toEqual({ dateFrom: '2026-09-21', dateTo: '2026-09-21' })
    // Numa terça-feira, "Esta semana" é só a segunda: igual a "Ontem".
    expect(periodPresetRange('thisWeek', terca)).toEqual({ dateFrom: '2026-09-21', dateTo: '2026-09-21' })
    expect(periodPresetRange('lastWeek', terca)).toEqual({ dateFrom: '2026-09-14', dateTo: '2026-09-20' })
    expect(periodPresetRange('thisMonth', terca)).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-21' })
    expect(periodPresetRange('lastMonth', terca)).toEqual({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })
  })

  it('na segunda-feira "Esta semana" cai na semana passada inteira', () => {
    expect(periodPresetRange('thisWeek', '2026-09-21')).toEqual({ dateFrom: '2026-09-14', dateTo: '2026-09-20' })
  })

  it('no dia 1 "Este mês" cai no mês anterior inteiro, inclusive na virada do ano', () => {
    expect(periodPresetRange('thisMonth', '2026-10-01')).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    expect(periodPresetRange('thisMonth', '2027-01-01')).toEqual({ dateFrom: '2026-12-01', dateTo: '2026-12-31' })
    expect(periodPresetRange('lastMonth', '2027-01-15')).toEqual({ dateFrom: '2026-12-01', dateTo: '2026-12-31' })
  })

  it('o atalho corrente que começou hoje não se aplica, e diz por quê', () => {
    // 28/09/2026 é segunda-feira.
    expect(periodPresetNotStartedReason('thisWeek', '2026-09-28')).toBe(
      'A semana começou hoje e ainda não tem dia fechado',
    )
    expect(periodPresetNotStartedReason('thisWeek', terca)).toBeNull()
    expect(periodPresetNotStartedReason('thisMonth', '2026-10-01')).toBe(
      'O mês começou hoje e ainda não tem dia fechado',
    )
    expect(periodPresetNotStartedReason('thisMonth', '2026-10-02')).toBeNull()
    // Os outros atalhos sempre têm dias fechados.
    expect(periodPresetNotStartedReason('yesterday', '2026-09-28')).toBeNull()
    expect(periodPresetNotStartedReason('lastWeek', '2026-09-28')).toBeNull()
    expect(periodPresetNotStartedReason('lastMonth', '2026-10-01')).toBeNull()
  })

  it('o atalho que começou hoje não acende, nem se foi o último clicado', () => {
    const semanaPassada = { dateFrom: '2026-09-21', dateTo: '2026-09-27' }

    expect(activePeriodPreset(semanaPassada, '2026-09-28', 'thisWeek')).toBe('lastWeek')
  })

  it('domingo pertence à semana que começou na segunda anterior', () => {
    // 27/09/2026 é domingo.
    expect(periodPresetRange('thisWeek', '2026-09-27')).toEqual({ dateFrom: '2026-09-21', dateTo: '2026-09-26' })
  })

  it('reconhece o atalho pelas datas, e nenhum quando o recorte é personalizado', () => {
    expect(activePeriodPreset({ dateFrom: '2026-09-01', dateTo: '2026-09-21' }, terca)).toBe('thisMonth')
    expect(activePeriodPreset({ dateFrom: '2026-08-01', dateTo: '2026-08-31' }, terca)).toBe('lastMonth')
    expect(activePeriodPreset({ dateFrom: '2026-09-14', dateTo: '2026-09-20' }, terca)).toBe('lastWeek')
    expect(activePeriodPreset({ dateFrom: '2026-09-03', dateTo: '2026-09-10' }, terca)).toBeNull()
  })

  it('o atalho clicado vence enquanto as datas forem as dele', () => {
    const segunda = { dateFrom: '2026-09-21', dateTo: '2026-09-21' }

    // Terça: "Esta semana" e "Ontem" são a mesma segunda. Quem clicou em
    // "Esta semana" vê "Esta semana" aceso, e não "Ontem".
    expect(activePeriodPreset(segunda, terca, 'thisWeek')).toBe('thisWeek')
    expect(activePeriodPreset(segunda, terca, 'yesterday')).toBe('yesterday')
    // Clique antigo que já não bate com as datas não manda mais.
    expect(activePeriodPreset({ dateFrom: '2026-09-01', dateTo: '2026-09-21' }, terca, 'thisWeek')).toBe('thisMonth')
    expect(activePeriodPreset({ dateFrom: '2026-09-03', dateTo: '2026-09-10' }, terca, 'thisWeek')).toBeNull()
  })

  it('quando dois atalhos coincidem e ninguém clicou, acende o de nome verdadeiro', () => {
    // Terça: "Ontem" e "Esta semana" são a mesma segunda-feira.
    expect(activePeriodPreset({ dateFrom: '2026-09-21', dateTo: '2026-09-21' }, terca)).toBe('yesterday')
    // Segunda: "Esta semana" ainda não tem dia fechado e cai na semana passada.
    expect(activePeriodPreset({ dateFrom: '2026-09-14', dateTo: '2026-09-20' }, '2026-09-21')).toBe('lastWeek')
    // Dia 1: "Este mês" cai no mês anterior inteiro, e é "Mês passado" que acende.
    expect(activePeriodPreset({ dateFrom: '2026-09-01', dateTo: '2026-09-30' }, '2026-10-01')).toBe('lastMonth')
  })

  it('atalho fora da cobertura da fonte não se aplica, e a borda exata da cobertura cabe', () => {
    const cobertura = { min: '2026-06-01', max: '2026-09-21' }

    expect(periodWithinCoverage(periodPresetRange('lastMonth', '2026-06-15'), cobertura)).toBe(false)
    expect(periodWithinCoverage(periodPresetRange('lastMonth', terca), cobertura)).toBe(true)
    // O primeiro e o último dia com dado são dias com dado: entram.
    expect(periodWithinCoverage({ dateFrom: '2026-06-01', dateTo: '2026-09-21' }, cobertura)).toBe(true)
    expect(periodWithinCoverage({ dateFrom: '2026-05-31', dateTo: '2026-09-21' }, cobertura)).toBe(false)
    expect(periodWithinCoverage({ dateFrom: '2026-06-01', dateTo: '2026-09-22' }, cobertura)).toBe(false)
  })

  it('os cinco atalhos ficam na ordem aprovada', () => {
    expect(PERIOD_PRESETS.map((preset) => preset.label)).toEqual([
      'Ontem',
      'Esta semana',
      'Semana passada',
      'Este mês',
      'Mês passado',
    ])
  })
})

describe('período por extenso', () => {
  it('escreve o intervalo pelas datas, e um dia só pelo dia da semana', () => {
    expect(periodRangeText({ dateFrom: '2026-09-01', dateTo: '2026-09-21' })).toBe(
      '01/09/2026 a 21/09/2026',
    )
    // 17/09/2026 é quinta-feira.
    expect(periodRangeText({ dateFrom: '2026-09-17', dateTo: '2026-09-17' })).toBe(
      'quinta-feira, 17/09/2026',
    )
  })

  it('data fora do formato não passa por Date nem inventa dia da semana', () => {
    expect(periodRangeText({ dateFrom: 'x', dateTo: '2026-09-21' })).toBe(
      'Data não definida a 21/09/2026',
    )
    expect(periodRangeText({ dateFrom: 'x', dateTo: 'x' })).toBe('Data não definida a Data não definida')
  })
})
