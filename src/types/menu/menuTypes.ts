export interface MenuTypes {
    id: string
    name: string
    position: number
    menuId: string
    icon: string
    profileMenuId: string
    createdAt: string
    updatedAt: string
}

export interface MenuTreeTypes {
    id: string
    name: string
    position: number
    menuId: string
    icon: string
    profileMenuId: string
    createdAt: string
    updatedAt: string
    children: MenuTypes[]
}

export interface CreateMenuTypes {
    name: string
    position: number
    menuId: string
    icon: string
    profileMenuId: string
}

export interface UpdateMenuTreeTypes {
    name: string
    position: number
    menuId: string
    icon: string
    profileMenuId: string
}