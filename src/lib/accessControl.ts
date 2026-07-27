import { ADMIN_FULL_PERMISSION } from '../config/permissions'
import type { BiAreaId } from '../config/biAreas'
import type { User } from '../data/dashboardTypes'

/**
 * Regra pura de autorização de uma página de departamento.
 *
 * `admin.full` é o bypass global: quem o possui acessa qualquer página, sem
 * consultar os vínculos individuais. Para os demais usuários o acesso é sempre
 * avaliado pelo par departmentId + pageKey no mesmo registro de
 * `departmentPageAccess`, porque a mesma chave de página (overview, model)
 * existe em vários departamentos e conceder uma delas não pode liberar as outras.
 *
 * O estado de desenvolvimento da página (`disabled`) não faz parte desta função:
 * ter permissão e a página estar pronta são condições independentes, tratadas
 * separadamente.
 */
export function hasDepartmentPageAccess(
  user: User | null,
  departmentId: BiAreaId,
  pageKey: string,
): boolean {
  if (!user) return false

  if (user.permissionKeys.includes(ADMIN_FULL_PERMISSION)) return true

  return user.departmentPageAccess.some(
    (access) => access.departmentId === departmentId && access.pageKeys.includes(pageKey),
  )
}
