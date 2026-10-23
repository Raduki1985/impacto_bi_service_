import type {
  OsScheduleCategoryCalendarDay,
  OsScheduleCategoryCalendarPeriod,
  OsScheduleCategoryInfo,
  OsScheduleCategorySource,
  OsScheduleClosure,
  OsScheduleDay,
  OsScheduleDayKind,
  OsSchedulePeriodLoad,
  OsSchedulePeriodRule,
  OsScheduleRegistryRow,
  OsScheduleSource,
  OsScheduleWindow,
} from '../../data/api/osScheduleSource'
import { daysBetween, mondayOf, shiftISODate, weekdayNameOf, weekdayOf } from '../../data/isoDate'
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

/** A partir daqui o turno é "quase cheio" (provisório). */
export const OCCUPATION_ATTENTION = 0.85
/** A partir daqui a agenda chegou à capacidade: cheio, seja qual for a OS média. */
export const OCCUPATION_FULL = 1
/** Turno com menos OS do que isto usa a OS média do dia, para uma OS longa não distorcer. */
export const AVERAGE_MIN_ORDERS = 5

/**
 * A janela que a página pede ao serviço: as quatro semanas do calendário
 * (da segunda-feira da semana de hoje, ou de `weekOffset` semanas depois
 * dela quando o calendário avança) mais uma semana antes e uma depois.
 * Sempre as quatro, para o atalho "4 semanas" não precisar de outra
 * leitura. A folga existe porque a janela sai do relógio de quem olha e o
 * calendário ancora no hoje do serviço: um dia de diferença entre os dois
 * (fuso, relógio errado, virada da meia-noite) não pode deixar uma semana
 * inteira fora da leitura. São 42 dias, abaixo dos 45 que o serviço aceita.
 */
export function scheduleWindow(today: string, weeks = EXPANDED_WEEKS, weekOffset = 0): OsScheduleWindow {
  const from = shiftISODate(mondayOf(today), 7 * (weekOffset - WINDOW_MARGIN_WEEKS))

  return { from, to: shiftISODate(from, (weeks + 2 * WINDOW_MARGIN_WEEKS) * 7 - 1) }
}

/** Há OS marcada (com ou sem turno) em algum dia da leitura depois deste. */
export function hasScheduledAfter(source: Pick<OsScheduleSource, 'days'>, iso: string): boolean {
  return source.days.some((day) => day.day > iso && day.scheduled > 0)
}

/**
 * A seta que avança uma semana (Mário, 22/10/2026: a agenda é de hoje em
 * diante, "avançável até onde houver coisa agendada"; até ali as setas
 * voltavam até oito semanas e não passavam da semana de hoje). Ela anda
 * enquanto houver OS marcada depois da PRIMEIRA semana da tela: avançar
 * tira só essa semana, e a última OS marcada termina na primeira linha.
 *
 * Medir depois da primeira semana, e não depois do último dia na tela, dá o
 * mesmo alcance com 2 e com 4 semanas: a leitura vai uma semana além das
 * quatro do calendário (`scheduleWindow`), então enxerga quatro semanas
 * depois da primeira linha nos dois atalhos (revisor de dados, 22/10/2026:
 * medindo pelo último dia, com 4 semanas a seta parava numa semana vazia
 * e dizia que não havia OS adiante sem ter olhado). Nulo é a seta acesa; o
 * texto é o motivo da seta apagada, dizendo até onde a leitura olhou.
 */
export function advanceBlockedReason(
  source: Pick<OsScheduleSource, 'days' | 'dateTo'>,
  firstWeekEnd: string,
): string | null {
  if (hasScheduledAfter(source, firstWeekEnd)) return null

  return `Não há OS marcadas de ${shortDay(shiftISODate(firstWeekEnd, 1))} a ${shortDay(source.dateTo)}`
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

/**
 * O estado de um turno, em palavras; a cor é derivada dele, nunca o
 * contrário. `no-apt` só existe com a categoria escolhida no filtro: a
 * categoria não tem técnico apto naquele dia (22/10/2026).
 */
export type ShiftState =
  | 'past'
  | 'free'
  | 'closed'
  | 'cutoff'
  | 'nobody'
  | 'no-apt'
  | 'unknown'
  | 'ok'
  | 'attention'
  | 'over'

export type ShiftTone = 'ok' | 'attention' | 'over' | 'muted'

/**
 * A cor de cada tom, pelos tokens da página (`.os-schedule` em
 * `styles.css`, medidos nos dois temas); o cinza é o texto secundário. Usada
 * pelo card do turno, pelas pílulas e pela barra do resumo da semana.
 */
export const SHIFT_TONE_VAR: Readonly<Record<ShiftTone, string>> = {
  ok: 'var(--schedule-ok)',
  attention: 'var(--schedule-attention)',
  over: 'var(--schedule-over)',
  muted: 'var(--text-secondary)',
}

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
  if (state === 'nobody' || state === 'no-apt') return 'over'

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
    case 'no-apt':
      return word('Sem técnico apto')
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
  /** Célula sem agenda: domingo sem OS, ou dia fora da leitura. */
  readonly empty: 'sunday' | 'outside' | null
  readonly shifts: readonly ShiftCell[]
}

type PeriodRules = ReadonlyMap<string, OsSchedulePeriodRule>

/**
 * O turno com a categoria escolhida no filtro (Mário, 22/10/2026: com a
 * categoria, a capacidade e a ocupação do calendário têm de ser as dela, e
 * não as da equipe inteira, que davam "44%" num turno em que ela já não
 * cabia). É a grade de datas do SGI, como o serviço a manda
 * (`/calendar/schedule/category`): capacidade só dos técnicos aptos,
 * consumo de tudo o que eles atendem, e cheio quando mais uma OS da
 * categoria não cabe (a regra do SGI, e não a OS média do calendário
 * geral). Embaixo da barra, quantas OS dela ainda cabem ("cabe mais 9"); sem
 * horas previstas no cadastro, as horas livres dos aptos. Dia passado,
 * feriado, fim de semana desligado e hora limite de hoje respondem como no
 * calendário geral.
 */
