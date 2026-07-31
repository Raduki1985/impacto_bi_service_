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
  { key: 'costs', label: 'Custos', icon: CircleDollarSign, disabled: true },
  { key: 'fuel', label: 'Combustível', icon: Fuel, disabled: true },
  { key: 'maintenance', label: 'Manutenção', icon: Wrench, disabled: true },
  { key: 'availability-utilization', label: 'Disponibilidade e Utilização', icon: Activity, disabled: true },
  { key: 'incidents-fines', label: 'Sinistros e Multas', icon: AlertTriangle, disabled: true },
  { key: 'document-compliance', label: 'Conformidade Documental', icon: FileCheck, disabled: true },
  { key: 'intelligence', label: 'Inteligência (IA)', icon: Sparkles, disabled: true },
  { key: 'model', label: 'Modelo Dimensional', icon: Database, disabled: true },
]
