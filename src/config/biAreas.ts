import { pageFromSlug, pageSlugs } from '../Pages/Dashboard/pageConfig'
import { COMMERCIAL_ACCESS_PERMISSION, commercialOverviewPath } from '../Pages/Commercial/pageConfig'
import {
  TECHNICAL_SUPPORT_ACCESS_PERMISSION,
  technicalSupportOverviewPath,
} from '../Pages/TechnicalSupport/pageConfig'
import { BILLING_ACCESS_PERMISSION, billingOverviewPath } from '../Pages/Billing/pageConfig'
import {
  EQUIPMENT_RETRIEVAL_ACCESS_PERMISSION,
  equipmentRetrievalOverviewPath,
} from '../Pages/EquipmentRetrieval/pageConfig'
import { LOYALTY_ACCESS_PERMISSION, loyaltyOverviewPath } from '../Pages/Loyalty/pageConfig'
import { RETENTION_ACCESS_PERMISSION, retentionOverviewPath } from '../Pages/Retention/pageConfig'
import { COP_ACCESS_PERMISSION, copOverviewPath } from '../Pages/Cop/pageConfig'
import {
  TECHNICAL_AUDIT_ACCESS_PERMISSION,
  technicalAuditOverviewPath,
} from '../Pages/TechnicalAudit/pageConfig'
import {
  FLEET_MANAGEMENT_ACCESS_PERMISSION,
  fleetManagementOverviewPath,
} from '../Pages/FleetManagement/pageConfig'
import {
  CUSTOMER_EXPERIENCE_ACCESS_PERMISSION,
  customerExperienceOverviewPath,
} from '../Pages/CustomerExperience/pageConfig'
import { ORDERS_SERVICE_ACCESS_PERMISSION } from './permissions'

export type BiAreaId =
  | 'os'
  | 'comercial'
  | 'suporte-tecnico'
  | 'cobranca'
  | 'retiradas'
  | 'fidelizacao'
  | 'retencao'
  | 'cop'
  | 'auditoria-tecnica'
  | 'gestao-frota'
  | 'experiencia-cliente'

export type BiArea = {
  id: BiAreaId
  label: string
  overviewPath: string
  requiredPermission: string | null
  matchesPath: (pathname: string) => boolean
}

/** Contexto visual da navegação: uma BiArea selecionável, ou um contexto global (admin/corporativo) somente informativo. */
export type NavigationContextId = BiAreaId | 'admin' | 'corporate'

export type NavigationContext = {
  id: NavigationContextId
  label: string
}

const ADMIN_CONTEXT: NavigationContext = { id: 'admin', label: 'Configurações do Portal' }
const CORPORATE_CONTEXT: NavigationContext = { id: 'corporate', label: 'Visão Geral Executiva' }

/** Páginas do dashboard que pertencem ao contexto administrativo, não a Ordens de Serviço. */
const adminPageSlugs = new Set<string>([pageSlugs.users, pageSlugs.permissions])

/** Rota fixa da Visão Geral Executiva — contexto global do portal, não uma BiArea departamental do array biAreas. */
export const CORPORATE_OVERVIEW_PATH = '/dashboard/inicio'

function adminPageSlugFromPath(pathname: string): string | null {
  const match = /^\/dashboard\/([^/]+)\/?$/.exec(pathname)
  return match ? match[1] : null
}

function configPageSlugFromPath(pathname: string): string | null {
  const match = /^\/dashboard\/configuracoes\/([^/]+)\/?$/.exec(pathname)
  return match ? match[1] : null
}

function osPageSlugFromPath(pathname: string): string | null {
  const match = /^\/dashboard\/os\/([^/]+)\/?$/.exec(pathname)
  return match ? match[1] : null
}

function isAdminPath(pathname: string): boolean {
  const legacySlug = adminPageSlugFromPath(pathname)
  if (legacySlug !== null && adminPageSlugs.has(legacySlug)) return true

  const configSlug = configPageSlugFromPath(pathname)
  return configSlug !== null
}

function isCorporatePath(pathname: string): boolean {
  return pathname === CORPORATE_OVERVIEW_PATH
}

