/**
 * Contas do campo de data do portal: a grade do mês, a máscara de digitação e
 * a leitura do que foi digitado.
 *
 * Toda conta usa UTC e o formato `AAAA-MM-DD`, como no calendário comercial:
 * é o que garante que 01/09 continue sendo 01/09 em qualquer fuso. As poucas
 * contas básicas ficam aqui, e não vêm de `data/commercialCalendar`, para o
 * campo servir a qualquer página sem depender do calendário de um departamento.
 *
 * Nada aqui toca a tela: o componente é que desenha. Assim a suíte, que não
 * tem navegador, consegue provar as regras do calendário.
 */

/** Um dia da grade, já sabendo se pertence ao mês e se pode ser escolhido. */
export type CalendarDay = {
  iso: string
  day: number
  /** false para os dias vizinhos que completam a primeira e a última semana. */
  currentMonth: boolean
  /** false quando o dia está fora da cobertura da base. */
  selectable: boolean
}

/** Iniciais na ordem em que a grade desenha, de domingo a sábado. */
export const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

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

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Dias do mês, com o ano em conta: fevereiro de 2028 tem 29. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** true somente para uma data real escrita como `AAAA-MM-DD`. */
export function isIsoDate(value: string): boolean {
  if (!ISO_PATTERN.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1) return false

  return day <= daysInMonth(year, month)
}

