import { BiApiError, fetchFromBiApi, type QueryParams } from './biApiClient'

/**
 * Fonte da página Agenda e capacidade (16/10/2026): a resposta de
 * `/bi/os/calendar/schedule`, um registro por dia, convertida na projeção que
 * a página consome.
 *
 * As CONTAS vivem no serviço (`app/services/bi/os_schedule.py` do
 * impacto-bi-service): a conta de capacidade do SGI espelhada, a mesma conta
 * com os técnicos presentes e o cadastro de aptidões. Aqui só mora a forma: a
 * validação é de formato (data ISO, número finito, contagem inteira), não de
 * vocabulário, e um campo fora do formato derruba a leitura com uma mensagem
 * em português em vez de deixar um `NaN` chegar à tela.
 */

/** Uma régua: quantos técnicos entram na conta, quantas horas cabem e quanto já está tomado. */
export type OsScheduleGauge = {
  /** Nulo quando não há como estimar (dia futuro sem histórico do dia da semana). */
  readonly technicians: number | null
  readonly capacityHours: number | null
  /** Consumo sobre capacidade, SEM teto: 1,5 é 150%; nulo sem capacidade. */
  readonly occupation: number | null
}

export type OsSchedulePeriodLoad = {
  readonly periodKey: string
  readonly period: string
  /** OS que consomem agenda no turno. */
  readonly scheduled: number
  /** Soma das horas previstas (SLA da categoria) dessas OS. */
  readonly consumedHours: number
  /** A conta do SGI: técnicos ativos do cadastro. */
  readonly scheduler: OsScheduleGauge
  /** A mesma conta com os técnicos presentes. */
  readonly operation: OsScheduleGauge
}

export type OsScheduleCategoryPeriod = {
  readonly periodKey: string
  readonly period: string
  /** OS da PRÓPRIA categoria no turno. */
  readonly scheduled: number
  /** Horas de todas as categorias que os técnicos aptos atendem (consumo compartilhado). */
  readonly consumedHours: number
  readonly capacityHours: number
  readonly occupation: number | null
  /** Mais uma OS desta categoria não cabe: o agendamento recusa a data. */
  readonly full: boolean
}

export type OsScheduleCategory = {
  readonly id: string
  readonly name: string
  readonly serviceType: string
  readonly slaHours: number | null
  readonly aptTechnicians: number
  readonly scheduled: number
  readonly consumedHours: number
  readonly capacityHours: number
  readonly occupation: number | null
  /** Em quantos turnos do dia o agendamento recusa esta categoria. */
  readonly fullPeriods: number
  readonly periods: readonly OsScheduleCategoryPeriod[]
}

/**
 * Um registro do cadastro de feriados do SGI que cai no dia (20/10/2026). O
 * gestor de OS usa esse cadastro também para TRAVAR a rota (chuva,
 * barramento): sem equipes fecha o dia, com equipes só a rota delas.
 */
export type OsScheduleClosure = {
  /** O nome do dia como o gestor escreveu; pode vir vazio ou "-". */
  readonly name: string
  /** O feriado que agrupa o dia; "Fixos (padrão do sistema)" no calendário. */
  readonly group: string
  /** Equipes da rota travada; vazia quando fecha o dia todo. */
  readonly teams: readonly string[]
}

export type OsScheduleDayKind = 'past' | 'today' | 'future'

/** De onde saiu o número de presentes da régua da operação. */
export type OsSchedulePresenceBasis = 'executed' | 'assigned_or_available' | 'typical_weekday'

export type OsScheduleDay = {
  readonly day: string
  readonly kind: OsScheduleDayKind
  /** Feriado geral no cadastro do SGI: a grade não oferece o dia. */
  readonly closed: boolean
  /** Equipes com rota fechada no dia, pelo nome. */
  readonly closedTeams: readonly string[]
  /** Os registros do cadastro de feriados do dia, com o nome; vazia em resposta antiga. */
  readonly closures: readonly OsScheduleClosure[]
  /** OS que consomem agenda no dia, com ou sem turno. */
  readonly scheduled: number
  readonly withoutPeriod: number
  readonly ordersWithoutSla: number
  readonly consumedHours: number
  readonly scheduler: OsScheduleGauge
  readonly operation: OsScheduleGauge
  readonly presenceBasis: OsSchedulePresenceBasis | null
  readonly periods: readonly OsSchedulePeriodLoad[]
  /** Só categorias com OS no dia, da mais apertada à mais folgada. */
  readonly categories: readonly OsScheduleCategory[]
}

