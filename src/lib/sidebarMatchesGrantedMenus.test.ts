import { describe, expect, it } from 'vitest'

import { biAreas } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import { ADMIN_FULL_PERMISSION, ORDERS_SERVICE_ACCESS_PERMISSION } from '../config/permissions'
import type { AreaSidebarItem } from '../components/navigation/AreaSidebar'
import type { User } from '../data/dashboardTypes'
import type { CoreProfileMenuTree } from '../types/coreApi'
import { departmentPageAccessFromMenus } from '../services/profileMenus/profileMenuApi'
import { childMenuId } from '../services/profileMenus/profileMenuKeys'
import { deriveUserAccessFromGrants } from '../services/users/userApiMapper'
import {
  firstAccessibleDepartmentPageKey,
  getAccessibleBiAreas,
  getDepartmentPageAccessState,
} from './accessControl'
import { departmentEntryPath } from './homeNavigation'
import { getAccessibleDepartmentSidebarItems } from './sidebarAccess'

/**
 * A barra lateral esquerda corresponde aos MENUS que o Perfil de Acesso concedeu
 * no `impacto-bi-service`, e isso vale para os três Perfis do Sistema.
 *
 * O cenário do bloco é o que estava errado: um usuário ADMINISTRADOR cujo Perfil
 * de Acesso libera unicamente Ordens de Serviço, com todos os submenus. Antes,
 * ele enxergava os onze departamentos — `admin.full` era um bypass em
 * `hasDepartmentPageAccess` e em `hasPermission`, e o tradutor lhe dava o
 * catálogo inteiro sem olhar as concessões. Os três bypasses saíram.
 *
 * O teste percorre a CADEIA INTEIRA, e não uma função isolada, porque foi a
 * emenda entre as etapas que falhou:
 *
 *   árvore de `profile_menu` do serviço
 *     → `departmentPageAccessFromMenus` (UUID concedido → departamento + página)
 *     → `deriveUserAccessFromGrants`    (concessões → acesso do usuário)
 *     → `getAccessibleBiAreas`          (lista de departamentos da barra)
 *     → `getAccessibleDepartmentSidebarItems` (itens do departamento aberto)
 *
 * A árvore é montada com a convenção real de `menu_id` (`os`, `os.overview`), por
 * `childMenuId`, e com as páginas reais do catálogo do portal: é a mesma forma
 * que o serviço devolve em `GET /profile-menus/tree`.
 */

const osArea = biAreas.find((area) => area.id === 'os')
if (!osArea) throw new Error('O catálogo precisa ter Ordens de Serviço.')

/** Um segundo departamento, só para provar que o não concedido fica fora. */
const otherArea = biAreas.find((area) => area.id === 'comercial')
if (!otherArea) throw new Error('O catálogo precisa ter Comercial.')

/** UUIDs são inventados aqui, como no serviço: o que liga os dois lados é `menu_id`. */
function menuNode(menuId: string, position: number): Omit<CoreProfileMenuTree, 'children'> {
  return {
    id: `uuid-${menuId}`,
    name: menuId,
    position,
    menu_id: menuId,
    icon: null,
    profile_menu_id: null,
    created_at: '2026-09-23T00:00:00Z',
    updated_at: '2026-09-23T00:00:00Z',
  }
}

/** Raiz de um departamento com um filho por página do catálogo do portal. */
function departmentMenuTree(departmentId: 'os' | 'comercial'): CoreProfileMenuTree {
  return {
    ...menuNode(departmentId, 1),
    children: departmentPages[departmentId].map((page, index) => ({
      ...menuNode(childMenuId(departmentId, page.key), index + 1),
      children: [],
    })),
  }
}

const tree: CoreProfileMenuTree[] = [departmentMenuTree('os'), departmentMenuTree('comercial')]

/** Todos os menus de Ordens de Serviço: a raiz e os treze submenus. */
function allOsMenuIds(): string[] {
  const root = tree.find((node) => node.menu_id === 'os')
  if (!root) throw new Error('A árvore de teste precisa ter a raiz de Ordens de Serviço.')

  return [root.id, ...root.children.map((child) => child.id)]
}