export const biAreas: BiArea[] = [
  {
    id: 'auditoria-tecnica',
    label: 'Auditoria Técnica',
    overviewPath: technicalAuditOverviewPath,
    requiredPermission: TECHNICAL_AUDIT_ACCESS_PERMISSION,
    matchesPath: (pathname) =>
      pathname === '/dashboard/auditoria-tecnica' ||
      pathname.startsWith('/dashboard/auditoria-tecnica/'),
  },
  {
    id: 'cobranca',
    label: 'Cobrança',
    overviewPath: billingOverviewPath,
    requiredPermission: BILLING_ACCESS_PERMISSION,
    matchesPath: (pathname) =>
      pathname === '/dashboard/cobranca' ||
      pathname.startsWith('/dashboard/cobranca/'),
  },
  {
    id: 'comercial',
    label: 'Comercial',
    overviewPath: commercialOverviewPath,
    requiredPermission: COMMERCIAL_ACCESS_PERMISSION,
    matchesPath: (pathname) => pathname.startsWith('/dashboard/comercial'),
  },
  {
    id: 'cop',
    label: 'COP',
    overviewPath: copOverviewPath,
    requiredPermission: COP_ACCESS_PERMISSION,
    matchesPath: (pathname) =>
      pathname === '/dashboard/cop' ||
      pathname.startsWith('/dashboard/cop/'),
  },
  {
    id: 'experiencia-cliente',
    label: 'Experiência do Cliente',
    overviewPath: customerExperienceOverviewPath,
    requiredPermission: CUSTOMER_EXPERIENCE_ACCESS_PERMISSION,
    matchesPath: (pathname) =>
      pathname === '/dashboard/experiencia-cliente' ||
      pathname.startsWith('/dashboard/experiencia-cliente/'),
  },
  {
    id: 'fidelizacao',
    label: 'Fidelização',
    overviewPath: loyaltyOverviewPath,
    requiredPermission: LOYALTY_ACCESS_PERMISSION,
    matchesPath: (pathname) =>
      pathname === '/dashboard/fidelizacao' ||
      pathname.startsWith('/dashboard/fidelizacao/'),
  },
  {
    id: 'gestao-frota',
    label: 'Gestão de Frota',
    overviewPath: fleetManagementOverviewPath,
    requiredPermission: FLEET_MANAGEMENT_ACCESS_PERMISSION,
    matchesPath: (pathname) =>
      pathname === '/dashboard/gestao-frota' ||
      pathname.startsWith('/dashboard/gestao-frota/'),
  },
  {
    id: 'os',
    label: 'Ordens de Serviço',
    overviewPath: `/dashboard/os/${pageSlugs.overview}`,
    requiredPermission: ORDERS_SERVICE_ACCESS_PERMISSION,
    matchesPath: (pathname) => {
      const slug = osPageSlugFromPath(pathname)
      if (slug === null) return false
      if (adminPageSlugs.has(slug)) return false
      return pageFromSlug(slug) !== null
    },
  },
  {
    id: 'retencao',
    label: 'Retenção',
    overviewPath: retentionOverviewPath,
    requiredPermission: RETENTION_ACCESS_PERMISSION,
    matchesPath: (pathname) =>
      pathname === '/dashboard/retencao' ||
      pathname.startsWith('/dashboard/retencao/'),
  },
  {
    id: 'retiradas',
    label: 'Retiradas',
    overviewPath: equipmentRetrievalOverviewPath,
    requiredPermission: EQUIPMENT_RETRIEVAL_ACCESS_PERMISSION,
    matchesPath: (pathname) =>
      pathname === '/dashboard/retiradas' ||
      pathname.startsWith('/dashboard/retiradas/'),
  },
  {
    id: 'suporte-tecnico',
    label: 'Suporte Técnico',
    overviewPath: technicalSupportOverviewPath,
    requiredPermission: TECHNICAL_SUPPORT_ACCESS_PERMISSION,
    matchesPath: (pathname) =>
      pathname === '/dashboard/suporte-tecnico' ||
      pathname.startsWith('/dashboard/suporte-tecnico/'),
  },
]

export function getActiveBiArea(pathname: string): BiArea | null {
  return biAreas.find((area) => area.matchesPath(pathname)) ?? null
}

/** Identifica o contexto visual atual da navegação, incluindo Administração (estática, sem dropdown) e Visão Geral Executiva, agora selecionável a partir do dropdown das páginas departamentais. */
export function getActiveNavigationContext(pathname: string): NavigationContext | null {
  if (isAdminPath(pathname)) return ADMIN_CONTEXT
  if (isCorporatePath(pathname)) return CORPORATE_CONTEXT

  const area = getActiveBiArea(pathname)
  return area ? { id: area.id, label: area.label } : null
}
