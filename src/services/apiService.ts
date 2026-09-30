import {Config} from "../config";
import {authService} from "./auth/authService";

export class ApiError extends Error {
    status: number
    payload?: unknown

    constructor(status: number, message: string, payload?: unknown) {
        super(message)
        this.status = status
        this.payload = payload
    }
}

type RequestOptions = Omit<RequestInit, "body"> & {
    body?: any
    auth?: boolean
    redirectOnUnauthorized?: boolean
    baseURL?: string
    params?: Record<string, string | number | boolean | undefined | null>
    timeout?: number
}

type UploadOptions = Omit<RequestOptions, "body"> & {
    onProgress?: (ev: ProgressEvent) => void
}

class ApiService {
    private defaultBase = Config.API_BASE_URL

    private getToken() {
        return authService.getToken()
    }

    private buildUrl(path: string, baseURL?: string, params?: RequestOptions["params"]) {
        const base = (baseURL ?? this.defaultBase)
        const url = new URL(`${base}${path}`)

        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
            })
        }
        return url.toString()
    }

    private options(options: RequestOptions = {}): RequestInit {
        const token = this.getToken()
        const headers = new Headers(options.headers as HeadersInit)

        headers.set("Accept-Language", "pt-BR")

        const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
        const isURLEncoded = typeof URLSearchParams !== "undefined" && options.body instanceof URLSearchParams
        const isJsonBody = Boolean(!isFormData && !isURLEncoded && options.body && typeof options.body === "object")

        if (isJsonBody) {
            headers.set("Content-Type", "application/json")
        }

        const useAuth = options.auth !== false
        if (useAuth && token) headers.set("Authorization", `Bearer ${token}`)

        return {
            ...options,
            headers,
            body:
                isFormData || isURLEncoded
                    ? options.body
                    : isJsonBody
                        ? JSON.stringify(emptyStringToNull(options.body))
                        : options.body,
        }
    }

    private async handleResponse<T>(res: Response, redirectOnUnauthorized = true): Promise<T> {
        const text = await res.text()
        const maybeJson = text ? safeJson(text) : undefined

        if (res.status === 401 && redirectOnUnauthorized) {
            authService.clearSession()
            window.location.replace("/login")
            throw new ApiError(401, errorMessage(maybeJson) ?? "Sessão expirada", maybeJson)
        }

        if (!res.ok) {
            throw new ApiError(
                res.status,
                errorMessage(maybeJson) ?? (res.statusText || "Erro na requisição"),
                maybeJson,
            )
        }

        if (!text) return undefined as T
        return maybeJson as T
    }

    private async handleBlob(res: Response): Promise<Blob> {
        if (res.status === 401) {
            authService.clearSession();
            window.location.replace("/login");
            throw new ApiError(401, "Sessão expirada");
        }
        if (!res.ok) {
            const text = await res.text();
            const payload = text ? safeJson(text) : undefined;
            throw new ApiError(res.status, errorMessage(payload) ?? (res.statusText || "Erro na requisição"), payload);
        }
        return res.blob();
    }

    async request<T = unknown>(path: string, options: RequestOptions = {}) {
        const url = this.buildUrl(path, options.baseURL, options.params)
        const init = this.options(options)

        const {timeout} = options
        const redirectOnUnauthorized = options.auth !== false && options.redirectOnUnauthorized !== false

        if (!timeout) {
            const res = await fetch(url, init)
            return this.handleResponse<T>(res, redirectOnUnauthorized)
        }

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)

        try {
            const res = await fetch(url, {...init, signal: controller.signal})
            return await this.handleResponse<T>(res, redirectOnUnauthorized)
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new ApiError(0, "Tempo de requisição excedido. Verifique sua conexão e tente novamente.")
            }
            throw error
        } finally {
            clearTimeout(timer)
        }
    }

    uploadFile<T = unknown>(path: string, form: FormData, options: UploadOptions = {}): Promise<T> {
        const url = this.buildUrl(path, options.baseURL, options.params)
        const token = this.getToken()
        const useAuth = options.auth !== false

        return new Promise<T>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open("POST", url, true)

            if (useAuth && token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
            const extraHeaders = options.headers as Record<string, string> | undefined
            if (extraHeaders) {
                Object.entries(extraHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v as string))
            }

            if (options.onProgress) {
                xhr.upload.onprogress = options.onProgress
            }

            xhr.onload = async () => {
                const status = xhr.status
                const text = xhr.responseText ?? ""
                const payload = text ? safeJson(text) : undefined

                if (status === 401) {
                    authService.clearSession()
                    window.location.replace("/login")
                    reject(new ApiError(401, "Sessão expirada"))
                    return
                }
                if (status < 200 || status >= 300) {
                    const msg =
                        (payload)?.detail ||
                        (payload)?.message ||
                        xhr.statusText ||
                        "Erro na requisição"
                    reject(new ApiError(status, msg, payload))
                    return
                }

                resolve((payload as T) ?? (undefined as T))
            }

            xhr.onerror = () => {
                reject(new ApiError(0, "Falha de rede durante upload"))
            }

            xhr.send(form)
        })
    }

    getBlob(path: string, options: Omit<RequestOptions, "body"> = {}) {
        const url = this.buildUrl(path, options.baseURL, options.params);
        const init = this.options({...options, method: "GET"});
        return fetch(url, init).then(this.handleBlob);
    }

    postBlob(path: string, body?: unknown, options: Omit<RequestOptions, "body"> = {}) {
        const url = this.buildUrl(path, options.baseURL, options.params);
        const init = this.options({...options, method: "POST", body});
        return fetch(url, init).then(this.handleBlob);
    }

    get<T = unknown>(path: string, options: Omit<RequestOptions, "body"> = {}) {
        return this.request<T>(path, {...options, method: "GET"})
    }

    post<T = unknown>(path: string, body?: unknown, options: Omit<RequestOptions, "body"> = {}) {
        return this.request<T>(path, {...options, method: "POST", body})
    }

    put<T = unknown>(path: string, body?: unknown, options: Omit<RequestOptions, "body"> = {}) {
        return this.request<T>(path, {...options, method: "PUT", body})
    }

    delete<T = unknown>(path: string, options: Omit<RequestOptions, "body"> = {}) {
        return this.request<T>(path, {...options, method: "DELETE"})
    }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) return false

    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

type ValidationIssue = { loc?: unknown[]; msg?: string }

function filledString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null
}

function errorMessage(payload: unknown): string | null {
    if (typeof payload !== "object" || payload === null) return null

    const {error, detail, message} = payload as Record<string, unknown>

    if (typeof error === "object" && error !== null) {
        const enveloped = filledString((error as Record<string, unknown>).message)
        if (enveloped !== null) return enveloped
    }

    const plainDetail = filledString(detail)
    if (plainDetail !== null) return plainDetail

    if (Array.isArray(detail)) {
        const joined = (detail as ValidationIssue[])
            .map((item) =>
                item?.loc?.length
                    ? `${String(item.loc[item.loc.length - 1])}: ${item.msg ?? ""}`
                    : (item?.msg ?? JSON.stringify(item))
            )
            .join(" | ")
        return joined === "" ? null : joined
    }

    return filledString(message)
}

function emptyStringToNull<T>(value: T): T {
    if (typeof value === "string") {
        return (value.trim() === "" ? null : value) as T
    }

    if (Array.isArray(value)) {
        return value.map(item => emptyStringToNull(item)) as T
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, emptyStringToNull(item)]),
        ) as T
    }

    return value
}

function safeJson(text: string) {
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

export const apiService = new ApiService()
