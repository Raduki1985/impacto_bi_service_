import {
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  Database,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Sparkles,
  Target,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export const COMMERCIAL_ACCESS_PERMISSION = 'bi.comercial.access'

export const commercialOverviewPath = '/dashboard/comercial/visao-geral'

export const commercialOverviewTitle = 'Visão Geral'
export const commercialOverviewSubtitle = 'Indicadores executivos da operação comercial'

export type CommercialPageKey =
  | 'overview'
  | 'goals'
  | 'sellers'
  | 'cities-stores'
  | 'plans-services'
  | 'customers'
  | 'sales-period'
  | 'detailed-indicators'
  | 'reports'
  | 'intelligence'
  | 'model'

export const COMMERCIAL_OVERVIEW_KEY: CommercialPageKey = 'overview'

export type CommercialNavigationItem = {
  key: CommercialPageKey
  label: string
  icon: LucideIcon
  disabled: boolean
}

export const commercialNavigationItems: CommercialNavigationItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, disabled: false },
  { key: 'goals', label: 'Metas e Desempenho', icon: Target, disabled: true },
  { key: 'sellers', label: 'Vendedores', icon: Users, disabled: true },
  { key: 'cities-stores', label: 'Cidades e Lojas', icon: MapPin, disabled: true },
  { key: 'plans-services', label: 'Planos e Serviços', icon: ClipboardList, disabled: true },
  { key: 'customers', label: 'Clientes', icon: UsersRound, disabled: true },
  { key: 'sales-period', label: 'Vendas por Período', icon: ChartNoAxesColumnIncreasing, disabled: true },
  { key: 'detailed-indicators', label: 'Indicadores Detalhados', icon: LayoutGrid, disabled: true },
  { key: 'reports', label: 'Relatórios', icon: FileText, disabled: true },
  { key: 'intelligence', label: 'Inteligência (IA)', icon: Sparkles, disabled: true },
  { key: 'model', label: 'Modelo Dimensional', icon: Database, disabled: true },
]
