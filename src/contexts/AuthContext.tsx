import {type ReactNode, useCallback, useEffect, useMemo, useState} from 'react'

import {ADMIN_FULL_PERMISSION, isAdministrativePermission} from '../config/permissions'
import {authService} from '../services/auth/authService'
import type {AuthUser} from '../types/user/userTypes'
import {AuthContext, type AuthContextValue, type LoginResult} from './AuthContextCore'

type AuthProviderProps = {
    children: ReactNode
}

export function AuthProvider({children}: AuthProviderProps) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [restoring, setRestoring] = useState<boolean>(() => authService.hasStoredSession())

    useEffect(() => {
        if (!restoring) return

        let cancelled = false

        void authService.restoreSession().then((restored) => {
            if (cancelled) return

            setUser(restored)
            setRestoring(false)
        })

        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
        const result = await authService.login({email, password})

        if (!result.ok) {
            setUser(null)

            return {ok: false, reason: result.reason}
        }

        setUser(result.user)

        return {ok: true}
    }, [])

    const logout = useCallback(() => {
        void authService.logout()
        setUser(null)
    }, [])

    const hasPermission = useCallback(
        (permissionKey: string) => {
            if (!user) return false

            if (
                isAdministrativePermission(permissionKey) &&
                user.permissionKeys.includes(ADMIN_FULL_PERMISSION)
            ) {
                return true
            }

            return user.permissionKeys.includes(permissionKey)
        },
        [user],
    )

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            login,
            logout,
            hasPermission,
        }),
        [user, login, logout, hasPermission],
    )

    if (restoring) return null

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
