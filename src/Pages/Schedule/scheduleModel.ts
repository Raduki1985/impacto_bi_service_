import type {
  OsScheduleDay,
  OsScheduleDayKind,
  OsSchedulePeriodLoad,
  OsSchedulePeriodRule,
  OsSchedulePresenceBasis,
  OsScheduleRegistryRow,
  OsScheduleSource,
  OsScheduleWindow,
} from '../../data/api/osScheduleSource'
import { mondayOf, shiftISODate, weekdayNameOf, weekdayOf } from '../../data/isoDate'
import { formatClockMinutes, formatNumber } from '../../lib/formatters'

/**
 * Modelo da página Agenda e capacidade, redesenhada como calendário em
 * 19/10/2026 (decisão do Mário sobre o mock em
 * `Docs/historico/capacidade/mock-agenda-calendario.html`): semanas em
 * linhas, de segunda a domingo, cada dia com os turnos do SGI, e a resposta
 * de cada turno em HORAS, porque cada categoria pesa o próprio tempo
 * previsto. A contagem de OS por categoria fica no detalhe do turno.
 *
 * As contas de capacidade NÃO estão aqui: vivem no serviço (`os_schedule.py`
 * do impacto-bi-service), uma vez só, e a página recebe os números prontos.
 * O que mora aqui é apresentação: a grade de semanas, o estado de cada turno,
 * a frase de cada pílula, o resumo da semana em palavras e o que o detalhe
 * lista.
 *
 * O que este arquivo congela, até o Mário decidir o contrário:
 *
 * - a ocupação de referência é a da RÉGUA DA OPERAÇÃO (técnicos presentes):
 *   é a que mede o que cabe de verdade. A conta do SGI aparece por categoria,
 *   no detalhe, porque é ela que recusa data na hora de agendar;
 * - cheio é quando não cabe mais uma OS (regra do Mário, 19/10/2026): a
 *   sobra do turno é menor que a OS média dele (horas marcadas divididas
 *   pelas OS marcadas; com menos de 5 OS no turno, a média do dia), ou a
 *   ocupação chegou a 100%. Quase cheio de 85% até aí (o 85% segue
 *   provisório); abaixo, cabe;
 * - turno sem OS é "Livre", em cinza (confirmado pelo Mário em 19/10/2026);
 *   quantas categorias a grade do SGI recusa fica só no detalhe do turno,
 *   pelo nome, porque o número na célula assustava sem explicar;
 * - feriado do cadastro e o turno de hoje já fechado pela hora limite do SGI
 *   não respondem "cabe": a grade não oferece o turno, seja qual for a
 *   ocupação;
 * - abre com duas semanas; quatro só ao clicar, sem guardar a escolha. A
 *   leitura do serviço já traz as quatro, para o clique não esperar.
 */

/** Semanas que o calendário mostra ao abrir, e depois de "Ver 4 semanas". */
export const DEFAULT_WEEKS = 2
export const EXPANDED_WEEKS = 4
/** Semanas de folga de cada lado da leitura (ver `scheduleWindow`). */
export const WINDOW_MARGIN_WEEKS = 1

/** A partir daqui o turno é "quase cheio" (provisório). */
export const OCCUPATION_ATTENTION = 0.85
/** A partir daqui a agenda chegou à capacidade: cheio, seja qual for a OS média. */
export const OCCUPATION_FULL = 1
/** Turno com menos OS do que isto usa a OS média do dia, para uma OS longa não distorcer. */
export const AVERAGE_MIN_ORDERS = 5

/**
 * A janela que a página pede ao serviço: as quatro semanas do calendário
 * (da segunda-feira da semana de hoje em diante) mais uma semana antes e uma
 * depois. Sempre as quatro, para "Ver 4 semanas" não precisar de outra
 * leitura. A folga existe porque a janela sai do relógio de quem olha e o
 * calendário ancora no hoje do serviço: um dia de diferença entre os dois
 * (fuso, relógio errado, virada da meia-noite) não pode deixar uma semana
 * inteira fora da leitura. São 42 dias, abaixo dos 45 que o serviço aceita.
 */
