import type { Pair } from '../../data/dashboardTypes'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import {
  matchesOverviewOsField,
  shiftISODate,
  type OverviewOsFilters,
} from '../../data/overviewOsFilters'
import { formatIsoClock, formatNumber } from '../../lib/formatters'
import { osStatusKind, type OsStatusKind } from './osStatusKind'

/**
 * Modelo da faixa "Hoje ao vivo" da Visão Geral.
 *
 * A faixa responde a pergunta que a página não respondia até 21/09/2026:
 * como está o dia de hoje, agora. Ela lê só as OS de hoje (agendadas para
 * hoje, ou criadas hoje sem agendamento), direto do serviço, e as separa em
 * cinco caixas na ordem em que o gestor
 * pergunta: quantas já foram concluídas, quantas estão em campo, quantas
 * ainda faltam, quantas falharam e quantas não vão acontecer.
 *
 * Os filtros da página valem aqui, MENOS o período e o status: o período é
 * sempre hoje, e o status é justamente o que a faixa abre.
 *
 * Desde 22/09/2026 a faixa também sinaliza o que precisa de ação, por decisão
 * do Mário e DENTRO do que já existe, em vez de ganhar caixas novas:
 *
 * - quantas das OS a fazer estão sem técnico, como detalhe da própria caixa
 *   `A fazer` (é lá que todas elas estão: sem técnico a OS não sai, não
 *   conclui e não fica improdutiva);
 * - uma linha de aviso, só quando existe caso, para a OS de dia anterior que
 *   continua aberta no aplicativo.
 */

export type TodayBucketKey =
  | 'done'
  | 'inField'
  | 'toDo'
  | 'unproductive'
  | 'notExecuted'
  | 'unknown'

/** Caixas da faixa, na ordem de exibição, cada uma ligada a uma situação. */
export const TODAY_BUCKETS = [
  { key: 'done', label: 'Concluídas', kind: 'completed' },
  { key: 'inField', label: 'Em campo', kind: 'in-field' },
  { key: 'toDo', label: 'A fazer', kind: 'to-do' },
  { key: 'unproductive', label: 'Improdutivas', kind: 'unproductive' },
  { key: 'notExecuted', label: 'Não executadas', kind: 'not-executed' },
  { key: 'unknown', label: 'Sem classificação', kind: 'unknown' },
] as const satisfies readonly { key: TodayBucketKey; label: string; kind: OsStatusKind }[]

/**
 * Caixa de cada situação, declarada como registro COMPLETO de `OsStatusKind`.
 *
 * Situação nova em `osStatusKind` sem caixa aqui vira erro de compilação. Com
 * uma busca na lista acima, o esquecimento só apareceria no primeiro registro
 * daquela situação, e aí a Visão Geral inteira quebraria na tela do gestor.
 */
const BUCKET_BY_KIND: Readonly<Record<OsStatusKind, TodayBucketKey>> = {
  completed: 'done',
  'in-field': 'inField',
  'to-do': 'toDo',
  unproductive: 'unproductive',
  'not-executed': 'notExecuted',
  unknown: 'unknown',
}

export type TodayBucket = {
  readonly key: TodayBucketKey
  readonly label: string
  readonly count: number
  /** Participação sobre a agenda do dia, de 0 a 1; zero com agenda vazia. */
  readonly share: number
  /** Status dentro da caixa, do mais frequente ao menos. */
  readonly statuses: readonly Pair[]
}

export type TodaySummary = {
  readonly total: number
  readonly buckets: readonly TodayBucket[]
}

const byPtBr = (a: string, b: string) => a.localeCompare(b, 'pt-BR')

/**
 * Resumo do dia. A caixa "sem classificação" só entra quando tem OS: ela
 * existe para uma chave nova do SGI não sumir da agenda, e não para ocupar
 * lugar todo dia com zero.
 */
