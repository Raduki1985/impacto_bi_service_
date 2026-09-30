/**
 * Acesso HTTP às rotas de usuários do `impacto-bi-service` e tradução de cada
 * resposta para o domínio do portal.
 *
 * Três responsabilidades, separadas dentro do arquivo:
 *
 * - as CHAMADAS, uma função por rota, que falam o contrato do serviço
 *   (`CoreUser`, `CoreUserCreate`, `CoreUserUpdate`, `CoreAccess`) e nada mais;
 * - o TRADUTOR de usuários, que completa o que o usuário do serviço não traz
 *   sozinho: os departamentos e páginas concedidos, que vivem em
 *   `GET /access/{id}`;
 * - o CATÁLOGO do formulário de usuários: os tipos de perfil (`profile_types`)
 *   e os perfis de acesso (`access`) do serviço, já na forma que a página
 *   Usuários consome.
 *
 * Nada aqui decide regra de negócio. Validação de nome e e-mail, proteção do
 * último Administrador e Histórico continuam no `userRepository`, que é quem
 * chama estas funções.
 */

import {fetchAllCorePages, requestCoreApi} from '../../data/api/coreApiClient'
import type {User} from '../../data/dashboardTypes'
import type {AccessProfile, DepartmentPageAccess} from '../../types/access'
import type {
    CoreAccess,
    CoreUser,
    CoreUserCreate,
    CoreUserPasswordChange,
    CoreUserUpdate,
} from '../../types/coreApi'
import {accessProfileService} from '../accessProfiles/accessProfileService'
import {profileMenuService} from '../profileMenus/profileMenuService'
import {profileTypesService} from '../profileTypes/profileTypesService'
import {departmentPageAccessFromMenus} from '../profileMenus/profileMenuApi'
import {mapCoreUser, type SystemProfileOption, systemProfileOptionFromCore} from './userApiMapper'

/* -------------------------------------------------------------------------- */
/* Chamadas                                                                   */

/* -------------------------------------------------------------------------- */

/** Todos os usuários. Exige Administrador ou Executivo no serviço. */
export function fetchAllCoreUsers(): Promise<CoreUser[]> {
    return fetchAllCorePages<CoreUser>('/users')
}

/** Usuário autenticado pelo token atual. Qualquer perfil pode chamar. */
export function fetchCoreCurrentUser(): Promise<CoreUser> {
    return requestCoreApi<CoreUser>('/users/me')
}

/** Cria o usuário. Exige Administrador. */
export function createCoreUser(payload: CoreUserCreate): Promise<CoreUser> {
    return requestCoreApi<CoreUser>('/users', {method: 'POST', body: payload})
}

/** Altera só os campos enviados. Exige Administrador. */
export function updateCoreUser(id: string, payload: CoreUserUpdate): Promise<CoreUser> {
    return requestCoreApi<CoreUser>(`/users/${id}`, {method: 'PUT', body: payload})
}

/**
 * Troca a senha do usuário, confirmada com a senha de quem está autenticado.
 * Exige Administrador.
 *
 * Não confundir com o `password` de `updateCoreUser`: lá o administrador grava
 * a primeira senha de quem ainda não tem nenhuma, sem confirmar nada; aqui a
 * conta já tem senha, e o serviço só troca contra a senha do próprio
 * administrador. A resposta traz só a frase de confirmação.
 */
export function changeCoreUserPassword(
    id: string,
    payload: CoreUserPasswordChange,
): Promise<{ message: string }> {
    return requestCoreApi<{ message: string }>(`/users/${id}/password`, {
        method: 'POST',
        body: payload,
    })
}

/**
 * Reenvia o e-mail de primeiro acesso, com um link novo de 10 minutos. Exige
 * Administrador.
 *
 * O token anterior é DERRUBADO pelo serviço: o link antigo deixa de valer no
 * momento em que este é gerado. A resposta traz só a frase de confirmação, e o
 * link em si nunca chega ao portal fora de `ENV=local`.
 */
export function resendCoreFirstAccess(id: string): Promise<{ message: string }> {
    return requestCoreApi<{ message: string }>(`/users/${id}/first-access`, {method: 'POST'})
}

