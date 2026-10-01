import {ADMIN_FULL_PERMISSION, ADMIN_USERS_READ_PERMISSION} from '../../config/permissions'
import {type DerivedUserAccess, deriveUserAccess} from '../../lib/userAccessRules'
import type {DepartmentPageAccess, UserProfile} from '../../types/access'
import type {CoreProfileType, CoreProfileTypeCode} from '../../types/coreApi'
import {UserStatus, UserTypes} from "../../types/user/userTypes";

export const PROFILE_TYPE_CODE_BY_USER_PROFILE: Record<UserProfile, CoreProfileTypeCode> = {
    Administrador: 'adm',
    Executivo: 'executive',
    Analista: 'analyst',
}

const USER_PROFILE_BY_CODE: Record<CoreProfileTypeCode, UserProfile> = {
    adm: 'Administrador',
    executive: 'Executivo',
    analyst: 'Analista',
}

export function userProfileFromCode(code: string | null | undefined): UserProfile | null {
    if (typeof code !== 'string') return null

    const normalized = code.trim().toLowerCase()

    return normalized in USER_PROFILE_BY_CODE
        ? USER_PROFILE_BY_CODE[normalized as CoreProfileTypeCode]
        : null
}

export type SystemProfileOption = {
    id: string
    code: CoreProfileTypeCode
    name: string
    profile: UserProfile
}

export function systemProfileOptionFromCore(type: CoreProfileType): SystemProfileOption | null {
    const profile = userProfileFromCode(type.code)
    if (profile === null) return null

    return {
        id: type.id,
        code: type.code.trim().toLowerCase() as CoreProfileTypeCode,
        name: type.name.trim(),
        profile,
    }
}

export function userStatusFromCore(status: UserStatus): string {
    if (status === 'active') return 'Ativo'
    if (status === 'pending') return 'Pendente'

    return 'Inativo'
}

export const NEVER_ACCESSED_LABEL = 'Nunca acessou'

function twoDigits(value: number): string {
    return String(value).padStart(2, '0')
}

export function formatLastAccess(lastAccess: string | null): string {
    if (lastAccess === null || lastAccess.trim() === '') return NEVER_ACCESSED_LABEL

    const date = new Date(lastAccess)
    if (Number.isNaN(date.getTime())) return NEVER_ACCESSED_LABEL

    return (
        `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()} ` +
        `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
    )
}

function emptyAccess(profile: UserProfile, permissionKeys: string[] = []): DerivedUserAccess {
    return {profile, permissions: '', permissionKeys, departments: [], departmentPageAccess: []}
}

export function deriveUserAccessFromGrants(
    userProfile: UserProfile,
    grants: readonly DepartmentPageAccess[],
): DerivedUserAccess {

    const granted = deriveUserAccess({
        profile: 'Analista',
        departments: grants.map((access) => ({
            departmentId: access.departmentId,
            pageKeys: access.pageKeys,
        })),
    })

    const adminPermissionKeys: Record<UserProfile, string[]> = {
        Administrador: [ADMIN_FULL_PERMISSION],
        Executivo: [ADMIN_USERS_READ_PERMISSION],
        Analista: [],
    }

    const adminKeys = adminPermissionKeys[userProfile]

    if (!granted) return emptyAccess(userProfile, adminKeys)

    return {
        profile: userProfile,
        permissions: granted.permissions,
        permissionKeys: [...new Set([...granted.permissionKeys, ...adminKeys])],
        departments: granted.departments,
        departmentPageAccess: granted.departmentPageAccess,
    }
}

/*export class UserTypesMappingError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'UserTypesMappingError'
    }
}

export type UserTypesMappingContext = {
    grants: readonly DepartmentPageAccess[]
}

function auditFrom(core: UserTypes): Partial<UserAuditMetadata> | undefined {
    const audit: Partial<UserAuditMetadata> = {}

    if (core.createdAt) audit.createdAt = core.createdAt
    if (core.updatedAt) audit.updatedAt = core.updatedAt

    return Object.keys(audit).length ? audit : undefined
}*/

/*export function mapUserTypes(core: UserTypes, context: UserTypesMappingContext): User {
    const profile = userProfileFromCode(core.profileType?.code)

    if (profile === null) {
        throw new UserTypesMappingError(
            `O serviço devolveu o usuário ${core.email} com um tipo de perfil que o portal não ` +
            `reconhece (${core.profileType?.code ?? 'sem tipo'}).`,
        )
    }

    const name = core.name.trim()

    return {
        id: core.id,
        name,
        email: core.email.trim().toLowerCase(),
        ...deriveUserAccessFromGrants(profile, context.grants),
        accessProfileId: core.accessProfileId,
        status: userStatusFromCore(core.status),
        audit: auditFrom(core),
        lastAccess: formatLastAccess(core.lastAccess),
        firstAccessExpiresAt: core.setPasswordExpire,
        initials: initials(name),
    }
}*/

export function compareByCreation(first: UserTypes, second: UserTypes): number {
    const a = first.createdAt ?? ''
    const b = second.createdAt ?? ''

    if (a === b) return 0
    if (a === '') return 1
    if (b === '') return -1

    return a < b ? -1 : 1
}