export function buildTodaySummary(rows: readonly OverviewOsRecord[]): TodaySummary {
  const counts = new Map<TodayBucketKey, Map<string, number>>(
    TODAY_BUCKETS.map((bucket) => [bucket.key, new Map<string, number>()]),
  )

  for (const row of rows) {
    const statuses = counts.get(BUCKET_BY_KIND[osStatusKind(row.statusKey)])!
    statuses.set(row.status, (statuses.get(row.status) ?? 0) + 1)
  }

  const total = rows.length
  const buckets = TODAY_BUCKETS.flatMap((bucket): TodayBucket[] => {
    const statuses = [...counts.get(bucket.key)!.entries()].sort(
      (a, b) => b[1] - a[1] || byPtBr(a[0], b[0]),
    )
    const count = statuses.reduce((sum, [, value]) => sum + value, 0)
    if (bucket.key === 'unknown' && count === 0) return []

    return [{ key: bucket.key, label: bucket.label, count, share: total === 0 ? 0 : count / total, statuses }]
  })

  return { total, buckets }
}

/**
 * Caixa aberta na faixa: uma das situações, ou `all` para a agenda inteira,
 * que é a caixa "Agenda do dia". Fechada, a página guarda `null`.
 *
 * A lista do aviso de dias anteriores NÃO entra aqui: ela tem estado próprio
 * na faixa, para abrir e fechar sem mexer na caixa que o gestor deixou aberta
 * (apontado pelo Mário em 22/09/2026, quando abrir o aviso fechava a caixa e
 * fechá-lo não a devolvia).
 */
export type TodaySelection = TodayBucketKey | 'all'

/** Uma OS na lista que a caixa aberta mostra. */
export type TodayOsRow = {
  /** Código da OS no SGI (`OS-2026-1234`), que é o que o gestor procura lá. */
  readonly id: string
  /**
   * Data de agendamento, ISO. Só a janela de OS do período a preenche
   * (24/09/2026): na agenda de hoje todas as OS são do mesmo dia, e a lista
   * não tem a coluna.
   */
  readonly date?: string
  /** Turno do agendamento; null na OS sem período marcado no SGI. */
  readonly period: string | null
  /**
   * A OS não tem agendamento no SGI (15/10/2026): a Ativação Remota, que o
   * suporte faz à distância. A coluna Turno escreve "Sem agendamento" e a
   * lista a ordena como OS sem turno, mesmo que o SGI tenha gravado um (sem
   * data marcada ele não diz quando). A coluna Técnico diz "Sem técnico",
   * como em qualquer OS sem executor, mas ela não entra na conta "sem
   * técnico" da caixa A fazer, e a marca de risco de turno não vale para ela.
   */
  readonly unscheduled: boolean
  /**
   * Na OS sem técnico já fechada, quem a concluiu ou encerrou no SGI
   * (15/10/2026). A coluna Detalhe o mostra, e a busca acha pelo nome.
   */
  readonly endedBy: string | null
  readonly serviceType: string
  readonly category: string
  readonly city: string
  /** Nome do técnico; null sem executor e também quando o nome não veio. */
  readonly technician: string | null
  /**
   * Equipe do técnico como está no cadastro do SGI; null quando a OS não tem
   * executor ou ele ainda não foi vinculado a uma equipe. A coluna existe
   * desde 21/09/2026, a pedido do Mário: com o técnico sozinho, a lista não
   * dizia de qual frente era a visita.
   */
  readonly team: string | null
  /**
   * A OS TEM executor designado. Separado do nome de propósito: o serviço
   * deixa de fora do catálogo o técnico sem nome no cadastro do SGI, e sem
   * esta distinção a lista diria "Sem técnico" para uma OS que já tem dono,
   * o que levaria o gestor a designar alguém por cima de quem está com ela.
   */
  readonly hasTechnician: boolean
  /** Rótulo exato do status, porque a caixa junta vários deles. */
  readonly status: string
  /**
   * OS a fazer, sem técnico, de um turno que já começou: a MESMA régua da
   * caixa `A fazer` (`UNASSIGNED_ALERT_HOUR`), levada linha a linha para a
   * lista marcar quais são (aprovado pelo Mário em 22/09/2026). Fora da
   * régua a linha não se distingue das outras, de propósito: de manhã cedo
   * a lista inteira ficaria marcada por rotina.
   */
  readonly unassignedAtRisk: boolean
  /**
   * O que se sabe do desfecho, conforme a situação: a resolução na concluída,
   * o motivo na improdutiva, a hora em que o serviço começou na que está em
   * campo. Null quando não há o que dizer, e aí a coluna fica com um traço.
   */
  readonly detail: string | null
  /**
   * SLA e reagendamento (TSK-892, 13/10/2026). `slaMinutes` é o tempo
   * previsto de serviço da categoria; `serviceMinutes` é o tempo real, só na
   * concluída com início e fim marcados, para a coluna escrever "1h12 de
   * 1h30". O reagendamento é o último, com quantas vezes; zero é nunca.
   */
  readonly slaMinutes: number | null
  readonly serviceMinutes: number | null
  readonly rescheduleCount: number
  readonly rescheduledAt: string | null
  readonly rescheduledBy: string | null
  /** Colaborador do SGI ou login de cliente; null sem usuário gravado. */
  readonly rescheduledByKind: 'employee' | 'customer' | null
  readonly reschedulingReason: string | null
}

