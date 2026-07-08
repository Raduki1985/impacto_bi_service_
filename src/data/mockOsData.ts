import type {
  Category,
  IntelligenceTopic,
  Period,
  ServiceOrder,
  Technician,
  Weighted,
} from './dashboardTypes'

const technicians: Technician[] = [
  { name: 'Jefferson Leal de Oliveira Sampaio', skill: 0.9 },
  { name: 'Daniel Aparecido de Oliveira Junior', skill: 0.86 },
  { name: 'Thiago Andre Santana Teixeira', skill: 0.72 },
  { name: 'Francisco Fabio Bernardo', skill: 0.88 },
  { name: 'Jailson Ribeiro dos Santos Paixão', skill: 0.83 },
  { name: 'Kelvis Leite Canuto da Silva', skill: 0.79 },
  { name: 'Marcos Antonio Alves de Oliveira', skill: 0.91 },
  { name: 'Rafael Souza Lima', skill: 0.68 },
  { name: 'Anderson Pereira Gomes', skill: 0.84 },
  { name: 'Bruno Carvalho Nogueira', skill: 0.76 },
  { name: 'Willian Rocha Fernandes', skill: 0.81 },
  { name: 'Diego Martins Barbosa', skill: 0.7 },
]

const categories: Category[] = [
  { value: 'Fibra Instalação', weight: 34, unproductiveRate: 0.12 },
  { value: 'Suporte Técnico', weight: 20, unproductiveRate: 0.06 },
  { value: 'Reparo', weight: 16, unproductiveRate: 0.09 },
  { value: 'Mudança de Endereço', weight: 14, unproductiveRate: 0.1 },
  { value: 'Upgrade de Plano', weight: 8, unproductiveRate: 0.05 },
  { value: 'Troca de Equipamento', weight: 8, unproductiveRate: 0.06 },
]

const resolutionsByCategory: Record<string, Weighted<string>[]> = {
  'Fibra Instalação': [
    { value: 'Instalação Realizada', weight: 88 },
    { value: 'Troca de Equipamento', weight: 12 },
  ],
  'Mudança de Endereço': [
    { value: 'Instalação Realizada', weight: 68 },
    { value: 'Configuração Realizada', weight: 32 },
  ],
  'Suporte Técnico': [
    { value: 'Cliente Orientado', weight: 40 },
    { value: 'Configuração Realizada', weight: 25 },
    { value: 'Sem Defeito Encontrado', weight: 20 },
    { value: 'Reparo Realizado', weight: 15 },
  ],
  Reparo: [
    { value: 'Reparo Realizado', weight: 55 },
    { value: 'Troca de Equipamento', weight: 20 },
    { value: 'Equipamento Substituído', weight: 15 },
    { value: 'Sem Defeito Encontrado', weight: 10 },
  ],
  'Upgrade de Plano': [
    { value: 'Configuração Realizada', weight: 60 },
    { value: 'Cliente Orientado', weight: 25 },
    { value: 'Troca de Equipamento', weight: 15 },
  ],
  'Troca de Equipamento': [
    { value: 'Equipamento Substituído', weight: 62 },
    { value: 'Troca de Equipamento', weight: 38 },
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

function createRandom(seed = 20260601) {
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
  technicians,
  categories,
  resolutions: [
    'Instalação Realizada',
    'Reparo Realizado',
    'Configuração Realizada',
    'Cliente Orientado',
    'Equipamento Substituído',
    'Troca de Equipamento',
    'Sem Defeito Encontrado',
  ],
  unproductiveReasons: unproductiveReasons.map((item) => item.value),
  closingReasons: closingReasons.map((item) => item.value),
  periods: periods.map((item) => item.value),
}

export function generateOrders(): ServiceOrder[] {
  const random = createRandom()
  const technicianWeights = technicians.map((_, index) => ({
    value: index,
    weight: 1 + (11 - index) * 0.11 + random() * 0.35,
  }))
  const customers = buildCustomers(random)
  const orders: ServiceOrder[] = []
  const start = new Date(2026, 3, 1)
  const end = new Date(2026, 5, 30)
  let orderNumber = 1000

  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay()
    const dayIndex = Math.round((date.getTime() - start.getTime()) / 86400000)
    let base = dayOfWeek === 0 ? 4 : dayOfWeek === 6 ? 13 : 21
    base += Math.round(dayIndex * 0.05) + randomInt(random, -3, 4)
    base = Math.max(base, 1)

    for (let index = 0; index < base; index++) {
      orderNumber += 1
      const technicianIndex = weightedPick(random, technicianWeights)
      const technician = technicians[technicianIndex]
      const category = weightedPick(
        random,
        categories.map((item) => ({ value: item, weight: item.weight })),
      )
      const period = weightedPick(random, periods)
      const customer = weightedPick(random, customers)
      const recent = (end.getTime() - date.getTime()) / 86400000 <= 4
      const unproductiveChance = Math.min(0.45, category.unproductiveRate * (1.7 - technician.skill))
      const closedChance = 0.07
      const canceledChance = 0.03
      const inProgressChance = recent ? 0.16 : 0
      const sample = random()

      let status: ServiceOrder['status']
      let resolution: string | null = null
      let unproductiveReason: string | null = null
      let closingReason: string | null = null
      let note: string | null = null

      if (sample < inProgressChance) {
        status = 'Em Andamento'
        note = inProgressNotes[Math.floor(random() * inProgressNotes.length)]
      } else if (sample < inProgressChance + canceledChance) {
        status = 'Cancelada'
        closingReason = 'Cancelamento'
      } else if (sample < inProgressChance + canceledChance + closedChance) {
        status = 'Fechada'
        closingReason = weightedPick(random, closingReasons)
        note = closedNotes[Math.floor(random() * closedNotes.length)]
      } else if (sample < inProgressChance + canceledChance + closedChance + unproductiveChance) {
        status = 'Improdutiva'
        unproductiveReason = weightedPick(random, unproductiveReasons)
        note = unproductiveNotes[Math.floor(random() * unproductiveNotes.length)]
      } else {
        status = 'Concluída'
        resolution = weightedPick(random, resolutionsByCategory[category.value])
        note = random() < 0.85 ? completedNotes[Math.floor(random() * completedNotes.length)] : null
      }

      const durationRange = durationRanges[category.value]
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
        dateISO: toISO(date),
        dayOfWeek,
        period,
        status,
        resolution,
        category: category.value,
        technician: technician.name,
        technicianIndex,
        note,
        unproductiveReason,
        closingReason,
        durationMinutes,
        leadDays,
        weekKey: toISO(monday(date)),
        monthKey: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`,
        intelligenceTopic: classifyNote(note),
      })
    }
  }

  return orders
}

export const orders = generateOrders()
