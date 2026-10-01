import {MenuTreeTypes, MenuTypes} from "../menu/menuTypes";

export interface accessProfileResponse {
    id: string
    name: string
}

export interface AccessProfileTypes {
    id: string
    name: string
    description: string
    menus: MenuTypes[]
    usersCount: number
    createdAt: string
    updatedAt: string
}

export interface CreateAccessProfileTypes {
    name: string
    description: string
    menusIds: MenuTreeTypes[]
}

export interface UpdateAccessProfileTypes {
    name: string
    description: string
    menusIds: MenuTreeTypes[]
}

/*------------------------------------------------------------------------*/

export interface UserAccessProfileTypes {
    accessId: string
    profileMenuId: string
    createdAt: string
    updatedAt: string
}

export interface CreateUserAccessProfileTypes {
    accessId: string
    profileMenuId: string
}