/**
 * Ordem dos turnos na lista, a mesma do dia de trabalho. Turno fora do de-para
 * do serviço vem depois dos dois conhecidos, e a OS sem período fica no fim:
 * ausência não se mistura com quem tem turno marcado.
 */
const PERIOD_ORDER: readonly string[] = ['Manhã', 'Tarde']

function periodRank(period: string | null): number {
  if (period === null) return PERIOD_ORDER.length + 1
  const index = PERIOD_ORDER.indexOf(period)

  return index === -1 ? PERIOD_ORDER.length : index
}

/** Ordem do executor na lista: com nome, sem nome no cadastro, sem executor. */
function technicianRank(row: TodayOsRow): number {
  if (row.technician !== null) return 0

  return row.hasTechnician ? 1 : 2
}

function detailOf(record: OverviewOsRecord): string | null {
  const kind = osStatusKind(record.statusKey)
  if (kind === 'completed') return record.resolution ?? null
  if (kind === 'unproductive') return record.unproductiveReason ?? null
  if (kind === 'in-field') {
    const clock = formatClock(record.startedAt ?? null)

    // "Iniciada", e não "em campo desde": a caixa Em campo inclui a OS que
    // espera aprovação do checklist, com o serviço já terminado, e dizer que
    // ela está na rua desde aquela hora seria falso.
    return clock === null ? null : `Iniciada às ${clock}`
  }

  return null
}

/**
 * Detalhe com quem fechou a OS sem técnico (decisão do Mário em
 * 16/10/2026): na encerrada, onde o Detalhe ficava vazio, "Encerrada por
 * Fulano"; na concluída, a resolução continua na frente, "Cliente Ativado,
 * por Fulano". É quem fez a Ativação Remota, à vista sem passar o mouse. A
 * planilha não muda: ela não leva o Detalhe, e tem coluna própria para o
 * nome.
 */
function detailWithEndedBy(record: OverviewOsRecord, endedBy: string | null): string | null {
  const detail = detailOf(record)
  if (endedBy === null) return detail

  return detail === null ? `${record.status} por ${endedBy}` : `${detail}, por ${endedBy}`
}

/**
 * Minutos de serviço no cliente, do início ao fim marcados no aplicativo, só
 * na OS CONCLUÍDA: é o tempo que se compara com o SLA da categoria. Nas
 * demais situações não há serviço inteiro para medir, e a improdutiva com
 * fim marcado diria um tempo que não é de serviço. Os dois horários vêm com
 * o fuso escrito, então a diferença não depende do relógio de quem olha.
 * Marcação invertida vira nulo, como o deslocamento negativo.
 */
export function serviceMinutesOf(record: OverviewOsRecord): number | null {
  if (osStatusKind(record.statusKey) !== 'completed') return null
  if (!record.startedAt || !record.finishedAt) return null
  const minutes = (Date.parse(record.finishedAt) - Date.parse(record.startedAt)) / 60_000

  return Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes) : null
}

