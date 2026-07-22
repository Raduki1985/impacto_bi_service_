import {
  Database,
  Headset,
  Layers,
  LayoutDashboard,
  MapPinned,
  RotateCcw,
  ShieldAlert,
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
  { key: 'attendances', label: 'Atendimentos', icon: Headset, disabled: true },
  { key: 'retentions-cancellations', label: 'Retenções e Cancelamentos', icon: RotateCcw, disabled: true },
  { key: 'churn', label: 'Churn', icon: TrendingDown, disabled: true },
  { key: 'preventive-churn', label: 'Churn Preventivo', icon: ShieldAlert, disabled: true },
  { key: 'aggregates', label: 'Agregados', icon: Layers, disabled: true },
  { key: 'geographic-analysis', label: 'Análise Geográfica', icon: MapPinned, disabled: true },
  { key: 'agents', label: 'Agentes', icon: UsersRound, disabled: true },
  { key: 'model', label: 'Modelo', icon: Database, disabled: true },
]