/** Um técnico que executou a categoria sem ter a aptidão cadastrada. */
export type OsScheduleRegistryTechnician = {
  readonly id: string
  readonly name: string
  /** Equipes pelo nome; vazia quando o técnico não está em nenhuma. */
  readonly teams: readonly string[]
  /** Inativo não precisa de cadastro: já saiu. */
  readonly active: boolean
  readonly orders: number
}

export type OsScheduleRegistryRow = {
  readonly id: string
  readonly name: string
  readonly serviceType: string
  readonly slaHours: number | null
  readonly aptTechnicians: number
  /** Técnicos distintos que concluíram ou tiveram improdutiva na categoria. */
  readonly executedBy: number
  /** Desses, quantos não têm a aptidão cadastrada. */
  readonly executedWithoutCapability: number
  readonly orders: number
  /** Quem executou sem a aptidão, do que mais executou ao que menos; vazia em resposta antiga. */
  readonly technicians: readonly OsScheduleRegistryTechnician[]
}

/** O primeiro turno em que a grade de datas do SGI oferece a categoria. */
export type OsScheduleNextSlot = {
  readonly day: string
  readonly periodKey: string
  readonly period: string
  /** Consumo compartilhado dos técnicos aptos nesse turno. */
  readonly consumedHours: number
  /** Capacidade dos técnicos aptos nesse turno. */
  readonly capacityHours: number
}

/**
 * A próxima agenda disponível de uma categoria (22/10/2026): o que o
 * atendente recebe da grade de datas do SGI ao marcar uma OS dela, de hoje
 * até o fim da leitura. Uma linha por categoria viva do cadastro, com ou sem
 * OS, na ordem dos tipos do portal e depois pelo nome.
 */
export type OsScheduleCategoryAvailability = {
  readonly id: string
  readonly name: string
  readonly serviceType: string
  readonly slaHours: number | null
  /** Técnicos ativos com aptidão na categoria, no cadastro de hoje. */
  readonly aptTechnicians: number
  /** Infra e auditoria: a grade do SGI nunca as recusa. */
  readonly alwaysAvailable: boolean
  /** Nulo quando nenhum turno da leitura a oferece: sem técnico apto, ou cheia até o fim. */
  readonly next: OsScheduleNextSlot | null
}

export type OsSchedulePeriodRule = {
  readonly key: string
  readonly label: string
  readonly startHour: number | null
  readonly limitHour: number | null
}

export type OsScheduleParameters = {
  readonly periodDurationHours: number
  readonly efficiency: number
  /** duração x eficiência: o que um técnico entrega num turno. */
  readonly hoursPerTechnicianPeriod: number
  readonly weekendSchedulingEnabled: boolean
  /** Técnicos ativos no cadastro, os que o SGI conta. */
  readonly activeTechnicians: number
  /** Ativos com o botão de disponível ligado no aplicativo agora. */
  readonly availableNow: number
  readonly periods: readonly OsSchedulePeriodRule[]
}

export type OsScheduleSource = {
  /** Hora em que o serviço leu o banco, em ISO com fuso. */
  readonly generatedAt: string
  readonly today: string
  readonly dateFrom: string
  readonly dateTo: string
  /** Dias para trás que a presença típica e o cadastro olham. */
  readonly historyDays: number
  readonly parameters: OsScheduleParameters
  readonly days: readonly OsScheduleDay[]
  readonly registry: readonly OsScheduleRegistryRow[]
  /** A próxima agenda de cada categoria viva; vazia em resposta de serviço anterior a 22/10/2026. */
  readonly availability: readonly OsScheduleCategoryAvailability[]
}

const OS_SCHEDULE_PATH = 'v1/bi/os/calendar/schedule'

/** A janela pedida ao serviço: primeiro e último dia, em `aaaa-mm-dd`. */
export type OsScheduleWindow = { readonly from: string; readonly to: string }

/**
 * Os parâmetros da consulta. Sem janela, o serviço usa a dele (os 7 dias
 * anteriores e os 7 a partir de hoje); o calendário pede as semanas que
 * desenha (19/10/2026), até os 45 dias que o serviço aceita.
 */
export function scheduleQueryParams(window?: OsScheduleWindow): QueryParams | undefined {
  return window === undefined ? undefined : { date_from: window.from, date_to: window.to }
}