function toCategoryShift(
  day: OsScheduleDay,
  cell: OsScheduleCategoryCalendarPeriod,
  info: OsScheduleCategoryInfo,
  rule: OsSchedulePeriodRule | undefined,
  readHour: number | null,
): ShiftCell {
  const capacity = cell.capacityHours
  const consumed = cell.consumedHours
  const band = (cell.occupation ?? 0) >= OCCUPATION_ATTENTION ? 'attention' : 'ok'
  const state: ShiftState =
    day.kind === 'past'
      ? 'past'
      : day.closed || cell.weekendClosed
        ? 'closed'
        : shiftCutoff(day.kind, rule, readHour)
          ? 'cutoff'
          : info.alwaysAvailable
            ? // Infra e auditoria: a grade nunca recusa. Sem técnico apto
              // não há capacidade para medir, e o painel conta "sem estimativa".
              capacity > 0
              ? band
              : 'unknown'
            : capacity <= 0
              ? 'no-apt'
              : cell.full
                ? 'over'
                : band

  let answer: AnswerPart[]
  if (state === 'over') answer = word('Cheio')
  else if ((state === 'ok' || state === 'attention' || state === 'unknown') && info.alwaysAvailable) {
    answer = word(ALWAYS_ACCEPTED_LABEL)
  }
  else if ((state === 'ok' || state === 'attention') && cell.fits !== null) {
    answer = [
      { text: 'cabe mais', kind: 'unit' },
      { text: formatNumber(cell.fits), kind: 'hours' },
    ]
  } else answer = shiftAnswer(state, consumed, capacity, rule?.limitHour ?? null)

  const base =
    capacity <= 0
      ? `Nenhum técnico apto em ${info.name} neste dia`
      : `Técnicos aptos em ${info.name}: ${shiftTooltip(state, consumed, capacity, cell.occupation, null)}`
  const refused = state === 'over' && info.slaHours !== null ? `. Mais uma OS de ${formatHours(info.slaHours)} não cabe` : ''

  return {
    iso: day.day,
    periodKey: cell.periodKey,
    period: cell.period,
    kind: day.kind,
    state,
    tone: shiftTone(state),
    scheduled: cell.scheduled,
    consumedHours: consumed,
    capacityHours: capacity,
    occupation: cell.occupation,
    answer,
    barText: barText(consumed, capacity, cell.occupation),
    capacity: capacity <= 0 ? null : formatHours(capacity),
    tooltip: `${base}${refused}`,
    fillPercent: state === 'no-apt' ? 100 : fillPercent(cell.occupation),
  }
}

/**
 * `4 técnicos aptos em Instalação de 2 Câmeras no cadastro do SGI`, a dica do
 * dia com a categoria. Sem o nome (`name` nulo) na janela da agenda, onde a
 * mesma linha já diz a categoria.
 */
function aptTechniciansText(
  count: number,
  name: string | null,
  kind: OsScheduleDayKind,
  closedTeams: readonly string[],
): string {
  const base = `${formatNumber(count)} ${plural(count, 'técnico apto', 'técnicos aptos')}${name === null ? '' : ` em ${name}`} no cadastro do SGI`
  // O mesmo aviso da dica geral: no passado o cadastro é o do dia, e a
  // inativação, que não tem data no SGI, segue o cadastro de hoje.
  if (kind === 'past') return `${base} nesse dia (inativações não têm data e seguem o cadastro atual)`

  return closedTeams.length > 0 ? `${base}, sem as equipes com rota travada` : base
}

function toDayCell(
  iso: string,
  day: OsScheduleDay | null,
  today: string,
  rules: PeriodRules,
  readHour: number | null,
  periodFilter: string | null,
  availableNow: number,
  categoryDay: OsScheduleCategoryCalendarDay | null = null,
  categoryInfo: OsScheduleCategoryInfo | null = null,
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
      empty: 'outside',
      shifts: [],
    }
  }
  // Domingo só entra na agenda sob demanda: sem OS, a célula fica vazia em
  // vez de mostrar dois turnos "Livre" que ninguém vai marcar.
  const sundayEmpty = weekdayOf(iso) === 0 && day.scheduled === 0
  // Com a categoria escolhida, o turno e os técnicos do dia são os dela.
  const byCategory = categoryInfo !== null
  const categoryCell = (periodKey: string) => categoryDay?.periods.find((cell) => cell.periodKey === periodKey)

  return {
    iso,
    label,
    isToday,
    kind: day.kind,
    closed: day.closed,
    closedTeams: day.closedTeams,
    lock: dayLock(day.closures),
    technicians: byCategory ? (categoryDay?.aptTechnicians ?? null) : day.scheduler.technicians,
    techniciansText: !byCategory
      ? techniciansText(day.scheduler.technicians, day.kind, day.closedTeams)
      : categoryDay === null
        ? null
        : aptTechniciansText(categoryDay.aptTechnicians, categoryInfo.name, day.kind, day.closedTeams),
    // Com a categoria, o "Agora: 35 disponíveis" da equipe inteira ficaria ao
    // lado dos aptos dela e pareceria da categoria (revisor de dados,
    // 22/10/2026): a linha sai enquanto a categoria está escolhida.
    availableNow: isToday && !byCategory ? availableNow : null,
    scheduled: day.scheduled,
    empty: sundayEmpty ? 'sunday' : null,
    shifts: sundayEmpty
      ? []
      : day.periods
          .filter((period) => periodFilter === null || period.periodKey === periodFilter)
          .map((period) => {
            if (!byCategory) return toShift(day, period, rules.get(period.periodKey), readHour)
            const cell = categoryCell(period.periodKey)

            // Turno que a leitura da categoria não trouxe: "Sem estimativa",
            // e não a conta da equipe inteira misturada à da categoria.
            return cell === undefined
              ? missingCategoryShift(day, period)
              : toCategoryShift(day, cell, categoryInfo, rules.get(period.periodKey), readHour)
          }),
  }
}

/** O turno sem a leitura da categoria: nada a afirmar sobre ele. */
function missingCategoryShift(day: OsScheduleDay, period: OsSchedulePeriodLoad): ShiftCell {
  return {
    iso: day.day,
    periodKey: period.periodKey,
    period: period.period,
    kind: day.kind,
    state: 'unknown',
    tone: 'muted',
    scheduled: 0,
    consumedHours: 0,
    capacityHours: null,
    occupation: null,
    answer: word('Sem estimativa'),
    barText: '',
    capacity: null,
    tooltip: 'A leitura da categoria não trouxe este turno',
    fillPercent: 0,
  }
}

export type CalendarWeek = {
  readonly start: string
  readonly end: string
  readonly title: string
  /**
   * O nome do painel de resumo: `Esta semana`, `Próxima semana` e, mais à
   * frente, o título inteiro (`Semana de 02/11 a 08/11`), porque o painel
   * não escreve mais os dias no canto (Mário, 22/10/2026).
   */
  readonly name: string
  readonly days: readonly DayCell[]
}

