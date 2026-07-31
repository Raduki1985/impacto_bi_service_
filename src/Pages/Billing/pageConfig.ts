import {
  Database,
  FileWarning,
  Headset,
  Inbox,
  LayoutDashboard,
  ListOrdered,
  Receipt,
  RotateCcw,
  Smile,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export const BILLING_ACCESS_PERMISSION = 'bi.cobranca.access'

export const billingOverviewPath = '/dashboard/cobranca/visao-geral'

export const billingOverviewTitle = 'Visão Geral'
export const billingOverviewSubtitle = 'Indicadores executivos da operação de cobrança'

export type BillingPageKey =
  | 'overview'
  | 'service'
  | 'requests'
  | 'collections-agreements'
  | 'collection-cycle'
  | 'titles-delinquency'
  | 'cancellations-reactivations'
  | 'customer-experience'
  | 'intelligence'
  | 'model'

export const BILLING_OVERVIEW_KEY: BillingPageKey = 'overview'

export type BillingNavigationItem = {
  key: BillingPageKey
  label: string
  icon: LucideIcon
  disabled: boolean
}

export const billingNavigationItems: BillingNavigationItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, disabled: false },
  { key: 'service', label: 'Atendimento', icon: Headset, disabled: true },
  { key: 'requests', label: 'Solicitações', icon: Inbox, disabled: true },
  { key: 'collections-agreements', label: 'Cobranças e Acordos', icon: Receipt, disabled: true },
  { key: 'collection-cycle', label: 'Régua de Cobrança', icon: ListOrdered, disabled: true },
  { key: 'titles-delinquency', label: 'Títulos e Inadimplência', icon: FileWarning, disabled: true },
  { key: 'cancellations-reactivations', label: 'Cancelamentos e Reativações', icon: RotateCcw, disabled: true },
  { key: 'customer-experience', label: 'Experiência do Cliente', icon: Smile, disabled: true },
  { key: 'intelligence', label: 'Inteligência (IA)', icon: Sparkles, disabled: true },
  { key: 'model', label: 'Modelo Dimensional', icon: Database, disabled: true },
]
