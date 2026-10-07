/**
 * Menus do `impacto-bi-service` (`profile_menu`), que são as unidades de acesso
 * que um Perfil de Acesso concede no serviço.
 *
 * O portal e o serviço descrevem o mesmo acesso de duas formas diferentes:
 *
 * - no portal, o acesso é o par `departmentId + pageKey`, validado contra os
 *   catálogos locais (`biAreas` e `departmentPages`);
 * - no serviço, o acesso é uma lista de UUIDs de `profile_menu`, organizados em
 *   uma árvore de duas alturas.
 *
 * Este módulo é a tradução entre as duas, e é o ÚNICO lugar do portal que
 * conhece as duas ao mesmo tempo.
 *
 * ## Convenção de correspondência
 *
 * A ligação entre os dois lados é a coluna textual `menu_id`, e nunca o UUID: o
 * UUID é gerado por banco e muda de ambiente para ambiente, então escrevê-lo no
 * código do portal quebraria em produção.
 *
 * A convenção mora em `profileMenuKeys`, e não aqui: a raiz é o id do
 * departamento, e o filho é `departamento.pagina`. Este módulo apenas a aplica.
 */

import {fetchAllCorePages} from '../../data/api/coreApiClient'
import {pageKeyFromChildMenuId} from './profileMenuKeys'
import type {CoreProfileMenu, CoreProfileMenuTree,} from '../../types/coreApi'
import type {DepartmentPageAccess} from '../../types/access'

/**
 * Árvore completa de menus publicada pelo serviço.
 *
 * Usa `GET /profile-menus/tree`, e não `GET /profile-menus`, porque a árvore vem
 * inteira em uma chamada só: a rota paginada exigiria percorrer páginas de até
 * 100 itens e remontar a hierarquia no portal.
 *
 * Exige token: a rota está protegida por `get_current_user` no serviço.
export export async function fetchProfileMenuTree(): Promise<CoreProfileMenuTree[]> {
    return requestCoreApi<CoreProfileMenuTree[]>('/profile-menus/tree')
}*/

/* -------------------------------------------------------------------------- */
/* Cadastro dos menus                                                         */

/* -------------------------------------------------------------------------- */

/**
 * Coleção PLANA de todos os menus, pais e filhos juntos, na ordem do serviço
 * (`position`, depois `name`).
 *
 * A aba Menu Itens usa esta rota, e não a árvore, porque ela precisa dos itens
 * como REGISTROS para listar, editar e excluir: a árvore aninha os filhos
 * dentro dos pais e é a forma certa para conceder acesso, não para cadastrar.
 * A hierarquia é remontada no portal, a partir de `profile_menu_id`.
 *
 * Exige token, como toda rota de leitura de menus.
 */
export function fetchProfileMenus(): Promise<CoreProfileMenu[]> {
    return fetchAllCorePages<CoreProfileMenu>('/profile-menus')
}

/**
 * Cria o menu no serviço. Exige Administrador: a rota está protegida por
 * `require_admin`.
 *
 * Recusas esperadas, já com frase própria vinda do serviço: 409 quando a chave
 * `menu_id` já existe, e 404 quando o pai informado não existe mais.
 *//*
export function createProfileMenuOnApi(payload: CoreProfileMenuCreate): Promise<CoreProfileMenu> {
    return requestCoreApi<CoreProfileMenu>('/profile-menus', {method: 'POST', body: payload})
}*/

/**
 * Edita o menu no serviço.
 *
 * O corpo é montado por quem chama, e é ele que decide o que muda: `profile_menu_id`
 * presente e nulo promove o item a raiz, e ausente preserva o pai atual.
 *
 * Além do 409 da chave duplicada, o serviço recusa com 422 quando o pai
 * escolhido é o próprio item ou um descendente dele — o ciclo que deixaria a
 * árvore sem raiz.
 */
