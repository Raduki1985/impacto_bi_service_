import type {
  Category,
  IntelligenceTopic,
  OrderStatus,
  OsCity,
  OsServiceType,
  OsTeam,
  Period,
  ServiceOrder,
  Weighted,
} from './dashboardTypes'
import {
  OS_ACTIVE_TECHNICIANS,
  OS_PERIOD,
  OS_RESOLUTIONS,
  type OsTechnician,
} from './mockOsCatalog'

/**
 * Base MOCKADA de Ordens de Serviço.
 *
 * Os catálogos (equipes, técnicos, tipos, cidades, status e resoluções) e os
 * totais agregados do período vêm da investigação do SGI de 21/08/2026,
 * transcritos em `mockOsCatalog.ts`. Tudo o mais é SIMULAÇÃO determinística:
 * a associação de cada OS a técnico, cliente, categoria, tipo, cidade,
 * resolução, duração e dia é sorteada com seed fixa e não representa o
 * desempenho real de ninguém.
 *
 * Totais reproduzidos com exatidão para 01/08/2026 a 21/08/2026:
 * 1.231 OS, 916 Concluídas, 128 Improdutivas, 150 sem técnico e média de
 * 101 minutos entre as concluídas. A distribuição dos demais status é
 * sintética: os contadores auxiliares do relatório do SGI não são categorias
 * mutuamente exclusivas e não foram somados.
 */

const TOTAL_ORDERS = 1231
const COMPLETED_ORDERS = 916
const UNPRODUCTIVE_ORDERS = 128
const ORDERS_WITHOUT_TECHNICIAN = 150
const COMPLETED_AVERAGE_MINUTES = 101

/**
 * Status finais (passado) e status em aberto (últimos dias da janela). As
 * quantidades de Concluída e Improdutiva são as confirmadas; o restante é um
 * rateio sintético e determinístico dos 187 não confirmados.
 */
const finalStatusCounts: [OrderStatus, number][] = [
  ['Concluída', COMPLETED_ORDERS],
  ['Improdutiva', UNPRODUCTIVE_ORDERS],
  ['Encerrada', 42],
  ['Expirada', 30],
  ['Cancelada', 6],
]

const openStatusCounts: [OrderStatus, number][] = [
  ['Reagendada', 35],
  ['Agendada', 31],
  ['Em Andamento', 14],
  ['Pendente', 8],
  ['Pendente de Aprovação', 7],
  ['Em Deslocamento', 6],
  ['Técnico no Local', 5],
  ['Provisionamento', 3],
]

/**
 * Status que podem existir sem técnico atribuído. As 150 OS sem técnico saem
 * exclusivamente daqui: status em execução ou concluído sempre têm técnico.
 */
const statusesWithoutTechnician = new Set<OrderStatus>([
  'Pendente',
  'Agendada',
  'Reagendada',
  'Expirada',
  'Cancelada',
  'Encerrada',
  'Provisionamento',
])

const inProgressStatuses = new Set<OrderStatus>([
  'Em Deslocamento',
  'Técnico no Local',
  'Em Andamento',
  'Pendente de Aprovação',
])

/**
 * Categoria continua sendo a dimensão sintética que já alimentava os gráficos:
 * a investigação não enumerou o catálogo completo dela no SGI. As combinações
 * de Categoria com Tipo de OS são simuladas, não regra real do SGI.
 */
const categories: Category[] = [
  { value: 'Fibra Instalação', weight: 34, unproductiveRate: 0.12 },
  { value: 'Suporte Técnico', weight: 20, unproductiveRate: 0.06 },
  { value: 'Reparo', weight: 16, unproductiveRate: 0.09 },
  { value: 'Mudança de Endereço', weight: 14, unproductiveRate: 0.1 },
  { value: 'Upgrade de Plano', weight: 8, unproductiveRate: 0.05 },
  { value: 'Troca de Equipamento', weight: 8, unproductiveRate: 0.06 },
]

/** Pesos SIMULADOS de Tipo de OS, apenas para dar volume plausível a cada valor. */
const serviceTypes: Weighted<OsServiceType>[] = [
  { value: 'Manutenção', weight: 32 },
  { value: 'Instalação', weight: 27 },
  { value: 'Instalação de Câmera', weight: 12 },
  { value: 'Infraestrutura', weight: 10 },
  { value: 'Mudança de Endereço', weight: 9 },
  { value: 'Retirada', weight: 6 },
  { value: 'Auditoria', weight: 4 },
]

/**
 * Equipe provável por Tipo de OS. Mapeamento SIMULADO, usado somente para o
 * sorteio: garante que cada equipe atue nos tipos plausíveis, sem afirmar
 * regra real do SGI e sem privilegiar nenhum técnico individualmente.
 */
