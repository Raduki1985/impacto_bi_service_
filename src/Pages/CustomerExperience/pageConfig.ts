import {
  BadgeCheck,
  BarChart3,
  Database,
  LayoutDashboard,
  Smile,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

export const CUSTOMER_EXPERIENCE_ACCESS_PERMISSION = 'bi.experiencia-cliente.access'

export const customerExperienceOverviewPath = '/dashboard/experiencia-cliente/visao-geral'

export const customerExperienceOverviewTitle = 'Visão Geral'
export const customerExperienceOverviewSubtitle = 'Indicadores executivos da experiência do cliente'

export type CustomerExperiencePageKey =
  | 'overview'
  | 'satisfaction'
  | 'recommendation'
  | 'perceived-quality'
  | 'sector-comparison'
  | 'temporal-evolution'
  | 'intelligence'
  | 'model'

export const CUSTOMER_EXPERIENCE_OVERVIEW_KEY: CustomerExperiencePageKey = 'overview'

export type CustomerExperienceNavigationItem = {
  key: CustomerExperiencePageKey
  label: string
  icon: LucideIcon
  disabled: boolean
}

export const customerExperienceNavigationItems: CustomerExperienceNavigationItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, disabled: false },
  { key: 'satisfaction', label: 'Satisfação', icon: Smile, disabled: false },
  { key: 'recommendation', label: 'Recomendação', icon: ThumbsUp, disabled: false },
  { key: 'perceived-quality', label: 'Qualidade Percebida', icon: BadgeCheck, disabled: false },
  { key: 'sector-comparison', label: 'Comparativo por Setor', icon: BarChart3, disabled: false },
  { key: 'temporal-evolution', label: 'Evolução Temporal', icon: TrendingUp, disabled: false },
  { key: 'intelligence', label: 'Inteligência (IA)', icon: Sparkles, disabled: false },
  { key: 'model', label: 'Modelo Dimensional', icon: Database, disabled: false },
]
