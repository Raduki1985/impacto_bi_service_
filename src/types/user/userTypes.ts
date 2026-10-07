import {UserProfileTypesResponse} from "../profileTypes/profileTypesType";
import {accessProfileResponse} from "../accessProfile/accessProfileTypes";

/*export type UserStatus = 'pending' | 'inactive' | 'active' | 'blocked'*/
export type UserStatus = 'pending' | 'inactive' | 'active'

export interface UserTypes {
    id: string
    name: string
    email: string
    status: UserStatus
    isActive: boolean
    lastAccess: string | null
    profileSystemId: string
    accessProfileId: string
    profileType: UserProfileTypesResponse
    access: accessProfileResponse
    setPasswordExpire: string | null
    createdAt: string
    updatedAt: string
}

export interface DepartmentPageAccessTypes {
    departmentId: string
    pageKeys: string[]
}

export type AuthUser = UserTypes & {
    departmentPageAccess: DepartmentPageAccessTypes[]
}

export interface CreateUserTypes {
    name: string
    email: string
    profileSystemId: string
    accessProfileId: string
    status: UserStatus
    password: string
}

export interface UpdateUserTypes {
    name?: string
    email?: string
    profileSystemId?: string
    accessProfileId?: string
    status?: UserStatus
    password?: string
}

export interface PendingStatusChange {
    user: UserTypes
    action: 'deactivate' | 'reactivate'
}

export interface UserPasswordTypes {
    currentPassword: string
    newPassword: string
}

export interface UserMessage {
    message: string
}