/* -------------------------------------------------------------------------- */
/* Tradutor de usuários                                                       */
/* -------------------------------------------------------------------------- */

/** Tradutor de usuários do serviço para o domínio do portal. */
export type CoreUserTranslator = (core: CoreUser) => Promise<User>

/**
 * Cria um tradutor com memória de UMA carga.
 *
 * A memória é o motivo de ser uma fábrica, e não uma função solta: uma lista de
 * cinquenta usuários costuma ter meia dúzia de perfis de acesso distintos, e as
 * concessões de cada um são buscadas uma vez só, por perfil, e não por usuário.
 * A memória morre com o tradutor, então a carga seguinte lê o serviço de novo e
 * enxerga perfis editados nesse meio-tempo.
 */
export function createCoreUserTranslator(): CoreUserTranslator {
    const grantsByAccess = new Map<string, Promise<DepartmentPageAccess[]>>()

    function grantsFor(core: CoreUser): Promise<DepartmentPageAccess[]> {
        // Sem perfil de acesso não há o que buscar. O Perfil do Sistema não entra
        // nesta decisão: o Administrador era dispensado desta busca porque recebia o
        // catálogo inteiro pela regra do portal, e não recebe mais — os
        // departamentos dele são os do Perfil de Acesso dele, como para qualquer
        // perfil. Ver `deriveUserAccessFromGrants`.
        if (core.access_profile_id === null) {
            return Promise.resolve([])
        }

        const accessId = core.access_profile_id
        let pending = grantsByAccess.get(accessId)

        if (pending === undefined) {
            pending = (async () => {
                const [access, tree] = await Promise.all([
                    requestCoreApi<CoreAccess>(`/access/${accessId}`),
                    profileMenuService.fetchProfileMenuTree(),
                ])

                return departmentPageAccessFromMenus(
                    tree,
                    access.menus.map((menu) => menu.id),
                )
            })().catch((cause: unknown) => {
                // Uma busca que falhou não pode ficar presa na memória: o usuário
                // seguinte com o mesmo perfil precisa poder tentar de novo.
                grantsByAccess.delete(accessId)
                throw cause
            })

            grantsByAccess.set(accessId, pending)
        }

        return pending
    }

    return async (core) => mapCoreUser(core, {grants: await grantsFor(core)})
}

/** Usuário autenticado, já no domínio do portal. É o que a sessão guarda. */
export async function fetchCurrentUser(): Promise<User> {
    const translate = createCoreUserTranslator()

    return translate(await fetchCoreCurrentUser())
}

/* -------------------------------------------------------------------------- */
/* Catálogo do formulário                                                     */
/* -------------------------------------------------------------------------- */

/** Os dois catálogos que o cadastro de usuários oferece para escolha. */
export type UserFormCatalog = {
    /** Linhas de `profile_types`, na ordem do serviço, só as que o portal sabe ler. */
    profileTypes: SystemProfileOption[]
    /** Linhas de `access`, na ordem do serviço, com os departamentos concedidos. */
    accessProfiles: AccessProfile[]
}

/**
 * Carrega os catálogos do formulário a partir do serviço.
 *
 * Perfil do Sistema vem de `profile_types` e Perfil de Acesso vem de `access`,
 * e é o serviço quem diz a qual tipo cada perfil de acesso pertence: o
 * formulário só oferece, para o tipo escolhido, os perfis daquele tipo. A
 * coleção de perfis é a mesma que a tela Perfis de acesso lista.
 *
 * Uma leitura só, das duas fontes em paralelo. Quem chama decide quando reler.
 */
export async function loadUserFormCatalog(): Promise<UserFormCatalog> {
    const [types, accessProfiles] = await Promise.all([
        profileTypesService.listProfileTypes(),
        accessProfileService.listAccessProfiles(),
    ])

    const profileTypes = types.flatMap((type) => {
        const option = systemProfileOptionFromCore(type)
        return option ? [option] : []
    })

    return {profileTypes, accessProfiles}
}
