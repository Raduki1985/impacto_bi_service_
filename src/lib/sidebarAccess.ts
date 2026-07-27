import { getDepartmentPageAccessState } from './accessControl'
import type { AreaSidebarItem } from '../components/navigation/AreaSidebar'
import type { BiAreaId } from '../config/biAreas'
import type { User } from '../data/dashboardTypes'

/**
 * Adapta o estado de acesso de cada página para a apresentação da AreaSidebar:
 * `hidden` remove o item da lista, `enabled` mantém o item navegável e
 * `disabled` mantém o item visível e bloqueado.
 *
 * Devolve sempre itens novos e na ordem recebida, para não tocar nos
 * `pageConfig` de origem. A decisão de acesso continua inteira em
 * `getDepartmentPageAccessState`.
 */
export function getAccessibleDepartmentSidebarItems(
  user: User | null,
  departmentId: BiAreaId,
  items: readonly AreaSidebarItem[],
): AreaSidebarItem[] {
  return items.flatMap((item) => {
    const state = getDepartmentPageAccessState(user, departmentId, item.key)

    if (state === 'hidden') return []

    return [{ ...item, disabled: state === 'disabled' }]
  })
}
