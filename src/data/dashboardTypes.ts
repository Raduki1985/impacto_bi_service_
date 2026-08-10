import type {
  DepartmentPageAccess,
  UserAuditMetadata,
  UserProfile,
  UserStatus,
} from '../types/access'

export type OrderStatus =
  | 'Concluída'
  | 'Fechada'
  | 'Improdutiva'
  | 'Em Andamento'
  | 'Cancelada'

export type Period = 'Manhã' | 'Tarde' | 'Noite'

export type IntelligenceTopic =
  | 'Cliente'
  | 'Equipamentos'
  | 'Rede'
  | 'Infraestrutura'
  | 'Comercial'
  | 'Administrativo'
  | 'Operacional'

export type ServiceOrder = {
  os: string
  subscription: string
  customer: string
  dateISO: string
  dayOfWeek: number
  period: Period
  status: OrderStatus
  resolution: string | null
  category: string
  technician: string
  technicianIndex: number
  note: string | null
  unproductiveReason: string | null
  closingReason: string | null
  durationMinutes: number
  leadDays: number
  weekKey: string
  monthKey: string
  intelligenceTopic: IntelligenceTopic | null
}

export type Weighted<T> = {
  value: T
  weight: number
}

export type Technician = {
  name: string
  skill: number
}

export type Category = {
  value: string
  weight: number
  unproductiveRate: number
}

export type Pair = [string, number]

export type ChartSeries = {
  name: string
  color: string
  data: number[]
}

export type KpiDelta = {
  text: string
  positive: boolean
  /** false quando não há período anterior com dados para comparar (mostra "N/A"). */
  available: boolean
}

export type DashboardKpis = {
  total: string
  completed: string
  closed: string
  unproductive: string
  completionRate: string
  unproductiveRate: string
  averageTime: string
  averageLead: string
  activeTechnicians: number
  totalDelta: KpiDelta
  completedDelta: KpiDelta
  completionDelta: KpiDelta
  unproductiveDelta: KpiDelta
  timeDelta: KpiDelta
}

export type HeatmapData = {
  x: string[]
  y: string[]
  data: [number, number, number][]
  max: number
}

export type DashboardCharts = {
  statusColors: Record<string, string>
  statusPairs: Pair[]
  overviewDay: { x: string[]; total: number[]; completed: number[] }
  categoryBar: { labels: string[]; values: number[] }
  resolutionPairs: Pair[]
  daily: { x: string[]; total: number[] }
  weekly: { x: string[]; total: number[] }
  monthly: { x: string[]; values: number[] }
  evolution: { x: string[]; completed: number[]; unproductive: number[] }
  categoryStatus: { x: string[]; series: ChartSeries[] }
  categoryResolution: HeatmapData
  resolutionCategory: { x: string[]; series: ChartSeries[] }
  statusPeriod: { x: string[]; series: ChartSeries[] }
  technicianTop: { labels: string[]; values: number[] }
  technicianCategory: HeatmapData
  technicianResolution: HeatmapData
  unproductiveReason: Pair[]
  unproductivePeriod: Pair[]
  unproductiveTechnician: Pair[]
  unproductiveCategory: Pair[]
  unproductiveEvolution: { x: string[]; values: number[] }
  closingReason: Pair[]
  closingEvolution: { x: string[]; values: number[] }
  qualityCategoryResolution: HeatmapData
  qualityCategoryUnproductive: HeatmapData
  qualityStatusCategory: { x: string[]; series: ChartSeries[] }
  qualityStatusTechnician: HeatmapData
  calendarDay: [string, number][]
  calendarRange: [string, string]
  dayOfWeekByWeek: HeatmapData
  intelligenceBar: Pair[]
  intelligenceTrend: { x: string[]; series: ChartSeries[] }
}

export type TechnicianRanking = {
  position: number
  name: string
  initials: string
  total: string
  completed: string
  unproductive: string
  averageDay: string
  completionRate: string
  completionRateNumber: number
}

export type CustomerRanking = {
  position: number
  name: string
  subscription: string
  visits: number
  width: number
}

export type WordCloudItem = {
  text: string
  size: number
  color: string
}

export type DashboardData = {
  kpis: DashboardKpis
  calendar: {
    peak: string
    peakQuantity: number
    critical: string
    criticalQuantity: number
    average: string
  }
  unproductive: {
    topReason: string
    topReasonPercent: string
  }
  customers: {
    unique: string
    recurring: string
    averageVisits: string
  }
  intelligence: {
    totalNotes: string
  }
  technicianRanking: TechnicianRanking[]
  customerRanking: CustomerRanking[]
  wordCloud: WordCloudItem[]
  charts: DashboardCharts
}

export type User = {
  id: string
  name: string
  email: string
  profile: UserProfile
  /**
   * Perfil de Acesso vinculado, pelo id técnico.
   *
   * `null` é a ausência EXPLÍCITA de vínculo, e não um estado neutro: um usuário
   * sem Perfil de Acesso válido não entra no portal.
   *
   * Opcional no tipo porque bases gravadas antes deste bloco simplesmente não
   * têm a propriedade. Ausência, `undefined` e texto vazio significam a mesma
   * coisa que `null`, e a leitura do armazenamento normaliza os três para `null`
   * antes de qualquer decisão. Nenhuma camada deve ler o campo diretamente: use
   * `storedAccessProfileId`, que é onde essa normalização mora.
   */
  accessProfileId?: string | null
  permissions: string
  permissionKeys: string[]
  departments: string[]
  departmentPageAccess: DepartmentPageAccess[]
  status: UserStatus
  /** Últimos eventos conhecidos; parcial porque usuários legados do mock não têm histórico de criação. */
  audit?: Partial<UserAuditMetadata>
  lastAccess: string
  initials: string
}

export type Permission = {
  name: string
  key: string
  description: string
  screens: string[]
  users: number
  color: string
}
