import { ADMIN_FULL_PERMISSION } from '../config/permissions'
import { departmentPages } from '../config/departmentPages'
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

/** Como uma página departamental deve se comportar para um usuário. */
export type DepartmentPageAccessState =
  | 'hidden'
  | 'enabled'
  | 'disabled'

/**
 * Combina a permissão do usuário com o catálogo de páginas do departamento.
 *
 * `hidden` cobre os dois casos em que a página não deve sequer ser exibida: ela
 * não existe no catálogo daquele departamento, ou o usuário não tem permissão
 * sobre ela. `disabled` é a página autorizada que ainda está em desenvolvimento,
 * e `enabled` é a página autorizada e disponível.
 *
 * `admin.full` continua sendo tratado apenas em `hasDepartmentPageAccess`: ele
 * concede permissão sobre qualquer página, mas não ignora o estado de
 * desenvolvimento nem torna válida uma página que não existe no catálogo.
 */
export function getDepartmentPageAccessState(
  user: User | null,
  departmentId: BiAreaId,
  pageKey: string,
): DepartmentPageAccessState {
  const page = departmentPages[departmentId].find((item) => item.key === pageKey)

  if (!page) return 'hidden'
  if (!hasDepartmentPageAccess(user, departmentId, pageKey)) return 'hidden'

  return page.disabled ? 'disabled' : 'enabled'
}