export function scheduleWindow(today: string, weeks = EXPANDED_WEEKS): OsScheduleWindow {
  const from = shiftISODate(mondayOf(today), -7 * WINDOW_MARGIN_WEEKS)

  return { from, to: shiftISODate(from, (weeks + 2 * WINDOW_MARGIN_WEEKS) * 7 - 1) }
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Horas no formato de relógio, sem decimal (pedido do Mário em 19/10/2026, o
 * mesmo formato da coluna SLA das listas de OS): `97h30`, `40min`, `8h`.
 * Zero é `0h`. As horas previstas são somas de SLA quebrado, e o
 * arredondamento ao minuto é o que a tela precisa.
 */
export function formatHours(hours: number): string {
  const minutes = Math.round(hours * 60)

  return minutes === 0 ? '0h' : formatClockMinutes(minutes)
}

const ZERO_HOURS = formatHours(0)

/** `19/10`, o rótulo curto de um dia. */
export function shortDay(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** `Seg 19/10`: o cabeçalho de cada dia do calendário. */
export function dayLabel(iso: string): string {
  return `${capitalize(weekdayNameOf(iso, 'short').slice(0, 3))} ${shortDay(iso)}`
}

/** `Amanhã, sábado 17/10, manhã`, ou `Terça-feira 20/10, manhã`: o título do detalhe. */
export function detailTitle(iso: string, period: string, today: string): string {
  const base = `${weekdayNameOf(iso)} ${shortDay(iso)}, ${period.toLowerCase()}`
  if (iso === today) return `Hoje, ${base}`
  if (iso === shiftISODate(today, 1)) return `Amanhã, ${base}`

  return capitalize(base)
}

/** A hora de um texto ISO com hora (`2026-10-16T14:32:00-03:00` dá 14); nula sem hora. */
export function isoHour(iso: string): number | null {
  const match = /T(\d{2}):/.exec(iso)

  return match === null ? null : Number(match[1])
}

/** Dias de histórico que o serviço olha, por extenso: `nas últimas 4 semanas` ou `nos últimos 30 dias`. */
function historyWindowText(historyDays: number): string {
  return historyDays % 7 === 0
    ? `nas últimas ${formatNumber(historyDays / 7)} semanas`
    : `nos últimos ${formatNumber(historyDays)} dias`
}

/**
 * Quem entrou na conta de presentes, para escrever depois de "N técnicos";
 * `count` só serve à concordância ("1 técnico que executou"), e
 * `historyDays` é o que o serviço informa ter olhado para a presença típica.
 */
export function presenceBasisText(
  basis: OsSchedulePresenceBasis | null,
  iso: string,
  count = 2,
  historyDays = 28,
): string {
  const one = count === 1
  switch (basis) {
    case 'executed':
      return one ? 'que executou ou esteve em campo no dia' : 'que executaram ou estiveram em campo no dia'
    case 'assigned_or_available':
      return `com OS designada hoje ou ${one ? 'disponível' : 'disponíveis'} no aplicativo`
    case 'typical_weekday':
      return `pela presença típica de ${weekdayNameOf(iso)} ${historyWindowText(historyDays)}, estimativa`
    default:
      return 'sem histórico deste dia da semana para estimar a presença'
  }
}

/** `29 técnicos pela presença típica de terça-feira ...`, ou nulo sem estimativa. */
function presenceText(
  technicians: number | null,
  basis: OsSchedulePresenceBasis | null,
  iso: string,
  historyDays: number,
): string | null {
  if (technicians === null) return null

  return `${formatNumber(technicians)} ${plural(technicians, 'técnico', 'técnicos')} ${presenceBasisText(basis, iso, technicians, historyDays)}`
}

/**
 * O SGI só aceita marcar OS para o próprio dia até a hora limite do turno
 * (`limitHour` do cadastro: 11 h de manhã, 16 h à tarde). Lida a agenda
 * depois disso, o turno de hoje está fechado para agendar, seja qual for a
 * ocupação. A hora é a da leitura no serviço, não a do navegador.
 */
export function shiftCutoff(
  kind: OsScheduleDayKind,
  rule: OsSchedulePeriodRule | undefined,
  readHour: number | null,
): boolean {
  return (
    kind === 'today' && rule !== undefined && rule.limitHour !== null && readHour !== null && readHour >= rule.limitHour
  )
}

/** O estado de um turno, em palavras; a cor é derivada dele, nunca o contrário. */
export type ShiftState = 'past' | 'free' | 'closed' | 'cutoff' | 'nobody' | 'unknown' | 'ok' | 'attention' | 'over'

export type ShiftTone = 'ok' | 'attention' | 'over' | 'muted'

/**
 * As horas de uma OS média: as horas marcadas divididas pelas OS marcadas,
 * no turno quando ele tem OS suficientes, senão no dia inteiro. Nula sem OS
 * com horas. É a medida do "não cabe mais uma OS": a média sai do próprio
 * dado, ninguém inventa um número.
 */
export function averageOrderHours(
  period: Pick<OsSchedulePeriodLoad, 'scheduled' | 'consumedHours'>,
  dayPeriods: readonly Pick<OsSchedulePeriodLoad, 'scheduled' | 'consumedHours'>[],
): number | null {
  if (period.scheduled >= AVERAGE_MIN_ORDERS && period.consumedHours > 0) {
    return period.consumedHours / period.scheduled
  }
  const scheduled = dayPeriods.reduce((sum, item) => sum + item.scheduled, 0)
  const hours = dayPeriods.reduce((sum, item) => sum + item.consumedHours, 0)

  return scheduled > 0 && hours > 0 ? hours / scheduled : null
}

/**
 * Cheio quando a ocupação chega a 100%, ou antes disso, quando o que sobra
 * no turno é menor que uma OS média dele (regra do Mário em 19/10/2026:
 * cheio é quando não cabe mais OS, não só quando as horas acabam). Quase
 * cheio de 85% até aí; abaixo, cabe.
 */
export function occupationState(
  occupation: number | null,
  remainingHours: number | null = null,
  orderHours: number | null = null,
): 'unknown' | 'ok' | 'attention' | 'over' {
  if (occupation === null || !Number.isFinite(occupation)) return 'unknown'
  if (occupation >= OCCUPATION_FULL) return 'over'
  if (remainingHours !== null && orderHours !== null && remainingHours < orderHours) return 'over'
  if (occupation >= OCCUPATION_ATTENTION) return 'attention'

  return 'ok'
}

/**
 * Dia passado é realizado, não cabe mais nada nele. Feriado do cadastro e
 * turno de hoje já fechado pela hora limite não recebem OS pela grade, com
 * ou sem OS marcada. Turno sem OS é livre. Com OS e nenhum técnico previsto,
 * nada cabe. Sem capacidade estimada não há como responder; o resto responde
 * pela ocupação com os presentes.
 */
export function shiftState(
  period: Pick<OsSchedulePeriodLoad, 'scheduled' | 'consumedHours' | 'operation'>,
  kind: OsScheduleDayKind,
  closed: boolean,
  cutoff = false,
  /** As horas de uma OS média, para o "não cabe mais uma"; nula sem a medida. */
  orderHours: number | null = null,
): ShiftState {
  if (kind === 'past') return 'past'
  if (closed) return 'closed'
  if (cutoff) return 'cutoff'
  if (period.scheduled === 0) return 'free'
  if (period.operation.technicians === 0) return 'nobody'
  const capacity = period.operation.capacityHours

  return occupationState(
    period.operation.occupation,
    capacity === null ? null : capacity - period.consumedHours,
    orderHours,
  )
}

export function shiftTone(state: ShiftState): ShiftTone {
  if (state === 'nobody') return 'over'

  return state === 'ok' || state === 'attention' || state === 'over' ? state : 'muted'
}

/**
 * A resposta do turno, em palavras e em horas, que a pílula escreve. Quando
 * a sobra ou o excesso arredondam para zero, a frase diz "sem sobra" em vez
 * de "0,0 h".
 */
export function shiftPill(
  state: ShiftState,
  consumedHours: number,
  capacityHours: number | null,
  limitHour: number | null = null,
): string {
  const capacity = capacityHours ?? 0
  switch (state) {
    case 'past':
      return 'Realizado'
    case 'free':
      return 'Livre'
    case 'closed':
      return 'Feriado'
    case 'cutoff':
      return limitHour === null ? 'Fechado para hoje' : `Fechado às ${limitHour}h`
    case 'nobody':
      return 'Sem técnico previsto'
    case 'unknown':
      return 'Sem estimativa'
    case 'ok':
      return `Cabe mais ${formatHours(capacity - consumedHours)}`
    case 'attention': {
      const left = formatHours(Math.max(capacity - consumedHours, 0))

      return left === ZERO_HOURS ? 'Quase cheio · sem sobra' : `Quase cheio · sobram ${left}`
    }
    case 'over': {
      // Passou da capacidade; ou ainda sobra alguma hora, mas menos que uma
      // OS média, e aí a pílula diz quanto sobra para ninguém tentar encaixar.
      const beyond = formatHours(Math.max(consumedHours - capacity, 0))
      if (beyond !== ZERO_HOURS) return `Cheio · passou ${beyond}`
      const left = formatHours(Math.max(capacity - consumedHours, 0))

      return left === ZERO_HOURS ? 'Cheio · sem sobra' : `Cheio · sobram ${left}`
    }
  }
}

/**
 * A legenda das horas do turno, em letra pequena embaixo da pílula: o que o
 * número grande é ("marcadas" ou "realizadas") e de quanto ("de 96,0 h").
 * Sem capacidade estimada, só a palavra. Desde 19/10/2026 o número grande do
 * turno é em horas, e não em OS (pedido do Mário: a página toda fala em
 * horas, e o número de OS no topo confundia).
 */
export function shiftHoursNote(past: boolean, capacityHours: number | null): string {
  const verb = past ? 'realizadas' : 'marcadas'
  if (capacityHours === null || capacityHours <= 0) return verb

  return `${verb} de ${formatHours(capacityHours)}`
}

/** Largura da barra, de 0 a 100: a ocupação acima de 100% enche a barra inteira. */
export function fillPercent(occupation: number | null): number {
  if (occupation === null || !Number.isFinite(occupation)) return 0

  return Math.min(100, Math.max(0, Math.round(occupation * 100)))
}

export type ShiftCell = {
  readonly iso: string
  readonly periodKey: string
  readonly period: string
  readonly kind: OsScheduleDayKind
  readonly state: ShiftState
  readonly tone: ShiftTone
  readonly scheduled: number
  readonly consumedHours: number
  /** Capacidade com os técnicos presentes; nula sem estimativa. */
  readonly capacityHours: number | null
  readonly occupation: number | null
  readonly pill: string
  /** O número grande do turno: as horas marcadas (ou realizadas, no passado). */
  readonly hours: string
  readonly hoursNote: string
  readonly fillPercent: number
}

function toShift(
  day: OsScheduleDay,
  period: OsSchedulePeriodLoad,
  rule: OsSchedulePeriodRule | undefined,
  readHour: number | null,
): ShiftCell {
  const state = shiftState(
    period,
    day.kind,
    day.closed,
    shiftCutoff(day.kind, rule, readHour),
    averageOrderHours(period, day.periods),
  )
  const capacityHours = period.operation.capacityHours

  return {
    iso: day.day,
    periodKey: period.periodKey,
    period: period.period,
    kind: day.kind,
    state,
    tone: shiftTone(state),
    scheduled: period.scheduled,
    consumedHours: period.consumedHours,
    capacityHours,
    occupation: period.operation.occupation,
    pill: shiftPill(state, period.consumedHours, capacityHours, rule?.limitHour ?? null),
    hours: formatHours(period.consumedHours),
    hoursNote: shiftHoursNote(state === 'past', capacityHours),
    fillPercent: state === 'nobody' ? 100 : fillPercent(period.operation.occupation),
  }
}

export type DayCell = {
  readonly iso: string
  readonly label: string
  readonly isToday: boolean
  /** Nulo quando a leitura não cobre o dia. */
  readonly kind: OsScheduleDayKind | null
  readonly closed: boolean
  readonly closedTeams: readonly string[]
  /** Técnicos presentes na conta, e de onde o número saiu, para a dica de mouse. */
  readonly technicians: number | null
  readonly presenceText: string | null
  readonly scheduled: number
  readonly withoutPeriod: number
  /** Célula sem agenda: domingo sem OS, ou dia fora da leitura. */
  readonly empty: 'sunday' | 'outside' | null
  readonly shifts: readonly ShiftCell[]
}

type PeriodRules = ReadonlyMap<string, OsSchedulePeriodRule>

function toDayCell(
  iso: string,
  day: OsScheduleDay | null,
  today: string,
  rules: PeriodRules,
  readHour: number | null,
  historyDays: number,
  periodFilter: string | null,
): DayCell {
  const label = dayLabel(iso)
  const isToday = iso === today
  if (day === null) {
    return {
      iso,
      label,
      isToday,
      kind: null,
      closed: false,
      closedTeams: [],
      technicians: null,
      presenceText: null,
      scheduled: 0,
      withoutPeriod: 0,
      empty: 'outside',
      shifts: [],
    }
  }
  // Domingo só entra na agenda sob demanda: sem OS, a célula fica vazia em
  // vez de mostrar dois turnos "Livre" que ninguém vai marcar.
  const sundayEmpty = weekdayOf(iso) === 0 && day.scheduled === 0

  return {
    iso,
    label,
    isToday,
    kind: day.kind,
    closed: day.closed,
    closedTeams: day.closedTeams,
    technicians: day.operation.technicians,
    presenceText: presenceText(day.operation.technicians, day.presenceBasis, iso, historyDays),
    scheduled: day.scheduled,
    withoutPeriod: day.withoutPeriod,
    empty: sundayEmpty ? 'sunday' : null,
    shifts: sundayEmpty
      ? []
      : day.periods
          .filter((period) => periodFilter === null || period.periodKey === periodFilter)
          .map((period) => toShift(day, period, rules.get(period.periodKey), readHour)),
  }
}

export type CalendarWeek = {
  readonly start: string
  readonly end: string
  readonly title: string
  readonly days: readonly DayCell[]
}

/** `Esta semana, 19/10 a 25/10`, `Próxima semana, ...`, e depois `Semana de ...`. */
export function weekTitle(index: number, start: string, end: string): string {
  const range = `${shortDay(start)} a ${shortDay(end)}`
  if (index === 0) return `Esta semana, ${range}`
  if (index === 1) return `Próxima semana, ${range}`

  return `Semana de ${range}`
}

function periodRules(source: OsScheduleSource): PeriodRules {
  return new Map(source.parameters.periods.map((rule) => [rule.key, rule]))
}

/**
 * As semanas do calendário, da segunda-feira da semana de hoje (o hoje do
 * serviço) em diante. `periodFilter` é o filtro de turno da faixa de
 * filtros: nulo mostra todos.
 */
export function buildCalendar(
  source: OsScheduleSource,
  weeks: number,
  periodFilter: string | null = null,
): CalendarWeek[] {
  const byIso = new Map(source.days.map((day) => [day.day, day]))
  const rules = periodRules(source)
  const readHour = isoHour(source.generatedAt)
  const start = mondayOf(source.today)

  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = shiftISODate(start, index * 7)
    const weekEnd = shiftISODate(weekStart, 6)

    return {
      start: weekStart,
      end: weekEnd,
      title: weekTitle(index, weekStart, weekEnd),
      days: Array.from({ length: 7 }, (_, offset) => {
        const iso = shiftISODate(weekStart, offset)

        return toDayCell(iso, byIso.get(iso) ?? null, source.today, rules, readHour, source.historyDays, periodFilter)
      }),
    }
  })
}