export async function fetchOsSchedule(window?: OsScheduleWindow): Promise<OsScheduleSource> {
  const response = await fetchFromBiApi<unknown>(OS_SCHEDULE_PATH, scheduleQueryParams(window))

  return parseOsSchedule(response)
}

type Raw = Record<string, unknown>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function fail(message: string): never {
  throw new BiApiError(message)
}

function rawObject(value: unknown, field: string): Raw {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`A API devolveu ${field} fora do formato esperado.`)
  }
  return value as Raw
}

function asList(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(`A API devolveu ${field} fora do formato de lista.`)
  return value
}

function isoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    fail(`A API devolveu ${field} fora do formato aaaa-mm-dd.`)
  }
  return value
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value === '') fail(`A API devolveu ${field} vazio.`)
  return value
}

/** Texto que pode vir vazio: o nome de um feriado, por exemplo. */
function optionalText(value: unknown, field: string): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string') fail(`A API devolveu ${field} sem um texto.`)
  return value
}

function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`A API devolveu ${field} sem um número válido.`)
  }
  return value
}

function nullableFinite(value: unknown, field: string): number | null {
  return value === null || value === undefined ? null : finite(value, field)
}

function count(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`A API devolveu ${field} sem uma contagem válida.`)
  }
  return value
}

function nullableInt(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(`A API devolveu ${field} sem um inteiro válido.`)
  }
  return value
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') fail(`A API devolveu ${field} sem um valor lógico.`)
  return value
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(`A API devolveu ${field} fora dos valores previstos.`)
  }
  return value as T
}

function textList(value: unknown, field: string): readonly string[] {
  return asList(value, field).map((item) => text(item, field))
}

function gaugeOf(value: unknown, field: string): OsScheduleGauge {
  const raw = rawObject(value, field)

  return {
    technicians: nullableInt(raw.technicians, `os técnicos de ${field}`),
    capacityHours: nullableFinite(raw.capacity_hours, `a capacidade de ${field}`),
    occupation: nullableFinite(raw.occupation, `a ocupação de ${field}`),
  }
}

function periodLoadOf(value: unknown): OsSchedulePeriodLoad {
  const raw = rawObject(value, 'a carga de um turno')
  const period = text(raw.period, 'o nome do turno')

  return {
    periodKey: text(raw.period_key, 'a chave do turno'),
    period,
    scheduled: count(raw.scheduled, `as OS do turno ${period}`),
    consumedHours: finite(raw.consumed_hours, `as horas do turno ${period}`),
    scheduler: gaugeOf(raw.scheduler, `a régua do agendamento no turno ${period}`),
    operation: gaugeOf(raw.operation, `a régua da operação no turno ${period}`),
  }
}

function categoryPeriodOf(value: unknown, category: string): OsScheduleCategoryPeriod {
  const raw = rawObject(value, `um turno da categoria ${category}`)
  const period = text(raw.period, `o nome do turno da categoria ${category}`)
  const field = `${category} em ${period}`

  return {
    periodKey: text(raw.period_key, `a chave do turno de ${field}`),
    period,
    scheduled: count(raw.scheduled, `as OS de ${field}`),
    consumedHours: finite(raw.consumed_hours, `o consumo de ${field}`),
    capacityHours: finite(raw.capacity_hours, `a capacidade de ${field}`),
    occupation: nullableFinite(raw.occupation, `a ocupação de ${field}`),
    full: bool(raw.full, `o cheio de ${field}`),
  }
}

function categoryOf(value: unknown): OsScheduleCategory {
  const raw = rawObject(value, 'uma categoria do dia')
  const name = text(raw.name, 'o nome de uma categoria')

  return {
    id: text(raw.id, `o identificador da categoria ${name}`),
    name,
    serviceType: text(raw.service_type, `o tipo da categoria ${name}`),
    slaHours: nullableFinite(raw.sla_hours, `as horas previstas da categoria ${name}`),
    aptTechnicians: count(raw.apt_technicians, `os técnicos aptos em ${name}`),
    scheduled: count(raw.scheduled, `as OS de ${name}`),
    consumedHours: finite(raw.consumed_hours, `o consumo de ${name}`),
    capacityHours: finite(raw.capacity_hours, `a capacidade de ${name}`),
    occupation: nullableFinite(raw.occupation, `a ocupação de ${name}`),
    fullPeriods: count(raw.full_periods, `os turnos cheios de ${name}`),
    periods: asList(raw.periods, `os turnos da categoria ${name}`).map((item) => categoryPeriodOf(item, name)),
  }
}