const teamsByServiceType: Record<OsServiceType, Weighted<OsTeam>[]> = {
  Instalação: [
    { value: 'Terceirizada', weight: 60 },
    { value: 'Suporte Técnico', weight: 40 },
  ],
  Infraestrutura: [
    { value: 'Infra', weight: 85 },
    { value: 'Terceirizada', weight: 15 },
  ],
  Manutenção: [
    { value: 'Suporte Técnico', weight: 55 },
    { value: 'Terceirizada', weight: 35 },
    { value: 'Suporte Lógico', weight: 10 },
  ],
  Retirada: [{ value: 'Retiradas', weight: 100 }],
  'Mudança de Endereço': [
    { value: 'Suporte Técnico', weight: 50 },
    { value: 'Terceirizada', weight: 50 },
  ],
  Auditoria: [
    { value: 'Suporte Lógico', weight: 60 },
    { value: 'Suporte Técnico', weight: 40 },
  ],
  'Instalação de Câmera': [{ value: 'Câmeras', weight: 100 }],
}

/**
 * Pesos SIMULADOS de cidade, ecoando a forma do gráfico do relatório (Atibaia
 * concentra a maior parte do volume). Valores normalizados, sem variação de caixa.
 */
const cities: Weighted<OsCity>[] = [
  { value: 'Atibaia', weight: 745 },
  { value: 'Bom Jesus dos Perdões', weight: 60 },
  { value: 'Bragança Paulista', weight: 50 },
  { value: 'Mairiporã', weight: 45 },
  { value: 'Piracaia', weight: 35 },
  { value: 'Nazaré Paulista', weight: 25 },
  { value: 'Jarinu', weight: 15 },
  { value: 'Joanópolis', weight: 15 },
  { value: 'Terra Preta', weight: 12 },
  { value: 'Campinas', weight: 10 },
  { value: 'São Paulo', weight: 8 },
]

/**
 * Resolução por Tipo de OS, restrita ao catálogo normalizado. Combinações
 * SIMULADAS; `null` representa OS concluída sem resolução registrada, situação
 * que existe no SGI (filtro "Sem resolução").
 */
const resolutionsByServiceType: Record<OsServiceType, Weighted<string | null>[]> = {
  Instalação: [
    { value: 'Instalação Realizada', weight: 78 },
    { value: 'Instalação + Segundo Ponto Executado', weight: 10 },
    { value: null, weight: 12 },
  ],
  'Instalação de Câmera': [
    { value: 'Todas as Câmeras Instaladas', weight: 62 },
    { value: 'Instalação Parcial das Câmeras, Retornar ao Local', weight: 16 },
    { value: 'Troca de Câmeras', weight: 12 },
    { value: null, weight: 10 },
  ],
  Manutenção: [
    { value: 'Reparo Realizado com Sucesso', weight: 22 },
    { value: 'Manutenção Realizada com Sucesso', weight: 16 },
    { value: 'Problema na Rede', weight: 10 },
    { value: 'Fibra Quebrada', weight: 8 },
    { value: 'Cabo Rompido', weight: 8 },
    { value: 'Atenuação da Rede', weight: 6 },
    { value: 'Cabo Dobrado', weight: 5 },
    { value: 'Cabo Queimado', weight: 4 },
    { value: 'Fusão Quebrada', weight: 4 },
    { value: 'Splitter', weight: 4 },
    { value: 'Readequação da CTO', weight: 3 },
    { value: 'Troca de Poste', weight: 2 },
    { value: 'Poda', weight: 2 },
    { value: null, weight: 6 },
  ],
  Infraestrutura: [
    { value: 'Projeto Finalizado', weight: 18 },
    { value: 'Continuar Projeto', weight: 14 },
    { value: 'Link Finalizado', weight: 10 },
    { value: 'Expansão Finalizada', weight: 10 },
    { value: 'Continuar Link', weight: 8 },
    { value: 'Ampliado para 1x8', weight: 8 },
    { value: 'Ampliado para 1x16', weight: 6 },
    { value: 'Rede Mal Projetada', weight: 5 },
    { value: 'Projeto Pausado por Tempo', weight: 5 },
    { value: 'Projeto Pausado por Outra Urgência', weight: 4 },
    { value: 'Troca de Poste', weight: 4 },
    { value: 'Poda', weight: 3 },
    { value: null, weight: 5 },
  ],
  // Retirada não tem resolução própria no catálogo do SGI: fica sem resolução.
  Retirada: [{ value: null, weight: 100 }],
  'Mudança de Endereço': [
    { value: 'Instalação Realizada', weight: 66 },
    { value: 'Não Realizado, Local sem Viabilidade', weight: 12 },
    { value: null, weight: 22 },
  ],
  Auditoria: [
    { value: 'Atenuação da Rede', weight: 25 },
    { value: 'Rede Mal Projetada', weight: 20 },
    { value: 'Problema na Rede', weight: 15 },
    { value: null, weight: 40 },
  ],
}