/** Mês de uma data, no formato `AAAA-MM`. */
export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/** `Julho de 2026`, o título do calendário aberto. */
export function monthTitle(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`
}

/** Mês vizinho, para as setas do calendário. Vira o ano sozinho. */
export function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4))
  const number = Number(month.slice(5, 7))
  const shifted = new Date(Date.UTC(year, number - 1 + delta, 1))

  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Data dentro da cobertura, considerando os limites que existirem. */
export function isSelectable(isoDate: string, min?: string, max?: string): boolean {
  if (min !== undefined && isoDate < min) return false
  if (max !== undefined && isoDate > max) return false

  return true
}

/** A data presa à cobertura: antes do início vira o início, depois do fim vira o fim. */
export function clampToLimits(isoDate: string, min?: string, max?: string): string {
  if (min !== undefined && isoDate < min) return min
  if (max !== undefined && isoDate > max) return max

  return isoDate
}

/** Último dia de um mês `AAAA-MM`, em `AAAA-MM-DD`. */
export function lastDayOfMonth(month: string): string {
  const year = Number(month.slice(0, 4))
  const number = Number(month.slice(5, 7))

  return toIso(year, number, daysInMonth(year, number))
}

/**
 * O mesmo dia no mês de destino, na regra que o Mário pediu em 10/09/2026.
 *
 * Quem está no dia 15 vai para o dia 15. Quem está no ÚLTIMO dia do mês vai
 * para o último dia do destino: 28/02 vira 31/03, e 31/03 vira 30/04. Um dia
 * que o destino não tem cai no último dele, 30/04 vira 28/02. O dia 1 dispensa
 * regra, porque o dia 1 é sempre o dia 1.
 */
export function sameDayInMonth(isoDate: string, targetMonth: string): string {
  const year = Number(isoDate.slice(0, 4))
  const month = Number(isoDate.slice(5, 7))
  const day = Number(isoDate.slice(8, 10))
  const targetYear = Number(targetMonth.slice(0, 4))
  const targetNumber = Number(targetMonth.slice(5, 7))
  const lastOfTarget = daysInMonth(targetYear, targetNumber)
  const isLastDay = day === daysInMonth(year, month)

  return toIso(targetYear, targetNumber, isLastDay ? lastOfTarget : Math.min(day, lastOfTarget))
}

/** Se o mês tem ao menos um dia dentro da cobertura. */
export function monthHasSelectableDay(
  month: string,
  limits: { min?: string; max?: string } = {},
): boolean {
  if (limits.max !== undefined && `${month}-01` > limits.max) return false
  if (limits.min !== undefined && lastDayOfMonth(month) < limits.min) return false

  return true
}

/** Anos do seletor: os da cobertura; sem cobertura, dez para cada lado do mês visível. */
export function pickerYears(
  visibleMonth: string,
  limits: { min?: string; max?: string } = {},
): number[] {
  const visibleYear = Number(visibleMonth.slice(0, 4))
  const first = limits.min !== undefined ? Number(limits.min.slice(0, 4)) : visibleYear - 10
  const last = limits.max !== undefined ? Number(limits.max.slice(0, 4)) : visibleYear + 10
  const years: number[] = []

  for (let year = first; year <= last; year += 1) years.push(year)

  return years
}

/** `AAAA-MM` a partir do ano e do número do mês. */
export function monthKey(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

/** `Jan` a `Dez`, os rótulos do seletor de mês. */
export const MONTH_SHORT_NAMES = [
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
] as const

/**
 * Hoje, pelo relógio de quem está usando, para o botão `Hoje` e a marca do
 * dia na grade. É a única conta do campo que lê o relógio: o período padrão
 * das páginas continua vindo da data máxima da base, como sempre.
 */
export function localToday(): string {
  const now = new Date()

  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/**
 * As seis semanas do mês, sempre completas, de domingo a sábado.
 *
 * A altura fixa de seis linhas evita o calendário mudar de tamanho ao trocar de
 * mês, que é o que faria o campo pular na tela.
 */
export function buildCalendarWeeks(
  month: string,
  limits: { min?: string; max?: string } = {},
): CalendarDay[][] {
  const year = Number(month.slice(0, 4))
  const number = Number(month.slice(5, 7))
  const firstWeekday = new Date(Date.UTC(year, number - 1, 1)).getUTCDay()
  const weeks: CalendarDay[][] = []

  for (let week = 0; week < 6; week += 1) {
    const days: CalendarDay[] = []

    for (let weekday = 0; weekday < 7; weekday += 1) {
      // Dia 1 menos o dia da semana em que ele cai: assim a grade começa no
      // domingo anterior, e os dias vizinhos aparecem no lugar certo.
      const offset = week * 7 + weekday - firstWeekday
      const date = new Date(Date.UTC(year, number - 1, 1 + offset))
      const iso = toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())

      days.push({
        iso,
        day: date.getUTCDate(),
        currentMonth: iso.slice(0, 7) === month,
        selectable: isSelectable(iso, limits.min, limits.max),
      })
    }

    weeks.push(days)
  }

  return weeks
}

/* ---------------------------------------------------------------------------
   Edição por partes, como no campo de data do navegador.

   O campo nativo trabalha em três partes, dia, mês e ano: as setas de lado
   trocam de parte, as de cima e de baixo somam e subtraem dentro dela, e o
   número digitado preenche a parte e passa para a seguinte. As contas dessas
   regras ficam aqui, medidas no próprio campo nativo em 10/09/2026: a soma dá
   a volta dentro da parte (dia 30 mais um vira 01, sem mexer no mês) e para de
   andar quando o resultado sairia da cobertura da base.
--------------------------------------------------------------------------- */

/** As três partes da data, na ordem em que aparecem em `dd/mm/aaaa`. */
export type DateSegment = 'day' | 'month' | 'year'

/** Onde cada parte começa e termina dentro do texto `dd/mm/aaaa`. */
export const SEGMENT_RANGES: Record<DateSegment, [number, number]> = {
  day: [0, 2],
  month: [3, 5],
  year: [6, 10],
}

const SEGMENT_ORDER: DateSegment[] = ['day', 'month', 'year']

/** A parte em que o cursor caiu, para o clique escolher onde editar. */
export function segmentAtCursor(position: number): DateSegment {
  if (position <= 2) return 'day'
  if (position <= 5) return 'month'

  return 'year'
}

/** Parte vizinha, sem sair das três: no fim, a seta de lado não faz nada. */
export function neighbourSegment(segment: DateSegment, delta: number): DateSegment {
  const index = SEGMENT_ORDER.indexOf(segment) + delta

  return SEGMENT_ORDER[Math.min(Math.max(index, 0), SEGMENT_ORDER.length - 1)]
}

/** Quantos números cabem na parte. */
function segmentSize(segment: DateSegment): number {
  return segment === 'year' ? 4 : 2
}

/** Data montada de novo com uma das partes trocada, com o dia cabendo no mês. */
function withSegment(isoDate: string, segment: DateSegment, valor: number): string {
  const year = segment === 'year' ? valor : Number(isoDate.slice(0, 4))
  const month = segment === 'month' ? valor : Number(isoDate.slice(5, 7))
  const day = segment === 'day' ? valor : Number(isoDate.slice(8, 10))

  // 31/01 com o mês somado vira 28/02, e não uma data que não existe.
  return toIso(year, month, Math.min(day, daysInMonth(year, month)))
}

/**
 * Soma ou subtrai na parte, como as setas de cima e de baixo do campo nativo.
 *
 * Dia e mês dão a volta sem tocar no resto da data, o ano anda livre, e o
 * resultado que sairia da cobertura é recusado: a data devolvida é a mesma.
 */
export function stepSegment(
  isoDate: string,
  segment: DateSegment,
  delta: number,
  limits: { min?: string; max?: string } = {},
): string {
  const year = Number(isoDate.slice(0, 4))
  const month = Number(isoDate.slice(5, 7))
  const day = Number(isoDate.slice(8, 10))
  let valor: number

  if (segment === 'year') {
    valor = year + delta
  } else if (segment === 'month') {
    valor = ((month - 1 + delta + 12) % 12) + 1
  } else {
    const total = daysInMonth(year, month)
    valor = ((day - 1 + delta + total) % total) + 1
  }

  const proposta = withSegment(isoDate, segment, valor)

  return isSelectable(proposta, limits.min, limits.max) ? proposta : isoDate
}

/**
 * Número digitado dentro da parte, no ritmo do campo nativo.
 *
 * `pending` são os números já digitados nesta parte. A parte fecha e o cursor
 * passa adiante quando ela enche, ou quando o número seguinte não caberia:
 * digitar 7 no dia fecha em 07, porque não existe dia começando em 7.
 */
export function typeInSegment(
  isoDate: string,
  segment: DateSegment,
  pending: string,
  digit: string,
  limits: { min?: string; max?: string } = {},
): { isoDate: string; pending: string; done: boolean } {
  const acumulado = `${pending}${digit}`.slice(-segmentSize(segment))
  const valor = Number(acumulado)
  const cheio = acumulado.length === segmentSize(segment)
  // Com uma casa só, o dia acima de 3 e o mês acima de 1 não podem receber
  // outro número: fecham na hora, como no campo nativo.
  const naoCabeMais =
    !cheio &&
    ((segment === 'day' && valor > 3) || (segment === 'month' && valor > 1))
  const fecha = cheio || naoCabeMais

  // Zero sozinho é um começo válido (o 0 de 07), e não uma parte com valor 0.
  if (valor === 0 && segment !== 'year') {
    return { isoDate, pending: acumulado, done: false }
  }

  const proposta = withSegment(isoDate, segment, valor)
  const aceita = isIsoDate(proposta) && isSelectable(proposta, limits.min, limits.max)

  return {
    isoDate: aceita ? proposta : isoDate,
    pending: fecha ? '' : acumulado,
    done: fecha,
  }
}

/** Texto `dd/mm/aaaa` com os números que estão sendo digitados na parte. */
export function draftWithPending(
  isoDate: string,
  segment: DateSegment,
  pending: string,
): string {
  const texto = brDateFromIso(isoDate)
  if (pending === '') return texto

  const [inicio, fim] = SEGMENT_RANGES[segment]
  const parte = pending.padStart(fim - inicio, '0')

  return `${texto.slice(0, inicio)}${parte}${texto.slice(fim)}`
}

/**
 * Se o campo deve aceitar o que acabou de ser digitado.
 *
 * Vale para o texto colado, único caminho que ainda entrega o campo inteiro de
 * uma vez. Com a data completa, um número a mais empurraria o último para fora
 * e embaralharia tudo, que foi o que apareceu na tela ao testar o campo:
 * `01/09/2026` com um `0` na frente virava `00/10/9202`.
 */
export function acceptsTyping(input: string): boolean {
  return input.replace(/\D/g, '').length <= 8
}

/**
 * Data digitada em `AAAA-MM-DD`, ou null enquanto ela não for uma data real.
 *
 * Incompleta é null, e 31/02 também: o campo só avisa a página quando o que
 * está escrito existe no calendário.
 */
export function isoFromBrDate(text: string): string | null {
  const digits = text.replace(/\D/g, '')
  if (digits.length !== 8) return null

  const iso = `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`

  return isIsoDate(iso) ? iso : null
}

/** `31/07/2026` a partir de `2026-07-31`. Vazio quando não há data. */
export function brDateFromIso(isoDate: string): string {
  if (!isIsoDate(isoDate)) return ''

  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(0, 4)}`
}
