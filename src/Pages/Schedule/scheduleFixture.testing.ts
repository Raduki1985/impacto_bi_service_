import type {
  OsScheduleCategory,
  OsScheduleCategoryAvailability,
  OsScheduleCategorySource,
  OsScheduleDay,
  OsScheduleDayKind,
  OsScheduleGauge,
  OsScheduleSource,
} from '../../data/api/osScheduleSource'
import { mondayOf, shiftISODate, weekdayOf } from '../../data/isoDate'

/**
 * Agenda sintética para os testes da página: hoje é sexta-feira 16/10/2026 e
 * a janela são as quatro semanas do calendário, de segunda 12/10 a domingo
 * 08/11, com a forma da resposta real do serviço. Os números são inventados
 * para cobrir cada estado de turno (realizado, cabe, quase cheio, cheio,
 * livre, sem estimativa, domingo sem agenda, feriado, rota fechada, OS sem
 * turno). Nada aqui é dado do SGI.
 *
 * Desde 20/10/2026 a página lê a régua do SGI (`scheduler`): o número de
 * técnicos de cada dia faz o papel dos ativos no cadastro naquele dia, com a
 * rota fechada já descontada. Os números continuam os de antes, escolhidos
 * para cada estado aparecer. A régua dos presentes (`operation`) vai sem
 * estimativa: se a página voltar a lê-la, os testes quebram.
 */

export const FIXTURE_TODAY = '2026-10-16'

const HOURS_PER_TECHNICIAN_PERIOD = 3.2

function gauge(technicians: number | null, consumed: number, periods = 1): OsScheduleGauge {
  if (technicians === null) return { technicians: null, capacityHours: null, occupation: null }
  const capacityHours = technicians * HOURS_PER_TECHNICIAN_PERIOD * periods

  return { technicians, capacityHours, occupation: capacityHours > 0 ? consumed / capacityHours : null }
}

function category(
  id: string,
  name: string,
  serviceType: string,
  apt: number,
  morning: readonly [number, number],
  afternoon: readonly [number, number],
  sla: number | null = 1.5,
  alwaysAccepted = false,
): OsScheduleCategory {
  const capacity = apt * HOURS_PER_TECHNICIAN_PERIOD
  const period = (key: string, label: string, [scheduled, consumed]: readonly [number, number]) => ({
    periodKey: key,
    period: label,
    scheduled,
    consumedHours: consumed,
    capacityHours: capacity,
    occupation: capacity > 0 ? consumed / capacity : null,
    // Infra e auditoria nunca ficam cheias, e a tolerância é a do serviço.
    full: !alwaysAccepted && (capacity <= 0 || (sla !== null && consumed + sla > capacity + 1e-9)),
  })
  const periods = [period('morning', 'Manhã', morning), period('afternoon', 'Tarde', afternoon)]

  return {
    id,
    name,
    serviceType,
    slaHours: sla,
    aptTechnicians: apt,
    scheduled: morning[0] + afternoon[0],
    consumedHours: morning[1] + afternoon[1],
    capacityHours: capacity * 2,
    occupation: capacity > 0 ? (morning[1] + afternoon[1]) / (capacity * 2) : null,
    fullPeriods: periods.filter((item) => item.full).length,
    periods,
  }
}

function day(
  iso: string,
  kind: OsScheduleDayKind,
  morning: number,
  afternoon: number,
  active: number | null,
  withoutPeriod = 0,
  ordersWithoutSla = 0,
): OsScheduleDay {
  const consumed = morning + afternoon
  const categories =
    consumed === 0
      ? []
      : [
          category('cam-2', 'Instalação de 2 Câmeras', 'Instalação de Câmeras', 4, [6, 12.0], [2, 4.0], 1.33),
          category('fibra', 'Fibra Instalação', 'Instalação', 12, [10, 20.0], [8, 15.0]),
          category('cto', 'Execução de CTO', 'Infraestrutura', 0, [2, 1.0], [0, 0], 0.5, true),
          // Sexta 23/10: uma categoria sem horas previstas, que pesa zero.
          ...(iso === '2026-10-23' ? [category('vistoria', 'Vistoria Técnica', 'Manutenção', 3, [1, 0], [0, 0], null)] : []),
        ]

  return {
    day: iso,
    kind,
    closed: iso === '2026-10-12',
    closedTeams: iso === '2026-10-20' ? ['Terceirizada'] : [],
    // Segunda 12/10: feriado do calendário; terça 20/10: a rota da Terceirizada
    // travada pelo gestor, como ele faz no SGI.
    closures:
      iso === '2026-10-12'
        ? [{ name: 'Aparecida', group: 'Fixos (padrão do sistema)', teams: [] }]
        : iso === '2026-10-20'
          ? [{ name: 'ROTA FECHADA', group: 'ROTA FECHADA', teams: ['Terceirizada'] }]
          : [],
    scheduled: Math.round(morning / 1.3) + Math.round(afternoon / 1.3) + withoutPeriod,
    withoutPeriod,
    ordersWithoutSla,
    consumedHours: consumed,
    scheduler: gauge(active, consumed, 2),
    operation: gauge(null, consumed, 2),
    presenceBasis:
      kind === 'past'
        ? 'executed'
        : kind === 'today'
          ? 'assigned_or_available'
          : active === null
            ? null
            : 'typical_weekday',
    periods: [
      {
        periodKey: 'morning',
        period: 'Manhã',
        scheduled: Math.round(morning / 1.3),
        consumedHours: morning,
        scheduler: gauge(active, morning),
        operation: gauge(null, morning),
      },
      {
        periodKey: 'afternoon',
        period: 'Tarde',
        scheduled: Math.round(afternoon / 1.3),
        consumedHours: afternoon,
        scheduler: gauge(active, afternoon),
        operation: gauge(null, afternoon),
      },
    ],
    categories,
  }
}

