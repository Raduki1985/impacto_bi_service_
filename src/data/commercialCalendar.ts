/**
 * Calendário do período comercial mockado.
 *
 * Funções puras de data, sem fuso: toda conta usa UTC e o formato `AAAA-MM-DD`.
 * É o que garante que a venda ativada em 01/07 continue sendo de julho em
 * qualquer máquina, independentemente do fuso do navegador.
 */

import type { CommercialMonthKey } from './commercialTypes'

/** Primeiro dia coberto pela base mockada. */
export const COMMERCIAL_PERIOD_START = '2026-01-01'

/** Último dia coberto pela base mockada, e também a data de atualização exibida. */
export const COMMERCIAL_PERIOD_END = '2026-07-31'

/** Meses do período, em ordem. Janeiro a julho de 2026. */
export const COMMERCIAL_MONTHS: readonly CommercialMonthKey[] = [
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
]

/** Mês inicial da página. */
export const DEFAULT_COMMERCIAL_MONTH: CommercialMonthKey = '2026-07'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const SHORT_MONTH_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** true somente para uma data real no formato `AAAA-MM-DD`. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1) return false

  return day <= daysInYearMonth(year, month)
}

export function isCommercialMonthKey(value: string): value is CommercialMonthKey {
  return COMMERCIAL_MONTHS.includes(value as CommercialMonthKey)
}

/** Mês de uma data ISO, no formato `AAAA-MM`. */
export function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function yearOf(month: CommercialMonthKey): number {
  return Number(month.slice(0, 4))
}

/** Número do mês, de 1 a 12. */
export function monthNumberOf(month: CommercialMonthKey): number {
  return Number(month.slice(5, 7))
}

function daysInYearMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Dias corridos do mês. É a base do ritmo esperado. */
export function daysInMonth(month: CommercialMonthKey): number {
  return daysInYearMonth(yearOf(month), monthNumberOf(month))
}

/** `Julho de 2026`. */
export function monthLabel(month: CommercialMonthKey): string {
  return `${MONTH_NAMES[monthNumberOf(month) - 1]} de ${yearOf(month)}`
}

/** `Jul/26`, para eixos de gráfico. */
export function monthShortLabel(month: CommercialMonthKey): string {
  return `${SHORT_MONTH_NAMES[monthNumberOf(month) - 1]}/${String(yearOf(month)).slice(2)}`
}

/** Mês anterior dentro do período, ou null quando ele fica fora da base. */
export function previousCommercialMonth(month: CommercialMonthKey): CommercialMonthKey | null {
  const index = COMMERCIAL_MONTHS.indexOf(month)

  return index > 0 ? COMMERCIAL_MONTHS[index - 1] : null
}

/** Data ISO a partir dos componentes. */
export function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Data ISO do dia `day` do mês. */
export function isoDateInMonth(month: CommercialMonthKey, day: number): string {
  return toIsoDate(yearOf(month), monthNumberOf(month), day)
}

/** Dia do mês de uma data ISO, de 1 a 31. */
export function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10))
}

/** Dia da semana em UTC: 0 é domingo. */
export function weekdayOf(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Soma dias (aceita negativo) preservando o formato ISO. */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))

  return toIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

/** Ordenação lexicográfica, que em ISO é também cronológica. */
export function compareIsoDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** `31/07/2026` a partir de `2026-07-31`. */
export function formatIsoAsBrDate(isoDate: string): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(0, 4)}`
}
