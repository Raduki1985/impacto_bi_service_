import {CoreUser} from "../types/coreApi";

export type FirstAccessInviteState =
    | 'not-applicable'
    | 'pending'
    | 'expired'

export function firstAccessInviteState(user: CoreUser, now: Date): FirstAccessInviteState {
    if (user.status !== 'pending') return 'not-applicable'

    const expiresAt = user.set_password_expire
    if (expiresAt === null || expiresAt === undefined || expiresAt.trim() === '') return 'expired'

    const deadline = new Date(expiresAt)
    if (Number.isNaN(deadline.getTime())) return 'expired'

    return deadline.getTime() > now.getTime() ? 'pending' : 'expired'
}


export function hasDefinedPassword(user: CoreUser): boolean {
    return user.status! !== 'pending'
}

export function formatInviteDeadline(expiresAt: string | null | undefined): string | null {
    if (expiresAt === null || expiresAt === undefined || expiresAt.trim() === '') return null

    const deadline = new Date(expiresAt)
    if (Number.isNaN(deadline.getTime())) return null

    return `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`
}