/** Horas marcadas por turno e presentes de cada dia da janela, pelo deslocamento até hoje. */
function dayAt(offset: number): OsScheduleDay {
  const iso = shiftISODate(FIXTURE_TODAY, offset)
  const kind: OsScheduleDayKind = offset < 0 ? 'past' : offset === 0 ? 'today' : 'future'
  const weekday = weekdayOf(iso)
  if (weekday === 0) return day(iso, kind, 0, 0, null)
  const saturday = weekday === 6
  if (offset < 0) return day(iso, kind, 97.5, saturday ? 0 : 71, 28)
  if (offset === 0) return day(iso, kind, 97.5, 71, 39)
  switch (offset) {
    case 1:
      // Sábado 17/10: quase cheio de manhã (60 h de 67,2 h), tarde livre.
      return day(iso, kind, 60, 0, 21)
    case 3:
      // Segunda 19/10: cheio de manhã (100 h de 92,8 h).
      return day(iso, kind, 100, 30, 29)
    case 4:
      // Terça 20/10: rota fechada, uma OS sem turno e duas sem horas previstas.
      return day(iso, kind, 36.3, 30, 29, 1, 2)
    case 5:
      // Quarta 21/10: tarde livre.
      return day(iso, kind, 36.3, 0, 29)
    case 6:
      // Quinta 22/10: sem histórico para estimar a presença.
      return day(iso, kind, 36.3, 30, null)
    default:
      if (offset <= 9) return day(iso, kind, 36.3, saturday ? 0 : 30, saturday ? 21 : 29)

      // Semanas 3 e 4: nada marcado ainda.
      return day(iso, kind, 0, 0, saturday ? 21 : 29)
  }
}

/**
 * A próxima agenda de cada categoria (22/10/2026), como o serviço a manda:
 * na ordem dos tipos e depois pelo nome. Lida às 14h32 de sexta 16/10, a
 * manhã de hoje já passou da hora limite (um turno fechado antes de tudo).
 * Cobre cada caso do destaque no calendário e dos filtros: cabe hoje, cabe
 * amanhã, cabe só na semana que vem, sem técnico apto, sem data na leitura
 * e infra, que a grade nunca recusa. Nada aqui é dado do SGI.
 */
function availability(
  id: string,
  name: string,
  serviceType: string,
  sla: number | null,
  apt: number,
  next: readonly [string, string, string, number] | null,
  alwaysAvailable = false,
): OsScheduleCategoryAvailability {
  return {
    id,
    name,
    serviceType,
    slaHours: sla,
    aptTechnicians: apt,
    alwaysAvailable,
    next:
      next === null
        ? null
        : {
            day: next[0],
            periodKey: next[1],
            period: next[2],
            consumedHours: next[3],
            capacityHours: apt * HOURS_PER_TECHNICIAN_PERIOD,
          },
  }
}

const AVAILABILITY: readonly OsScheduleCategoryAvailability[] = [
  // A remota nasce sem turno e ainda assim conta nas OS marcadas.
  availability('remota', 'Ativação Remota', 'Instalação', 1, 0, null),
  availability('fibra', 'Fibra Instalação', 'Instalação', 1.5, 12, ['2026-10-17', 'morning', 'Manhã', 20]),
  availability('tv-box', 'Nova Instalação de TV Box', 'Instalação', 0.67, 2, ['2026-10-19', 'afternoon', 'Tarde', 5]),
  availability('cto', 'Execução de CTO', 'Infraestrutura', 0.5, 0, ['2026-10-16', 'afternoon', 'Tarde', 1], true),
  availability('sem-conexao', 'Sem Conexão', 'Manutenção', 1.5, 11, ['2026-10-17', 'afternoon', 'Tarde', 14.2]),
  availability('cam-1', 'Instalação de 1 Câmera', 'Instalação de Câmeras', 0.67, 4, ['2026-10-16', 'afternoon', 'Tarde', 4]),
  availability('cam-2', 'Instalação de 2 Câmeras', 'Instalação de Câmeras', 1.33, 4, ['2026-10-17', 'afternoon', 'Tarde', 4]),
  availability('cam-off', 'Câmera Offline', 'Manutenção de Câmeras', 0.67, 1, null),
]

