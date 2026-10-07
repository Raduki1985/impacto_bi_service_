import type { KpiDelta, Pair } from './dashboardTypes'

/**
 * Formato das comparações e tipos dos painéis da Visão Geral de OS.
 *
 * Até 01/10/2026 este módulo fazia as contas da página sobre os registros
 * (`buildOverviewOsData`). Elas foram para o serviço de BI
 * (`app/services/bi/os_period.py`), por decisão do Mário de ter a regra num
 * lugar só, e chegam prontas em `OverviewOsPeriodFacts`. Ficou aqui o que é
 * apresentação: como uma variação é escrita no card.
 */

/** Texto do card quando a janela anterior alcança datas sem cobertura da fonte. */
export const OVERVIEW_PREVIOUS_INCOMPLETE_LABEL = 'Período anterior incompleto'
export const OVERVIEW_PREVIOUS_INCOMPLETE_ACCESSIBLE =
  'comparação indisponível, o período anterior alcança datas sem cobertura da base'

/** Uma fatia da composição por tipo de OS, com as categorias que a compõem. */
export type ServiceTypeSlice = {
  readonly name: string
  readonly value: number
  /** Categorias do tipo, da mais frequente para a menos, sem corte. */
  readonly categories: readonly Pair[]
}

/** Comparação indisponível, com o motivo. */
export function unavailableDelta(reason: 'no-data' | 'incomplete'): KpiDelta {
  if (reason === 'incomplete') {
    return {
      text: 'N/A',
      positive: false,
      available: false,
      unavailableLabel: OVERVIEW_PREVIOUS_INCOMPLETE_LABEL,
      unavailableAccessibleLabel: OVERVIEW_PREVIOUS_INCOMPLETE_ACCESSIBLE,
    }
  }
  return { text: 'N/A', positive: false, available: false }
}

/** Variação relativa de um volume, como o card a escreve (`+12,5%`). */
export function delta(current: number, previous: number, higherIsGood: boolean): KpiDelta {
  const value = previous ? (current - previous) / previous : 0
  const positive = higherIsGood ? value >= 0 : value < 0

  return {
    text: `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1).replace('.', ',')}%`,
    positive,
    available: true,
  }
}
