import {
  Activity,
  AlertTriangle,
  CircleDollarSign,
  Database,
  FileCheck,
  Fuel,
  LayoutDashboard,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export const FLEET_MANAGEMENT_ACCESS_PERMISSION = 'bi.gestao-frota.access'

export const fleetManagementOverviewPath = '/dashboard/gestao-frota/visao-geral'

export const fleetManagementOverviewTitle = 'Visão Geral'
export const fleetManagementOverviewSubtitle = 'Indicadores executivos da gestão de frota'

export type FleetManagementPageKey =
  | 'overview'
  | 'costs'
  | 'fuel'
  | 'maintenance'
  | 'availability-utilization'
  | 'incidents-fines'
  | 'document-compliance'
  | 'intelligence'
  | 'model'

export const FLEET_MANAGEMENT_OVERVIEW_KEY: FleetManagementPageKey = 'overview'

export type FleetManagementNavigationItem = {
  key: FleetManagementPageKey
  label: string
  icon: LucideIcon
  disabled: boolean
}

export const fleetManagementNavigationItems: FleetManagementNavigationItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, disabled: false },
  { key: 'costs', label: 'Custos', icon: CircleDollarSign, disabled: false },
  { key: 'fuel', label: 'Combustível', icon: Fuel, disabled: false },
  { key: 'maintenance', label: 'Manutenção', icon: Wrench, disabled: false },
  { key: 'availability-utilization', label: 'Disponibilidade e Utilização', icon: Activity, disabled: false },
  { key: 'incidents-fines', label: 'Sinistros e Multas', icon: AlertTriangle, disabled: false },
  { key: 'document-compliance', label: 'Conformidade Documental', icon: FileCheck, disabled: false },
  { key: 'intelligence', label: 'Inteligência (IA)', icon: Sparkles, disabled: false },
  { key: 'model', label: 'Modelo Dimensional', icon: Database, disabled: false },
]
