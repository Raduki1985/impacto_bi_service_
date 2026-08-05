import {
  Database,
  Gauge,
  LayoutDashboard,
  Repeat2,
  Settings,
  Sparkles,
  TimerReset,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export const COP_ACCESS_PERMISSION = 'bi.cop.access'

export const copOverviewPath = '/dashboard/cop/visao-geral'

export const copOverviewTitle = 'Visão Geral'
export const copOverviewSubtitle = 'Indicadores executivos da operação do COP'

export type CopPageKey =
  | 'overview'
  | 'installations'
  | 'maintenance'
  | 'technical-productivity'
  | 'rework'
  | 'deadlines-mttr'
  | 'intelligence'
  | 'model'

export const COP_OVERVIEW_KEY: CopPageKey = 'overview'

export type CopNavigationItem = {
  key: CopPageKey
  label: string
  icon: LucideIcon
  disabled: boolean
}

export const copNavigationItems: CopNavigationItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, disabled: false },
  { key: 'installations', label: 'Instalações', icon: Wrench, disabled: false },
  { key: 'maintenance', label: 'Manutenções', icon: Settings, disabled: false },
  { key: 'technical-productivity', label: 'Produtividade Técnica', icon: Gauge, disabled: false },
  { key: 'rework', label: 'Retrabalho', icon: Repeat2, disabled: false },
  { key: 'deadlines-mttr', label: 'Prazos e MTTR', icon: TimerReset, disabled: false },
  { key: 'intelligence', label: 'Inteligência (IA)', icon: Sparkles, disabled: false },
  { key: 'model', label: 'Modelo Dimensional', icon: Database, disabled: false },
]
