import {initials} from '../../lib/formatters'
import {pageKeyFromChildMenuId} from '../../services/profileMenus/profileMenuKeys'
import type {AccessProfileTypes} from '../../types/accessProfile/accessProfileTypes'
import type {MenuTreeTypes, MenuTypes} from '../../types/menu/menuTypes'
import type {UserStatus, UserTypes} from '../../types/user/userTypes'
import {INTELLIGENCE_PAGE_KEY, MODEL_PAGE_KEY} from '../../lib/userAccessRules'

export type DepartmentCoverage = {
    granted: number
    total: number
    percent: number
    fraction: string
    accessibleLabel: string
}

export type MenuPageView = {
    id: string
    pageKey: string
    label: string
    granted: boolean
    inDevelopment: boolean
}

export type MenuGroupView = {
    id: string
    menuId: string
    label: string
    pages: MenuPageView[]
    coverage: DepartmentCoverage
}

export type ProfileUserView = {
    id: string
    name: string
    email: string
    initials: string
    profileCode: string
    profileName: string
    status: UserStatus
}

export type ProfileView = {
    id: string
    name: string
    description: string
    userCount: number
    users: ProfileUserView[]
    groups: MenuGroupView[]
    groupCount: number
    pageCount: number
    grantedMenuIds: ReadonlySet<string>
}

export type AccessProfilesModel = {
    profiles: ProfileView[]
    unassignedUsers: ProfileUserView[]
    profileCount: number
    matchedUserCount: number
    unassignedUserCount: number
}

export function byPosition<T extends { position: number }>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => a.position - b.position)
}

export function menuLabel(item: { name: string; menuId: string }): string {
    return item.name.trim() || item.menuId
}

export function submenusOf(root: MenuTreeTypes): MenuTreeTypes[] {
    return byPosition(root.children ?? [])
}

export function describeCoverage(label: string, granted: number, total: number): DepartmentCoverage {
    const percent = total === 0 ? 0 : Math.min(100, Math.max(0, (granted / total) * 100))

    return {
        granted,
        total,
        percent,
        fraction: `${granted}/${total}`,
        accessibleLabel:
            total === 0
                ? `${label}: nenhum submenu cadastrado no departamento`
                : `${label}: ${granted} de ${total} ${
                    total === 1 ? 'submenu liberado' : 'submenus liberados'
                }`,
    }
}

export function describeMenuGroups(
    tree: readonly MenuTreeTypes[],
    grantedMenuIds: ReadonlySet<string>,
): MenuGroupView[] {
    return byPosition(tree).map((root) => {
        const label = menuLabel(root)

        const pages: MenuPageView[] = submenusOf(root).map((child) => ({
            id: child.id,
            pageKey: pageKeyFromChildMenuId(root.menuId, child.menuId),
            label: menuLabel(child),
            granted: grantedMenuIds.has(child.id),
            inDevelopment: false,
        }))

        return {
            id: root.id,
            menuId: root.menuId,
            label,
            pages,
            coverage: describeCoverage(label, pages.filter((page) => page.granted).length, pages.length),
        }
    })
}

export function menuIdsFromSelection(
    tree: readonly MenuTreeTypes[],
    selected: ReadonlySet<string>,
): string[] {
    const menuIds: string[] = []

    for (const root of byPosition(tree)) {
        const submenus = submenusOf(root)
        const grantedSubmenus = submenus.filter((child) => selected.has(child.id))

        if (submenus.length === 0) {
            if (selected.has(root.id)) menuIds.push(root.id)
            continue
        }

        if (grantedSubmenus.length === 0) continue

        menuIds.push(root.id)
        for (const child of grantedSubmenus) menuIds.push(child.id)
    }

    return menuIds
}

export const NON_DEFAULT_SELECTION_PAGE_KEYS: readonly string[] = [
    INTELLIGENCE_PAGE_KEY,
    MODEL_PAGE_KEY,
]