/** Um pedaço da frase do resumo; os números saem em destaque. */
export type SummarySegment = { readonly text: string; readonly emphasis: boolean }

export type WeekSummary = { readonly title: string; readonly segments: readonly SummarySegment[] }

const num = (value: number): SummarySegment => ({ text: formatNumber(value), emphasis: true })
const txt = (text: string): SummarySegment => ({ text, emphasis: false })

/**
 * A semana em uma frase, em horas como o calendário: o realizado até ontem,
 * o marcado de hoje em diante, as OS sem turno (que contam no dia e em hora
 * nenhuma) e quantos turnos ainda cabem, estão quase cheios ou cheios, com
 * as mesmas palavras da legenda e das pílulas. As horas somam os turnos
 * visíveis, então o filtro de turno vale também aqui. Só turnos abertos, com
 * OS e com capacidade estimada entram na contagem de estados; turno sem
 * técnico previsto conta como cheio.
 */
export function buildWeekSummary(week: CalendarWeek): WeekSummary {
  const past = week.days.filter((day) => day.kind === 'past')
  const ahead = week.days.filter((day) => day.kind === 'today' || day.kind === 'future')
  const hoursOf = (days: readonly DayCell[]) =>
    days.flatMap((day) => day.shifts).reduce((sum, shift) => sum + shift.consumedHours, 0)
  const withoutPeriod = ahead.reduce((sum, day) => sum + day.withoutPeriod, 0)
  const counts = { ok: 0, attention: 0, over: 0, unknown: 0 }
  for (const shift of ahead.flatMap((day) => day.shifts)) {
    if (shift.state === 'nobody') counts.over += 1
    else if (shift.state === 'ok' || shift.state === 'attention' || shift.state === 'over' || shift.state === 'unknown') {
      counts[shift.state] += 1
    }
  }

  const segments: SummarySegment[] = []
  if (past.length > 0) {
    segments.push({ text: formatHours(hoursOf(past)), emphasis: true }, txt(' realizadas até ontem'))
  }
  if (ahead.length > 0) {
    if (segments.length > 0) segments.push(txt(' · '))
    segments.push(
      { text: formatHours(hoursOf(ahead)), emphasis: true },
      txt(past.length > 0 ? ' marcadas de hoje em diante' : ' marcadas'),
    )
    if (withoutPeriod > 0) {
      segments.push(
        txt(' · '),
        num(withoutPeriod),
        txt(` OS sem turno ${plural(withoutPeriod, 'fica', 'ficam')} fora dos turnos`),
      )
    }
    if (counts.ok + counts.attention + counts.over > 0) {
      segments.push(
        txt(' · '),
        num(counts.ok),
        txt(` ${plural(counts.ok, 'turno', 'turnos')} em que ainda cabe, `),
        num(counts.attention),
        txt(` quase ${plural(counts.attention, 'cheio', 'cheios')}, `),
        num(counts.over),
        txt(` ${plural(counts.over, 'cheio', 'cheios')}`),
      )
    }
    if (counts.unknown > 0) {
      segments.push(
        txt(' · '),
        num(counts.unknown),
        txt(` ${plural(counts.unknown, 'turno', 'turnos')} sem estimativa de capacidade`),
      )
    }
  }
  if (segments.length === 0) return { title: week.title, segments: [txt('Semana fora da leitura')] }

  return { title: week.title, segments }
}

