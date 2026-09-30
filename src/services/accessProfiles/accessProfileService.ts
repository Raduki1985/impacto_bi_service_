import {normalizeStoredAccessProfileId} from "../../lib/accessProfileRules";
import type {AccessProfile, DepartmentPageAccess} from "../../types/access";
import type {CoreAccess, CoreProfileMenuTree, CoreUser, CoreUserUpdate} from "../../types/coreApi";
import type {PaginatedResponse} from "../../types/pagination/paginationTypes";
import {ApiError, apiService} from "../apiService";
import {CoreApiError} from "../../data/api/coreApiClient";
import {resolveMenuIds} from "../profileMenus/profileMenuApi";
import {profileMenuService} from "../profileMenus/profileMenuService";
import {type AccessProfileActor, normalizeActor} from "./accessProfileActor";
import {
    accessProfileFromCoreAccessWithTree,
    accessProfilesFromCoreAccesses,
    coreAccessPayloadFromInput,
} from "./accessProfileApiMapper";

/**
 * Perfis de Acesso, que vivem no `impacto-bi-service`.
 *
 * Substitui o par `accessProfileApi` + `accessProfileRepository`: as chamadas e
 * as REGRAS do portal que as cercam passaram a morar juntas, e nada mais é lido
 * ou gravado no navegador. Toda rota que devolve perfil devolve `AccessProfile`,
 * nunca `CoreAccess`: a tradução, nos dois sentidos, é do
 * `accessProfileApiMapper`; as regras de domínio continuam em
 * `lib/accessProfileRules`; quem é o responsável pela operação continua em
 * `accessProfileActor`.
 *
 * O que continua sendo decidido no portal, e por quê:
 *
 * - um perfil COM GENTE DENTRO não é excluído. O serviço confere de novo e
 *   recusa com 409; a conferência aqui existe para a recusa chegar com a frase
 *   do portal, antes da chamada;
 * - a atribuição direta exige que o usuário CONTINUE sem Perfil de Acesso entre
 *   a leitura da tela e a gravação;
 * - toda operação exige um responsável identificado.
 *
 * O HISTÓRICO saiu daqui junto com o repositório: cada operação gravava um
 * evento no `localStorage`, e nada o substitui enquanto o serviço não expuser
 * auditoria.
 */

/** Tamanho de página pedido ao serviço ao varrer as rotas paginadas. */
const PAGE_SIZE = 100

/** Campos que o formulário do portal preenche e que o serviço aceita. */
export type CoreAccessProfileInput = {
    name: string
    description?: string
    departmentPageAccess: readonly DepartmentPageAccess[]
}

/* -------------------------------------------------------------------------- */
/* Falha do serviço                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Recusa vinda do serviço, ou falha ao falar com ele. Carrega a FRASE, e não um
 * código: o serviço explica a própria recusa, e traduzi-la para um código
 * fechado perderia justamente a parte útil.
 */
export type AccessProfileServiceFailure = {
    ok: false
    reason: 'service-failure'
    message: string
}

function serviceFailure(cause: unknown): AccessProfileServiceFailure {
    if (cause instanceof ApiError || cause instanceof CoreApiError) {
        return {ok: false, reason: 'service-failure', message: cause.message}
    }

    return {
        ok: false,
        reason: 'service-failure',
        message: 'Falha inesperada ao falar com o serviço do portal.',
    }
}

/** 404 do serviço: o registro não existe mais. Qualquer outra falha é falha. */
function isNotFound(cause: unknown): boolean {
    return cause instanceof ApiError && cause.status === 404
}

/* -------------------------------------------------------------------------- */
/* Exclusão                                                                   */
/* -------------------------------------------------------------------------- */

export type AccessProfileDeleteFailureReason =
    | 'not-found'
    | 'profile-has-users'
    | 'actor-required'

export type AccessProfileDeleteResult =
    | { ok: true; profile: AccessProfile }
    | { ok: false; reason: AccessProfileDeleteFailureReason }
    | AccessProfileServiceFailure

/* -------------------------------------------------------------------------- */
/* Atribuição direta a um usuário sem Perfil de Acesso                        */
/* -------------------------------------------------------------------------- */

export type AccessProfileDirectAssignmentFailureReason =
    | 'user-not-found'
    | 'user-already-assigned'
    | 'access-profile-required'
    | 'unknown-access-profile'
    | 'actor-required'

export type AccessProfileDirectAssignmentResult =
    | {
    ok: true
    profile: AccessProfile
    userId: string
    /** Nome do usuário no momento da atribuição, para a mensagem da tela. */
    userName: string
}
    | { ok: false; reason: AccessProfileDirectAssignmentFailureReason }
    | AccessProfileServiceFailure

