import {Config} from "../../config";
import {ApiError, apiService} from "../apiService";
import {
    AuthResponse,
    AuthResult,
    ChangePasswordData,
    ConfirmResetPasswordData,
    LoginCredentials,
    LoginFailureReason,
    MessageResponse,
    PasswordFlowFailure,
    PasswordFlowResult,
    ResetPasswordData,
    SetPasswordData,
} from "../../types/auth/authTypes";
import {AuthUser, UserTypes} from "../../types/user/userTypes";
import {CoreAccess, CoreProfileMenuTree} from "../../types/coreApi";
import {DepartmentPageAccess} from "../../types/access";
import {mapCoreUser} from "../users/userApiMapper";
import {pageKeyFromChildMenuId} from "../profileMenus/profileMenuKeys";

const TOKEN_STORAGE_KEY = "auth_token"
const USER_STORAGE_KEY = "auth_user"
const LEGACY_SESSION_STORAGE_KEYS = ["impacto-bi.auth-session", "impacto-bi.core-api-token"]

class AuthService {
    private memoryToken: string | null = null
    private memoryUser: AuthUser | null = null

    async login(credentials: LoginCredentials): Promise<AuthResult> {
        this.clearSession()

        const form = new URLSearchParams()
        form.set("grant_type", "password")
        form.set("username", credentials.email.trim())
        form.set("password", credentials.password)
        form.set("scope", "")
        form.set("client_id", "")
        form.set("client_secret", "")

        try {
            const data = await apiService.post<AuthResponse>(
                "v1/auth/login",
                form,
                {auth: false}
            )

            if (!data?.access_token) {
                throw new ApiError(0, "O serviço não devolveu o token de acesso.")
            }

            this.setToken(data.access_token)

            return {ok: true, user: await this.getCurrentUser()}
        } catch (cause) {
            if (this.getToken()) await this.revokeSession()
            this.clearSession()

            return {ok: false, reason: this.loginFailureReasonFor(cause)}
        }
    }

    async logout(): Promise<void> {
        if (this.getToken()) await this.revokeSession()
        this.clearSession()
    }

    clearSession(): void {
        this.memoryToken = null
        this.memoryUser = null

        for (const storage of this.storages()) {
            for (const key of [TOKEN_STORAGE_KEY, USER_STORAGE_KEY, ...LEGACY_SESSION_STORAGE_KEYS]) {
                try {
                    storage.removeItem(key)
                } catch {
                    continue
                }
            }
        }
    }

    setToken(token: string): void {
        const trimmed = token.trim()
        this.memoryToken = trimmed === "" ? null : trimmed

        const storage = this.storage()
        if (!storage) return

        try {
            if (this.memoryToken === null) storage.removeItem(TOKEN_STORAGE_KEY)
            else storage.setItem(TOKEN_STORAGE_KEY, this.memoryToken)
        } catch {
            return
        }
    }

    getToken(): string | null {
        const storage = this.storage()
        if (!storage) return this.memoryToken

        try {
            const stored = storage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
            return stored === "" ? this.memoryToken : stored
        } catch {
            return this.memoryToken
        }
    }

    hasStoredSession(): boolean {
        return this.getToken() !== null
    }

    getAuthUser(): AuthUser | null {
        const storage = this.storage()
        if (!storage) return this.memoryUser

        try {
            const stored = storage.getItem(USER_STORAGE_KEY)
            return stored ? (JSON.parse(stored) as AuthUser) : this.memoryUser
        } catch {
            return this.memoryUser
        }
    }

    private setAuthUser(user: AuthUser): void {
        this.memoryUser = user

        const storage = this.storage()
        if (!storage) return

        try {
            storage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
        } catch {
            return
        }
    }

    private storage(): Storage | null {
        if (typeof window === "undefined") return null

        try {
            return window.localStorage
        } catch {
            return null
        }
    }

    private storages(): Storage[] {
        if (typeof window === "undefined") return []

        const found: Storage[] = []
        for (const read of [() => window.localStorage, () => window.sessionStorage]) {
            try {
                found.push(read())
            } catch {
                continue
            }
        }

        return found
    }

    async getCurrentUser(): Promise<AuthUser> {
        const core = await apiService.get<UserTypes>(
            "v1/users/me",
            {baseURL: Config.API_BASE_URL}
        )

        const user = mapCoreUser(core, {grants: await this.grantsFor(core)})
        this.setAuthUser(user)

        return user
    }

