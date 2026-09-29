import type {AuthUser} from "../user/userTypes";

export interface LoginCredentials {
    email: string
    password: string
}

export interface AuthResponse {
    access_token: string | null
    token_type: string
}

export interface MessageResponse {
    message: string
}

export interface ResetPasswordData {
    email: string
}

export interface SetPasswordData {
    token: string
    newPassword: string
}

export interface ConfirmResetPasswordData {
    token: string
    newPassword: string
}

export interface ChangePasswordData {
    currentPassword: string
    newPassword: string
}

export type LoginFailureReason =
    | "invalid-credentials"
    | "inactive-account"
    | "access-profile-required"
    | "service-unavailable"

export type LoginResult = { ok: true } | { ok: false; reason: LoginFailureReason }

export type AuthResult =
    | { ok: true; user: AuthUser }
    | { ok: false; reason: LoginFailureReason }

export type PasswordFlowFailureReason =
    | "invalid-token"
    | "weak-password"
    | "account-not-active"
    | "service-unavailable"

export interface PasswordFlowFailure {
    reason: PasswordFlowFailureReason
    message: string | null
}

export type PasswordFlowResult =
    | { ok: true }
    | { ok: false; reason: PasswordFlowFailureReason; message: string | null }
