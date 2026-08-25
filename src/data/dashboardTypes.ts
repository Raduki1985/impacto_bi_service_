import type {
  DepartmentPageAccess,
  UserAuditMetadata,
  UserProfile,
  UserStatus,
} from '../types/access'
import type { OrderStatus, OsCity, OsServiceType, OsTeam } from './mockOsCatalog'

export type { OrderStatus, OsCity, OsServiceType, OsTeam } from './mockOsCatalog'

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
  /** Tipo de OS normalizado do SGI. Dimensão distinta de `category`. */
  serviceType: OsServiceType
  /** Cidade normalizada, sem duplicidade por caixa. */
  city: OsCity
  /**
   * Identificador interno e opaco do técnico na base mockada
   * (`mock-tech-NNN`, não é o identificador oficial do SGI). `null` SOMENTE
   * quando a própria OS ainda não possui técnico atribuído; nunca é exibido
   * na interface.
   */
  technicianId: string | null
  /** Nome exibido no SGI; `null` apenas em OS sem técnico atribuído. */
  technician: string | null
  /**
   * Equipe oficial do técnico. `null` apenas em OS sem técnico: toda OS com
   * técnico tem exatamente uma das seis equipes oficiais.
   */
  team: OsTeam | null
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
  /**
   * Motivo específico exibido quando `available` é false. Sem ele, o card
   * mantém o aviso padrão `Sem período anterior`: os consumidores antigos não
   * mudam de comportamento. A Visão Geral usa `Período anterior incompleto`
   * quando a janela anterior alcança datas sem cobertura da fonte.
   */
  unavailableLabel?: string
  /** Leitura acessível correspondente ao `unavailableLabel`. */
  unavailableAccessibleLabel?: string
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

/**
 * Ponto diário dos minigráficos dos cards executivos.
 *
 * `null` marca dia sem base válida para a métrica, que é diferente de zero: um
 * dia sem OS concluída não tem tempo médio de atendimento, e apresentá-lo como
 * zero mentiria uma queda. O minigráfico interrompe a linha na lacuna.
 */
export type KpiSparklinePoint = number | null

/**
 * Séries diárias reais dos seis cards da Visão Geral de OS.
 *
 * Cada série tem um ponto por dia COM OS no recorte filtrado, em ordem
 * cronológica, derivado exclusivamente das mesmas linhas que alimentam os
 * valores dos cards. Dias sem nenhuma OS não entram na base, então não existem
 * zeros inventados.
 */
export type KpiSparklines = {
  /** Quantidade de OS no dia. */
  total: number[]
  /** Quantidade de OS concluídas no dia. */
  completed: number[]
  /** Concluídas divididas pelo total do dia. */
  completionRate: number[]
  /** Improdutivas divididas pelo total do dia. */
  unproductiveRate: number[]
  /** Média de duração das OS concluídas no dia; null em dia sem concluída. */
  averageTime: KpiSparklinePoint[]
  /** Quantidade distinta de técnicos atuantes no dia. */
  activeTechnicians: number[]
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
  /** Dados completos do recorte: todas as resoluções presentes, em ordem decrescente. */
  resolutionPairs: Pair[]
  /** Projeção visual: as 10 resoluções mais frequentes do recorte, para rankings. */
  resolutionTopPairs: Pair[]
  /** Projeção visual: Top 10 mais a fatia `Outras`, que soma o restante do recorte. */
  resolutionTopWithOthers: Pair[]
  daily: { x: string[]; total: number[] }
  weekly: { x: string[]; total: number[] }
  monthly: { x: string[]; values: number[] }
  evolution: { x: string[]; completed: number[]; unproductive: number[] }
  categoryStatus: { x: string[]; series: ChartSeries[] }
  /** Matriz categoria x resolução no eixo visual Top 10 + `Outras`; totais preservados. */
  categoryResolution: HeatmapData
  /** Séries por categoria sobre o eixo visual Top 10 + `Outras`; totais preservados. */
  resolutionCategoryTop: { x: string[]; series: ChartSeries[] }
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
  kpiSparklines: KpiSparklines
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
