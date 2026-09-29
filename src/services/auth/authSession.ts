/*
import type {LoginFailureReason} from '../../contexts/AuthContextCore'
import type {User} from '../../data/dashboardTypes'
import {CoreApiError, requestCoreApi} from '../../data/api/coreApiClient'
import type {CoreLogoutResponse, CoreTokenResponse} from '../../types/coreApi'
import {fetchCurrentUser} from '../users/userApi'
import {clearCoreApiToken, getCoreApiToken, setCoreApiToken} from './coreApiToken'

/!**
 * Sessão do portal contra o `impacto-bi-service`: quem está autenticado agora e
 * como isso sobrevive a um F5.
 *
 * Três operações moram aqui, e nada além delas:
 *
 * - ENTRAR: `POST /auth/login` com e-mail e senha devolve o token; o token é
 *   guardado e `GET /users/me` diz quem entrou. É o serviço que confere a senha,
 *   a situação da conta e a presença de um perfil de acesso, e cada recusa dele
 *   vira um motivo distinto para a tela;
 * - VOLTAR: com um token guardado na aba, `GET /users/me` de novo. O serviço
 *   reavalia tudo a cada chamada, então quem foi desativado ou perdeu o perfil
 *   de acesso entre um acesso e outro é recusado aqui também, e o token some;
 * - SAIR: `POST /auth/logout` encerra a sessão no serviço e o token é apagado.
 *
 * O QUE É GRAVADO: somente o token, em `services/auth/coreApiToken`. Nada de
 * senha, nome, e-mail, perfil ou permissões. O usuário em memória é
 * reconstruído do serviço a cada carga da página.
 *
 * A chave `impacto-bi.auth-session` da fase mockada, que guardava só o id do
 * usuário e não provava nada, é apagada dos dois armazenamentos em toda
 * operação: nenhuma sessão antiga pode continuar valendo por ela.
 *!/

/!* -------------------------------------------------------------------------- *!/
/!* Chave antiga                                                               *!/
/!* -------------------------------------------------------------------------- *!/

/!** Chave da sessão mockada, mantida aqui apenas para ser limpa. *!/
export const LEGACY_AUTH_SESSION_STORAGE_KEY = 'impacto-bi.auth-session'

/!** null quando indisponível (SSR, modo privado ou bloqueio do navegador). *!/
function legacyStorages(): Storage[] {
    if (typeof window === 'undefined') return []

    const storages: Storage[] = []
    try {
        storages.push(window.sessionStorage)
    } catch {
        // Sem armazenamento da aba: não há chave antiga a limpar nele.
    }
    try {
        storages.push(window.localStorage)
    } catch {
        // Sem armazenamento do dispositivo: idem.
    }

    return storages
}

/!**
 * Apaga a sessão que a fase mockada tenha deixado gravada.
 *
 * Sem isso, a chave antiga sobreviveria para sempre no navegador de quem já
 * usava o portal, sem ninguém lê-la e sem ninguém removê-la.
 *!/
export function removeLegacySessionKeys(): void {
    for (const storage of legacyStorages()) {
        try {
            storage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY)
        } catch {
            // Armazenamento indisponível não derruba a sessão em memória.
        }
    }
}

/!* -------------------------------------------------------------------------- *!/
/!* Sessão                                                                     *!/

/!* -------------------------------------------------------------------------- *!/

/!** true quando existe um token guardado, a validar contra o serviço. *!/
export function hasStoredSession(): boolean {
    return getCoreApiToken() !== null
}

export type AuthorizationResult =
    | { ok: true; user: User }
    | { ok: false; reason: LoginFailureReason }

/!**
 * Motivo da recusa a partir do que o serviço respondeu.
 *
 * O serviço usa DOIS códigos para três situações: `401` para credencial errada
 * e `403` tanto para conta inativa quanto para usuário sem perfil de acesso. Os
 * dois `403` só se distinguem pelo texto, então o texto é lido: `Usuário sem
 * perfil de acesso` é a falta de perfil, e qualquer outro `403` é a conta que
 * não pode entrar. `422` é o formulário incompleto (campo vazio), que para quem
 * está entrando é o mesmo que credencial inválida.
 *
 * Tudo o que não é resposta do serviço (rede, tempo esgotado, endereço não
 * configurado, resposta em formato desconhecido) é o serviço indisponível: não
 * há nada a corrigir no e-mail ou na senha.
 *!/
export function loginFailureReasonFor(cause: unknown): LoginFailureReason {
    if (!(cause instanceof CoreApiError)) return 'service-unavailable'

    if (cause.status === 401 || cause.status === 422) return 'invalid-credentials'

    if (cause.status === 403) {
        return /perfil de acesso/i.test(cause.message) ? 'access-profile-required' : 'inactive-account'
    }

    return 'service-unavailable'
}

/!** Encerra a sessão no serviço sem esperar nem falhar: é limpeza, não decisão. *!/
function revokeSessionQuietly(): void {
    void requestCoreApi<CoreLogoutResponse>('/auth/logout', {method: 'POST'}).catch(
        () => undefined,
    )
}

/!**
 * Entrada pelo formulário.
 *
 * O e-mail vai em `username`, como formulário, porque é o que a rota do serviço
 * espera. Uma recusa não deixa token para trás: uma tentativa mal sucedida
 * depois de um logout não pode ressuscitar a sessão anterior no F5.
 *
 * Se o token chegou mas a leitura do usuário falhou em seguida, a sessão que o
 * serviço acabou de abrir é encerrada antes de o token ser descartado, para não
 * ficar uma sessão aberta lá que ninguém consegue fechar por aqui.
 *!/
export async function authenticate(email: string, password: string): Promise<AuthorizationResult> {
    removeLegacySessionKeys()

    const form = new URLSearchParams({username: email.trim(), password})
    let tokenStored = false

    try {
        const token = await requestCoreApi<CoreTokenResponse>('/auth/login', {
            method: 'POST',
            body: form,
        })

        if (!token.access_token) {
            throw new CoreApiError('O serviço não devolveu o token de acesso.')
        }

        setCoreApiToken(token.access_token)
        tokenStored = true

        return {ok: true, user: await fetchCurrentUser()}
    } catch (cause) {
        if (tokenStored) revokeSessionQuietly()
        clearCoreApiToken()

        return {ok: false, reason: loginFailureReasonFor(cause)}
    }
}

/!**
 * Usuário da sessão gravada, ou null.
 *
 * Chamada na montagem do provedor, antes de qualquer rota decidir. O token
 * gravado não é a sessão: ele só permite perguntar ao serviço quem é a pessoa, e
 * o serviço responde de novo a cada carga, com a situação atual da conta.
 *
 * Token recusado (`401`, `403`) é sessão que deixou de valer, e é APAGADO da
 * aba: deixá-lo ali faria o portal tentar de novo em cada visita. Qualquer outra
 * falha (serviço fora do ar, tempo esgotado) devolve null SEM apagar o token: a
 * credencial pode continuar boa, e destruí-la por causa de uma indisponibilidade
 * passageira obrigaria a pessoa a entrar de novo sem motivo.
 *!/
export async function restoreSession(): Promise<User | null> {
    removeLegacySessionKeys()

    if (!hasStoredSession()) return null

    try {
        return await fetchCurrentUser()
    } catch (cause) {
        if (cause instanceof CoreApiError && (cause.status === 401 || cause.status === 403)) {
            clearCoreApiToken()
        }

        return null
    }
}

/!**
 * Saída.
 *
 * O serviço é avisado ANTES de o token ser apagado, porque a chamada precisa
 * dele para identificar qual sessão encerrar; a resposta não é esperada, porque
 * a pessoa já decidiu sair e nada do que o serviço responder muda isso.
 *!/
export function endSession(): void {
    if (hasStoredSession()) revokeSessionQuietly()

    clearCoreApiToken()
    removeLegacySessionKeys()
}

*/