class AccessProfileService {

    /**
     * Árvore de menus do serviço.
     *
     * Cada operação a lê UMA vez e a repassa: gravar precisa dela para resolver
     * os `menu_ids`, e a resposta precisa dela de novo para traduzir os menus de
     * volta. O cache de processo é do `profileMenuService`, que é quem sabe
     * quando ele deixa de valer.
     */
    private loadMenuTree(): Promise<CoreProfileMenuTree[]> {
        return profileMenuService.fetchProfileMenuTree()
    }

    /**
     * UUIDs dos menus, recusando a gravação quando alguma página concedida não
     * tem menu correspondente no serviço.
     *
     * Gravar só a parte que casou seria pior do que recusar: o formulário mostrou
     * N páginas marcadas, o serviço guardaria menos, e ninguém veria a diferença
     * até alguém reclamar de não enxergar uma tela.
     */
    private resolveMenuIdsOrThrow(
        tree: readonly CoreProfileMenuTree[],
        departmentPageAccess: readonly DepartmentPageAccess[],
    ): string[] {
        const {menuIds, unmatched} = resolveMenuIds(tree, departmentPageAccess)

        if (unmatched.length) {
            throw new CoreApiError(
                `O serviço não publicou menu para ${unmatched.length} página(s) selecionada(s): ` +
                `${unmatched.join(', ')}. Cadastre os menus em profile_menu antes de gravar.`,
            )
        }

        return menuIds
    }

    /**
     * Todas as linhas de `access`, cruas, percorrendo as páginas do serviço.
     *
     * A rota é paginada, e quem chama lista a coleção INTEIRA: parar na primeira
     * página esconderia perfis sem dizer que eles existem. O `usersService`
     * consome esta forma, e não a traduzida: ele só confere se o UUID escolhido
     * no cadastro de usuários existe, e traduzir os menus seria trabalho jogado
     * fora.
     */
    async listCoreAccesses(): Promise<CoreAccess[]> {
        const accesses: CoreAccess[] = []

        for (let page = 1; ; page += 1) {
            const result = await apiService.get<PaginatedResponse<CoreAccess>>("v1/access", {
                params: {page, size: PAGE_SIZE},
            })

            accesses.push(...result.list)

            if (!result.pagination.next || result.list.length === 0) break
        }

        return accesses
    }

    /** Um perfil pelo UUID, já traduzido. */
    private async getAccessProfile(id: string): Promise<AccessProfile> {
        const [access, tree] = await Promise.all([
            apiService.get<CoreAccess>(`v1/access/${id}`),
            this.loadMenuTree(),
        ])

        return accessProfileFromCoreAccessWithTree(access, tree)
    }

    /**
     * Coleção completa do serviço, na ordem dele, no domínio do portal.
     *
     * É a lista da tela Perfis de acesso e o catálogo do campo Perfil de Acesso
     * do cadastro de usuários.
     */
    async listAccessProfiles(): Promise<AccessProfile[]> {
        const [accesses, tree] = await Promise.all([this.listCoreAccesses(), this.loadMenuTree()])

        return accessProfilesFromCoreAccesses(accesses, tree)
    }

    /**
     * Cria o perfil no serviço. Exige um Administrador autenticado: a rota está
     * protegida por `require_admin`.
     */
    async createAccessProfile(input: CoreAccessProfileInput): Promise<AccessProfile> {
        const tree = await this.loadMenuTree()
        const payload = coreAccessPayloadFromInput(
            input,
            this.resolveMenuIdsOrThrow(tree, input.departmentPageAccess),
        )

        return accessProfileFromCoreAccessWithTree(
            await apiService.post<CoreAccess>("v1/access", payload),
            tree,
        )
    }

    /** Edita o perfil no serviço: nome, descrição e a lista de menus. */
    async updateAccessProfile(id: string, input: CoreAccessProfileInput): Promise<AccessProfile> {
        const tree = await this.loadMenuTree()
        const payload = coreAccessPayloadFromInput(
            input,
            this.resolveMenuIdsOrThrow(tree, input.departmentPageAccess),
        )

        return accessProfileFromCoreAccessWithTree(
            await apiService.put<CoreAccess>(`v1/access/${id}`, payload),
            tree,
        )
    }

