import { parseISODate, toISODate } from './dashboardFilters'

/**
 * Contas com datas ISO (`aaaa-mm-dd`) sem passar pelo fuso do computador.
 *
 * Saíram de `overviewOsFilters.ts` em 24/09/2026, quando os atalhos de
 * período viraram componente do portal (`components/filters/PeriodPresets`):
 * "semana passada" e "mês passado" precisam destas contas, e nenhuma delas
 * sabe o que é uma OS. Ficam em `data`, ao lado de `dashboardFilters`, que já
 * guarda `parseISODate` e `toISODate`. `overviewOsFilters` continua
 * reexportando as que a Visão Geral de OS usa, então nada lá mudou de lugar
 * para quem consome.
 *
 * Toda conta é feita em UTC a partir do texto: uma data sem hora convertida
 * pelo relógio local pode virar o dia anterior em outro fuso, e a página
 * anunciaria a segunda como domingo.
 */

const MS_PER_DAY = 86_400_000

/** Data ISO deslocada em dias. */
export function shiftISODate(iso: string, days: number): string {
  return toISODate(parseISODate(iso) + days * MS_PER_DAY)
}

/** Dias inteiros entre duas datas ISO; negativo quando `to` vem antes de `from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to) - parseISODate(from)) / MS_PER_DAY)
}

/** Dia da semana da data ISO: 0 é domingo, 1 é segunda-feira. */
export function weekdayOf(iso: string): number {
  return new Date(parseISODate(iso)).getUTCDay()
}

const WEEKDAY_NAMES = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const

/**
 * Nome do dia da semana em português, por extenso (`segunda-feira`) ou curto
 * (`segunda`). Entrou em 23/09/2026 para o recorte de UM dia: "vs. 14/09"
 * deixava a pergunta "por que 14?" no ar, e "vs. segunda 14/09" responde
 * sozinho que é o mesmo dia da semana anterior.
 */
export function weekdayNameOf(iso: string, form: 'long' | 'short' = 'long'): string {
  const name = WEEKDAY_NAMES[weekdayOf(iso)]

  return form === 'long' ? name : name.replace('-feira', '')
}

/**
 * Segunda-feira da semana da data. É a semana dos atalhos de período, de
 * segunda a domingo, e a mesma da coluna "Início da semana" da planilha de OS.
 */
export function mondayOf(iso: string): string {
  const weekday = weekdayOf(iso)

  return shiftISODate(iso, weekday === 0 ? -6 : 1 - weekday)
}

/** Primeiro dia do mês anterior ao da data. */
export function previousMonthStart(iso: string): string {
  const [year, month] = iso.split('-').map(Number)

  return toISODate(Date.UTC(year, month - 2, 1))
}

/** Último dia do mês da data. */
export function lastDayOfMonth(iso: string): string {
  const [year, month] = iso.split('-').map(Number)

  return toISODate(Date.UTC(year, month, 0))
}