function dayOf(value: unknown): OsScheduleDay {
  const raw = rawObject(value, 'um dia da agenda')
  const day = isoDate(raw.day, 'a data de um dia da agenda')

  return {
    day,
    kind: oneOf(raw.kind, ['past', 'today', 'future'] as const, `a natureza do dia ${day}`),
    closed: bool(raw.closed, `o fechamento do dia ${day}`),
    closedTeams: textList(raw.closed_teams, `as equipes com rota fechada em ${day}`),
    closures:
      raw.closures === undefined
        ? []
        : asList(raw.closures, `os feriados do dia ${day}`).map((item) => {
            const closure = rawObject(item, `um feriado do dia ${day}`)

            return {
              name: optionalText(closure.name, `o nome de um feriado do dia ${day}`),
              group: optionalText(closure.group, `o grupo de um feriado do dia ${day}`),
              teams: textList(closure.teams, `as equipes de um feriado do dia ${day}`),
            }
          }),
    scheduled: count(raw.scheduled, `as OS do dia ${day}`),
    withoutPeriod: count(raw.without_period, `as OS sem turno do dia ${day}`),
    ordersWithoutSla: count(raw.orders_without_sla, `as OS sem horas previstas do dia ${day}`),
    consumedHours: finite(raw.consumed_hours, `as horas do dia ${day}`),
    scheduler: gaugeOf(raw.scheduler, `a régua do agendamento do dia ${day}`),
    operation: gaugeOf(raw.operation, `a régua da operação do dia ${day}`),
    presenceBasis:
      raw.presence_basis === null || raw.presence_basis === undefined
        ? null
        : oneOf(
            raw.presence_basis,
            ['executed', 'assigned_or_available', 'typical_weekday'] as const,
            `a base de presença do dia ${day}`,
          ),
    periods: asList(raw.periods, `os turnos do dia ${day}`).map(periodLoadOf),
    categories: asList(raw.categories, `as categorias do dia ${day}`).map(categoryOf),
  }
}

function registryRowOf(value: unknown): OsScheduleRegistryRow {
  const raw = rawObject(value, 'uma linha do cadastro de aptidões')
  const name = text(raw.name, 'o nome de uma categoria do cadastro')

  return {
    id: text(raw.id, `o identificador da categoria ${name}`),
    name,
    serviceType: text(raw.service_type, `o tipo da categoria ${name}`),
    slaHours: nullableFinite(raw.sla_hours, `as horas previstas da categoria ${name}`),
    aptTechnicians: count(raw.apt_technicians, `os aptos em ${name}`),
    executedBy: count(raw.executed_by, `quem executou ${name}`),
    executedWithoutCapability: count(raw.executed_without_capability, `quem executou ${name} sem aptidão`),
    orders: count(raw.orders, `as OS de ${name} no histórico`),
    technicians:
      raw.technicians === undefined || raw.technicians === null
        ? []
        : asList(raw.technicians, `os técnicos sem aptidão em ${name}`).map((item) => technicianOf(item, name)),
  }
}

function technicianOf(value: unknown, category: string): OsScheduleRegistryTechnician {
  const raw = rawObject(value, `um técnico sem aptidão em ${category}`)
  const name = text(raw.name, `o nome de um técnico sem aptidão em ${category}`)

  return {
    id: text(raw.id, `o identificador do técnico ${name}`),
    name,
    teams: textList(raw.teams, `as equipes do técnico ${name}`),
    active: bool(raw.active, `a situação do técnico ${name}`),
    orders: count(raw.orders, `as OS de ${name} em ${category}`),
  }
}

function nextSlotOf(value: unknown, category: string): OsScheduleNextSlot | null {
  if (value === null || value === undefined) return null
  const raw = rawObject(value, `a próxima agenda de ${category}`)
  const period = text(raw.period, `o nome do turno da próxima agenda de ${category}`)

  return {
    day: isoDate(raw.day, `o dia da próxima agenda de ${category}`),
    periodKey: text(raw.period_key, `a chave do turno da próxima agenda de ${category}`),
    period,
    consumedHours: finite(raw.consumed_hours, `o consumo da próxima agenda de ${category}`),
    capacityHours: finite(raw.capacity_hours, `a capacidade da próxima agenda de ${category}`),
  }
}

