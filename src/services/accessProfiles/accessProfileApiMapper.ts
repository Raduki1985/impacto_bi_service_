import {
  normalizeAccessProfileGrants,
  resolveAccessProfileHomePage,
} from '../../lib/accessProfileRules'
import type { AccessProfile, DepartmentPageAccess } from '../../types/access'
import type { CoreAccess } from '../../types/coreApi'

/**
 * Tradução de uma linha de `access` do `impacto-bi-service` para o
 * `AccessProfile` do portal.
 *
 * A forma é a do domínio, e não uma cópia do contrato: a tela Perfis de acesso e
 * o cadastro de usuários montam os labels de departamento a partir de
 * `departmentPageAccess` e nunca precisam saber de onde o perfil veio.
 *
 * | serviço                         | portal                                   |
 * |---------------------------------|------------------------------------------|
 * | `id` (UUID)                     | `id`                                     |
 * | `name`, `description`           | `name`, `description`                    |
 * | menus                           | `departmentPageAccess`, `homePage`       |
 * | `users_count`                   | `hasBeenUsed`                            |
 * | (não existe)                    | `lifecycle`, sempre ativo                |
 *
 * O TIPO de perfil saiu das duas colunas: ele vinha de
 * `access.access_profile_system_id`, que não existe mais, e virava `kind` e
 * `audience` no portal. Um perfil de acesso é nome e menus, e nada nele diz a
 * quem se destina. `lifecycle` é sempre ativo porque o serviço não tem esse
 * estado. `hasBeenUsed` é a contagem de usuários que ele calcula.
 *
 * Módulo puro: não lê nem grava armazenamento e não chama o serviço. Os menus
 * já chegam traduzidos em departamentos e páginas por quem chama.
 */

/**
 * `AccessProfile` a partir da linha de `access` e das concessões já traduzidas
 * dos menus.
 *
 * Não recusa mais nenhuma linha. Recusava a de tipo desconhecido, quando o tipo
 * decidia quem podia receber o perfil; hoje toda linha de `access` é um perfil
 * que qualquer pessoa pode receber.
 */
export function accessProfileFromCoreAccess(
  core: CoreAccess,
  grants: readonly DepartmentPageAccess[],
): AccessProfile {
  const departmentPageAccess = normalizeAccessProfileGrants(grants)
  const description = core.description?.trim()

  return {
    id: core.id,
    name: core.name.trim(),
    ...(description ? { description } : {}),
    lifecycle: 'active' as const,
    departmentPageAccess,
    // Sem página concedida não há destino, e nenhum é inventado: o domínio
    // classifica o perfil como Revisão necessária.
    homePage: resolveAccessProfileHomePage(departmentPageAccess, null) ?? {
      departmentId: '',
      pageKey: '',
    },
    hasBeenUsed: core.users_count > 0,
  }
}
