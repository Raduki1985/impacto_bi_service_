import {
  AlertTriangle,
  ClipboardCheck,
  Database,
  HardHat,
  LayoutDashboard,
  Repeat2,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react'

export const TECHNICAL_AUDIT_ACCESS_PERMISSION = 'bi.auditoria-tecnica.access'

export const technicalAuditOverviewPath = '/dashboard/auditoria-tecnica/visao-geral'

export const technicalAuditOverviewTitle = 'Visão Geral'
export const technicalAuditOverviewSubtitle = 'Indicadores executivos da operação de auditoria técnica'

export type TechnicalAuditPageKey =
  | 'overview'
  | 'audits'
  | 'technical-compliance'
  | 'rework'
  | 'ppe-tools'
  | 'vehicles-ladders'
  | 'incidents-safety'
  | 'model'

export const TECHNICAL_AUDIT_OVERVIEW_KEY: TechnicalAuditPageKey = 'overview'

export type TechnicalAuditNavigationItem = {
  key: TechnicalAuditPageKey
  label: string
  icon: LucideIcon
  disabled: boolean
}

export const technicalAuditNavigationItems: TechnicalAuditNavigationItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, disabled: false },
  { key: 'audits', label: 'Auditorias', icon: ClipboardCheck, disabled: true },
  { key: 'technical-compliance', label: 'Conformidade Técnica', icon: ShieldCheck, disabled: true },
  { key: 'rework', label: 'Retrabalho', icon: Repeat2, disabled: true },
  { key: 'ppe-tools', label: 'EPIs e Ferramentas', icon: HardHat, disabled: true },
  { key: 'vehicles-ladders', label: 'Veículos e Escadas', icon: Truck, disabled: true },
  { key: 'incidents-safety', label: 'Incidentes e Segurança', icon: AlertTriangle, disabled: true },
  { key: 'model', label: 'Modelo', icon: Database, disabled: true },
]