function availabilityOf(value: unknown): OsScheduleCategoryAvailability {
  const raw = rawObject(value, 'a próxima agenda de uma categoria')
  const name = text(raw.name, 'o nome de uma categoria da próxima agenda')

  return {
    id: text(raw.id, `o identificador da categoria ${name}`),
    name,
    serviceType: text(raw.service_type, `o tipo da categoria ${name}`),
    slaHours: nullableFinite(raw.sla_hours, `as horas previstas da categoria ${name}`),
    aptTechnicians: count(raw.apt_technicians, `os técnicos aptos em ${name}`),
    alwaysAvailable: bool(raw.always_available, `a regra de recusa de ${name}`),
    next: nextSlotOf(raw.next, name),
  }
}

function parametersOf(value: unknown): OsScheduleParameters {
  const raw = rawObject(value, 'os parâmetros da conta')

  return {
    periodDurationHours: finite(raw.period_duration_hours, 'a duração do turno'),
    efficiency: finite(raw.efficiency, 'a eficiência do turno'),
    hoursPerTechnicianPeriod: finite(raw.hours_per_technician_period, 'as horas por técnico por turno'),
    weekendSchedulingEnabled: bool(raw.weekend_scheduling_enabled, 'o agendamento no fim de semana'),
    activeTechnicians: count(raw.active_technicians, 'os técnicos ativos'),
    availableNow: count(raw.available_now, 'os técnicos disponíveis agora'),
    periods: asList(raw.periods, 'os turnos cadastrados').map((item): OsSchedulePeriodRule => {
      const rule = rawObject(item, 'um turno cadastrado')
      const label = text(rule.label, 'o nome de um turno cadastrado')

      return {
        key: text(rule.key, `a chave do turno ${label}`),
        label,
        startHour: nullableInt(rule.start_hour, `a hora de início do turno ${label}`),
        limitHour: nullableInt(rule.limit_hour, `a hora limite do turno ${label}`),
      }
    }),
  }
}

/**
 * Converte a resposta de `/bi/os/calendar/schedule` na projeção da página.
 * Separada da busca para os testes lerem respostas do serviço pelo mesmo
 * caminho da página.
 */
export function parseOsSchedule(raw: unknown): OsScheduleSource {
  const response = rawObject(raw, 'a agenda')

  return {
    generatedAt: text(response.generated_at, 'a hora da leitura'),
    today: isoDate(response.today, 'o dia de hoje'),
    dateFrom: isoDate(response.date_from, 'o primeiro dia da janela'),
    dateTo: isoDate(response.date_to, 'o último dia da janela'),
    historyDays: count(response.history_days, 'os dias de histórico'),
    parameters: parametersOf(response.parameters),
    days: asList(response.days, 'os dias da agenda').map(dayOf),
    registry: asList(response.registry, 'o cadastro de aptidões').map(registryRowOf),
    // Serviço anterior a 22/10/2026 não manda a lista: a página fica sem os
    // filtros Tipo de OS e Categoria, e não sem a agenda inteira.
    availability:
      response.availability === undefined || response.availability === null
        ? []
        : asList(response.availability, 'a próxima agenda por categoria').map(availabilityOf),
  }
}

// --- Calendário de uma categoria (22/10/2026) ----------------------------------

/** A categoria do calendário por categoria, como o cadastro do SGI a descreve. */
export type OsScheduleCategoryInfo = {
  readonly id: string
  readonly name: string
  readonly serviceType: string
  readonly slaHours: number | null
  /** Infra e auditoria: a grade do SGI nunca as recusa. */
  readonly alwaysAvailable: boolean
}

/** Um turno da categoria, pela grade de datas do SGI. */
export type OsScheduleCategoryCalendarPeriod = {
  readonly periodKey: string
  readonly period: string
  /** OS da própria categoria no turno. */
  readonly scheduled: number
  /** Horas de tudo o que os técnicos aptos atendem (consumo compartilhado). */
  readonly consumedHours: number
  /** Capacidade dos técnicos aptos no turno. */
  readonly capacityHours: number
  /** Consumo sobre capacidade, sem teto; nulo sem capacidade. */
  readonly occupation: number | null
  /** Mais uma OS da categoria não cabe; sempre falso em infra e auditoria. */
  readonly full: boolean
  /** Quantas OS da categoria ainda cabem; nulo em infra e auditoria, sem horas previstas ou sem capacidade. */
  readonly fits: number | null
  /** A config do SGI não oferece este turno no fim de semana. */
  readonly weekendClosed: boolean
}