/** Uma OS como a lista a mostra: nome no lugar do identificador, desfecho, risco. */
function toRow(
  record: OverviewOsRecord,
  technicianNames: ReadonlyMap<string, string>,
  hour: number | null,
): TodayOsRow {
  const rescheduleCount = record.rescheduledAt ? Math.max(record.rescheduleCount ?? 1, 1) : 0
  // O serviço só manda o nome na OS sem técnico; a guarda aqui mantém a
  // regra mesmo com uma fonte que o mande a mais.
  const endedBy = record.technicianId === null ? (record.endedBy ?? null) : null

  return {
    id: record.id,
    period: record.period ?? null,
    unscheduled: record.unscheduled === true,
    endedBy,
    serviceType: record.serviceType,
    category: record.category,
    city: record.city,
    technician:
      record.technicianId === null ? null : (technicianNames.get(record.technicianId) ?? null),
    team: record.team,
    hasTechnician: record.technicianId !== null,
    status: record.status,
    detail: detailWithEndedBy(record, endedBy),
    unassignedAtRisk: isUnassignedAtRisk(record, hour),
    slaMinutes: record.slaMinutes ?? null,
    serviceMinutes: serviceMinutesOf(record),
    rescheduleCount,
    rescheduledAt: rescheduleCount === 0 ? null : (record.rescheduledAt ?? null),
    rescheduledBy: rescheduleCount === 0 ? null : (record.rescheduledBy ?? null),
    rescheduledByKind: rescheduleCount === 0 ? null : (record.rescheduledByKind ?? null),
    reschedulingReason: rescheduleCount === 0 ? null : (record.reschedulingReason ?? null),
  }
}

/**
 * Linhas da lista de OS da caixa aberta.
 *
 * A ordem é a da operação: primeiro o turno, depois o técnico, depois o código
 * da OS. É assim que o gestor lê a agenda ("de manhã, o fulano tem estas"), e
 * deixa quem não tem turno ou executor no fim, visível, nunca escondido.
 *
 * O nome do técnico vem do catálogo do serviço, que só manda os técnicos com
 * OS no lote. Identificador sem nome fica nulo: mostrar o uuid na tela não
 * ajudaria ninguém.
 */
export function buildTodayRows(
  records: readonly OverviewOsRecord[],
  selection: TodaySelection,
  technicianNames: ReadonlyMap<string, string>,
  /** Hora da leitura do serviço, para a régua de turno; sem ela, nenhuma linha é marcada. */
  hour: number | null = null,
): TodayOsRow[] {
  const rows = records
    .filter(
      (record) =>
        selection === 'all' || BUCKET_BY_KIND[osStatusKind(record.statusKey)] === selection,
    )
    .map((record) => toRow(record, technicianNames, hour))

  return rows.sort(compareOperationOrder)
}

/**
 * Turno pelo qual a lista ordena: nenhum na OS sem agendamento, mesmo com
 * turno gravado no SGI, o mesmo que a coluna Turno escreve ("Sem
 * agendamento"). Sem isto a linha sairia no meio das da manhã com a célula
 * dizendo outra coisa.
 */
function listPeriod(row: Pick<TodayOsRow, 'period' | 'unscheduled'>): string | null {
  return row.unscheduled ? null : row.period
}

/**
 * Ordem da operação dentro de um dia: turno, técnico e código. É a regra da
 * agenda de hoje, e a janela do período a usa depois da data, para as duas
 * listas lerem o dia do mesmo jeito.
 */
export function compareOperationOrder(a: TodayOsRow, b: TodayOsRow): number {
  const periodA = listPeriod(a)
  const periodB = listPeriod(b)

  return (
    periodRank(periodA) - periodRank(periodB) ||
    byPtBr(periodA ?? '', periodB ?? '') ||
    // Dentro do turno: primeiro quem tem nome, depois o executor sem nome no
    // cadastro, e por último a OS sem executor. Ordenar pelo texto puro
    // jogaria os dois últimos para o começo, no lugar do vazio.
    technicianRank(a) - technicianRank(b) ||
    byPtBr(a.technician ?? '', b.technician ?? '') ||
    byPtBr(a.id, b.id)
  )
}

/**
 * Uma OS da janela do período (24/09/2026): a mesma linha da agenda de hoje,
 * com a data e a OS de origem. A origem viaja na linha porque a planilha
 * precisa de campos que a tela não mostra (grupo, destino, horários), e é da
 * linha visível, já recortada e ordenada, que ela sai.
 */
export type PeriodOsRow = TodayOsRow & {
  readonly date: string
  readonly source: OverviewOsRecord
}

/**
 * Linha da janela do período. Nenhuma marca de "sem técnico com o turno já
 * iniciado": a régua é da agenda de HOJE, e num dia passado ela marcaria
 * toda OS sem técnico como se ainda desse tempo de agir.
 */
export function toPeriodOsRow(
  record: OverviewOsRecord,
  technicianNames: ReadonlyMap<string, string>,
): PeriodOsRow {
  return { ...toRow(record, technicianNames, null), date: record.dateISO, source: record }
}

