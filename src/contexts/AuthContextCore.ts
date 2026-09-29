import {createContext} from 'react'

import type {AuthUser} from '../types/user/userTypes'
import type {LoginFailureReason, LoginResult} from '../types/auth/authTypes'

export type {LoginFailureReason, LoginResult}

export type AuthContextValue = {
    user: AuthUser | null
    login: (email: string, password: string) => Promise<LoginResult>
    logout: () => void
    hasPermission: (permissionKey: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