/** A frase inteira, para os testes e para o leitor de tela. */
export function summaryText(summary: WeekSummary): string {
  return summary.segments.map((segment) => segment.text).join('')
}

export type ShiftSelection = { readonly iso: string; readonly periodKey: string }

/**
 * O turno aberto ao entrar na página: o primeiro turno de amanhã, que é o
 * dia que quem agenda mais precisa enxergar. Domingo sem OS não tem turno
 * para abrir, então a escolha pula para o dia seguinte com agenda.
 */
export function defaultSelection(source: OsScheduleSource): ShiftSelection | null {
  const byIso = new Map(source.days.map((day) => [day.day, day]))
  for (let offset = 1; offset <= 7; offset += 1) {
    const iso = shiftISODate(source.today, offset)
    const day = byIso.get(iso)
    if (day === undefined || day.kind === 'past' || day.periods.length === 0) continue
    if (weekdayOf(iso) === 0 && day.scheduled === 0) continue

    return { iso, periodKey: day.periods[0].periodKey }
  }

  return null
}

/**
 * O que a conta deixa de fora num dia, por extenso: OS sem turno não entram
 * nos turnos, e OS sem horas previstas pesam zero. Vazio sem nada a avisar.
 */
export function uncountedNote(day: Pick<OsScheduleDay, 'withoutPeriod' | 'ordersWithoutSla'>): string {
  const partes: string[] = []
  if (day.withoutPeriod > 0) {
    partes.push(
      `${formatNumber(day.withoutPeriod)} OS sem turno ${plural(day.withoutPeriod, 'fica', 'ficam')} fora dos turnos`,
    )
  }
  if (day.ordersWithoutSla > 0) {
    partes.push(
      `${formatNumber(day.ordersWithoutSla)} OS sem horas previstas ${plural(day.ordersWithoutSla, 'pesa', 'pesam')} zero`,
    )
  }

  return partes.join(' · ')
}