const unproductiveReasons: Weighted<string>[] = [
  { value: 'Cliente Ausente', weight: 30 },
  { value: 'Sem Acesso', weight: 18 },
  { value: 'Endereço Incorreto', weight: 12 },
  { value: 'Cliente Desistiu', weight: 12 },
  { value: 'Sem Viabilidade', weight: 10 },
  { value: 'Sem Energia', weight: 8 },
  { value: 'Outros', weight: 10 },
]

const closingReasons: Weighted<string>[] = [
  { value: 'Já Realizado', weight: 40 },
  { value: 'Duplicidade', weight: 25 },
  { value: 'Cancelamento', weight: 20 },
  { value: 'Erro Operacional', weight: 15 },
]

const periods: Weighted<Period>[] = [
  { value: 'Manhã', weight: 46 },
  { value: 'Tarde', weight: 39 },
  { value: 'Noite', weight: 15 },
]

const completedNotes = [
  'cliente online',
  'instalação realizada',
  'local já cabeado',
  'finalizado',
  'configuração concluída',
  'sinal ok -18dbm',
  'troca de ONU realizada',
  'roteador substituído',
  'reparo no drop realizado',
  'cabo lançado até a caixa',
  'cliente orientado sobre o uso',
  'upgrade de plano aplicado',
  'ont reconfigurada',
  'sinal estável após reparo',
  'equipamento substituído em campo',
]

const unproductiveNotes = [
  'cliente ausente no local',
  'cliente não atende o telefone',
  'sem acesso ao imóvel',
  'endereço incorreto no cadastro',
  'cliente reagendou a visita',
  'sem energia no local',
  'sem viabilidade técnica no poste',
  'cliente desistiu do serviço',
]

const closedNotes = [
  'já realizado anteriormente',
  'duplicidade de OS no sistema',
  'cancelado pelo comercial',
  'erro operacional no agendamento',
]

const inProgressNotes = [
  'equipe a caminho',
  'aguardando liberação da caixa CTO',
  'em rota de atendimento',
]

const durationRanges: Record<string, [number, number]> = {
  'Fibra Instalação': [90, 170],
  'Mudança de Endereço': [70, 140],
  'Suporte Técnico': [25, 70],
  Reparo: [45, 110],
  'Upgrade de Plano': [20, 55],
  'Troca de Equipamento': [40, 90],
}

function createRandom(seed = 20260821) {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function randomInt(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1))
}

function weightedPick<T>(random: () => number, items: Weighted<T>[]) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let value = random() * total

  for (const item of items) {
    value -= item.weight
    if (value <= 0) return item.value
  }

  return items[items.length - 1].value
}

function shuffle<T>(random: () => number, items: T[]) {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }

  return result
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toISO(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function monday(date: Date) {
  const next = new Date(date)
  const offset = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - offset)
  return next
}

function classifyNote(note: string | null): IntelligenceTopic | null {
  if (!note) return null

  const value = note.toLowerCase()

  if (/onu|ont|roteador|equipamento|zte|aparelho|drop/.test(value)) return 'Equipamentos'
  if (/sinal|conex|lentid|oscil|pacote|dbm|instab|estável|estavel/.test(value)) return 'Rede'
  if (/cabo|caixa|cto|poste|cabea|infra/.test(value)) return 'Infraestrutura'
  if (/ausente|não atende|nao atende|desist|reagend|receber/.test(value)) return 'Cliente'
  if (/plano|upgrade|comercial|titular|cobran/.test(value)) return 'Comercial'
  if (/endereço|endereco|cadastro|duplic|operacional|agendamento/.test(value)) return 'Administrativo'

  return 'Operacional'
}