/**
 * `Esta semana, 19/10 a 25/10`, `Próxima semana, ...` e, mais à frente,
 * `Semana de ...`. `index` conta a partir da semana de hoje: 0 é esta, 1 a
 * próxima. Desde 22/10/2026 a página não volta antes da semana de hoje; o
 * -1 (`Semana passada`) fica só por defesa.
 */
export function weekTitle(index: number, start: string, end: string): string {
  const range = `${shortDay(start)} a ${shortDay(end)}`
  const name = weekName(index)

  return name === 'Semana' ? `Semana de ${range}` : `${name}, ${range}`
}

/** O nome curto da semana pela distância de hoje: 0 é esta, 1 a próxima (-1, a passada, só por defesa). */
export function weekName(index: number): string {
  if (index === -1) return 'Semana passada'
  if (index === 0) return 'Esta semana'
  if (index === 1) return 'Próxima semana'

  return 'Semana'
}

function periodRules(source: OsScheduleSource): PeriodRules {
  return new Map(source.parameters.periods.map((rule) => [rule.key, rule]))
}

/**
 * As semanas do calendário, da segunda-feira da semana de hoje (o hoje do
 * serviço) em diante, ou de `weekOffset` semanas depois dela. A semana de
 * hoje vem inteira, com os dias que já passaram (Mário, 22/10/2026: "de hoje
 * em diante" vale para as setas, não para a semana corrente). `periodFilter`
 * é o filtro de turno da faixa de filtros: nulo mostra todos.
 */
export function buildCalendar(
  source: OsScheduleSource,
  weeks: number,
  periodFilter: string | null = null,
  weekOffset = 0,
  /** O calendário da categoria escolhida no filtro (22/10/2026); nulo é o calendário geral. */
  categoryView: OsScheduleCategorySource | null = null,
): CalendarWeek[] {
  const byIso = new Map(source.days.map((day) => [day.day, day]))
  const categoryByIso = new Map((categoryView?.days ?? []).map((day) => [day.day, day]))
  const rules = periodRules(source)
  const readHour = isoHour(source.generatedAt)
  const start = shiftISODate(mondayOf(source.today), weekOffset * 7)

  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = shiftISODate(start, index * 7)
    const weekEnd = shiftISODate(weekStart, 6)
    const title = weekTitle(weekOffset + index, weekStart, weekEnd)
    const name = weekName(weekOffset + index)

    return {
      start: weekStart,
      end: weekEnd,
      title,
      name: name === 'Semana' ? title : name,
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
          categoryByIso.get(iso) ?? null,
          categoryView?.category ?? null,
        )
      }),
    }
  })
}

/** Um pedaço de uma linha do resumo; os números saem em destaque. */
export type SummarySegment = { readonly text: string; readonly emphasis: boolean }

/** A ocupação dos turnos ainda abertos, para a barra e os dois quadrinhos do resumo. */
export type SummaryOccupation = {
  /** Porcentagem inteira, arredondada para baixo antes de 100%, como no card. */
  readonly percent: number
  readonly tone: ShiftTone
  /** Largura da barra, de 0 a 100. */
  readonly fill: number
  readonly scheduled: string
  readonly capacity: string
  /** `Capacidade restante` na semana que já tem dias passados, `Capacidade total` na que ainda não começou. */
  readonly capacityLabel: string
}

/**
 * Um painel de semana (Mário, 22/10/2026, a partir de uma prévia dele): o
 * nome, as horas livres em destaque, a ocupação da agenda com as marcadas e
 * a capacidade, os turnos pelas palavras do card e as notas. Sem os dias no
 * canto e sem o realizado até ontem desde a tarde de 22/10/2026: a página é
 * de hoje em diante, e os dias estão no calendário logo abaixo.
 */
export type WeekSummary = {
  /** O nome inteiro da semana, com as datas, para o leitor de tela. */
  readonly title: string
  /** `Esta semana`, `Próxima semana` ou, mais à frente, `Semana de 02/11 a 08/11`. */
  readonly name: string
  /** O número em destaque e o que ele é; nulo fora da leitura. */
  readonly headline: { readonly label: string; readonly value: string; readonly free: boolean } | null
  /** A ocupação dos turnos que ainda aceitam agendamento; nula sem nenhum com capacidade. */
  readonly occupation: SummaryOccupation | null
  /** Os turnos de hoje em diante pela resposta do card; vazio sem nenhum. */
  readonly states: readonly SummarySegment[]
  /** O que a conta não fecha: turno cheio, semana fora da leitura. */
  readonly notes: readonly string[]
}

const num = (value: number): SummarySegment => ({ text: formatNumber(value), emphasis: true })
const txt = (text: string): SummarySegment => ({ text, emphasis: false })

/**
 * As horas que o card do turno escreve como livres: a sobra no turno com
 * folga ou quase cheio, e a capacidade inteira no turno sem OS. Zero no
 * cheio (mesmo com uma sobra menor que uma OS média, que o card chama de
 * "Cheio"), no fechado, no realizado e no sem estimativa.
 */
export function shiftFreeHours(shift: Pick<ShiftCell, 'state' | 'consumedHours' | 'capacityHours'>): number {
  const capacity = shift.capacityHours ?? 0
  if (shift.state === 'free') return capacity
  if (shift.state === 'ok' || shift.state === 'attention') return Math.max(capacity - shift.consumedHours, 0)

  return 0
}

/** A resposta do card do turno, agrupada para a contagem do resumo. */
type SummaryGroup = 'free' | 'few' | 'full' | 'noApt' | 'closed' | 'unknown'

/**
 * O grupo de cada turno, nas palavras do card: "Xh livres" (com folga, e o
 * turno sem OS), "só Xh livres" (quase cheio), "Cheio" ou "excedeu" (e o
 * turno com OS e nenhum técnico previsto), "Fechado" (dia fechado, ou hoje
 * depois da hora limite) e "Sem estimativa". O turno sem OS e sem técnico
 * previsto não tem o que dizer e fica de fora; o turno sem OS e sem
 * estimativa de capacidade (o card diz "Livre", sem horas) conta como sem
 * estimativa, porque o resumo não tem horas livres para dizer dele.
 */
