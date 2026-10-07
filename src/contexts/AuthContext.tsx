import {type ReactNode, useCallback, useEffect, useMemo, useState} from 'react'

import {biAreas} from '../config/biAreas'
import {ADMIN_FULL_PERMISSION, isAdministrativePermission} from '../config/permissions'
import {authService} from '../services/auth/authService'
import {AuthContext, type AuthContextValue, type LoginResult} from './AuthContextCore'
import {AuthUser} from "../types/user/userTypes";

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
                permissionKey === ADMIN_FULL_PERMISSION ||
                isAdministrativePermission(permissionKey)
            ) {
                return user.profileType?.code === ADMIN_FULL_PERMISSION
            }

            const area = biAreas.find((item) => item.requiredPermission === permissionKey)
            if (!area) return false

            return user.departmentPageAccess.some(
                (access) => access.departmentId === area.id && access.pageKeys.length > 0,
            )
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