export type OsScheduleCategoryCalendarDay = {
  readonly day: string
  readonly kind: OsScheduleDayKind
  /** Feriado geral no cadastro do SGI. */
  readonly closed: boolean
  /** Técnicos aptos na conta do dia: ativos naquele dia e, de hoje em diante, sem a rota travada. */
  readonly aptTechnicians: number
  readonly periods: readonly OsScheduleCategoryCalendarPeriod[]
}

/**
 * O calendário de uma categoria (22/10/2026): a grade de datas do SGI turno a
 * turno, em todos os dias da janela, com ou sem OS da categoria. É o que o
 * calendário mostra com o filtro Categoria escolhido.
 */
export type OsScheduleCategorySource = {
  readonly generatedAt: string
  readonly today: string
  readonly dateFrom: string
  readonly dateTo: string
  readonly category: OsScheduleCategoryInfo
  readonly days: readonly OsScheduleCategoryCalendarDay[]
}

const OS_SCHEDULE_CATEGORY_PATH = 'v1/bi/os/calendar/schedule/category'

export async function fetchOsScheduleCategory(
  window: OsScheduleWindow,
  categoryId: string,
): Promise<OsScheduleCategorySource> {
  const response = await fetchFromBiApi<unknown>(OS_SCHEDULE_CATEGORY_PATH, {
    ...scheduleQueryParams(window),
    category_id: categoryId,
  })

  return parseOsScheduleCategory(response)
}

function categoryCalendarPeriodOf(value: unknown, day: string): OsScheduleCategoryCalendarPeriod {
  const raw = rawObject(value, `um turno do dia ${day}`)
  const period = text(raw.period, `o nome de um turno do dia ${day}`)
  const field = `${period} de ${day}`

  return {
    periodKey: text(raw.period_key, `a chave do turno ${field}`),
    period,
    scheduled: count(raw.scheduled, `as OS da categoria em ${field}`),
    consumedHours: finite(raw.consumed_hours, `o consumo de ${field}`),
    capacityHours: finite(raw.capacity_hours, `a capacidade de ${field}`),
    occupation: nullableFinite(raw.occupation, `a ocupação de ${field}`),
    full: bool(raw.full, `o cheio de ${field}`),
    fits: raw.fits === null || raw.fits === undefined ? null : count(raw.fits, `as vagas de ${field}`),
    weekendClosed: bool(raw.weekend_closed, `o fim de semana de ${field}`),
  }
}

/**
 * Converte a resposta de `/bi/os/calendar/schedule/category`. Separada da
 * busca para os testes lerem respostas do serviço pelo mesmo caminho.
 */
export function parseOsScheduleCategory(raw: unknown): OsScheduleCategorySource {
  const response = rawObject(raw, 'o calendário da categoria')
  const info = rawObject(response.category, 'a categoria do calendário')
  const name = text(info.name, 'o nome da categoria do calendário')

  return {
    generatedAt: text(response.generated_at, 'a hora da leitura'),
    today: isoDate(response.today, 'o dia de hoje'),
    dateFrom: isoDate(response.date_from, 'o primeiro dia da janela'),
    dateTo: isoDate(response.date_to, 'o último dia da janela'),
    category: {
      id: text(info.id, `o identificador da categoria ${name}`),
      name,
      serviceType: text(info.service_type, `o tipo da categoria ${name}`),
      slaHours: nullableFinite(info.sla_hours, `as horas previstas da categoria ${name}`),
      alwaysAvailable: bool(info.always_available, `a regra de recusa de ${name}`),
    },
    days: asList(response.days, 'os dias do calendário da categoria').map((item) => {
      const day = rawObject(item, 'um dia do calendário da categoria')
      const iso = isoDate(day.day, 'a data de um dia do calendário da categoria')

      return {
        day: iso,
        kind: oneOf(day.kind, ['past', 'today', 'future'] as const, `a natureza do dia ${iso}`),
        closed: bool(day.closed, `o fechamento do dia ${iso}`),
        aptTechnicians: count(day.apt_technicians, `os técnicos aptos do dia ${iso}`),
        periods: asList(day.periods, `os turnos do dia ${iso}`).map((period) => categoryCalendarPeriodOf(period, iso)),
      }
    }),
  }
}