    /**
     * Exclui um Perfil de Acesso que não tem nenhum usuário dentro.
     *
     * A presença de gente RECUSA a exclusão: apagar um perfil não pode ser o
     * caminho para tirar o acesso de alguém sem que essa tenha sido a decisão. A
     * saída é transferir as pessoas para outro Perfil de Acesso e só então
     * excluir o que ficou vazio.
     *
     * Quem responde se o perfil está vazio é o SERVIÇO, pelo `users_count` da
     * linha relida agora — o repositório varria a base de usuários inteira para
     * chegar à mesma resposta. A linha é relida, e não aproveitada da tela: a
     * contagem que o card mostra pode ser de antes de alguém entrar no perfil em
     * outra aba.
     */
    async deleteAccessProfile(
        id: string,
        actorInput: AccessProfileActor,
    ): Promise<AccessProfileDeleteResult> {
        const normalizedId = id.trim()
        if (!normalizedId) return {ok: false, reason: 'not-found'}

        const actor = normalizeActor(actorInput)
        if (!actor) return {ok: false, reason: 'actor-required'}

        let current: AccessProfile
        try {
            current = await this.getAccessProfile(normalizedId)
        } catch (cause) {
            if (isNotFound(cause)) return {ok: false, reason: 'not-found'}
            return serviceFailure(cause)
        }

        if (current.hasBeenUsed) return {ok: false, reason: 'profile-has-users'}

        try {
            await apiService.delete<void>(`v1/access/${normalizedId}`)
        } catch (cause) {
            if (isNotFound(cause)) return {ok: false, reason: 'not-found'}
            return serviceFailure(cause)
        }

        return {ok: true, profile: current}
    }

    /**
     * Dá um Perfil de Acesso a UM usuário que está sem nenhum.
     *
     * ESTADO REVALIDADO NA GRAVAÇÃO: o usuário precisa continuar sem Perfil de
     * Acesso. A tela abriu o modal porque ele estava sem perfil, mas entre aquela
     * leitura e esta gravação outra aba pode ter atribuído um. Nesse caso a
     * operação é RECUSADA, e não convertida em transferência: trocar um vínculo
     * que ninguém pediu para trocar retiraria o acesso que a outra decisão acabou
     * de conceder.
     *
     * A revalidação lê a linha CRUA de `users`, e não a coleção traduzida do
     * `usersService`: o que decide aqui é `access_profile_id`, que está na
     * linha, e ler daqui evita que este módulo dependa do de usuários.
     */
    async assignAccessProfileToUser(input: {
        userId: string
        accessProfileId: string
        actor: AccessProfileActor
    }): Promise<AccessProfileDirectAssignmentResult> {
        const actor = normalizeActor(input.actor)
        if (!actor) return {ok: false, reason: 'actor-required'}

        const userId = input.userId.trim()
        if (!userId) return {ok: false, reason: 'user-not-found'}

        const accessProfileId = normalizeStoredAccessProfileId(input.accessProfileId)
        if (accessProfileId === null) return {ok: false, reason: 'access-profile-required'}

        // As duas leituras vão juntas, mas cada falha é lida por si: um 404 do
        // perfil é o perfil que sumiu, e um 404 na base de usuários não seria
        // isso. `allSettled` é o que mantém as duas em paralelo sem que a
        // primeira recusa engula o motivo da outra.
        const [profileResult, usersResult] = await Promise.allSettled([
            this.getAccessProfile(accessProfileId),
            this.listCoreUsers(),
        ])

        if (profileResult.status === 'rejected') {
            return isNotFound(profileResult.reason)
                ? {ok: false, reason: 'unknown-access-profile'}
                : serviceFailure(profileResult.reason)
        }

        if (usersResult.status === 'rejected') return serviceFailure(usersResult.reason)

        const target = profileResult.value
        const current = usersResult.value.find((candidate) => candidate.id === userId)

        if (!current) return {ok: false, reason: 'user-not-found'}

        if (normalizeStoredAccessProfileId(current.access_profile_id) !== null) {
            return {ok: false, reason: 'user-already-assigned'}
        }

        const payload: CoreUserUpdate = {access_profile_id: target.id}

        try {
            await apiService.put<CoreUser>(`v1/users/${current.id}`, payload)
        } catch (cause) {
            return serviceFailure(cause)
        }

        return {ok: true, profile: target, userId: current.id, userName: current.name}
    }

    /**
     * Linhas de `users` do serviço, cruas, só para a revalidação da atribuição.
     *
     * Não é o catálogo de usuários do portal: esse é do `usersService`, que
     * traduz cada linha e resolve os acessos de cada uma. Aqui bastam o id, o
     * nome e o vínculo atual.
     */
    private async listCoreUsers(): Promise<CoreUser[]> {
        const users: CoreUser[] = []

        for (let page = 1; ; page += 1) {
            const result = await apiService.get<PaginatedResponse<CoreUser>>("v1/users", {
                params: {page, size: PAGE_SIZE},
            })

            users.push(...result.list)

            if (!result.pagination.next || result.list.length === 0) break
        }

        return users
    }
}

export type {AccessProfileActor}

export const accessProfileService = new AccessProfileService()
