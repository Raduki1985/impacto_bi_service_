import type {MenuTreeTypes, MenuTypes} from '../../types/menu/menuTypes'

export type MenuItemDraft = {
    name: string
    menuKey: string
    position: string
    icon: string
    parentId: string | null
}

export type MenuItemInput = {
    name: string
    menuKey: string
    position: number
    icon: string
    parentId: string | null
}

export type MenuItemGroup = {
    root: MenuTypes
    children: MenuTypes[]
}

export type MenuItemsModel = {
    groups: MenuItemGroup[]
    unreachable: MenuTypes[]
}

export function flattenMenuTree(tree: readonly MenuTreeTypes[]): MenuTypes[] {
    return tree.flatMap(({children, ...menu}) => [menu, ...flattenMenuTree(children ?? [])])
}

export function parentIdOf(menu: MenuTypes): string | null {
    return menu.profileMenuId ?? null
}

export function byPosition(menus: readonly MenuTypes[]): MenuTypes[] {
    return [...menus].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
}

export function rootMenus(menus: readonly MenuTypes[]): MenuTypes[] {
    return byPosition(menus.filter((menu) => parentIdOf(menu) === null))
}

export function childrenOf(menus: readonly MenuTypes[], parentId: string): MenuTypes[] {
    return byPosition(menus.filter((menu) => parentIdOf(menu) === parentId))
}

export function hasChildren(menus: readonly MenuTypes[], id: string): boolean {
    return menus.some((menu) => parentIdOf(menu) === id)
}

export function parentOptionsFor(menus: readonly MenuTypes[], editingId: string | null): MenuTypes[] {
    if (editingId !== null && hasChildren(menus, editingId)) return []

    return rootMenus(menus).filter((menu) => menu.id !== editingId)
}

export function nextPositionFor(menus: readonly MenuTypes[], parentId: string | null): number {
    const siblings = parentId === null ? rootMenus(menus) : childrenOf(menus, parentId)

    return siblings.reduce((largest, menu) => Math.max(largest, menu.position), 0) + 1
}

export function childCountOf(menus: readonly MenuTypes[], id: string): number {
    return childrenOf(menus, id).length
}

export function buildMenuItemsModel(menus: readonly MenuTypes[]): MenuItemsModel {
    const groups = rootMenus(menus).map((root) => ({root, children: childrenOf(menus, root.id)}))

    const reached = new Set(
        groups.flatMap((group) => [group.root.id, ...group.children.map((child) => child.id)]),
    )

    return {
        groups,
        unreachable: menus.filter((menu) => !reached.has(menu.id)),
    }
}

export function parentNameOf(menus: readonly MenuTypes[], menu: MenuTypes): string | null {
    const parentId = parentIdOf(menu)

    if (parentId === null) return null

    return menus.find((item) => item.id === parentId)?.name ?? null
}

export type MenuItemDraftFailureReason =
    | 'invalid-name'
    | 'invalid-menu-key'
    | 'menu-key-taken'
    | 'invalid-position'
    | 'unknown-parent'
    | 'parent-not-root'
    | 'parent-is-self'
    | 'parent-of-parent'

export type MenuItemDraftCheck =
    | { ok: true; input: MenuItemInput }
    | { ok: false; reason: MenuItemDraftFailureReason }

export const draftFailureMessages: Record<MenuItemDraftFailureReason, string> = {
    'invalid-name': 'Informe o nome do item de menu.',
    'invalid-menu-key': 'Informe a chave do menu.',
    'menu-key-taken':
        'Esta chave já está cadastrada em outro item de menu. A chave é única em todo o serviço.',
    'invalid-position': 'Informe a posição como um número inteiro maior ou igual a zero.',
    'unknown-parent': 'O menu pai escolhido não existe mais. Atualize a página e escolha outro.',
    'parent-not-root':
        'O menu pai precisa ser um item pai. O portal reconhece apenas dois níveis de menu.',
    'parent-is-self': 'Um item de menu não pode ser pai de si mesmo.',
    'parent-of-parent':
        'Este item já tem submenus e por isso só pode existir como item pai. Mova os submenus dele antes de rebaixá-lo.',
}

export function checkMenuItemDraft(
    draft: MenuItemDraft,
    menus: readonly MenuTypes[],
    editingId: string | null,
): MenuItemDraftCheck {
    const name = draft.name.trim()
    if (name === '') return {ok: false, reason: 'invalid-name'}

    const menuKey = draft.menuKey.trim()
    if (menuKey === '') return {ok: false, reason: 'invalid-menu-key'}

    if (menus.some((menu) => menu.id !== editingId && menu.menuId === menuKey)) {
        return {ok: false, reason: 'menu-key-taken'}
    }

    const position = Number(draft.position.trim())
    if (draft.position.trim() === '' || !Number.isInteger(position) || position < 0) {
        return {ok: false, reason: 'invalid-position'}
    }

    if (draft.parentId !== null) {
        if (draft.parentId === editingId) return {ok: false, reason: 'parent-is-self'}

        const parent = menus.find((menu) => menu.id === draft.parentId)
        if (parent === undefined) return {ok: false, reason: 'unknown-parent'}
        if (parentIdOf(parent) !== null) return {ok: false, reason: 'parent-not-root'}

        if (editingId !== null && hasChildren(menus, editingId)) {
            return {ok: false, reason: 'parent-of-parent'}
        }
    }

    return {
        ok: true,
        input: {name, menuKey, position, icon: draft.icon.trim(), parentId: draft.parentId},
    }
}