/** Campos da página que valem para a agenda de hoje: tudo, menos período e status. */
export const TODAY_FILTER_FIELDS = [
  'team',
  'technicianId',
  'serviceType',
  'category',
  'city',
] as const satisfies readonly (keyof OverviewOsFilters)[]

export function applyTodayFilters(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
): OverviewOsRecord[] {
  // Mesma regra da página, "Sem equipe" inclusive: com ela escolhida, a
  // faixa mostra as OS de hoje sem equipe, que é onde estão as sem técnico.
  return records.filter((record) =>
    TODAY_FILTER_FIELDS.every((field) => matchesOverviewOsField(record, field, filters[field])),
  )
}

/** true quando algum filtro que vale para hoje está diferente do neutro. */
export function hasTodayFilters(filters: OverviewOsFilters): boolean {
  return TODAY_FILTER_FIELDS.some((field) => filters[field].length > 0)
}

/**
 * Hora de uma data-hora ISO, como `16h16`, lida do próprio texto.
 *
 * O serviço escreve a hora já no fuso dele (`2026-09-18T16:16:01-03:00`), e
 * é essa hora que a faixa mostra. Desde 25/09/2026 a conta é a do portal
 * (`formatIsoClock`), a mesma da faixa de vendas.
 */
export function formatClock(iso: string | null): string | null {
  return formatIsoClock(iso)
}

/** Hora cheia de uma data-hora ISO, pelo mesmo caminho de `formatClock`. */
export function hourOf(iso: string | null): number | null {
  if (iso === null) return null
  const match = /T(\d{2}):/.exec(iso)

  return match === null ? null : Number(match[1])
}

/**
 * Hora a partir da qual uma OS sem técnico daquele turno vira sinal, e não
 * rotina.
 *
 * Régua aprovada pelo Mário em 22/09/2026, com a medição do SGI: a designação
 * do técnico é feita no PRÓPRIO dia da visita (999 das 1.112 OS de setembro),
 * então de manhã cedo ter dezenas de OS sem dono é o fluxo normal, e alertar
 * ali seria ruído que o gestor aprende a ignorar. Num dia útil, às 8h só um
 * terço das designações do dia aconteceu, ao meio-dia 71% e às 15h 96%. O que
 * é sinal de verdade é a OS sem técnico de um turno que JÁ COMEÇOU: o serviço
 * da manhã começa, na metade das vezes, até 10h12, e o da tarde até 15h18.
 *
 * A OS sem turno marcado (0,4% da base) segue a régua da tarde, a mais tardia:
 * na dúvida, avisar depois é melhor do que avisar à toa.
 */
export const UNASSIGNED_ALERT_HOUR: Readonly<Record<string, number>> = {
  Manhã: 10,
  Tarde: 15,
}

/** Régua de quem não tem turno marcado, e piso para turno fora do de-para. */
const UNASSIGNED_ALERT_HOUR_FALLBACK = 15

function alertHourOf(period: string | null): number {
  if (period === null) return UNASSIGNED_ALERT_HOUR_FALLBACK

  return UNASSIGNED_ALERT_HOUR[period] ?? UNASSIGNED_ALERT_HOUR_FALLBACK
}

/**
 * OS que ainda precisa de alguém: a fazer e sem executor designado.
 *
 * A OS sem agendamento não entra (15/10/2026): é a Ativação Remota, que o
 * suporte faz à distância, e ela nunca terá técnico. Contá-la seria alarme
 * falso toda tarde. É a mesma regra do serviço (`os_live.today_summary`),
 * que é quem conta as caixas desde 01/10/2026.
 */
function isUnassigned(record: OverviewOsRecord): boolean {
  return (
    osStatusKind(record.statusKey) === 'to-do' &&
    record.technicianId === null &&
    record.unscheduled !== true
  )
}

/**
 * A régua, num só lugar: a caixa conta com ela e a lista marca com ela. Sem
 * hora conhecida nada está em risco.
 */
function isUnassignedAtRisk(record: OverviewOsRecord, hour: number | null): boolean {
  return hour !== null && isUnassigned(record) && hour >= alertHourOf(record.period ?? null)
}

