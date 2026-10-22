import type {
  OsScheduleClosure,
  OsScheduleDay,
  OsScheduleDayKind,
  OsSchedulePeriodLoad,
  OsSchedulePeriodRule,
  OsScheduleRegistryRow,
  OsScheduleSource,
  OsScheduleWindow,
} from '../../data/api/osScheduleSource'
import { mondayOf, shiftISODate, weekdayNameOf, weekdayOf } from '../../data/isoDate'
import { formatClockMinutes, formatIsoClock, formatNumber } from '../../lib/formatters'

/**
 * Modelo da página Agenda e capacidade, redesenhada como calendário em
 * 19/10/2026 (decisão do Mário sobre o mock em
 * `Docs/historico/capacidade/mock-agenda-calendario.html`): semanas em
 * linhas, de segunda a domingo, cada dia com os turnos do SGI, e a resposta
 * de cada turno em HORAS, porque cada categoria pesa o próprio tempo
 * previsto. A contagem de OS por categoria fica na janela que o clique abre.
 *
 * As contas de capacidade NÃO estão aqui: vivem no serviço (`os_schedule.py`
 * do impacto-bi-service), uma vez só, e a página recebe os números prontos.
 * O que mora aqui é apresentação: a grade de semanas, o estado de cada turno,
 * a resposta e a dica de cada turno, o resumo da semana em palavras e o que
 * a janela da agenda mostra (o turno ou o dia inteiro, por categoria).
 *
 * O que este arquivo congela, até o Mário decidir o contrário:
 *
 * - a capacidade é a da RÉGUA DO SGI (decisão do Mário, 20/10/2026): os
 *   técnicos ativos do cadastro naquele dia, menos as equipes com rota
 *   fechada, vezes as horas de um turno. É o número que o agendamento do SGI
 *   usa, e de amanhã em diante a sobra daqui bate com a dele. Até 20/10 a
 *   página usava os técnicos presentes (`operation`, que o serviço ainda
 *   manda). As OS que contam seguem o serviço: no dia de hoje, as concluídas
 *   continuam ocupando o turno, e o SGI as devolve;
 * - cheio é quando não cabe mais uma OS (regra do Mário, 19/10/2026): a
 *   sobra do turno é menor que a OS média dele (horas marcadas divididas
 *   pelas OS marcadas; com menos de 5 OS no turno, a média do dia), ou a
 *   ocupação chegou a 100%. Quase cheio de 85% até aí (o 85% segue
 *   provisório); abaixo, cabe;
 * - turno sem OS fica em cinza (confirmado pelo Mário em 19/10/2026) e, desde
 *   20/10/2026, escreve a capacidade inteira como livre ("74h livres");
 *   quantas categorias a grade do SGI recusa fica só na janela da agenda,
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
/**
 * Até quantas semanas antes da semana de hoje o calendário volta (Mário,
 * 20/10/2026): o bastante para conferir a régua contra o que foi feito, sem
 * deixar ninguém voltar um ano clicando. Para a frente não passa da semana
 * de hoje: "4 semanas" já mostra até onde a agenda tem OS marcadas.
 */
export const MAX_PAST_WEEKS = 8

/** A partir daqui o turno é "quase cheio" (provisório). */
export const OCCUPATION_ATTENTION = 0.85
/** A partir daqui a agenda chegou à capacidade: cheio, seja qual for a OS média. */
export const OCCUPATION_FULL = 1
/** Turno com menos OS do que isto usa a OS média do dia, para uma OS longa não distorcer. */
export const AVERAGE_MIN_ORDERS = 5

/**
 * A janela que a página pede ao serviço: as quatro semanas do calendário
 * (da segunda-feira da semana de hoje em diante, ou de `weekOffset` semanas
 * antes dela quando o calendário volta no tempo) mais uma semana antes e uma
 * depois. Sempre as quatro, para o atalho "4 semanas" não precisar de outra
 * leitura. A folga existe porque a janela sai do relógio de quem olha e o
 * calendário ancora no hoje do serviço: um dia de diferença entre os dois
 * (fuso, relógio errado, virada da meia-noite) não pode deixar uma semana
 * inteira fora da leitura. São 42 dias, abaixo dos 45 que o serviço aceita.
 */
