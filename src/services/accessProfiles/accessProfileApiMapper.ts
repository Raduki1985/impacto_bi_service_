import {
  normalizeAccessProfileGrants,
  resolveAccessProfileHomePage,
} from '../../lib/accessProfileRules'
import type { AccessProfile, DepartmentPageAccess } from '../../types/access'
import type { CoreAccess, CoreAccessCreate, CoreProfileMenuTree } from '../../types/coreApi'
import { departmentPageAccessFromMenus } from '../profileMenus/profileMenuApi'

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
 * Módulo puro: não lê nem grava armazenamento e não chama o serviço. Quando a
 * tradução depende da árvore de menus, ela chega PRONTA por parâmetro — quem a
 * busca é o `accessProfileService`.
 *
 * As duas direções moram aqui. A volta (`accessProfileFromCoreAccess...`) é o
 * que a tela consome; a ida (`coreAccessPayloadFromInput`) é o corpo que o
 * serviço aceita. Antes só a volta existia, e a ida ficava espalhada nas
 * chamadas: cada rota remontava `name`/`description`/`menu_ids` por conta
 * própria, e o `accessProfileService` acabava devolvendo `CoreAccess` cru.
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

/**
 * `AccessProfile` a partir da linha de `access` e da árvore de menus do serviço.
 *
 * É a forma que o SERVIÇO usa: o que volta de `GET/POST/PUT /access` traz os
 * menus como registros, e não como concessões do portal. A tradução dos menus
 * para `departmentId + pageKey` acontece aqui, e não em quem chama, para o
 * `accessProfileService` devolver `AccessProfile` em todas as rotas sem repetir
 * a composição em cada uma delas.
 *
 * Continua puro: a árvore chega pronta por parâmetro.
 */
export function accessProfileFromCoreAccessWithTree(
  core: CoreAccess,
  tree: readonly CoreProfileMenuTree[],
): AccessProfile {
  return accessProfileFromCoreAccess(
    core,
    departmentPageAccessFromMenus(
      tree,
      core.menus.map((menu) => menu.id),
    ),
  )
}

/**
 * A coleção inteira, na ordem em que o serviço a devolveu.
 *
 * Nenhuma linha é descartada. O descarte existia por causa do TIPO do perfil:
 * um perfil de tipo que o portal não reconhecia não podia ser recebido por
 * ninguém. O tipo saiu do serviço, e o que sobra em cada linha — nome e menus —
 * o portal sempre entende.
 */
export function accessProfilesFromCoreAccesses(
  accesses: readonly CoreAccess[],
  tree: readonly CoreProfileMenuTree[],
): AccessProfile[] {
  return accesses.map((access) => accessProfileFromCoreAccessWithTree(access, tree))
}

/** Descrição como o serviço a espera: null quando vazia. */
function descriptionPayload(description: string | undefined): string | null {
  const trimmed = description?.trim() ?? ''

  return trimmed === '' ? null : trimmed
}

/**
 * Caminho de ida: o conteúdo editável do formulário como o corpo que o serviço
 * aceita em `POST /access` e `PUT /access/{id}`.
 *
 * Os `menu_ids` já chegam resolvidos: traduzir página em UUID exige a árvore do
 * serviço, e essa leitura é do `accessProfileService`, não deste módulo.
 */
export function coreAccessPayloadFromInput(
  input: { name: string; description?: string },
  menuIds: string[],
): CoreAccessCreate {
  return {
    name: input.name.trim(),
    description: descriptionPayload(input.description),
    menu_ids: menuIds,
  }
}
