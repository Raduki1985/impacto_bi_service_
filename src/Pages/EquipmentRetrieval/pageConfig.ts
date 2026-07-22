import {
  AlertTriangle,
  ClipboardList,
  Database,
  Gauge,
  LayoutDashboard,
  Layers,
  Package,
  TimerReset,
  type LucideIcon,
} from 'lucide-react'

export const EQUIPMENT_RETRIEVAL_ACCESS_PERMISSION = 'bi.retiradas.access'

export const equipmentRetrievalOverviewPath = '/dashboard/retiradas/visao-geral'

export const equipmentRetrievalOverviewTitle = 'Visão Geral'
export const equipmentRetrievalOverviewSubtitle = 'Indicadores executivos da operação de retiradas'

export type EquipmentRetrievalPageKey =
  | 'overview'
  | 'equipment'
  | 'technical-productivity'
  | 'protocols'
  | 'effectiveness-deadlines'
  | 'aggregates'
  | 'damages-losses'
  | 'model'

export const EQUIPMENT_RETRIEVAL_OVERVIEW_KEY: EquipmentRetrievalPageKey = 'overview'

export type EquipmentRetrievalNavigationItem = {
  key: EquipmentRetrievalPageKey
  label: string
  icon: LucideIcon
  disabled: boolean
}

export const equipmentRetrievalNavigationItems: EquipmentRetrievalNavigationItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, disabled: false },
  { key: 'equipment', label: 'Equipamentos', icon: Package, disabled: true },
  { key: 'technical-productivity', label: 'Produtividade Técnica', icon: Gauge, disabled: true },
  { key: 'protocols', label: 'Protocolos', icon: ClipboardList, disabled: true },
  { key: 'effectiveness-deadlines', label: 'Efetividade e Prazos', icon: TimerReset, disabled: true },
  { key: 'aggregates', label: 'Agregados', icon: Layers, disabled: true },
  { key: 'damages-losses', label: 'Avarias e Extravios', icon: AlertTriangle, disabled: true },
  { key: 'model', label: 'Modelo', icon: Database, disabled: true },
]