export type CategoryLine = {
  readonly id: string
  readonly name: string
  readonly serviceType: string
  readonly aptTechnicians: number
  /** OS da própria categoria neste turno. */
  readonly scheduled: number
}

export type FittingLine = CategoryLine & {
  readonly slaHours: number | null
  /** Quantas OS a mais a categoria recebe no turno; nula sem horas previstas. */
  readonly fits: number | null
}

export type ShiftDetail = {
  readonly selection: ShiftSelection
  readonly kind: OsScheduleDayKind
  readonly title: string
  readonly summary: string
  /** Cheias pela grade do SGI: mais uma OS não cabe. */
  readonly refused: readonly CategoryLine[]
  /** As demais, da que está mais perto de encher à mais folgada. */
  readonly fitting: readonly FittingLine[]
  /** Infra e auditoria: a grade nunca as recusa, por regra do SGI. */
  readonly alwaysAccepted: readonly CategoryLine[]
  /** Num dia passado, o que foi feito por categoria, da maior para a menor. */
  readonly realized: readonly CategoryLine[]
  readonly note: string | null
}

/**
 * Tipos de categoria que a grade de datas do SGI nunca recusa (regra do
 * serviço, §8 da memória de cálculo do SGI). Os rótulos são os do catálogo
 * do serviço (`os_catalog.py`), os mesmos que a Visão Geral de OS usa.
 */