function buildCustomers(random: () => number) {
  const firstNames = [
    'ana',
    'joão',
    'maria',
    'pedro',
    'lucas',
    'carla',
    'marcos',
    'fernanda',
    'rafael',
    'juliana',
    'bruno',
    'patricia',
    'thiago',
    'camila',
    'felipe',
    'larissa',
    'gustavo',
    'beatriz',
    'rodrigo',
    'vanessa',
    'daniel',
    'aline',
    'vitor',
    'sabrina',
    'andré',
    'tatiana',
    'wilson',
    'geni',
    'koyo',
    'izumi',
    'samuel',
    'vicktor',
    'diego',
    'renata',
    'sergio',
    'paula',
  ]
  const lastNames = [
    'silva',
    'souza',
    'oliveira',
    'santos',
    'pereira',
    'lima',
    'carvalho',
    'rocha',
    'almeida',
    'fernandes',
    'gomes',
    'barbosa',
    'ribeiro',
    'martins',
    'araujo',
    'teixeira',
    'nogueira',
    'alves',
    'mendes',
    'castro',
    'pinto',
    'freitas',
    'moraes',
    'cardoso',
    'dias',
  ]

  return Array.from({ length: 360 }, (_, index) => ({
    value: {
      name: `${firstNames[Math.floor(random() * firstNames.length)]} ${
        lastNames[Math.floor(random() * lastNames.length)]
      } ${lastNames[Math.floor(random() * lastNames.length)]}`,
      subscription: String(randomInt(random, 100000, 999999)),
    },
    weight: 1 / Math.pow(index + 1, 0.7),
  }))
}

export const dashboardMeta = {
  categories,
  resolutions: [...OS_RESOLUTIONS],
  unproductiveReasons: unproductiveReasons.map((item) => item.value),
  closingReasons: closingReasons.map((item) => item.value),
  periods: periods.map((item) => item.value),
}

type DaySlot = {
  dateISO: string
  dayOfWeek: number
  weekKey: string
  monthKey: string
}

/**
 * Quantidade de OS por dia, fechando exatamente em `TOTAL_ORDERS` pelo método
 * dos maiores restos. Fins de semana mais leves, com textura determinística.
 */