export type TodayUnassigned = {
  /** OS a fazer e sem técnico designado, no recorte inteiro do dia. */
  readonly total: number
  /** Quantas delas já passaram da hora do próprio turno. */
  readonly atRisk: number
  /**
   * Turno em risco quando é só um, para a frase poder nomeá-lo. Null quando
   * não há risco, quando o risco alcança mais de um turno, ou quando ele é de
   * OS sem turno marcado.
   */
  readonly riskPeriod: string | null
}

/**
 * OS de hoje que ainda precisam de alguém, e quantas delas já estão atrasadas
 * pela régua do turno.
 *
 * `hour` é a hora da leitura do serviço, e não o relógio do computador de quem
 * olha: é o mesmo horário que a faixa já exibe no subtítulo, e o que mantém o
 * teste independente da máquina. Sem hora conhecida não existe risco, só o
 * total: melhor um número sem alarme do que um alarme sem base.
 */
export function buildTodayUnassigned(
  rows: readonly OverviewOsRecord[],
  hour: number | null,
): TodayUnassigned {
  const pending = rows.filter(isUnassigned)
  const atRisk = pending.filter((row) => isUnassignedAtRisk(row, hour))
  const periods = new Set(atRisk.map((row) => row.period))

  return {
    total: pending.length,
    atRisk: atRisk.length,
    riskPeriod:
      periods.size === 1 ? ([...periods][0] ?? null) : null,
  }
}

/**
 * A mesma conta de `buildTodayUnassigned`, sobre as CONTAGENS por turno que
 * o serviço manda desde 01/10/2026, quando a faixa deixou de baixar as OS do
 * dia: a régua do turno continua aqui, aplicada com a hora da leitura.
 */
export function buildTodayUnassignedFromCounts(
  byPeriod: readonly { readonly period: string | null; readonly count: number }[],
  hour: number | null,
): TodayUnassigned {
  const pending = byPeriod.filter((item) => item.count > 0)
  const atRisk = pending.filter((item) => hour !== null && hour >= alertHourOf(item.period))
  const sum = (items: typeof pending) => items.reduce((total, item) => total + item.count, 0)

  return {
    total: sum(pending),
    atRisk: sum(atRisk),
    riskPeriod: atRisk.length === 1 ? atRisk[0].period : null,
  }
}

/** Texto do atalho do canto de uma caixa, pronto para o botão. */
export type CornerText = {
  readonly label: string
  readonly title: string
  readonly accessibleLabel: string
  /** true = cor de atenção e triângulo; false = cinza, só informação. */
  readonly attention: boolean
}

/**
 * Texto do atalho "sem técnico" no canto da caixa `A fazer`, no formato que
 * o Mário fechou em 23/09/2026:
 *
 * - antes da hora de qualquer turno, o TOTAL do dia, em cinza: "35 sem
 *   técnico". É informação, designar no dia é o fluxo normal;
 * - depois, só as ATRASADAS, em atenção, com o turno entre parênteses quando
 *   é um só: "8 sem técnico (manhã)". É o número que aponta para a ação, e a
 *   lista que o clique abre vem filtrada pelo mesmo turno, então legenda e
 *   lista dizem o mesmo número. As da tarde ainda no prazo saem da legenda
 *   até as 15h; o total do dia continua na dica.
 */
export function unassignedCornerLabel(unassigned: TodayUnassigned): CornerText | null {
  if (unassigned.total === 0) return null
  const total = formatNumber(unassigned.total)

  if (unassigned.atRisk === 0) {
    return {
      label: `${total} sem técnico`,
      title: `${total} OS a fazer sem técnico designado. Abrir a lista.`,
      accessibleLabel: `${total} OS a fazer sem técnico, ver na lista`,
      attention: false,
    }
  }

  const atRisk = formatNumber(unassigned.atRisk)
  const period = unassigned.riskPeriod?.toLocaleLowerCase('pt-BR') ?? null
  const all = unassigned.atRisk === unassigned.total
  const one = unassigned.atRisk === 1
  const late = all
    ? `${one ? 'Ela já passou' : 'Todas já passaram'} da hora em que o turno costuma começar.`
    : `${atRisk}${period === null ? '' : ` da ${period}`} já ${one ? 'passou' : 'passaram'} da hora em que o turno costuma começar.`

  return {
    label: `${atRisk} sem técnico${period === null ? '' : ` (${period})`}`,
    title: `${total} OS a fazer sem técnico. ${late} Abrir a lista.`,
    accessibleLabel: `${atRisk} OS sem técnico${period === null ? '' : ` da ${period}`} com o turno já iniciado, de ${total} no dia, ver na lista`,
    attention: true,
  }
}