/*export function updateProfileMenuOnApi(
    id: string,
    payload: CoreProfileMenuUpdate,
): Promise<CoreProfileMenu> {
    return requestCoreApi<CoreProfileMenu>(`/profile-menus/${id}`, {method: 'PUT', body: payload})
}*/

/**
 * Exclui o menu no serviço.
 *
 * A exclusão LEVA JUNTO os submenus (cascata na chave estrangeira) e apaga os
 * vínculos daquele ramo com os Perfis de Acesso. Não existe recusa por menu em
 * uso: quem confirma precisa saber o tamanho do estrago antes, e é a tela que
 * mostra isso.
 *//*
export function deleteProfileMenuOnApi(id: string): Promise<void> {
    return requestCoreApi<void>(`/profile-menus/${id}`, {method: 'DELETE'})
}*/

/**
 * Resultado da conversão das concessões do portal em UUIDs do serviço.
 *
 * `unmatched` não é detalhe de diagnóstico: uma página concedida no portal que
 * não existe como menu no serviço é acesso que a pessoa veria no formulário e
 * não receberia de verdade. Quem chama decide se isso bloqueia a gravação, mas
 * não pode não saber.
 */
export type MenuIdResolution = {
    /** UUIDs a enviar em `menu_ids`, sem repetição. */
    menuIds: string[]
    /** Pares `departmentId::pageKey` sem menu correspondente no serviço. */
    unmatched: string[]
}

/**
 * Converte as concessões do portal nos UUIDs de `profile_menu` do serviço.
 *
 * O menu RAIZ do departamento entra junto sempre que ao menos uma página dele
 * foi concedida. Sem ele, o serviço guardaria páginas soltas, sem o nó que as
 * agrupa, e a navegação montada a partir de `access_profile_menu` não teria onde
 * pendurá-las.
 *
 * Departamento que o serviço não publicou não vira erro por si: o que conta como
 * não correspondido é a PÁGINA, porque é ela que representa o acesso pedido.
 */
export function resolveMenuIds(
    tree: readonly CoreProfileMenuTree[],
    departmentPageAccess: readonly DepartmentPageAccess[],
): MenuIdResolution {
    const roots = new Map(tree.map((root) => [root.menu_id, root]))

    const menuIds = new Set<string>()
    const unmatched: string[] = []

    for (const grant of departmentPageAccess) {
        const root = roots.get(grant.departmentId)
        const pages = new Map(
            (root?.children ?? []).map((child) => [
                pageKeyFromChildMenuId(grant.departmentId, child.menu_id),
                child,
            ]),
        )

        let concedeuAlguma = false

        for (const pageKey of grant.pageKeys) {
            const page = pages.get(pageKey)

            if (page === undefined) {
                unmatched.push(`${grant.departmentId}::${pageKey}`)
                continue
            }

            menuIds.add(page.id)
            concedeuAlguma = true
        }

        if (concedeuAlguma && root !== undefined) menuIds.add(root.id)
    }

    return {menuIds: [...menuIds], unmatched}
}

/**
 * Caminho inverso: os menus que o serviço devolveu em um perfil, de volta para o
 * par `departmentId + pageKey` do portal.
 *
 * Só as FOLHAS viram página. O menu raiz do departamento é a moldura do grupo, e
 * traduzi-lo produziria uma página inexistente com a chave do departamento.
 *
 * A ordem acompanha a árvore, que é a ordem de `position` do serviço.
 */
export function departmentPageAccessFromMenus(
    tree: readonly CoreProfileMenuTree[],
    menuIds: readonly string[],
): DepartmentPageAccess[] {
    const concedidos = new Set(menuIds)

    return tree.flatMap((root) => {
        const pageKeys = root.children
            .filter((child) => concedidos.has(child.id))
            .map((child) => pageKeyFromChildMenuId(root.menu_id, child.menu_id))

        return pageKeys.length ? [{departmentId: root.menu_id, pageKeys}] : []
    })
}