function buildDaySlots(random: () => number): DaySlot[] {
  const [startYear, startMonth, startDay] = OS_PERIOD.start.split('-').map(Number)
  const [, , endDay] = OS_PERIOD.end.split('-').map(Number)
  const days: { date: Date; weight: number }[] = []

  for (let day = startDay; day <= endDay; day++) {
    const date = new Date(startYear, startMonth - 1, day)
    const dayOfWeek = date.getDay()
    const base = dayOfWeek === 0 ? 5 : dayOfWeek === 6 ? 13 : 21
    days.push({ date, weight: Math.max(1, base + randomInt(random, -2, 2)) })
  }

  const totalWeight = days.reduce((sum, item) => sum + item.weight, 0)
  const exact = days.map((item) => (item.weight / totalWeight) * TOTAL_ORDERS)
  const counts = exact.map(Math.floor)
  let remaining = TOTAL_ORDERS - counts.reduce((sum, value) => sum + value, 0)
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (const item of byRemainder) {
    if (remaining <= 0) break
    counts[item.index] += 1
    remaining -= 1
  }

  const slots: DaySlot[] = []

  for (let index = 0; index < days.length; index++) {
    const { date } = days[index]
    const slot: DaySlot = {
      dateISO: toISO(date),
      dayOfWeek: date.getDay(),
      weekKey: toISO(monday(date)),
      monthKey: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`,
    }

    for (let position = 0; position < counts[index]; position++) {
      slots.push(slot)
    }
  }

  return slots
}

/**
 * Status de cada OS em ordem cronológica: os finais preenchem o começo da
 * janela e os em aberto ficam nos últimos dias, coerente com uma consulta
 * feita na manhã de 21/08. As quantidades são exatas por construção.
 */
function buildStatusSequence(random: () => number): OrderStatus[] {
  const finals = finalStatusCounts.flatMap(([status, count]) => Array(count).fill(status) as OrderStatus[])
  const opens = openStatusCounts.flatMap(([status, count]) => Array(count).fill(status) as OrderStatus[])

  return [...shuffle(random, finals), ...shuffle(random, opens)]
}

export function generateOrders(): ServiceOrder[] {
  const random = createRandom()
  const daySlots = buildDaySlots(random)
  const statuses = buildStatusSequence(random)
  const customers = buildCustomers(random)
  const techniciansByTeam = new Map<OsTeam, OsTechnician[]>()

  for (const technician of OS_ACTIVE_TECHNICIANS) {
    const pool = techniciansByTeam.get(technician.team) ?? []
    pool.push(technician)
    techniciansByTeam.set(technician.team, pool)
  }

  /**
   * As 150 OS sem técnico saem dos status elegíveis: as poucas posições que
   * MANTÊM técnico são espalhadas uniformemente pela sequência, de forma
   * determinística e sem relação com qualquer técnico específico.
   */
  const eligibleTotal = [...finalStatusCounts, ...openStatusCounts]
    .filter(([status]) => statusesWithoutTechnician.has(status))
    .reduce((sum, [, count]) => sum + count, 0)
  const keepers = eligibleTotal - ORDERS_WITHOUT_TECHNICIAN
  const eligiblePositionsWithTechnician = new Set(
    Array.from({ length: keepers }, (_, index) =>
      Math.floor((eligibleTotal * (index + 1)) / (keepers + 1)),
    ),
  )
  let eligibleSeen = 0

  const orders: ServiceOrder[] = []
  let orderNumber = 1000

  for (let index = 0; index < daySlots.length; index++) {
    const slot = daySlots[index]
    const status = statuses[index]
    orderNumber += 1

    let withoutTechnician = false
    if (statusesWithoutTechnician.has(status)) {
      withoutTechnician = !eligiblePositionsWithTechnician.has(eligibleSeen)
      eligibleSeen += 1
    }

    const serviceType = weightedPick(random, serviceTypes)
    const city = weightedPick(random, cities)
    const category = weightedPick(
      random,
      categories.map((item) => ({ value: item.value, weight: item.weight })),
    )
    const period = weightedPick(random, periods)
    const customer = weightedPick(random, customers)

    let technician: OsTechnician | null = null
    if (!withoutTechnician) {
      const team = weightedPick(random, teamsByServiceType[serviceType])
      const pool = techniciansByTeam.get(team)!
      technician = pool[Math.floor(random() * pool.length)]
    }

    let resolution: string | null = null
    let unproductiveReason: string | null = null
    let closingReason: string | null = null
    let note: string | null = null

    if (status === 'Concluída') {
      resolution = weightedPick(random, resolutionsByServiceType[serviceType])
      note = random() < 0.85 ? completedNotes[Math.floor(random() * completedNotes.length)] : null
    } else if (status === 'Improdutiva') {
      unproductiveReason = weightedPick(random, unproductiveReasons)
      note = unproductiveNotes[Math.floor(random() * unproductiveNotes.length)]
    } else if (status === 'Encerrada') {
      closingReason = weightedPick(random, closingReasons)
      note = closedNotes[Math.floor(random() * closedNotes.length)]
    } else if (status === 'Cancelada') {
      closingReason = 'Cancelamento'
    } else if (inProgressStatuses.has(status)) {
      note = inProgressNotes[Math.floor(random() * inProgressNotes.length)]
    }

    const durationRange = durationRanges[category]
    const durationMinutes =
      status === 'Concluída'
        ? randomInt(random, durationRange[0], durationRange[1])
        : status === 'Improdutiva'
          ? randomInt(random, 10, 35)
          : 0
    let leadDays = 0

    if (status === 'Concluída') {
      const leadSample = random()
      leadDays = leadSample < 0.7 ? 0 : leadSample < 0.88 ? 1 : leadSample < 0.96 ? 2 : 3
    }

    orders.push({
      os: `OS-2026-${orderNumber}`,
      subscription: customer.subscription,
      customer: customer.name,
      dateISO: slot.dateISO,
      dayOfWeek: slot.dayOfWeek,
      period,
      status,
      resolution,
      category,
      serviceType,
      city,
      technicianId: technician?.id ?? null,
      technician: technician?.name ?? null,
      team: technician?.team ?? null,
      note,
      unproductiveReason,
      closingReason,
      durationMinutes,
      leadDays,
      weekKey: slot.weekKey,
      monthKey: slot.monthKey,
      intelligenceTopic: classifyNote(note),
    })
  }

  adjustCompletedDurations(orders)

  return orders
}

/**
 * Ajuste determinístico de +-1 minuto, dentro de limites plausíveis, para a
 * média das concluídas fechar EXATAMENTE nos 101 minutos (1h41) confirmados.
 */
function adjustCompletedDurations(orders: ServiceOrder[]) {
  const completed = orders.filter((order) => order.status === 'Concluída')
  const targetSum = COMPLETED_ORDERS * COMPLETED_AVERAGE_MINUTES
  let diff = targetSum - completed.reduce((sum, order) => sum + order.durationMinutes, 0)

  while (diff !== 0) {
    let moved = false

    for (const order of completed) {
      if (diff === 0) break
      if (diff > 0 && order.durationMinutes < 220) {
        order.durationMinutes += 1
        diff -= 1
        moved = true
      } else if (diff < 0 && order.durationMinutes > 15) {
        order.durationMinutes -= 1
        diff += 1
        moved = true
      }
    }

    // Impossível na prática (os limites comportam qualquer soma alvo), mas
    // evita laço infinito caso os parâmetros mudem no futuro.
    if (!moved) break
  }
}

export const orders = generateOrders()