/**
 * Rótulo do status da OS reagendada que ainda espera a nova data, como o
 * serviço o escreve. Exportado porque o atalho da caixa `A fazer` conta por
 * ele e abre a lista filtrada por ele na coluna Status: legenda e lista
 * precisam do MESMO texto.
 */
export const RESCHEDULED_STATUS_LABEL = 'Reagendada'

/**
 * Quantas OS a fazer de hoje já foram reagendadas: as de status Reagendada
 * na caixa `A fazer`, que a faixa já recebe status a status. Vale pelo
 * status, e não por um campo a mais, porque a OS reagendada fica nesse status
 * até o técnico sair (medido em 09/10/2026: 14 de 51 a fazer, e nenhuma
 * Agendada tinha reagendamento). Zero sem a caixa ou sem o status.
 */
export function rescheduledToDoCount(buckets: readonly TodayBucket[]): number {
  const toDo = buckets.find((bucket) => bucket.key === 'toDo')

  return toDo?.statuses.find(([label]) => label === RESCHEDULED_STATUS_LABEL)?.[1] ?? 0
}

/**
 * Texto do atalho "reagendadas" no canto da caixa `A fazer` (TSK-892, ideia
 * do Mário em 09/10/2026, aprovada em 13/10): sempre em atenção, porque é a
 * visita que já falhou uma vez e não pode falhar de novo. O clique abre a
 * lista de A fazer filtrada por Status = Reagendada, então legenda e lista
 * dizem o mesmo número.
 */
export function rescheduledCornerLabel(count: number): CornerText | null {
  if (count <= 0) return null
  const total = formatNumber(count)
  const one = count === 1

  return {
    label: `${total} reagendada${one ? '' : 's'}`,
    title: `${total} OS a fazer ${one ? 'já foi reagendada' : 'já foram reagendadas'} ao menos uma vez. Abrir a lista.`,
    accessibleLabel: `${total} OS a fazer ${one ? 'reagendada' : 'reagendadas'}, ver na lista`,
    attention: true,
  }
}

/** Uma OS de dia anterior que o aplicativo nunca fechou. */
export type CarryOverOs = {
  readonly id: string
  readonly dateISO: string
  readonly serviceType: string
  readonly status: string
  /** Hora em que o serviço começou, quando a OS chegou a ser iniciada. */
  readonly startedAt: string | null
}

/**
 * OS de dias anteriores que continuam abertas.
 *
 * Existem porque o SGI só expira sozinho a OS que NINGUÉM iniciou: a que o
 * técnico começou e não fechou no aplicativo fica parada no status em que
 * estava, sem prazo para sair de lá. Medido em 22/09/2026: uma única OS em
 * catorze dias, a OS-2026-6623, com o técnico no local desde as 16h53 do dia
 * anterior. É exceção, e por isso vira aviso pontual e não indicador fixo.
 *
 * A mais antiga primeiro: é a que está parada há mais tempo.
 */
export function buildCarryOverOs(
  rows: readonly OverviewOsRecord[],
  today: string,
): CarryOverOs[] {
  return rows
    .filter((row) => isCarryOver(row, today))
    .map((row) => ({
      id: row.id,
      dateISO: row.dateISO,
      serviceType: row.serviceType,
      status: row.status,
      startedAt: row.startedAt ?? null,
    }))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || byPtBr(a.id, b.id))
}

/** OS de dia anterior que ainda não teve desfecho: em campo ou a fazer. */
function isCarryOver(record: OverviewOsRecord, today: string): boolean {
  if (record.dateISO >= today) return false
  const kind = osStatusKind(record.statusKey)

  return kind === 'in-field' || kind === 'to-do'
}

/**
 * Linhas da lista que o aviso de dias anteriores abre (aprovado pelo Mário
 * em 22/09/2026). É a MESMA tabela das caixas; o que muda é o Detalhe, que
 * aqui leva a DATA da OS: é a coluna que a lista de hoje não precisa ter, e a
 * primeira pergunta sobre uma OS que ficou para trás é de quando ela é.
 *
 * A mais antiga primeiro, que é a parada há mais tempo. Sem a marca de risco
 * de turno: a lista inteira já é o alerta, e marcar linha a linha repetiria o
 * mesmo aviso.
 */