/** A agenda inteira: as quatro semanas do calendário em torno de hoje. */
export function makeScheduleFixture(): OsScheduleSource {
  const dateFrom = mondayOf(FIXTURE_TODAY)
  const dateTo = shiftISODate(dateFrom, 27)
  const days: OsScheduleDay[] = []
  for (let offset = -4; offset <= 23; offset += 1) days.push(dayAt(offset))

  return {
    generatedAt: '2026-10-16T14:32:00-03:00',
    today: FIXTURE_TODAY,
    dateFrom,
    dateTo,
    historyDays: 28,
    parameters: {
      periodDurationHours: 4,
      efficiency: 0.8,
      hoursPerTechnicianPeriod: HOURS_PER_TECHNICIAN_PERIOD,
      weekendSchedulingEnabled: true,
      activeTechnicians: 42,
      availableNow: 35,
      periods: [
        { key: 'morning', label: 'Manhã', startHour: 8, limitHour: 11 },
        { key: 'afternoon', label: 'Tarde', startHour: 13, limitHour: 16 },
      ],
    },
    days,
    registry: [
      {
        id: 'cam-off',
        name: 'Câmera Offline',
        serviceType: 'Manutenção',
        slaHours: 0.67,
        aptTechnicians: 1,
        executedBy: 4,
        executedWithoutCapability: 3,
        orders: 145,
        technicians: [
          { id: 't-1', name: 'Técnico A', teams: ['Equipe Norte'], active: true, orders: 40 },
          { id: 't-2', name: 'Técnico B', teams: ['Equipe Sul', 'Equipe Norte'], active: true, orders: 25 },
          { id: 't-3', name: 'Técnico C', teams: [], active: false, orders: 5 },
        ],
      },
      {
        id: 'cto',
        name: 'Execução de CTO',
        serviceType: 'Infraestrutura',
        slaHours: 0.5,
        aptTechnicians: 0,
        executedBy: 2,
        executedWithoutCapability: 2,
        orders: 46,
        technicians: [
          { id: 't-4', name: 'Técnico D', teams: ['Infra'], active: true, orders: 30 },
          { id: 't-1', name: 'Técnico A', teams: ['Equipe Norte'], active: true, orders: 16 },
        ],
      },
      {
        id: 'fibra',
        name: 'Fibra Instalação',
        serviceType: 'Instalação',
        slaHours: 1.5,
        aptTechnicians: 12,
        executedBy: 12,
        executedWithoutCapability: 0,
        orders: 783,
        technicians: [],
      },
    ],
    availability: AVAILABILITY,
  }
}

/**
 * O calendário de uma categoria da agenda sintética (22/10/2026), como o
 * serviço o manda em `/calendar/schedule/category`: capacidade dos aptos
 * (os da próxima agenda da fixture), consumo dos dias em que a categoria tem
 * OS e zero nos outros. Para fechar com a próxima vaga da fixture, todo
 * turno aberto antes dela sai cheio. Nada aqui é dado do SGI. `base` é a
 * agenda de onde sai a próxima vaga, para o teste que a muda de lugar.
 */
export function makeCategoryViewFixture(
  categoryId: string,
  base: OsScheduleSource = makeScheduleFixture(),
): OsScheduleCategorySource {
  const line = base.availability.find((item) => item.id === categoryId)
  if (line === undefined) throw new Error(`a fixture não tem a categoria ${categoryId}`)
  const capacity = line.aptTechnicians * HOURS_PER_TECHNICIAN_PERIOD
  const sla = line.slaHours
  const order = (iso: string, periodKey: string) => `${iso}|${periodKey === 'morning' ? 0 : 1}`
  const nextOrder = line.next === null ? null : order(line.next.day, line.next.periodKey)

  return {
    generatedAt: base.generatedAt,
    today: base.today,
    dateFrom: base.dateFrom,
    dateTo: base.dateTo,
    category: {
      id: line.id,
      name: line.name,
      serviceType: line.serviceType,
      slaHours: sla,
      alwaysAvailable: line.alwaysAvailable,
    },
    days: base.days.map((day) => {
      const own = day.categories.find((item) => item.id === categoryId)

      return {
        day: day.day,
        kind: day.kind,
        closed: day.closed,
        aptTechnicians: line.aptTechnicians,
        periods: day.periods.map((period) => {
          const cell = own?.periods.find((item) => item.periodKey === period.periodKey)
          const before =
            day.kind !== 'past' && !line.alwaysAvailable && (nextOrder === null || order(day.day, period.periodKey) < nextOrder)
          const consumed = before ? capacity : (cell?.consumedHours ?? 0)
          const full = !line.alwaysAvailable && (capacity <= 0 || (sla !== null && consumed + sla > capacity + 1e-9))

          return {
            periodKey: period.periodKey,
            period: period.period,
            scheduled: cell?.scheduled ?? 0,
            consumedHours: consumed,
            capacityHours: capacity,
            occupation: capacity > 0 ? consumed / capacity : null,
            full,
            fits:
              line.alwaysAvailable || sla === null || capacity <= 0
                ? null
                : Math.max(0, Math.floor((capacity - consumed + 1e-9) / sla)),
            weekendClosed: false,
          }
        }),
      }
    }),
  }
}
