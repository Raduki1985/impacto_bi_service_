import {
  ArrowUpCircle,
  BarChart3,
  Database,
  Gauge,
  Headset,
  LayoutDashboard,
  Repeat2,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export const TECHNICAL_SUPPORT_ACCESS_PERMISSION = 'bi.suporte-tecnico.access'

export const technicalSupportOverviewPath = '/dashboard/suporte-tecnico/visao-geral'

export const technicalSupportOverviewTitle = 'Visão Geral'
export const technicalSupportOverviewSubtitle = 'Indicadores executivos da operação de suporte técnico'

export type TechnicalSupportPageKey =
  | 'overview'
  | 'attendances'
  | 'operational-efficiency'
  | 'escalations'
  | 'rework-recurrence'
  | 'quality-satisfaction'
  | 'agents'
  | 'intelligence'
  | 'model'

export const TECHNICAL_SUPPORT_OVERVIEW_KEY: TechnicalSupportPageKey = 'overview'

export type TechnicalSupportNavigationItem = {
  key: TechnicalSupportPageKey
  label: string
  icon: LucideIcon
  disabled: boolean
}

export const technicalSupportNavigationItems: TechnicalSupportNavigationItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, disabled: false },
  { key: 'attendances', label: 'Atendimentos', icon: Headset, disabled: true },
  { key: 'operational-efficiency', label: 'Eficiência Operacional', icon: Gauge, disabled: true },
  { key: 'escalations', label: 'Escalonamentos', icon: ArrowUpCircle, disabled: true },
  { key: 'rework-recurrence', label: 'Retrabalho e Reincidência', icon: Repeat2, disabled: true },
  { key: 'quality-satisfaction', label: 'Qualidade e Satisfação', icon: BarChart3, disabled: true },
  { key: 'agents', label: 'Atendentes', icon: UsersRound, disabled: true },
  { key: 'intelligence', label: 'Inteligência (IA)', icon: Sparkles, disabled: true },
  { key: 'model', label: 'Modelo Dimensional', icon: Database, disabled: true },
]