export function buildCarryOverRows(
  records: readonly OverviewOsRecord[],
  today: string,
  technicianNames: ReadonlyMap<string, string>,
  formatDate: (iso: string) => string,
): TodayOsRow[] {
  return records
    .filter((record) => isCarryOver(record, today))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || byPtBr(a.id, b.id))
    .map((record) => {
      const clock = formatClock(record.startedAt ?? null)
      // Curto de propósito: a coluna Detalhe tem largura fixa, e "de
      // 21/09/2026 · iniciada às 16h53" não cabia nela. O aviso acima da
      // lista já diz a frase inteira.
      const since = clock === null ? 'nunca iniciada' : `início ${clock}`

      return { ...toRow(record, technicianNames, null), detail: `${formatDate(record.dateISO)} · ${since}` }
    })
}

/**
 * Só as OS do dia (pelo agendamento, ou pela criação na OS sem agendamento),
 * dentro da janela que a faixa carrega.
 */
export function todayOnly(
  rows: readonly OverviewOsRecord[],
  today: string,
): OverviewOsRecord[] {
  return rows.filter((row) => row.dateISO === today)
}

/**
 * Texto do atalho de dias anteriores no canto da caixa `Em campo` (decisão
 * do Mário em 23/09/2026, o mesmo desenho do atalho "sem técnico").
 *
 * A legenda é número mais uma qualificação só, "1 de ontem", fechada com o
 * Mário em 23/09/2026 depois de duas tentativas: "+1 de ontem" lia como
 * variação, e "1 OS em aberto" foi lida como "1 das 13" (por ele mesmo).
 * Dentro de uma caixa que conta o dia de hoje, "de ontem" já diz que soma por
 * fora; "OS" e "em aberto" saíram porque a faixa é de OS e a caixa já diz o
 * estado. A frase inteira fica na dica e na leitura acessível.
 */
export function carryOverCornerLabel(
  rows: readonly CarryOverOs[],
  today: string,
): CornerText | null {
  if (rows.length === 0) return null
  const count = formatNumber(rows.length)
  const allYesterday = rows.every((row) => row.dateISO === shiftISODate(today, -1))
  const when = allYesterday ? 'de ontem' : 'de dias anteriores'
  const one = rows.length === 1

  return {
    label: `${count} ${when}`,
    title: `${count} OS ${when} ${one ? 'continua aberta' : 'continuam abertas'} no aplicativo. ${one ? 'Ela não está' : 'Elas não estão'} no número de hoje. Abrir a lista.`,
    accessibleLabel: `${count} OS ${when} em aberto no aplicativo, fora do número de hoje, ver na lista`,
    attention: true,
  }
}

/**
 * Frase do aviso de dias anteriores, ou null quando não há nenhum caso.
 *
 * Com uma OS só, que é o caso comum, a frase NOMEIA a OS: é o que permite
 * procurá-la no SGI sem abrir mais nada. Com várias, conta e aponta a mais
 * antiga, para o gestor saber o tamanho do problema sem uma lista nova dentro
 * da faixa.
 */
export function carryOverMessage(
  rows: readonly CarryOverOs[],
  today: string,
  formatDate: (iso: string) => string,
): string | null {
  if (rows.length === 0) return null
  const [first] = rows
  const yesterday = shiftISODate(today, -1)
  const whenOf = (iso: string) => (iso === yesterday ? 'de ontem' : `de ${formatDate(iso)}`)

  if (rows.length === 1) {
    const clock = formatClock(first.startedAt)
    const since =
      clock === null
        ? `continua em ${first.status}`
        : `continua aberta no aplicativo, iniciada às ${clock}`

    // Sem "a OS" antes do código: ele já começa por OS no SGI, e a frase saía
    // com a palavra repetida ("a OS OS-2026-6623").
    return `De dias anteriores: a ${first.id} ${whenOf(first.dateISO)}, ${first.serviceType.toLocaleLowerCase('pt-BR')}, ${since}.`
  }

  return `De dias anteriores: ${formatNumber(rows.length)} OS continuam abertas no aplicativo. A mais antiga é a ${first.id}, ${whenOf(first.dateISO)}.`
}