    async restoreSession(): Promise<AuthUser | null> {
        if (!this.hasStoredSession()) return null

        try {
            return await this.getCurrentUser()
        } catch (cause) {
            if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
                this.clearSession()
            }
            return null
        }
    }

    async forgotPassword(data: ResetPasswordData): Promise<PasswordFlowResult> {
        try {
            await apiService.post<MessageResponse>(
                "v1/auth/recover",
                {email: data.email.trim()},
                {baseURL: Config.API_BASE_URL, auth: false}
            )
            return {ok: true}
        } catch (cause) {
            return {ok: false, ...this.passwordFlowFailureFor(cause)}
        }
    }

    async setFirstAccessPassword(data: SetPasswordData): Promise<void> {
        try {
            await apiService.post<MessageResponse>(
                "v1/auth/set-password",
                {token: data.token, password: data.newPassword},
                {baseURL: Config.API_BASE_URL, auth: false}
            )

        } catch (cause) {
            console.error(cause)
        }
    }

    async confirmPasswordReset(data: ConfirmResetPasswordData): Promise<PasswordFlowResult> {
        try {
            await apiService.post<MessageResponse>(
                "v1/auth/recover/reset",
                {token: data.token, password: data.newPassword},
                {baseURL: Config.API_BASE_URL, auth: false}
            )
            return {ok: true}
        } catch (cause) {
            return {ok: false, ...this.passwordFlowFailureFor(cause)}
        }
    }

    async changePassword(data: ChangePasswordData): Promise<PasswordFlowResult> {
        try {
            await apiService.post<MessageResponse>(
                "/users/me/password",
                {current_password: data.currentPassword, new_password: data.newPassword},
                {baseURL: Config.API_BASE_URL}
            )
            return {ok: true}
        } catch (cause) {
            return {ok: false, ...this.passwordFlowFailureFor(cause)}
        }
    }

    loginFailureReasonFor(cause: unknown): LoginFailureReason {
        if (!(cause instanceof ApiError)) return "service-unavailable"

        if (cause.status === 401 || cause.status === 422) return "invalid-credentials"

        if (cause.status === 403) {
            return /perfil de acesso/i.test(cause.message) ? "access-profile-required" : "inactive-account"
        }

        return "service-unavailable"
    }

    passwordFlowFailureFor(cause: unknown): PasswordFlowFailure {
        if (!(cause instanceof ApiError)) return {reason: "service-unavailable", message: null}

        if (cause.status === 401) return {reason: "invalid-token", message: null}
        if (cause.status === 403) return {reason: "account-not-active", message: cause.message}
        if (cause.status === 422) {
            return {reason: "weak-password", message: this.readableValidationMessage(cause.message)}
        }

        return {reason: "service-unavailable", message: null}
    }

    readableValidationMessage(message: string): string | null {
        const [, humanPart] = message.split(/Value error,\s*/)
        const text = humanPart?.trim() ?? ""

        return text === "" ? null : text
    }

    private async revokeSession(): Promise<void> {
        await apiService
            .post<MessageResponse>(
                "v1/auth/logout",
                undefined,
                {baseURL: Config.API_BASE_URL, redirectOnUnauthorized: false}
            )
            .catch(() => undefined)
    }

    private async grantsFor(core: UserTypes): Promise<DepartmentPageAccess[]> {
        if (!core.access_profile_id) return []

        const [access, tree] = await Promise.all([
            apiService.get<CoreAccess>(
                `v1/access/${core.access_profile_id}`,
                {baseURL: Config.API_BASE_URL}
            ),
            apiService.get<CoreProfileMenuTree[]>(
                "v1/profile-menus/tree",
                {baseURL: Config.API_BASE_URL}
            ),
        ])

        const granted = new Set(access.menus.map((menu) => menu.id))

        return tree.flatMap((root) => {
            const pageKeys = root.children
                .filter((child) => granted.has(child.id))
                .map((child) => pageKeyFromChildMenuId(root.menu_id, child.menu_id))

            return pageKeys.length ? [{departmentId: root.menu_id, pageKeys}] : []
        })
    }
}

export const authService = new AuthService()