export function defaultSubmenusOf(root: MenuTreeTypes): MenuTypes[] {
    return submenusOf(root).filter(
        (child) =>
            !NON_DEFAULT_SELECTION_PAGE_KEYS.includes(
                pageKeyFromChildMenuId(root.menuId, child.menuId),
            ),
    )
}

export type MenuSelectionState = 'empty' | 'partial' | 'complete'

export function describeMenuSelectionState(
    root: MenuTreeTypes,
    selected: ReadonlySet<string>,
): MenuSelectionState {
    const submenus = submenusOf(root)

    if (!submenus.some((child) => selected.has(child.id))) return 'empty'

    const defaults = defaultSubmenusOf(root)

    return defaults.length > 0 && defaults.every((child) => selected.has(child.id))
        ? 'complete'
        : 'partial'
}

export function withMenuDefaults(
    selected: ReadonlySet<string>,
    root: MenuTreeTypes,
): Set<string> {
    const next = new Set(selected)

    next.add(root.id)
    for (const child of defaultSubmenusOf(root)) next.add(child.id)

    return next
}

export function withoutMenu(selected: ReadonlySet<string>, root: MenuTreeTypes): Set<string> {
    const next = new Set(selected)

    next.delete(root.id)
    for (const child of submenusOf(root)) next.delete(child.id)

    return next
}

function toProfileUser(user: UserTypes): ProfileUserView {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        initials: initials(user.name),
        profileCode: user.profileType?.code ?? '',
        profileName: user.profileType?.name ?? '',
        status: user.status,
    }
}

export function buildAccessProfilesModel(input: {
    profiles: readonly AccessProfileTypes[]
    users: readonly UserTypes[]
    menuTree: readonly MenuTreeTypes[]
}): AccessProfilesModel {
    const {profiles, users, menuTree} = input

    const profileIds = new Set(profiles.map((profile) => profile.id))

    const membersByProfileId = new Map<string, UserTypes[]>()
    const unassignedUsers: ProfileUserView[] = []

    for (const user of users) {
        const linkedId = user.accessProfileId

        if (!linkedId || !profileIds.has(linkedId)) {
            unassignedUsers.push(toProfileUser(user))
            continue
        }

        const members = membersByProfileId.get(linkedId) ?? []
        members.push(user)
        membersByProfileId.set(linkedId, members)
    }

    const described = profiles.map<ProfileView>((profile) => {
        const grantedMenuIds = new Set((profile.menus ?? []).map((menu) => menu.id))
        const groups = describeMenuGroups(menuTree, grantedMenuIds).filter(
            (group) => group.coverage.granted > 0,
        )

        return {
            id: profile.id,
            name: profile.name,
            description: profile.description?.trim() ?? '',
            userCount: profile.usersCount ?? 0,
            users: (membersByProfileId.get(profile.id) ?? []).map(toProfileUser),
            groups,
            groupCount: groups.length,
            pageCount: groups.reduce((total, group) => total + group.coverage.granted, 0),
            grantedMenuIds,
        }
    })

    return {
        profiles: described,
        unassignedUsers,
        profileCount: described.length,
        matchedUserCount: described.reduce((total, profile) => total + profile.userCount, 0),
        unassignedUserCount: unassignedUsers.length,
    }
}

export function describeAccessProfileDeletionImpact(userCount: number): string {
    if (userCount === 0) return 'Este perfil não possui usuários vinculados.'

    if (userCount === 1) {
        return 'Este perfil possui 1 usuário. Abra a tela Usuários e troque o Perfil de Acesso dessa pessoa: a transferência refaz o vínculo sem deixar ninguém sem acesso. Com o perfil vazio, a exclusão é liberada.'
    }

    return `Este perfil possui ${userCount} usuários. Abra a tela Usuários e troque o Perfil de Acesso dessas pessoas: a transferência refaz os vínculos sem deixar ninguém sem acesso. Com o perfil vazio, a exclusão é liberada.`
}
