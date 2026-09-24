/**
 * Modelo de apresentação da aba Menu Itens.
 *
 * Transforma a coleção PLANA que o serviço devolve na hierarquia que a tela
 * lista. Nada aqui chama o serviço nem decide gravação: as regras de gravação
 * moram em `profileMenuRules`, e são elas que o formulário e o repositório
 * consultam.
 *
 * NÃO importa mais `biAreas` nem `departmentPages`. As sugestões de chave saíam
 * de lá, e com elas saiu a única coisa deste módulo que conhecia o catálogo do
 * portal: a chave de um item de menu é texto livre do serviço, e o portal não
 * tem uma lista de valores aceitos a oferecer.
 */

import type { CoreProfileMenu } from '../../types/coreApi'
import { childrenOf, rootMenus } from '../../services/profileMenus/profileMenuRules'

/** Um item raiz com os submenus diretos dele. */
export type MenuItemGroup = {
  root: CoreProfileMenu
  children: CoreProfileMenu[]
}

export type MenuItemsModel = {
  groups: MenuItemGroup[]
  /**
   * Itens que a listagem por grupo não alcança: netos, que o portal não
   * reconhece, e filhos cujo pai sumiu da coleção.
   *
   * Eles são exibidos à parte, e não escondidos. O serviço aceita cadastrar um
   * neto por outra via (a API direta, um seed antigo), e um item que existe no
   * banco, não aparece em lugar nenhum da tela e não concede acesso nenhum é
   * exatamente o tipo de coisa que ninguém descobre até alguém reclamar.
   */
  unreachable: CoreProfileMenu[]
}

export function buildMenuItemsModel(menus: readonly CoreProfileMenu[]): MenuItemsModel {
  const roots = rootMenus(menus)
  const groups = roots.map((root) => ({ root, children: childrenOf(menus, root.id) }))

  const alcancados = new Set(
    groups.flatMap((group) => [group.root.id, ...group.children.map((child) => child.id)]),
  )

  return {
    groups,
    unreachable: menus.filter((menu) => !alcancados.has(menu.id)),
  }
}

/** Nome do pai de um item, para a listagem e para a confirmação de exclusão. */
export function parentNameOf(
  menus: readonly CoreProfileMenu[],
  menu: CoreProfileMenu,
): string | null {
  if (menu.profile_menu_id === null) return null

  return menus.find((item) => item.id === menu.profile_menu_id)?.name ?? null
}