function summaryGroup(shift: Pick<ShiftCell, 'state' | 'capacityHours'>): SummaryGroup | null {
  switch (shift.state) {
    case 'free':
      if (shift.capacityHours === null) return 'unknown'

      return shift.capacityHours > 0 ? 'free' : null
    case 'ok':
      return 'free'
    case 'attention':
      return 'few'
    case 'over':
    case 'nobody':
      return 'full'
    case 'no-apt':
      // Com a categoria: o card diz "Sem técnico apto", e o painel também
      // (revisor de dados, 22/10/2026: antes contava como cheio).
      return 'noApt'
    case 'closed':
    case 'cutoff':
      return 'closed'
    case 'unknown':
      return 'unknown'
    case 'past':
      return null
  }
}

/** O turno ainda aceita agendamento e tem capacidade estimada: entra na ocupação. */
function countsInOccupation(shift: ShiftCell): boolean {
  return shift.state !== 'closed' && shift.state !== 'cutoff' && shift.state !== 'past' && shift.capacityHours !== null
}

/**
 * Um painel de semana (Mário, 22/10/2026, a partir de uma prévia que ele
 * aprovou, com as quatro recomendações aceitas no mesmo dia):
 *
 * - em destaque, as horas livres de hoje em diante: a soma do que os cards
 *   dos turnos escrevem como "livres" (e não a capacidade menos as
 *   marcadas, que deixaria o excedente de um turno comer a folga de outro).
 *   Numa semana que já passou, o realizado. Desde 22/10/2026 a página não
 *   chega a ela: a semana 0 começa no hoje do serviço e sempre tem o dia de
 *   hoje. O ramo fica só por defesa, caso o serviço marque como passado um
 *   dia que não vem antes do hoje dele;
 * - a ocupação da agenda dos turnos que ainda aceitam agendamento e têm
 *   capacidade estimada, com a porcentagem inteira do card, as marcadas e a
 *   capacidade. Turno fechado e sem estimativa ficam fora dela;
 * - os turnos de hoje em diante pelas palavras do card;
 * - a nota: quando há turno cheio, a conta "capacidade menos marcadas" não
 *   dá as horas livres, e a nota diz quanto ele excedeu (ou a sobra que não
 *   cabe uma OS). A nota das OS sem turno saiu em 22/10/2026 (Mário): são
 *   Ativação Remota concluída sem técnico, que não ocupam turno.
 *
 * Tudo soma os turnos visíveis, então o filtro de turno vale também aqui.
 */
export function buildWeekSummary(week: CalendarWeek): WeekSummary {
  const past = week.days.filter((day) => day.kind === 'past')
  const ahead = week.days.filter((day) => day.kind === 'today' || day.kind === 'future')
  const hoursOf = (days: readonly DayCell[]) =>
    days.flatMap((day) => day.shifts).reduce((sum, shift) => sum + shift.consumedHours, 0)
  const base = { title: week.title, name: week.name }

  if (past.length === 0 && ahead.length === 0) {
    return { ...base, headline: null, occupation: null, states: [], notes: ['Semana fora da leitura'] }
  }
  if (ahead.length === 0) {
    return {
      ...base,
      headline: { label: 'Realizadas', value: formatHours(hoursOf(past)), free: false },
      occupation: null,
      states: [],
      notes: [],
    }
  }

  const aheadShifts = ahead.flatMap((day) => day.shifts)
  const counts: Record<SummaryGroup, number> = { free: 0, few: 0, full: 0, noApt: 0, closed: 0, unknown: 0 }
  for (const shift of aheadShifts) {
    const group = summaryGroup(shift)
    if (group !== null) counts[group] += 1
  }
  const freeHours = aheadShifts.reduce((sum, shift) => sum + shiftFreeHours(shift), 0)

  const open = aheadShifts.filter(countsInOccupation)
  const capacity = open.reduce((sum, shift) => sum + (shift.capacityHours ?? 0), 0)
  const scheduled = open.reduce((sum, shift) => sum + shift.consumedHours, 0)
  const ratio = capacity > 0 ? scheduled / capacity : null
  const occupation: SummaryOccupation | null =
    ratio === null
      ? null
      : {
          percent: occupationPercent(ratio) ?? 0,
          tone: shiftTone(occupationState(ratio)),
          fill: fillPercent(ratio),
          scheduled: formatHours(scheduled),
          capacity: formatHours(capacity),
          capacityLabel: past.length > 0 ? 'Capacidade restante' : 'Capacidade total',
        }

  // Cada grupo só aparece quando tem turno (zero some, como nas dicas do
  // portal), e a palavra "turno" vai no primeiro que aparece (Mário, 22/10).
  const groups: readonly (readonly [number, string, string])[] = [
    [counts.free, 'com horas livres', 'com horas livres'],
    [counts.few, 'com poucas horas livres', 'com poucas horas livres'],
    [counts.full, 'cheio', 'cheios'],
    [counts.noApt, 'sem técnico apto', 'sem técnico apto'],
    [counts.closed, 'fechado', 'fechados'],
    [counts.unknown, 'sem estimativa', 'sem estimativa'],
  ]
  const parts = groups
    .filter(([count]) => count > 0)
    .map(([count, one, many], index) => [
      num(count),
      txt(` ${index === 0 ? `${plural(count, 'turno', 'turnos')} ` : ''}${plural(count, one, many)}`),
    ])
  const states = parts.flatMap((part, index) => (index === 0 ? part : [txt(' · '), ...part]))

  // A diferença entre "capacidade menos marcadas" e as horas livres mora nos
  // turnos cheios: o que eles excederam e a sobra que não cabe uma OS.
  const full = open.filter((shift) => shift.state === 'over' || shift.state === 'nobody')
  const excess = full.reduce((sum, shift) => sum + Math.max(shift.consumedHours - (shift.capacityHours ?? 0), 0), 0)
  const leftover = full.reduce((sum, shift) => sum + Math.max((shift.capacityHours ?? 0) - shift.consumedHours, 0), 0)
  const fullParts = [
    formatHours(excess) === formatHours(0) ? null : `${formatHours(excess)} além da capacidade`,
    formatHours(leftover) === formatHours(0) ? null : `${formatHours(leftover)} de sobra que não cabe uma OS`,
  ].filter((part): part is string => part !== null)
  const fullNote =
    full.length === 0
      ? null
      : `${formatNumber(full.length)} ${plural(full.length, 'turno cheio', 'turnos cheios')}${
          fullParts.length === 0 ? '' : `: ${fullParts.join(' e ')}`
        }`

  return {
    ...base,
    headline: {
      label: past.length > 0 ? 'Horas livres de hoje em diante' : 'Horas livres',
      value: formatHours(freeHours),
      free: true,
    },
    occupation,
    states,
    notes: fullNote === null ? [] : [fullNote],
  }
}