export const ALWAYS_ACCEPTED_TYPES: readonly string[] = ['Infraestrutura', 'Auditoria']

/**
 * Quantas OS a mais cabem: a sobra dos aptos dividida pelas horas de uma OS.
 * A tolerância de um bilionésimo de hora é a mesma com que o serviço decide
 * `full`, para a categoria que ele diz "não cheia" nunca sair com zero aqui.
 */
export function fitsInShift(capacityHours: number, consumedHours: number, slaHours: number | null): number | null {
  if (slaHours === null || slaHours <= 0 || capacityHours <= 0) return null

  // O 1e-9 também absorve o erro de ponto flutuante da subtração: 9,6 menos
  // 3,2 dá 6,3999999999999995 em JavaScript, e sem ele o floor cairia para
  // 1 onde cabem 2.
  return Math.max(0, Math.floor((capacityHours - consumedHours + 1e-9) / slaHours))
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR')

/** O detalhe do turno escolhido, ou nulo quando a leitura não o cobre. */
export function buildShiftDetail(source: OsScheduleSource, selection: ShiftSelection | null): ShiftDetail | null {
  if (selection === null) return null
  const day = source.days.find((item) => item.day === selection.iso)
  const period = day?.periods.find((item) => item.periodKey === selection.periodKey)
  if (day === undefined || period === undefined) return null

  const refused: CategoryLine[] = []
  const fitting: FittingLine[] = []
  const alwaysAccepted: CategoryLine[] = []
  const realized: CategoryLine[] = []
  for (const category of day.categories) {
    const cell = category.periods.find((item) => item.periodKey === period.periodKey)
    if (cell === undefined) continue
    const line: CategoryLine = {
      id: category.id,
      name: category.name,
      serviceType: category.serviceType,
      aptTechnicians: category.aptTechnicians,
      scheduled: cell.scheduled,
    }
    if (day.kind === 'past') {
      if (cell.scheduled > 0) realized.push(line)
      continue
    }
    if (cell.full) {
      refused.push(line)
    } else if (ALWAYS_ACCEPTED_TYPES.includes(category.serviceType)) {
      alwaysAccepted.push(line)
    } else {
      fitting.push({
        ...line,
        slaHours: category.slaHours,
        fits: fitsInShift(cell.capacityHours, cell.consumedHours, category.slaHours),
      })
    }
  }
  fitting.sort(
    (a, b) => (a.fits ?? Number.POSITIVE_INFINITY) - (b.fits ?? Number.POSITIVE_INFINITY) || byName(a, b),
  )
  realized.sort((a, b) => b.scheduled - a.scheduled || byName(a, b))

  const past = day.kind === 'past'
  const rule = periodRules(source).get(period.periodKey)
  const cutoff = shiftCutoff(day.kind, rule, isoHour(source.generatedAt))
  const scheduledText = `${formatNumber(period.scheduled)} OS ${
    past ? plural(period.scheduled, 'realizada', 'realizadas') : plural(period.scheduled, 'marcada', 'marcadas')
  }`
  const capacity = period.operation.capacityHours
  const hoursText =
    capacity === null || capacity <= 0
      ? `${formatHours(period.consumedHours)} previstas`
      : `${formatHours(period.consumedHours)} de ${formatHours(capacity)}`
  const presence =
    presenceText(period.operation.technicians, day.presenceBasis, day.day, source.historyDays) ??
    presenceBasisText(null, day.day)
  const notes = [
    day.closed ? 'Feriado no cadastro do SGI: a grade não oferece o dia' : null,
    cutoff
      ? rule?.limitHour == null
        ? 'O SGI já fechou o agendamento de hoje neste turno'
        : `O SGI fechou o agendamento de hoje neste turno às ${rule.limitHour}h`
      : null,
    day.closedTeams.length > 0 ? `Rota fechada: ${day.closedTeams.join(', ')}` : null,
    uncountedNote(day) || null,
    alwaysAccepted.length > 0
      ? 'Infraestrutura e auditoria entram no consumo, mas a grade do SGI nunca as recusa'
      : null,
  ].filter((parte): parte is string => parte !== null)

  return {
    selection,
    kind: day.kind,
    title: detailTitle(day.day, period.period, source.today),
    summary: [
      `${scheduledText}, ${hoursText}`,
      presence,
      past
        ? 'o realizado, por categoria'
        : 'pela grade do SGI, capacidade só dos técnicos aptos em cada categoria, entre as categorias com OS no dia',
    ].join(' · '),
    refused,
    fitting,
    alwaysAccepted,
    realized,
    note: notes.length === 0 ? null : notes.join(' · '),
  }
}

/**
 * O cadastro de aptidões que distorce a conta do SGI: só as categorias em que
 * alguém executa sem estar cadastrado, ou que não têm nenhum técnico apto. O
 * serviço já ordena pelo que mais distorce.
 */
export function buildRegistryRows(source: OsScheduleSource): OsScheduleRegistryRow[] {
  return source.registry.filter((row) => row.executedWithoutCapability > 0 || row.aptTechnicians === 0)
}

/** O que a coluna Equipe escreve para o técnico que não está em nenhuma. */
export const NO_TEAM_LABEL = 'Sem equipe'

/** Uma linha da janela do cadastro: um técnico numa categoria que ele executa sem aptidão. */
export type RegistryLine = {
  readonly key: string
  readonly technician: string
  readonly teams: string
  readonly category: string
  readonly serviceType: string
  /** OS da categoria que ele concluiu ou teve improdutiva no período. */
  readonly orders: number
  readonly status: 'Ativo' | 'Inativo'
  readonly aptTechnicians: number
}

/**
 * A lista que o gestor de cada equipe corrige no SGI (Mário, 19/10/2026: quem
 * corrige o cadastro são os gestores): uma linha por técnico e categoria, do
 * que mais executou sem aptidão ao que menos. Equipe vem por extenso para a
 * coluna filtrar; técnico sem equipe diz isso, em vez de ficar vazio.
 */
export function buildRegistryLines(source: OsScheduleSource): RegistryLine[] {
  return buildRegistryRows(source)
    .flatMap((row) =>
      row.technicians.map(
        (technician): RegistryLine => ({
          key: `${row.id}:${technician.id}`,
          technician: technician.name,
          teams: technician.teams.length === 0 ? NO_TEAM_LABEL : technician.teams.join(', '),
          category: row.name,
          serviceType: row.serviceType,
          orders: technician.orders,
          status: technician.active ? 'Ativo' : 'Inativo',
          aptTechnicians: row.aptTechnicians,
        }),
      ),
    )
    .sort(
      (a, b) =>
        b.orders - a.orders ||
        a.technician.localeCompare(b.technician, 'pt-BR') ||
        a.category.localeCompare(b.category, 'pt-BR'),
    )
}