function buildUser(profile: User['profile'], menuIds: readonly string[]): User {
  const grants = departmentPageAccessFromMenus(tree, menuIds)

  return {
    id: 'usr-001',
    name: 'Usuário de Teste',
    email: 'teste@impactotelecom.com',
    status: 'Ativo',
    lastAccess: '01/01/2026 00:00',
    initials: 'UT',
    ...deriveUserAccessFromGrants(profile, grants),
  }
}

function sidebarKeys(user: User, departmentId: 'os' | 'comercial'): string[] {
  const items: AreaSidebarItem[] = departmentPages[departmentId].map((page) => ({
    key: page.key,
    label: page.label,
  }))

  return getAccessibleDepartmentSidebarItems(user, departmentId, items).map((item) => item.key)
}

/* -------------------------------------------------------------------------- */
/* O cenário do pedido                                                        */
/* -------------------------------------------------------------------------- */

describe('Administrador com apenas Ordens de Serviço concedido', () => {
  const administrator = buildUser('Administrador', allOsMenuIds())

  it('lê da árvore do serviço exatamente um departamento, com as treze páginas', () => {
    expect(administrator.departmentPageAccess).toHaveLength(1)
    expect(administrator.departmentPageAccess[0].departmentId).toBe('os')
    expect(administrator.departmentPageAccess[0].pageKeys).toEqual(
      departmentPages.os.map((page) => page.key),
    )
  })

  it('mostra só Ordens de Serviço na lista de departamentos da barra lateral', () => {
    expect(getAccessibleBiAreas(administrator).map((area) => area.id)).toEqual(['os'])
  })

  it('mostra todos os submenus de Ordens de Serviço, inclusive o Modelo Dimensional', () => {
    expect(sidebarKeys(administrator, 'os')).toEqual(departmentPages.os.map((page) => page.key))
    expect(sidebarKeys(administrator, 'os')).toContain('model')
  })

  it('não mostra nenhum submenu do departamento que não foi concedido', () => {
    expect(sidebarKeys(administrator, 'comercial')).toEqual([])

    for (const page of departmentPages.comercial) {
      expect(getDepartmentPageAccessState(administrator, 'comercial', page.key)).toBe('hidden')
    }
  })

  /**
   * As rotas são guardadas por `RequirePermission`, que lê a permissão do
   * departamento — e não os vínculos. Ela precisa acompanhar a barra lateral,
   * senão um item visível levaria a um redirecionamento.
   */
  it('recebe a permissão do departamento concedido, e só dele', () => {
    expect(administrator.permissionKeys).toContain(ORDERS_SERVICE_ACCESS_PERMISSION)
    expect(administrator.permissionKeys).toContain(ADMIN_FULL_PERMISSION)
    expect(administrator.permissionKeys).not.toContain(otherArea.requiredPermission)
  })
})

/* -------------------------------------------------------------------------- */
/* A mesma regra nos outros dois perfis                                       */
/* -------------------------------------------------------------------------- */

describe('a concessão manda em qualquer Perfil do Sistema', () => {
  it('dá a Executivo e Analista a mesma barra lateral do Administrador', () => {
    const menuIds = allOsMenuIds()

    for (const profile of ['Administrador', 'Executivo', 'Analista'] as const) {
      const user = buildUser(profile, menuIds)

      expect(getAccessibleBiAreas(user).map((area) => area.id)).toEqual(['os'])
      expect(sidebarKeys(user, 'os')).toEqual(departmentPages.os.map((page) => page.key))
    }
  })

  it('deixa a barra lateral vazia quando o perfil de acesso não tem menu nenhum', () => {
    for (const profile of ['Administrador', 'Executivo', 'Analista'] as const) {
      const user = buildUser(profile, [])

      expect(getAccessibleBiAreas(user)).toEqual([])
      expect(sidebarKeys(user, 'os')).toEqual([])
    }
  })

})

