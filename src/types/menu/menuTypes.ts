export interface MenuTypes {
    id: string
    name: string
    position: number
    menuId: string
    icon: string | null
    profileMenuId: string | null
    createdAt: string
    updatedAt: string
}

export interface MenuTreeTypes extends MenuTypes {
    children: MenuTreeTypes[]
}

export interface CreateMenuTypes {
    name: string
    position: number
    menuId: string
    icon?: string | null
    profileMenuId?: string | null
}

export interface UpdateMenuTreeTypes {
    name?: string
    position?: number
    menuId?: string
    icon?: string | null
    profileMenuId?: string | null
}