const segmentsText = (segments: readonly SummarySegment[]) => segments.map((segment) => segment.text).join('')

/** O painel inteiro numa linha, para os testes. */
export function summaryText(summary: WeekSummary): string {
  const occupation = summary.occupation
  return [
    summary.headline === null ? '' : `${summary.headline.label}: ${summary.headline.value}`,
    occupation === null
      ? ''
      : `Ocupação ${formatNumber(occupation.percent)}% · Marcadas ${occupation.scheduled} · ${occupation.capacityLabel} ${occupation.capacity}`,
    segmentsText(summary.states),
    summary.notes.join(' · '),
  ]
    .filter((line) => line !== '')
    .join(' | ')
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

/** A pílula de infra e auditoria na janela da agenda: a grade do SGI nunca as recusa. */
export const ALWAYS_ACCEPTED_LABEL = 'SGI não limita'

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

/**
 * A categoria escolhida no filtro Categoria da página (22/10/2026): o
 * identificador, que casa com a leitura, e o nome, que a janela escreve.
 */
export type CategoryChoice = { readonly id: string; readonly name: string }

/** A categoria passa nos filtros Tipo de OS e Categoria da página; nulo é sem filtro. */
function passesFilters(
  category: { readonly id: string; readonly serviceType: string },
  typeFilter: string | null,
  choice: CategoryChoice | null,
): boolean {
  return (typeFilter === null || category.serviceType === typeFilter) && (choice === null || category.id === choice.id)
}

/**
 * As categorias de um turno, para a janela da agenda; nulo quando a leitura
 * não cobre o turno. `typeFilter` e `choice` são os filtros Tipo de OS e
 * Categoria da página (22/10/2026): com eles, só as categorias escolhidas.
 */
export function buildShiftDetail(
  source: OsScheduleSource,
  selection: ShiftSelection,
  typeFilter: string | null = null,
  choice: CategoryChoice | null = null,
): ShiftDetail | null {
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
    if (!passesFilters(category, typeFilter, choice)) continue
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
 * inteiro. Nulo sem nada a avisar. Com a categoria escolhida no filtro
 * (`byCategory`), as OS sem turno e sem horas previstas continuam, porque
 * mexem nas contas dela (a sem turno fica fora da contagem, a sem horas pesa
 * zero na agenda dos aptos), mas escritas como do dia inteiro: a leitura não
 * diz quantas são dela.
 */
function agendaNote(
  source: OsScheduleSource,
  day: OsScheduleDay,
  periodKey: string | null,
  alwaysAccepted: boolean,
  byCategory = false,
): string | null {
  const uncounted = uncountedNote(day)
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
    uncounted === '' ? null : byCategory ? `Em todas as categorias do dia: ${uncounted}` : uncounted,
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
   * passado, `closed` no turno que o SGI não oferece mais e `no-apt` quando
   * ela não tem técnico apto (o SGI recusa, como no cheio, mas por outro
   * motivo, e o card do calendário com a categoria diz "Sem técnico apto").
   */
  readonly answer: 'refused' | 'no-apt' | 'fits' | 'always' | 'realized' | 'closed'
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
 * ordem é a das OS marcadas. `typeFilter` e `choice` são os filtros Tipo de
 * OS e Categoria da página: com eles, só as categorias escolhidas.
 */
export function buildDayLines(
  day: OsScheduleDay,
  closedPeriods: ReadonlySet<string> = new Set(),
  typeFilter: string | null = null,
  choice: CategoryChoice | null = null,
): DayCategoryLine[] {
  const past = day.kind === 'past'
  const lines = day.categories
    .filter((category) => passesFilters(category, typeFilter, choice))
    .map((category): DayCategoryLine => {
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
              ? category.aptTechnicians === 0
                ? 'no-apt'
                : 'refused'
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

  const refusedIn = (line: DayCategoryLine) =>
    line.cells.filter((cell) => cell.answer === 'refused' || cell.answer === 'no-apt').length
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
  /** O filtro Tipo de OS da página quando a janela abriu; nulo sem filtro. */
  readonly typeFilter: string | null
  /** O filtro Categoria da página quando a janela abriu; nulo sem filtro. */
  readonly category: CategoryChoice | null
  readonly kind: OsScheduleDayKind
  readonly title: string
  /** O turno, ou "Dia inteiro": o nome da lista e da planilha. */
  readonly label: string
  /** A linha de contexto: OS, horas, resposta do turno, técnicos e hora da leitura. */
  readonly description: string
  readonly chips: readonly AgendaChip[]
  /**
   * As OS que a lista inteira deve trazer: o número do turno, ou do dia, no
   * calendário geral. É a conta que avisa quando a agenda mudou entre as
   * duas leituras, porque a lista chega com todas as OS do turno.
   */
  readonly expected: number
  /** O número da aba OS: as da categoria escolhida no filtro, ou `expected` sem ela. */
  readonly orders: number
  /** A janela saiu do calendário da categoria escolhida, e não da leitura geral. */
  readonly byCategory: boolean
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
 * quando a leitura não tem o dia ou o turno. Com os filtros Tipo de OS e
 * Categoria da página (`typeFilter` e `choice`, 22/10/2026), as categorias
 * são só as escolhidas. Com a categoria e o calendário dela (`categoryView`),
 * a janela inteira passa a ser a dela (`buildCategoryAgendaDialog`); com só
 * o tipo, os atalhos e o número da lista seguem a leitura geral da agenda,
 * que conta todas as OS do turno.
 */
export function buildAgendaDialog(
  source: OsScheduleSource,
  selection: AgendaSelection,
  typeFilter: string | null = null,
  choice: CategoryChoice | null = null,
  categoryView: OsScheduleCategorySource | null = null,
): AgendaDialog | null {
  // Com o calendário da categoria, a janela é só dela, e nunca volta à
  // leitura geral no meio do caminho: os números da equipe inteira ficariam
  // embaixo de "Só a categoria".
  if (
    choice !== null &&
    categoryView !== null &&
    categoryView.category.id === choice.id &&
    (typeFilter === null || categoryView.category.serviceType === typeFilter)
  ) {
    return buildCategoryAgendaDialog(source, selection, typeFilter, choice, categoryView)
  }

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
    const dayLines = buildDayLines(day, closedPeriods, typeFilter, choice)

    return {
      selection,
      typeFilter,
      category: choice,
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
      orders: day.scheduled,
      byCategory: false,
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

  const shift = buildShiftDetail(source, { iso: day.day, periodKey: period.periodKey }, typeFilter, choice)
  const answer = toShift(day, period, periodRules(source).get(period.periodKey), isoHour(source.generatedAt)).answer

  return {
    selection,
    typeFilter,
    category: choice,
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
    orders: period.scheduled,
    byCategory: false,
    shift,
    dayLines: [],
    categoryCount: shift === null ? 0 : shiftCategoryCount(shift),
    note: shift?.note ?? null,
  }
}

/**
 * A resposta da grade do SGI para a categoria num turno, a mesma do card do
 * calendário com a categoria (`toCategoryShift`), nas palavras da janela.
 */
function categoryCellAnswer(state: ShiftState, info: OsScheduleCategoryInfo): DayCategoryCell['answer'] {
  if (state === 'past') return 'realized'
  if (state === 'closed' || state === 'cutoff') return 'closed'
  if (state === 'over') return 'refused'
  if (state === 'no-apt') return 'no-apt'

  return info.alwaysAvailable ? 'always' : 'fits'
}

/**
 * A janela com a categoria escolhida no filtro (Mário, 23/10/2026: com o
 * filtro, todo número da janela é o do recorte, e o total do turno ou do dia
 * fica só como referência). Sai do calendário da categoria, a mesma leitura
 * do card clicado: as OS dela, a agenda e os técnicos aptos nela e a resposta
 * da grade do SGI em cada turno, tenha ela OS no dia ou não. Até ali a janela
 * mostrava os números da equipe inteira e, sem OS dela no dia, nenhuma
 * categoria. O turno que a leitura da categoria não trouxe responde "Sem
 * estimativa", como no card. Nulo quando uma das leituras não tem o dia, ou
 * a geral não tem o turno.
 */
function buildCategoryAgendaDialog(
  source: OsScheduleSource,
  selection: AgendaSelection,
  typeFilter: string | null,
  choice: CategoryChoice,
  view: OsScheduleCategorySource,
): AgendaDialog | null {
  const day = source.days.find((item) => item.day === selection.iso)
  const viewDay = view.days.find((item) => item.day === selection.iso)
  if (day === undefined || viewDay === undefined) return null
  const period =
    selection.periodKey === null ? null : day.periods.find((item) => item.periodKey === selection.periodKey)
  if (period === undefined) return null

  const info = view.category
  const rules = periodRules(source)
  const readHour = isoHour(source.generatedAt)
  const past = day.kind === 'past'
  // Cada turno do dia com a conta da categoria e a resposta do card; sem a
  // conta (`cell` nulo), a mesma "Sem estimativa" do card.
  const cells = day.periods.map((item) => {
    const cell = viewDay.periods.find((own) => own.periodKey === item.periodKey) ?? null

    return {
      periodKey: item.periodKey,
      period: item.period,
      cell,
      shift:
        cell === null
          ? missingCategoryShift(day, item)
          : toCategoryShift(day, cell, info, rules.get(item.periodKey), readHour),
    }
  })
  const inScope = period === null ? cells : cells.filter((item) => item.periodKey === period.periodKey)
  const countOf = (periodKey: string | null) =>
    cells
      .filter((item) => periodKey === null || item.periodKey === periodKey)
      .reduce((sum, item) => sum + (item.cell?.scheduled ?? 0), 0)
  const answerOf = (item: (typeof cells)[number]) =>
    item.cell === null ? 'fits' : categoryCellAnswer(item.shift.state, info)
  const own = countOf(selection.periodKey)
  const line: CategoryLine = {
    id: info.id,
    name: info.name,
    serviceType: info.serviceType,
    aptTechnicians: viewDay.aptTechnicians,
    slaHours: info.slaHours,
    scheduled: own,
  }

  const chips: AgendaChip[] = [
    { selection: { iso: day.day, periodKey: null }, label: WHOLE_DAY_LABEL, count: countOf(null) },
    ...day.periods.map((item) => ({
      selection: { iso: day.day, periodKey: item.periodKey },
      label: item.period,
      count: countOf(item.periodKey),
    })),
  ]

  // `0 OS de Instalação de 3 Câmeras, de 112 marcadas no dia`: o número é o
  // dela, e o total fica como referência.
  const total = period === null ? day.scheduled : period.scheduled
  const totalWord = past ? plural(total, 'realizada', 'realizadas') : plural(total, 'marcada', 'marcadas')
  const consumed = inScope.reduce((sum, item) => sum + (item.cell?.consumedHours ?? 0), 0)
  const capacity = inScope.reduce((sum, item) => sum + (item.cell?.capacityHours ?? 0), 0)
  // A hora da leitura da categoria, de onde saem os números: com a releitura
  // dela falhando, ela pode ser mais velha que a geral, e a janela vai para o
  // projetor sem o aviso da página atrás.
  const read = formatIsoClock(view.generatedAt)
  const description = [
    `${formatNumber(own)} OS de ${info.name}, de ${formatNumber(total)} ${totalWord} ${period === null ? 'no dia' : 'no turno'}`,
    capacity > 0 ? `agenda dos técnicos aptos: ${formatHours(consumed)} de ${formatHours(capacity)}` : null,
    // A resposta do card do turno; o realizado não tem resposta para quem agenda.
    period === null || past ? null : answerText(inScope[0].shift.answer),
    aptTechniciansText(viewDay.aptTechnicians, null, day.kind, day.closedTeams),
    read === null ? 'agenda do SGI' : `agenda do SGI lida às ${read}`,
  ]
    .filter((parte): parte is string => parte !== null)
    .join(' · ')

  const base = {
    selection,
    typeFilter,
    category: choice,
    kind: day.kind,
    title: agendaTitle(day.day, period === null ? null : period.period, source.today),
    label: period === null ? WHOLE_DAY_LABEL : period.period,
    description,
    chips,
    expected: total,
    orders: own,
    byCategory: true,
  }

  if (period === null) {
    const dayLine: DayCategoryLine = {
      ...line,
      cells: cells.map((item): DayCategoryCell => {
        const answer = answerOf(item)

        return {
          periodKey: item.periodKey,
          period: item.period,
          scheduled: item.cell?.scheduled ?? 0,
          answer,
          fits: answer === 'fits' ? (item.cell?.fits ?? null) : null,
        }
      }),
    }
    // No passado, só o realizado: sem OS dela, a janela diz que não houve.
    const dayLines = past && own === 0 ? [] : [dayLine]

    return {
      ...base,
      shift: null,
      dayLines,
      categoryCount: dayLines.length,
      note: agendaNote(
        source,
        day,
        null,
        dayLine.cells.some((cell) => cell.answer === 'always'),
        true,
      ),
    }
  }

  const target = inScope[0]
  const answer = answerOf(target)
  const detail: ShiftDetail = {
    selection: { iso: day.day, periodKey: period.periodKey },
    kind: day.kind,
    // Sem técnico apto o SGI também recusa: a pílula diz o motivo.
    refused: answer === 'refused' || answer === 'no-apt' ? [line] : [],
    fitting: answer === 'fits' ? [{ ...line, fits: target.cell?.fits ?? null }] : [],
    alwaysAccepted: answer === 'always' ? [line] : [],
    realized: answer === 'realized' && own > 0 ? [line] : [],
    closed: answer === 'closed',
    closedLines: answer === 'closed' ? [line] : [],
    note: agendaNote(source, day, period.periodKey, answer === 'always', true),
  }

  return {
    ...base,
    shift: detail,
    dayLines: [],
    categoryCount: shiftCategoryCount(detail),
    note: detail.note,
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

// --- Próxima vaga por categoria (22/10/2026) ----------------------------------
//
// Pedido do Mário: com uma categoria escolhida no filtro, ver no calendário a
// próxima agenda possível dela. A grade de datas do SGI decide por CATEGORIA
// (os técnicos aptos e as horas previstas são dela), e o serviço manda, para
// cada categoria viva, o primeiro turno que a grade oferece
// (`source.availability`). A lista também alimenta os filtros Tipo de OS e
// Categoria. A faixa da próxima agenda por tipo, que vivia aqui, saiu no
// mesmo dia a pedido do Mário.

/** `hoje`, `amanhã` ou `sáb 24/10`: um dia visto de hoje. */
export function whenLabel(iso: string, today: string): string {
  if (iso === today) return 'hoje'
  if (iso === shiftISODate(today, 1)) return 'amanhã'

  return `${weekdayNameOf(iso, 'short').slice(0, 3)} ${shortDay(iso)}`
}

/** `amanhã · Manhã`: o turno da próxima vaga. */
export function slotLabel(iso: string, period: string, today: string): string {
  return `${whenLabel(iso, today)} · ${period}`
}

/** Tem turno, não tem técnico apto, ou está cheia até o fim da leitura. */
export type AvailabilityStatus = 'slot' | 'no-apt' | 'no-date'

export type NextSlot = {
  readonly iso: string
  readonly periodKey: string
  readonly period: string
  /** Quantas OS a mais cabem nesse turno; nula sem horas previstas, e em infra e auditoria. */
  readonly fits: number | null
  /** `amanhã · Manhã`. */
  readonly label: string
}

export type CategoryAvailabilityLine = {
  readonly id: string
  readonly name: string
  readonly serviceType: string
  /** Infra e auditoria: a grade do SGI nunca as recusa. */
  readonly alwaysAvailable: boolean
  readonly status: AvailabilityStatus
  readonly next: NextSlot | null
}

export type Availability = {
  /** As categorias, na ordem do serviço; só as do tipo do filtro quando ele existe. */
  readonly categories: readonly CategoryAvailabilityLine[]
  /** Todos os tipos presentes, na ordem do serviço: as opções do filtro. */
  readonly serviceTypes: readonly string[]
}

/**
 * As categorias da leitura com a próxima vaga de cada uma, para os filtros
 * Tipo de OS e Categoria e para o destaque no calendário. Com o filtro Tipo
 * de OS, só as categorias do tipo; a lista de tipos é sempre inteira, porque
 * são as opções do filtro.
 */
export function buildAvailability(source: OsScheduleSource, typeFilter: string | null = null): Availability {
  const all = source.availability.map((item): CategoryAvailabilityLine => {
    const next: NextSlot | null =
      item.next === null
        ? null
        : {
            iso: item.next.day,
            periodKey: item.next.periodKey,
            period: item.next.period,
            fits: item.alwaysAvailable
              ? null
              : fitsInShift(item.next.capacityHours, item.next.consumedHours, item.slaHours),
            label: slotLabel(item.next.day, item.next.period, source.today),
          }
    const status: AvailabilityStatus =
      next !== null ? 'slot' : item.aptTechnicians === 0 && !item.alwaysAvailable ? 'no-apt' : 'no-date'

    return {
      id: item.id,
      name: item.name,
      serviceType: item.serviceType,
      alwaysAvailable: item.alwaysAvailable,
      status,
      next,
    }
  })

  return {
    categories: typeFilter === null ? all : all.filter((line) => line.serviceType === typeFilter),
    serviceTypes: [...new Set(all.map((line) => line.serviceType))],
  }
}

/**
 * A próxima vaga pela leitura do calendário da categoria (22/10/2026). A
 * próxima agenda da leitura geral (`availability`) e o calendário da
 * categoria são duas leituras, renovadas em momentos diferentes: o selo
 * podia ficar num card "Cheio", ou dizer "cabe 6" ao lado de "cabe mais 5"
 * (revisor de dados). Com o calendário da categoria na tela, a vaga sai dele,
 * pela mesma regra do card (`toCategoryShift`): o primeiro turno de hoje em
 * diante que não está fechado nem cheio. Infra e auditoria sem técnico apto
 * também valem, porque a grade nunca as recusa.
 *
 * Com o calendário duas semanas ou mais à frente, a leitura da categoria
 * acompanha a tela e começa depois de hoje: os turnos de hoje até lá não
 * estão nela, e a primeira vaga dela não seria a próxima (revisor de dados,
 * 23/10/2026). Aí fica a vaga do serviço, que procura de hoje em diante.
 */
export function categoryLineFromView(
  line: CategoryAvailabilityLine,
  view: OsScheduleCategorySource,
  source: OsScheduleSource,
): CategoryAvailabilityLine {
  if (view.dateFrom > source.today) return line
  const byIso = new Map(source.days.map((day) => [day.day, day]))
  const readHour = isoHour(source.generatedAt)
  for (const viewDay of view.days) {
    const day = byIso.get(viewDay.day)
    if (day === undefined || day.kind === 'past') continue
    for (const rule of source.parameters.periods) {
      const cell = viewDay.periods.find((item) => item.periodKey === rule.key)
      if (cell === undefined) continue
      const { state } = toCategoryShift(day, cell, view.category, rule, readHour)
      const offered =
        state === 'ok' || state === 'attention' || (view.category.alwaysAvailable && state === 'unknown')
      if (!offered) continue

      return {
        ...line,
        status: 'slot',
        next: {
          iso: day.day,
          periodKey: cell.periodKey,
          period: cell.period,
          fits: view.category.alwaysAvailable ? null : cell.fits,
          label: slotLabel(day.day, cell.period, source.today),
        },
      }
    }
  }

  return { ...line, status: line.status === 'no-apt' ? 'no-apt' : 'no-date', next: null }
}

/**
 * Até quantos minutos a leitura da categoria pode estar atrás da leitura
 * geral e ainda valer na tela: as duas se renovam a cada 5 minutos, cada uma
 * no seu tempo. Mais atrasada que isso, é a leitura de uma escolha anterior
 * da mesma categoria, e a página espera a nova (revisor de dados, 22/10/2026).
 */
export const CATEGORY_READING_TOLERANCE_MINUTES = 10

/** Minutos entre duas leituras do serviço, pelas horas ISO com fuso; nulo se alguma não for uma data. */
export function minutesBetweenReadings(a: string, b: string): number | null {
  const left = Date.parse(a)
  const right = Date.parse(b)

  return Number.isNaN(left) || Number.isNaN(right) ? null : Math.abs(left - right) / 60_000
}

/** O que o destaque da categoria faz com um turno do calendário: só o turno da vaga é marcado. */
export type CategoryMark = 'next'

/** A chave de um turno do calendário: o dia e o turno. */
export function shiftKey(iso: string, periodKey: string): string {
  return `${iso}|${periodKey}`
}

/**
 * O destaque da categoria escolhida no calendário (Mário, 22/10/2026): o
 * turno da próxima vaga leva a borda de destaque e o selo "Próxima vaga", e
 * a linha acima do calendário diz a vaga por extenso. Os outros turnos já
 * respondem pela categoria (`toCategoryShift`: "Cheio", "cabe mais 9"), por
 * isso a tarja de "não oferece" dos turnos antes da vaga, que existiu
 * enquanto o calendário era só o geral, saiu no mesmo dia.
 */
export type CategoryHighlight = {
  readonly name: string
  readonly next: NextSlot | null
  readonly marks: ReadonlyMap<string, CategoryMark>
  /** O selo do turno da vaga: `cabe 9`; nulo sem o número (infra e auditoria, sem horas previstas). */
  readonly fits: number | null
  /**
   * Onde a vaga está em relação à tela: no calendário; num dia que o
   * calendário mostra como "Sem agenda" (domingo sem OS, que o SGI oferece
   * quando a configuração libera o fim de semana); num turno escondido pelo
   * filtro Turno; fora das semanas na tela; ou sem vaga na leitura.
   */
  readonly placement: 'visible' | 'empty-day' | 'hidden-period' | 'outside' | 'none'
  /** Semanas depois da semana de hoje em que a vaga cai, para "Ir para a semana"; nulo sem vaga. */
  readonly weekOffset: number | null
  /** A linha acima do calendário, em pedaços, com o turno da vaga em destaque. */
  readonly message: readonly SummarySegment[]
}

/** Um pedaço em destaque da linha acima do calendário. */
const strong = (text: string): SummarySegment => ({ text, emphasis: true })

export function buildCategoryHighlight(
  line: CategoryAvailabilityLine,
  calendar: readonly CalendarWeek[],
  source: Pick<OsScheduleSource, 'today' | 'dateTo'>,
): CategoryHighlight {
  const next = line.next
  const marks = new Map<string, CategoryMark>()
  let visible = false
  // O dia da vaga na tela: nulo fora dela; `empty` quando a célula não tem
  // turnos (domingo sem OS), e não por causa do filtro Turno (revisor de
  // dados, 22/10/2026: sábado depois das 16h a vaga de quase toda categoria
  // é o domingo, e a frase culpava um filtro que nem estava ligado).
  let nextDay: DayCell | null = null
  for (const day of calendar.flatMap((week) => week.days)) {
    if (next === null || day.iso !== next.iso) continue
    nextDay = day
    for (const shift of day.shifts) {
      if (shift.periodKey !== next.periodKey) continue
      marks.set(shiftKey(shift.iso, shift.periodKey), 'next')
      visible = true
    }
  }

  const placement: CategoryHighlight['placement'] =
    next === null
      ? 'none'
      : visible
        ? 'visible'
        : nextDay === null
          ? 'outside'
          : nextDay.empty !== null
            ? 'empty-day'
            : 'hidden-period'
  const fits = line.alwaysAvailable ? null : (next?.fits ?? null)
  // O que mudou na tela com a categoria: as contas são as dos aptos nela.
  const scope = 'As horas, a ocupação e as vagas do calendário e das semanas são as dos técnicos aptos nela.'

  let message: SummarySegment[]
  if (next === null) {
    const why =
      line.status === 'no-apt'
        ? 'sem técnico apto no cadastro, o SGI não oferece esta categoria'
        : `sem vaga até ${shortDay(source.dateTo)}`
    message = [txt(`${line.name}: `), strong(why), txt(`. ${scope}`)]
  } else {
    const extra = line.alwaysAvailable ? ', o SGI não limita' : fits === null ? '' : `, cabe mais ${formatNumber(fits)}`
    const where: Record<Exclude<CategoryHighlight['placement'], 'none'>, string> = {
      visible: '. Em destaque no calendário.',
      'empty-day': '. O SGI oferece esse dia, que o calendário mostra como "Sem agenda".',
      'hidden-period': '. O filtro Turno esconde esse turno.',
      outside: ', fora das semanas na tela.',
    }
    message = [
      txt(`Próxima vaga de ${line.name}: `),
      strong(next.label),
      txt(`${extra}${where[placement === 'none' ? 'outside' : placement]} ${scope}`),
    ]
  }

  return {
    name: line.name,
    next,
    marks,
    fits,
    placement,
    weekOffset: next === null ? null : Math.floor(daysBetween(mondayOf(source.today), mondayOf(next.iso)) / 7),
    message,
  }
}