export function scheduleWindow(today: string, weeks = EXPANDED_WEEKS, weekOffset = 0): OsScheduleWindow {
  const from = shiftISODate(mondayOf(today), 7 * (weekOffset - WINDOW_MARGIN_WEEKS))

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

/** O nome do atalho e da lista quando a janela abre o dia todo, e não um turno. */
export const WHOLE_DAY_LABEL = 'Dia inteiro'

/**
 * `Agenda de amanhã, sábado 17/10 · Manhã`, ou `Agenda de terça-feira 20/10 ·
 * Dia inteiro`: o título da janela que o clique no calendário abre. O turno,
 * ou o dia inteiro, vai no título porque a janela vai para o projetor sem o
 * calendário atrás, e é também o nome da planilha.
 */
export function agendaTitle(iso: string, periodLabel: string | null, today: string): string {
  const day = `${weekdayNameOf(iso)} ${shortDay(iso)}`
  const when = iso === today ? `hoje, ${day}` : iso === shiftISODate(today, 1) ? `amanhã, ${day}` : day

  return `Agenda de ${when} · ${periodLabel ?? WHOLE_DAY_LABEL}`
}

/** A hora de um texto ISO com hora (`2026-10-16T14:32:00-03:00` dá 14); nula sem hora. */
export function isoHour(iso: string): number | null {
  const match = /T(\d{2}):/.exec(iso)

  return match === null ? null : Number(match[1])
}

/**
 * Os técnicos da conta, por extenso, para a dica do dia e a janela da
 * agenda: `42 técnicos ativos no cadastro do SGI`. No passado, o cadastro é o
 * daquele dia pela data de criação e de exclusão; a inativação não tem data
 * no SGI e segue o cadastro de hoje, e a frase avisa. Com rota fechada, diz
 * que as equipes dela já saíram da conta. Nulo sem o número.
 */
export function techniciansText(
  technicians: number | null,
  kind: OsScheduleDayKind,
  closedTeams: readonly string[] = [],
): string | null {
  if (technicians === null) return null
  const base = `${formatNumber(technicians)} ${plural(technicians, 'técnico ativo', 'técnicos ativos')} no cadastro do SGI`
  const parts = [
    kind === 'past' ? `${base} nesse dia (inativações não têm data e seguem o cadastro atual)` : base,
    // No passado a rota travada não tira a equipe da conta: ela trabalhou.
    kind !== 'past' && closedTeams.length > 0 ? 'sem as equipes com rota travada' : null,
  ]

  return parts.filter((part): part is string => part !== null).join(', ')
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
 * pela ocupação na régua do SGI.
 */
export function shiftState(
  period: Pick<OsSchedulePeriodLoad, 'scheduled' | 'consumedHours' | 'scheduler'>,
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
  if (period.scheduler.technicians === 0) return 'nobody'
  const capacity = period.scheduler.capacityHours

  return occupationState(
    period.scheduler.occupation,
    capacity === null ? null : capacity - period.consumedHours,
    orderHours,
  )
}

export function shiftTone(state: ShiftState): ShiftTone {
  if (state === 'nobody') return 'over'

  return state === 'ok' || state === 'attention' || state === 'over' ? state : 'muted'
}

/**
 * Um pedaço da resposta do turno, com o papel que decide o desenho: `hours`
 * é o número em destaque, `qualifier` a palavra pequena na cor do estado
 * ("só", "excedeu"), `unit` a palavra pequena em cinza ("livres") e `word` a
 * resposta que é só palavra ("Cheio", "Realizado").
 */
export type AnswerPart = { readonly text: string; readonly kind: 'hours' | 'qualifier' | 'unit' | 'word' }

const word = (text: string): AnswerPart[] => [{ text, kind: 'word' }]
const freeHours = (hours: string, few = false): AnswerPart[] => [
  ...(few ? [{ text: 'só', kind: 'qualifier' as const }] : []),
  { text: hours, kind: 'hours' },
  { text: 'livres', kind: 'unit' },
]

/**
 * A resposta do turno, embaixo da barra (Mário, 20/10/2026, rodada 9 das
 * prévias): o que importa a quem agenda é quantas horas ainda dá para
 * marcar, então elas são o número mais forte do turno, "53h48 livres". A
 * palavra é "livres", e não "disponíveis", que no card de hoje já fala dos
 * técnicos, nem "para agendar", que não cabe na coluna do notebook. Turno sem
 * nada marcado escreve a capacidade inteira como livre. Cheio pela OS média
 * diz só "Cheio": a sobra menor que uma OS vai para a dica do mouse.
 */
export function shiftAnswer(
  state: ShiftState,
  consumedHours: number,
  capacityHours: number | null,
  limitHour: number | null = null,
): AnswerPart[] {
  const capacity = capacityHours ?? 0
  switch (state) {
    case 'past':
      return word('Realizado')
    case 'free':
      // Sem OS e sem ninguém previsto no turno (a tarde de sábado, quase
      // sempre), não há hora livre para oferecer: "Livre" pareceria folga.
      if (capacityHours === 0) return word('Sem técnico previsto')

      return capacity > 0 ? freeHours(formatHours(capacity)) : word('Livre')
    case 'closed':
      // O dia todo fechado no cadastro de feriados do SGI: feriado de
      // calendário ou trava de chuva e barramento. O selo do dia diz qual.
      return word('Fechado')
    case 'cutoff':
      return word(limitHour === null ? 'Fechado para hoje' : `Fechado às ${limitHour}h`)
    case 'nobody':
      return word('Sem técnico previsto')
    case 'unknown':
      return word('Sem estimativa')
    case 'ok':
      return freeHours(formatHours(capacity - consumedHours))
    case 'attention': {
      const left = formatHours(Math.max(capacity - consumedHours, 0))

      return left === ZERO_HOURS ? word('Quase cheio') : freeHours(left, true)
    }
    case 'over': {
      const beyond = formatHours(Math.max(consumedHours - capacity, 0))

      return beyond === ZERO_HOURS
        ? word('Cheio')
        : [
            { text: 'excedeu', kind: 'qualifier' },
            { text: beyond, kind: 'hours' },
          ]
    }
  }
}

/** A resposta por extenso, para os testes e para o leitor de tela. */
export function answerText(parts: readonly AnswerPart[]): string {
  return parts.map((part) => part.text).join(' ')
}

/**
 * A ocupação em porcentagem inteira, a mesma na barra e na dica. Abaixo de
 * 100% arredonda para baixo: 99,6% com tempo sobrando não pode aparecer como
 * "100%" (revisão de 20/10/2026). De 100% para cima, o arredondamento comum.
 * O `formatPercent` do portal não serve aqui porque sempre escreve uma casa
 * ("78,1%"), e o card aprovado mostra o número inteiro. O bilionésimo absorve
 * o erro de ponto flutuante (0,57 vezes 100 dá 56,99999...).
 */
export function occupationPercent(occupation: number | null): number | null {
  if (occupation === null || !Number.isFinite(occupation)) return null
  const percent = occupation * 100

  return Math.max(0, occupation < OCCUPATION_FULL ? Math.floor(percent + 1e-9) : Math.round(percent))
}

/**
 * A dica de mouse do turno: `97h30 marcadas de 124h48 de capacidade (78%)`,
 * com a ocupação que o serviço calcula. No cheio pela OS média, diz quanto
 * ainda sobra e por que não cabe, já que a resposta embaixo da barra escreve
 * só "Cheio". A OS média pode ser a do dia, quando o turno tem poucas OS,
 * então a frase não diz de onde ela vem.
 */
export function shiftTooltip(
  state: ShiftState,
  consumedHours: number,
  capacityHours: number | null,
  occupation: number | null,
  orderHours: number | null,
): string {
  const verb = state === 'past' ? 'realizadas' : 'marcadas'
  const done = `${formatHours(consumedHours)} ${verb}`
  if (capacityHours === null) return `${done}, sem estimativa de capacidade`
  if (capacityHours <= 0) return `${done}, nenhum técnico previsto`
  const percent = occupationPercent(occupation ?? consumedHours / capacityHours)
  const base = `${done} de ${formatHours(capacityHours)} de capacidade (${formatNumber(percent ?? 0)}%)`
  const left = formatHours(Math.max(capacityHours - consumedHours, 0))
  if (state === 'over' && consumedHours <= capacityHours && left !== ZERO_HOURS && orderHours !== null) {
    const order = formatHours(orderHours)

    return `${base}. Sobram ${left}, menos que uma OS média${order === left ? '' : ` (${order})`}`
  }

  return base
}

/** Largura da barra, de 0 a 100: a ocupação acima de 100% enche a barra inteira. */
export function fillPercent(occupation: number | null): number {
  return Math.min(100, occupationPercent(occupation) ?? 0)
}

/** `78%` dentro da barra; sem capacidade (sem estimativa, ninguém previsto), as horas marcadas. */
export function barText(consumedHours: number, capacityHours: number | null, occupation: number | null): string {
  if (capacityHours === null || capacityHours <= 0) return formatHours(consumedHours)

  return `${formatNumber(occupationPercent(occupation ?? consumedHours / capacityHours) ?? 0)}%`
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
  /** Capacidade pela régua do SGI (ativos do cadastro); nula sem estimativa. */
  readonly capacityHours: number | null
  readonly occupation: number | null
  /** A resposta embaixo da barra: as horas livres, ou a palavra do estado. */
  readonly answer: readonly AnswerPart[]
  /**
   * O que a barra escreve dentro: a ocupação, "78%" (Mário, 20/10/2026, na
   * rodada 10 das prévias), porque as horas livres já vão embaixo e a
   * capacidade no canto; as horas marcadas ficam na dica. Sem capacidade
   * para dividir, as horas marcadas.
   */
  readonly barText: string
  /** `124h48`, a capacidade no canto do turno; nula sem estimativa. */
  readonly capacity: string | null
  readonly tooltip: string
  readonly fillPercent: number
}

function toShift(
  day: OsScheduleDay,
  period: OsSchedulePeriodLoad,
  rule: OsSchedulePeriodRule | undefined,
  readHour: number | null,
): ShiftCell {
  const orderHours = averageOrderHours(period, day.periods)
  const state = shiftState(period, day.kind, day.closed, shiftCutoff(day.kind, rule, readHour), orderHours)
  const { capacityHours, occupation } = period.scheduler

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
    occupation,
    answer: shiftAnswer(state, period.consumedHours, capacityHours, rule?.limitHour ?? null),
    barText: barText(period.consumedHours, capacityHours, occupation),
    capacity: capacityHours === null || capacityHours <= 0 ? null : formatHours(capacityHours),
    tooltip: shiftTooltip(state, period.consumedHours, capacityHours, occupation, orderHours),
    fillPercent: state === 'nobody' ? 100 : fillPercent(occupation),
  }
}

/** O grupo do SGI que reúne os feriados de calendário. */
export const SYSTEM_HOLIDAYS_GROUP = 'Fixos (padrão do sistema)'

/**
 * O selo do dia (20/10/2026, prévia v12): feriado de calendário ou trava de
 * rota, com o nome que o gestor cadastrou no SGI. `locked` desenha o
 * cadeado: rota travada e dia todo travado levam, feriado do calendário não.
 * `title` é o texto inteiro, para a dica de mouse e o leitor de tela.
 */
export type DayLock = { readonly label: string; readonly title: string; readonly locked: boolean }

/** Nome todo em maiúsculas vira frase ("CHUVA INTENSA" dá "Chuva intensa"); o resto fica como veio. */
function sentenceCase(value: string): string {
  if (value !== value.toUpperCase() || value === value.toLowerCase()) return value
  const lower = value.toLowerCase()

  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/** O nome de um registro, com o do grupo quando o do dia veio vazio ou "-". */
function closureName(closure: OsScheduleClosure): string {
  const name = closure.name.trim()

  return name !== '' && name !== '-' ? name : closure.group.trim()
}

/**
 * Lê os registros do dia. O dia todo fechado vem primeiro, porque fecha
 * todas as rotas: feriado do calendário escreve "Feriado · Aparecida" (ou só
 * "Feriado" sem nome), sem cadeado; outro nome (chuva, barramento) leva o
 * cadeado e o nome. Sem fechamento geral, a rota travada leva o cadeado e só
 * as equipes, sem "Rota travada" na frente: na coluna do notebook a palavra
 * cortava o nome da equipe, e o cadeado já diz que é trava (regra aprovada
 * pelo Mário em 20/10/2026). Nulo sem registro no dia.
 */
export function dayLock(closures: readonly OsScheduleClosure[]): DayLock | null {
  if (closures.length === 0) return null
  const describe = (closure: OsScheduleClosure) => {
    const name = sentenceCase(closureName(closure)) || 'Sem nome'
    if (closure.teams.length > 0) return `${name}: rota travada para ${closure.teams.join(', ')}`
    if (closure.group === SYSTEM_HOLIDAYS_GROUP) return `Feriado do calendário do SGI: ${name}`

    return `${name}: dia todo fechado no SGI`
  }
  const title = closures.map(describe).join(' · ')
  const general = closures.find((closure) => closure.teams.length === 0)
  if (general !== undefined) {
    if (general.group === SYSTEM_HOLIDAYS_GROUP) {
      const own = general.name.trim()
      const holiday = own === '' || own === '-' ? '' : sentenceCase(own)

      return { label: holiday === '' ? 'Feriado' : `Feriado · ${holiday}`, title, locked: false }
    }
    const name = sentenceCase(closureName(general))

    return { label: name === '' ? 'Dia fechado' : name, title, locked: true }
  }
  const teams = [...new Set(closures.flatMap((closure) => closure.teams))]

  return { label: teams.join(', '), title, locked: true }
}

export type DayCell = {
  readonly iso: string
  readonly label: string
  readonly isToday: boolean
  /** Nulo quando a leitura não cobre o dia. */
  readonly kind: OsScheduleDayKind | null
  readonly closed: boolean
  readonly closedTeams: readonly string[]
  /** O selo de feriado ou de rota travada; nulo sem registro no dia. */
  readonly lock: DayLock | null
  /** Técnicos ativos na conta do SGI, e a frase da dica de mouse. */
  readonly technicians: number | null
  readonly techniciansText: string | null
  /**
   * Só no dia de hoje: o "Disponível" do Sumário do SGI, técnicos online e
   * com o botão de disponível ligado agora. Como no SGI, conta o cadastro
   * inteiro, inclusive equipe com rota fechada: nesse dia ele pode passar
   * do número de técnicos da conta. Nulo nos outros dias.
   */
  readonly availableNow: number | null
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
  periodFilter: string | null,
  availableNow: number,
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
      lock: null,
      technicians: null,
      techniciansText: null,
      availableNow: null,
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
    lock: dayLock(day.closures),
    technicians: day.scheduler.technicians,
    techniciansText: techniciansText(day.scheduler.technicians, day.kind, day.closedTeams),
    availableNow: isToday ? availableNow : null,
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

/**
 * `Semana passada, 12/10 a 18/10`, `Esta semana, ...`, `Próxima semana, ...`
 * e, mais longe para os dois lados, `Semana de ...`. `index` conta a partir
 * da semana de hoje: 0 é esta, -1 a passada, 1 a próxima.
 */
export function weekTitle(index: number, start: string, end: string): string {
  const range = `${shortDay(start)} a ${shortDay(end)}`
  if (index === -1) return `Semana passada, ${range}`
  if (index === 0) return `Esta semana, ${range}`
  if (index === 1) return `Próxima semana, ${range}`

  return `Semana de ${range}`
}

function periodRules(source: OsScheduleSource): PeriodRules {
  return new Map(source.parameters.periods.map((rule) => [rule.key, rule]))
}

/**
 * As semanas do calendário, da segunda-feira da semana de hoje (o hoje do
 * serviço) em diante, ou de `weekOffset` semanas antes dela. `periodFilter`
 * é o filtro de turno da faixa de filtros: nulo mostra todos.
 */
export function buildCalendar(
  source: OsScheduleSource,
  weeks: number,
  periodFilter: string | null = null,
  weekOffset = 0,
): CalendarWeek[] {
  const byIso = new Map(source.days.map((day) => [day.day, day]))
  const rules = periodRules(source)
  const readHour = isoHour(source.generatedAt)
  const start = shiftISODate(mondayOf(source.today), weekOffset * 7)

  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = shiftISODate(start, index * 7)
    const weekEnd = shiftISODate(weekStart, 6)

    return {
      start: weekStart,
      end: weekEnd,
      title: weekTitle(weekOffset + index, weekStart, weekEnd),
      days: Array.from({ length: 7 }, (_, offset) => {
        const iso = shiftISODate(weekStart, offset)

        return toDayCell(
          iso,
          byIso.get(iso) ?? null,
          source.today,
          rules,
          readHour,
          periodFilter,
          source.parameters.availableNow,
        )
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
 * nenhuma) e quantos turnos ainda cabem, estão quase cheios ou cheios. As
 * horas somam os turnos
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
    segments.push({ text: formatHours(hoursOf(past)), emphasis: true }, txt(ahead.length > 0 ? ' realizadas até ontem' : ' realizadas'))
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
  /** As horas previstas de uma OS da categoria; nula sem SLA no cadastro. */
  readonly slaHours: number | null
  /** OS da própria categoria neste turno. */
  readonly scheduled: number
}

export type FittingLine = CategoryLine & {
  /** Quantas OS a mais a categoria recebe no turno; nula sem horas previstas. */
  readonly fits: number | null
}

export type ShiftDetail = {
  readonly selection: ShiftSelection
  readonly kind: OsScheduleDayKind
  /** Cheias pela grade do SGI: mais uma OS não cabe. */
  readonly refused: readonly CategoryLine[]
  /** As demais, da que está mais perto de encher à mais folgada. */
  readonly fitting: readonly FittingLine[]
  /** Infra e auditoria: a grade nunca as recusa, por regra do SGI. */
  readonly alwaysAccepted: readonly CategoryLine[]
  /** Num dia passado, o que foi feito por categoria, da maior para a menor. */
  readonly realized: readonly CategoryLine[]
  /**
   * O SGI não oferece mais o turno (dia fechado no cadastro de feriados, ou
   * hoje depois da hora limite): nenhuma categoria cabe, seja qual for a
   * sobra (Mário, 21/10/2026). As listas de cima ficam vazias.
   */
  readonly closed: boolean
  /** Com o turno fechado, as categorias com OS no dia, da que tem mais OS no turno à que tem menos. */
  readonly closedLines: readonly CategoryLine[]
  readonly note: string | null
}

/**
 * O turno que a grade do SGI não oferece mais para agendar: o dia fechado no
 * cadastro de feriados, ou o turno de hoje lido depois da hora limite. O
 * passado não entra: ele responde pelo realizado.
 */
function periodClosed(day: OsScheduleDay, rule: OsSchedulePeriodRule | undefined, readHour: number | null): boolean {
  return day.kind !== 'past' && (day.closed || shiftCutoff(day.kind, rule, readHour))
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

/** As categorias de um turno, para a janela da agenda; nulo quando a leitura não cobre o turno. */
export function buildShiftDetail(source: OsScheduleSource, selection: ShiftSelection): ShiftDetail | null {
  const day = source.days.find((item) => item.day === selection.iso)
  const period = day?.periods.find((item) => item.periodKey === selection.periodKey)
  if (day === undefined || period === undefined) return null

  const closed = periodClosed(day, periodRules(source).get(period.periodKey), isoHour(source.generatedAt))
  const refused: CategoryLine[] = []
  const fitting: FittingLine[] = []
  const alwaysAccepted: CategoryLine[] = []
  const realized: CategoryLine[] = []
  const closedLines: CategoryLine[] = []
  for (const category of day.categories) {
    const cell = category.periods.find((item) => item.periodKey === period.periodKey)
    if (cell === undefined) continue
    const line: CategoryLine = {
      id: category.id,
      name: category.name,
      serviceType: category.serviceType,
      aptTechnicians: category.aptTechnicians,
      slaHours: category.slaHours,
      scheduled: cell.scheduled,
    }
    if (day.kind === 'past') {
      if (cell.scheduled > 0) realized.push(line)
      continue
    }
    if (closed) {
      closedLines.push(line)
      continue
    }
    if (cell.full) {
      refused.push(line)
    } else if (ALWAYS_ACCEPTED_TYPES.includes(category.serviceType)) {
      alwaysAccepted.push(line)
    } else {
      fitting.push({
        ...line,
        fits: fitsInShift(cell.capacityHours, cell.consumedHours, category.slaHours),
      })
    }
  }
  fitting.sort(
    (a, b) => (a.fits ?? Number.POSITIVE_INFINITY) - (b.fits ?? Number.POSITIVE_INFINITY) || byName(a, b),
  )
  realized.sort((a, b) => b.scheduled - a.scheduled || byName(a, b))
  closedLines.sort((a, b) => b.scheduled - a.scheduled || byName(a, b))

  return {
    selection,
    kind: day.kind,
    refused,
    fitting,
    alwaysAccepted,
    realized,
    closed,
    closedLines,
    note: agendaNote(source, day, period.periodKey, alwaysAccepted.length > 0),
  }
}

/** ` às 11h`, a hora limite do turno no SGI; vazio sem ela. */
function limitText(rule: OsSchedulePeriodRule): string {
  return rule.limitHour === null ? '' : ` às ${rule.limitHour}h`
}

/**
 * O que a conta deixa de fora ou o SGI fecha, por extenso, no pé das
 * categorias: o dia fechado no cadastro de feriados, o turno de hoje depois
 * da hora limite, a rota travada, as OS sem turno ou sem horas previstas, e
 * infra e auditoria, que a grade nunca recusa. `periodKey` nulo é o dia
 * inteiro. Nulo sem nada a avisar.
 */
function agendaNote(
  source: OsScheduleSource,
  day: OsScheduleDay,
  periodKey: string | null,
  alwaysAccepted: boolean,
): string | null {
  const readHour = isoHour(source.generatedAt)
  const cut = source.parameters.periods.filter(
    (rule) => (periodKey === null || rule.key === periodKey) && shiftCutoff(day.kind, rule, readHour),
  )
  const cutoff =
    cut.length === 0
      ? null
      : periodKey === null
        ? `O SGI fechou o agendamento de hoje: ${cut.map((rule) => `${rule.label.toLowerCase()}${limitText(rule)}`).join(' e ')}`
        : `O SGI fechou o agendamento de hoje neste turno${limitText(cut[0])}`
  const notes = [
    day.closed ? 'Dia fechado no cadastro de feriados do SGI: a grade não oferece o dia' : null,
    cutoff,
    day.closedTeams.length > 0
      ? day.kind === 'past'
        ? `Rota travada: ${day.closedTeams.join(', ')} (a equipe trabalhou e conta na capacidade)`
        : `Rota travada: ${day.closedTeams.join(', ')}`
      : null,
    uncountedNote(day) || null,
    alwaysAccepted ? 'Infraestrutura e auditoria entram no consumo, mas a grade do SGI nunca as recusa' : null,
  ].filter((parte): parte is string => parte !== null)

  return notes.length === 0 ? null : notes.join(' · ')
}

/** `46 OS marcadas`, ou `75 OS realizadas` num dia que já passou. */
function ordersCountText(count: number, kind: OsScheduleDayKind): string {
  const word = kind === 'past' ? plural(count, 'realizada', 'realizadas') : plural(count, 'marcada', 'marcadas')

  return `${formatNumber(count)} OS ${word}`
}

/** `60h de 67h12` com capacidade; `60h previstas` sem ela. */
function hoursOfCapacityText(consumed: number, capacity: number | null): string {
  return capacity === null || capacity <= 0
    ? `${formatHours(consumed)} previstas`
    : `${formatHours(consumed)} de ${formatHours(capacity)}`
}

/** O que a janela da agenda abre: um turno de um dia, ou o dia inteiro (`periodKey` nulo). */
export type AgendaSelection = { readonly iso: string; readonly periodKey: string | null }

/** Identidade da seleção em texto: marca o atalho aceso e remonta a lista ao trocar. */
export function agendaSelectionKey(selection: AgendaSelection): string {
  return `${selection.iso}|${selection.periodKey ?? 'dia'}`
}

/** Um atalho no topo da janela: o dia inteiro ou um turno, com quantas OS o calendário conta nele. */
export type AgendaChip = { readonly selection: AgendaSelection; readonly label: string; readonly count: number }

/** Uma categoria num turno, na janela do dia inteiro. */
export type DayCategoryCell = {
  readonly periodKey: string
  readonly period: string
  /** OS da categoria no turno: marcadas, ou realizadas no passado. */
  readonly scheduled: number
  /**
   * O que a grade do SGI faz com mais uma OS dela no turno; `realized` no
   * passado e `closed` no turno que o SGI não oferece mais.
   */
  readonly answer: 'refused' | 'fits' | 'always' | 'realized' | 'closed'
  /** Quantas OS a mais cabem, só quando cabe; nula sem horas previstas. */
  readonly fits: number | null
}

/** Uma categoria do dia inteiro, com a resposta de cada turno. */
export type DayCategoryLine = CategoryLine & { readonly cells: readonly DayCategoryCell[] }

/**
 * As categorias do dia inteiro, uma linha por categoria com os turnos lado a
 * lado. Hoje e no futuro, primeiro as que o SGI recusa em mais turnos, depois
 * as que cabem, da mais perto de encher à mais folgada, e infra e auditoria no
 * fim; no passado, o realizado, da maior para a menor. `closedPeriods` são os
 * turnos que o SGI não oferece mais (dia fechado, ou hoje depois da hora
 * limite): neles toda categoria responde "Fechado", e com todos fechados a
 * ordem é a das OS marcadas.
 */
export function buildDayLines(day: OsScheduleDay, closedPeriods: ReadonlySet<string> = new Set()): DayCategoryLine[] {
  const past = day.kind === 'past'
  const lines = day.categories.map((category): DayCategoryLine => {
    const always = ALWAYS_ACCEPTED_TYPES.includes(category.serviceType)

    return {
      id: category.id,
      name: category.name,
      serviceType: category.serviceType,
      aptTechnicians: category.aptTechnicians,
      slaHours: category.slaHours,
      scheduled: category.scheduled,
      cells: category.periods.map((cell): DayCategoryCell => {
        const answer = past
          ? 'realized'
          : closedPeriods.has(cell.periodKey)
            ? 'closed'
            : cell.full
              ? 'refused'
              : always
                ? 'always'
                : 'fits'

        return {
          periodKey: cell.periodKey,
          period: cell.period,
          scheduled: cell.scheduled,
          answer,
          fits: answer === 'fits' ? fitsInShift(cell.capacityHours, cell.consumedHours, category.slaHours) : null,
        }
      }),
    }
  })
  if (past) return lines.filter((line) => line.scheduled > 0).sort((a, b) => b.scheduled - a.scheduled || byName(a, b))
  if (lines.every((line) => line.cells.every((cell) => cell.answer === 'closed'))) {
    return lines.sort((a, b) => b.scheduled - a.scheduled || byName(a, b))
  }

  const refusedIn = (line: DayCategoryLine) => line.cells.filter((cell) => cell.answer === 'refused').length
  const alwaysRank = (line: DayCategoryLine) => (line.cells.some((cell) => cell.answer === 'always') ? 1 : 0)
  const fewest = (line: DayCategoryLine) =>
    Math.min(...line.cells.map((cell) => cell.fits ?? Number.POSITIVE_INFINITY))

  return lines.sort(
    (a, b) => refusedIn(b) - refusedIn(a) || alwaysRank(a) - alwaysRank(b) || fewest(a) - fewest(b) || byName(a, b),
  )
}

/** Tudo o que a janela da agenda mostra além da lista de OS. */
export type AgendaDialog = {
  readonly selection: AgendaSelection
  readonly kind: OsScheduleDayKind
  readonly title: string
  /** O turno, ou "Dia inteiro": o nome da lista e da planilha. */
  readonly label: string
  /** A linha de contexto: OS, horas, resposta do turno, técnicos e hora da leitura. */
  readonly description: string
  readonly chips: readonly AgendaChip[]
  /** As OS que a lista deve trazer: o número do turno, ou do dia, no calendário. */
  readonly expected: number
  /** O turno escolhido, por categoria; nulo no dia inteiro. */
  readonly shift: ShiftDetail | null
  /** O dia inteiro por categoria; vazio quando a janela abre um turno. */
  readonly dayLines: readonly DayCategoryLine[]
  /** Quantas categorias a aba Categorias mostra: o número ao lado do nome dela. */
  readonly categoryCount: number
  readonly note: string | null
}

/** As linhas que o turno mostra: o realizado, o fechado, ou o que recusa e o que cabe. */
function shiftCategoryCount(shift: ShiftDetail): number {
  if (shift.kind === 'past') return shift.realized.length
  if (shift.closed) return shift.closedLines.length

  return shift.refused.length + shift.fitting.length + shift.alwaysAccepted.length
}

/**
 * A janela que o clique no calendário abre (21/10/2026, no lugar do detalhe
 * embaixo do calendário): o turno clicado ou, pelo nome do dia, o dia
 * inteiro. Os atalhos e o número esperado da lista são os do calendário, da
 * mesma leitura; a lista em si vem do serviço quando a janela abre. Nulo
 * quando a leitura não tem o dia ou o turno.
 */
export function buildAgendaDialog(source: OsScheduleSource, selection: AgendaSelection): AgendaDialog | null {
  const day = source.days.find((item) => item.day === selection.iso)
  if (day === undefined) return null
  const period =
    selection.periodKey === null ? null : day.periods.find((item) => item.periodKey === selection.periodKey)
  if (period === undefined) return null

  const readAt = formatIsoClock(source.generatedAt)
  const read = readAt === null ? 'agenda do SGI' : `agenda do SGI lida às ${readAt}`
  const chips: AgendaChip[] = [
    { selection: { iso: day.day, periodKey: null }, label: WHOLE_DAY_LABEL, count: day.scheduled },
    ...day.periods.map((item) => ({
      selection: { iso: day.day, periodKey: item.periodKey },
      label: item.period,
      count: item.scheduled,
    })),
  ]
  const gauge = period === null ? day.scheduler : period.scheduler
  const technicians =
    techniciansText(gauge.technicians, day.kind, day.closedTeams) ?? 'sem o número de técnicos ativos'

  if (period === null) {
    const rules = periodRules(source)
    const readHour = isoHour(source.generatedAt)
    const closedPeriods = new Set(
      day.periods.filter((item) => periodClosed(day, rules.get(item.periodKey), readHour)).map((item) => item.periodKey),
    )
    const dayLines = buildDayLines(day, closedPeriods)

    return {
      selection,
      kind: day.kind,
      title: agendaTitle(day.day, null, source.today),
      label: WHOLE_DAY_LABEL,
      description: [
        `${ordersCountText(day.scheduled, day.kind)}, ${hoursOfCapacityText(day.consumedHours, gauge.capacityHours)}`,
        technicians,
        read,
      ].join(' · '),
      chips,
      expected: day.scheduled,
      shift: null,
      dayLines,
      categoryCount: dayLines.length,
      note: agendaNote(
        source,
        day,
        null,
        dayLines.some((line) => line.cells.some((cell) => cell.answer === 'always')),
      ),
    }
  }

  const shift = buildShiftDetail(source, { iso: day.day, periodKey: period.periodKey })
  const answer = toShift(day, period, periodRules(source).get(period.periodKey), isoHour(source.generatedAt)).answer

  return {
    selection,
    kind: day.kind,
    title: agendaTitle(day.day, period.period, source.today),
    label: period.period,
    description: [
      `${ordersCountText(period.scheduled, day.kind)}, ${hoursOfCapacityText(period.consumedHours, gauge.capacityHours)}`,
      // O realizado não tem resposta para quem agenda: o número já diz "realizadas".
      day.kind === 'past' ? null : answerText(answer),
      technicians,
      read,
    ]
      .filter((parte): parte is string => parte !== null)
      .join(' · '),
    chips,
    expected: period.scheduled,
    shift,
    dayLines: [],
    categoryCount: shift === null ? 0 : shiftCategoryCount(shift),
    note: shift?.note ?? null,
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
