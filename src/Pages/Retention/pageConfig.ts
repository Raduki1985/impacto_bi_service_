import {
  Database,
  Headset,
  Layers,
  LayoutDashboard,
  MapPinned,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export const RETENTION_ACCESS_PERMISSION = 'bi.retencao.access'

export const retentionOverviewPath = '/dashboard/retencao/visao-geral'

export const retentionOverviewTitle = 'Visão Geral'
export const retentionOverviewSubtitle = 'Indicadores executivos da operação de retenção'

export type RetentionPageKey =
  | 'overview'
  | 'attendances'
  | 'retentions-cancellations'
  | 'churn'
  | 'preventive-churn'
  | 'aggregates'
  | 'geographic-analysis'
  | 'agents'
  | 'intelligence'
  | 'model'

export const RETENTION_OVERVIEW_KEY: RetentionPageKey = 'overview'

export type RetentionNavigationItem = {
  key: RetentionPageKey
  label: string
  icon: LucideIcon
  disabled: boolean
}

export const retentionNavigationItems: RetentionNavigationItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, disabled: false },
  { key: 'attendances', label: 'Atendimentos', icon: Headset, disabled: false },
  { key: 'retentions-cancellations', label: 'Retenções e Cancelamentos', icon: RotateCcw, disabled: false },
  { key: 'churn', label: 'Churn', icon: TrendingDown, disabled: false },
  { key: 'preventive-churn', label: 'Churn Preventivo', icon: ShieldAlert, disabled: false },
  { key: 'aggregates', label: 'Agregados', icon: Layers, disabled: false },
  { key: 'geographic-analysis', label: 'Análise Geográfica', icon: MapPinned, disabled: false },
  { key: 'agents', label: 'Agentes', icon: UsersRound, disabled: false },
  { key: 'intelligence', label: 'Inteligência (IA)', icon: Sparkles, disabled: false },
  { key: 'model', label: 'Modelo Dimensional', icon: Database, disabled: false },
]
