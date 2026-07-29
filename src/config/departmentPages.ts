import type { BiAreaId } from './biAreas'
import { navigationGroups } from '../Pages/Dashboard/pageConfig'
import { billingNavigationItems } from '../Pages/Billing/pageConfig'
import { commercialNavigationItems } from '../Pages/Commercial/pageConfig'
import { copNavigationItems } from '../Pages/Cop/pageConfig'
import { customerExperienceNavigationItems } from '../Pages/CustomerExperience/pageConfig'
import { equipmentRetrievalNavigationItems } from '../Pages/EquipmentRetrieval/pageConfig'
import { fleetManagementNavigationItems } from '../Pages/FleetManagement/pageConfig'
import { loyaltyNavigationItems } from '../Pages/Loyalty/pageConfig'
import { retentionNavigationItems } from '../Pages/Retention/pageConfig'
import { technicalAuditNavigationItems } from '../Pages/TechnicalAudit/pageConfig'
import { technicalSupportNavigationItems } from '../Pages/TechnicalSupport/pageConfig'

/**
 * Página de um departamento, reduzida ao que identifica e rotula o acesso.
 * Ícone, rota, slug e componente permanecem no `pageConfig` de origem.
 */
export type DepartmentPageDefinition = {
  key: string
  label: string
  disabled: boolean
}

/** Forma mínima aceita dos itens de navegação já publicados nos `pageConfig`. */
type NavigationItemSource = {
  key: string
  label: string
  disabled?: boolean
}

/** Páginas do `pageConfig` de Ordens de Serviço que pertencem ao contexto administrativo. */
const ADMIN_PAGE_KEYS: ReadonlySet<string> = new Set(['users', 'history'])

/** Mantém a ordem de origem; item sem `disabled` é considerado habilitado. */
function toDepartmentPages(
  items: readonly NavigationItemSource[],
): readonly DepartmentPageDefinition[] {
  return items.map(({ key, label, disabled }) => ({ key, label, disabled: disabled ?? false }))
}

/** Ordens de Serviço agrupa as páginas na sidebar: o registro achata os grupos na ordem exibida. */
const ordersServicePages = toDepartmentPages(
  navigationGroups
    .flatMap<NavigationItemSource>((group) => group.items)
    .filter((item) => !ADMIN_PAGE_KEYS.has(item.key)),
)

/**
 * Registro somente leitura das páginas de cada departamento, derivado dos
 * `pageConfig` existentes. Fonte única para validar os pares departamento e
 * página aceitos por `DepartmentPageAccess`.
 */
export const departmentPages = {
  'auditoria-tecnica': toDepartmentPages(technicalAuditNavigationItems),
  cobranca: toDepartmentPages(billingNavigationItems),
  comercial: toDepartmentPages(commercialNavigationItems),
  cop: toDepartmentPages(copNavigationItems),
  'experiencia-cliente': toDepartmentPages(customerExperienceNavigationItems),
  fidelizacao: toDepartmentPages(loyaltyNavigationItems),
  'gestao-frota': toDepartmentPages(fleetManagementNavigationItems),
  os: ordersServicePages,
  retencao: toDepartmentPages(retentionNavigationItems),
  retiradas: toDepartmentPages(equipmentRetrievalNavigationItems),
  'suporte-tecnico': toDepartmentPages(technicalSupportNavigationItems),
} satisfies Record<BiAreaId, readonly DepartmentPageDefinition[]>
