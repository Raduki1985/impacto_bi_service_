/**
 * Período com que as páginas do portal abrem.
 *
 * Regra única do BI: do dia 1 do mês corrente até hoje.
 *
 * O fim é limitado ao que a fonte realmente entrega, e não ao relógio. Com a
 * carga do banco atrasada, ele recua para a última data com dado: deixar os
 * últimos dias zerados dentro do recorte faria uma carga que não rodou parecer
 * queda de resultado.
 *
 * O início acompanha o mês do fim e nunca começa antes da cobertura. Uma base
 * que comece no meio do mês abriria num dia que o próprio calendário do filtro
 * recusaria.
 *
 * Fonte inteiramente no futuro, caso que só apareceria com agendamento, cai no
 * primeiro dia coberto, porque é o mais perto de hoje que ela consegue mostrar.
 */

/** Cobertura de datas de uma fonte, do primeiro ao último dia com dado. */
export type SourcePeriod = {
  readonly start: string
  readonly end: string
}

/** Data de hoje no fuso do computador, no formato `AAAA-MM-DD`. */
export function todayISO(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Período de abertura para uma cobertura qualquer.
 *
 * `today` existe para os testes fixarem a data. No portal ele nunca é passado,
 * e vale o relógio do computador de quem está olhando a página.
 */
export function defaultPeriodFor(
  coverage: SourcePeriod,
  today: string = todayISO(),
): SourcePeriod {
  const end = today > coverage.end ? coverage.end : today < coverage.start ? coverage.start : today
  const monthStart = `${end.slice(0, 7)}-01`

  return { start: monthStart < coverage.start ? coverage.start : monthStart, end }
}