/* -------------------------------------------------------------------------- */
/* Um submenu de dez                                                          */
/* -------------------------------------------------------------------------- */

/**
 * O menu está liberado, mas só UM dos submenus dele.
 *
 * O portal impunha a Visão Geral a todo departamento concedido, para garantir um
 * destino de entrada, e o efeito era a barra mostrar DUAS páginas para quem
 * recebeu uma. A imposição saiu, e o destino de entrada passou a ser a primeira
 * página CONCEDIDA — que é a própria, quando só há uma.
 */
describe('departamento liberado com um único submenu concedido', () => {
  /** `status` é a quarta das treze páginas de OS, e não a primeira: não é a Visão Geral. */
  function userWithOnly(pageKey: string): User {
    const root = tree[0]
    const child = root.children.find((item) => item.menu_id === childMenuId('os', pageKey))
    if (!child) throw new Error(`A árvore de teste precisa ter a página ${pageKey}.`)

    return buildUser('Administrador', [root.id, child.id])
  }

  it('mostra na barra lateral somente o submenu concedido', () => {
    expect(sidebarKeys(userWithOnly('status'), 'os')).toEqual(['status'])
  })

  it('não concede a Visão Geral por tabela nem por consequência', () => {
    const user = userWithOnly('status')

    expect(getDepartmentPageAccessState(user, 'os', 'overview')).toBe('hidden')
    expect(user.departmentPageAccess[0].pageKeys).toEqual(['status'])
  })

  it('mantém o departamento na lista de dashboards, porque ele tem destino', () => {
    expect(getAccessibleBiAreas(userWithOnly('status')).map((area) => area.id)).toEqual(['os'])
  })

  /**
   * O destino de entrada é o que o clique no departamento e os redirecionamentos
   * das rotas usam. Apontar para a Visão Geral aqui mandaria a pessoa para uma
   * página que ela não recebeu, e o portal a devolveria para fora do departamento.
   */
  it('abre o departamento no submenu concedido, e não na Visão Geral', () => {
    expect(firstAccessibleDepartmentPageKey(userWithOnly('status'), 'os')).toBe('status')
    expect(departmentEntryPath(userWithOnly('status'), 'os')).toBe('/dashboard/os/status')
  })

  it('vale para o último submenu da lista tanto quanto para o primeiro', () => {
    const user = userWithOnly('model')

    expect(sidebarKeys(user, 'os')).toEqual(['model'])
    expect(firstAccessibleDepartmentPageKey(user, 'os')).toBe('model')
  })

  it('abre na primeira página do catálogo quando são dois os submenus concedidos', () => {
    const root = tree[0]
    const chosen = ['quality', 'categories'].map((pageKey) => {
      const child = root.children.find((item) => item.menu_id === childMenuId('os', pageKey))
      if (!child) throw new Error(`A árvore de teste precisa ter a página ${pageKey}.`)
      return child.id
    })

    const user = buildUser('Administrador', [root.id, ...chosen])

    // Ordem do catálogo, e não a da concessão: `categories` vem antes de `quality`.
    expect(sidebarKeys(user, 'os')).toEqual(['categories', 'quality'])
    expect(firstAccessibleDepartmentPageKey(user, 'os')).toBe('categories')
  })

  /**
   * Menu raiz concedido sem nenhum submenu: não há o que mostrar nem onde entrar,
   * então o departamento não entra na lista. Antes, a Visão Geral imposta o fazia
   * aparecer inteiro a partir de uma concessão vazia.
   */
  it('deixa o departamento fora da lista quando só a raiz foi concedida', () => {
    const user = buildUser('Administrador', [tree[0].id])

    expect(user.departmentPageAccess).toEqual([])
    expect(getAccessibleBiAreas(user)).toEqual([])
    expect(firstAccessibleDepartmentPageKey(user, 'os')).toBeNull()
    expect(departmentEntryPath(user, 'os')).toBeNull()
  })
})
