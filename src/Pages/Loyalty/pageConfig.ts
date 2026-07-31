import {
  ClipboardList,
  Database,
  FileSignature,
  Headset,
  LayoutDashboard,
  RefreshCcw,
  Smile,
  Sparkles,
  Tag,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export const LOYALTY_ACCESS_PERMISSION = 'bi.fidelizacao.access'

export const loyaltyOverviewPath = '/dashboard/fidelizacao/visao-geral'

export const loyaltyOverviewTitle = 'Visão Geral'
export const loyaltyOverviewSubtitle = 'Indicadores executivos da operação de fidelização'

export type LoyaltyPageKey =
  | 'overview'
  | 'attendances'
  | 'offers-conversion'
  | 'ticket-plans'
  | 'contracts-loyalty'
  | 'renewals'
  | 'customer-experience'
  | 'agents'
  | 'intelligence'
  | 'model'

export const LOYALTY_OVERVIEW_KEY: LoyaltyPageKey = 'overview'

export type LoyaltyNavigationItem = {
  key: LoyaltyPageKey
  label: string
  icon: LucideIcon
  disabled: boolean
}

export const loyaltyNavigationItems: LoyaltyNavigationItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, disabled: false },
  { key: 'attendances', label: 'Atendimentos', icon: Headset, disabled: true },
  { key: 'offers-conversion', label: 'Ofertas e Conversão', icon: Tag, disabled: true },
  { key: 'ticket-plans', label: 'Ticket e Planos', icon: ClipboardList, disabled: true },
  { key: 'contracts-loyalty', label: 'Contratos e Fidelidade', icon: FileSignature, disabled: true },
  { key: 'renewals', label: 'Renovações', icon: RefreshCcw, disabled: true },
  { key: 'customer-experience', label: 'Experiência do Cliente', icon: Smile, disabled: true },
  { key: 'agents', label: 'Atendentes', icon: UsersRound, disabled: true },
  { key: 'intelligence', label: 'Inteligência (IA)', icon: Sparkles, disabled: true },
  { key: 'model', label: 'Modelo Dimensional', icon: Database, disabled: true },
]
