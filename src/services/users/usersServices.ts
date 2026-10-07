/*
import type {User} from '../../data/dashboardTypes'
import {normalizeStoredAccessProfileId} from '../../lib/accessProfileRules'
import {firstAccessInviteState} from '../../lib/firstAccessInvite'
import {isPasswordAccepted} from '../../lib/passwordPolicy'
import {isValidUserEmail} from '../../lib/userEmail'
import type {AccessProfile, DepartmentPageAccess, UserProfile} from '../../types/access'
import type {
    CoreAccess,
    CoreUser,
    CoreUserCreate,
    CoreUserPasswordChange,
    CoreUserUpdate,
} from '../../types/coreApi'
import type {PaginatedResponse} from '../../types/pagination/paginationTypes'
import {accessProfileService} from '../accessProfiles/accessProfileService'
import {ApiError, apiService} from '../apiService'
import {authService} from '../auth/authService'
import {departmentPageAccessFromMenus} from '../profileMenus/profileMenuApi'
import {profileMenuService} from '../profileMenus/profileMenuService'
import {profileTypesService} from '../profileTypes/profileTypesService'
import {
    compareByCreation,
    CoreUserMappingError,
    mapCoreUser,
    type SystemProfileOption,
    systemProfileOptionFromCore,
    userProfileFromCode,
} from './userApiMapper'

/!**
 * Usuários, que vivem no `impacto-bi-service`.
 *
 * Substitui o par `userApi` + `userRepository`: as chamadas e as REGRAS do
 * portal que as cercam passaram a morar juntas, como já aconteceu com os Perfis
 * de Acesso em `accessProfileService`. Toda leitura e toda gravação passam pelo
 * serviço pelo `apiService`, e é ele quem confere e-mail repetido, tipo de
 * perfil, perfil de acesso e quem pode fazer o quê.
 *
 * DUAS FORMAS de usuário saem daqui, e a diferença é deliberada:
 *
 * - `CoreUser`, a linha do serviço, é o que as gravações devolvem e o que a tela
 *   Usuários lista. Ela mostra nome, e-mail, situação e os dois perfis, e tudo
 *   isso está na linha;
 * - `User`, o domínio do portal, sai de `listUsers` e de `getCurrentUser`. Ele
 *   custa uma leitura a mais por Perfil de Acesso distinto, porque os
 *   departamentos e páginas concedidos vivem em `GET /access/{id}`, e por isso só
 *   é montado para quem precisa deles: a sessão autenticada e a tela Perfis de
 *   acesso.
 *
 * O que continua sendo decidido no portal, e por quê:
 *
 * - as REGRAS que o serviço não conhece e a tela sempre teve: nome obrigatório,
 *   formato do e-mail, idempotência (salvar sem mudar nada não grava), a
 *   proteção do último Administrador ativo e a recusa da autoedição de perfil.
 *   Elas rodam contra a lista RECÉM-LIDA do serviço, antes da chamada, para a
 *   pessoa receber a mensagem do portal, e não um código HTTP;
 * - a CONFERÊNCIA da escolha contra os catálogos do serviço, pelo mesmo motivo:
 *   tipo inexistente e perfil inexistente viram frases do portal antes de virar
 *   um 422.
 *
 * O HISTÓRICO saiu daqui junto com o repositório: cada operação gravava um
 * evento no `localStorage`, e nada o substitui enquanto o serviço não expuser
 * auditoria.
 *!/

/!** Tamanho de página pedido ao serviço ao varrer `users`. *!/
const PAGE_SIZE = 100

/!* -------------------------------------------------------------------------- *!/
/!* Falha do serviço                                                           *!/
/!* -------------------------------------------------------------------------- *!/

/!**
 * Recusa vinda do serviço, ou falha ao falar com ele.
 *
 * Carrega a FRASE, e não um código, ao contrário das demais recusas deste
 * módulo: o serviço explica a própria recusa (`Email já cadastrado`, `Usuário
 * sem senha definida não pode ser ativado`), e traduzi-la para um código fechado
 * perderia justamente a parte útil. `reason` fixo é o que permite à tela
 * distinguir esta variante das que ela traduz sozinha.
 *!/
export type UserServiceFailure = { ok: false; reason: 'service-failure'; message: string }

function serviceFailure(cause: unknown): UserServiceFailure {
    if (cause instanceof ApiError || cause instanceof CoreUserMappingError) {
        return {ok: false, reason: 'service-failure', message: cause.message}
    }

    return {
        ok: false,
        reason: 'service-failure',
        message: 'Falha inesperada ao falar com o serviço do portal.',
    }
}

/!* -------------------------------------------------------------------------- *!/
/!* Responsável pela operação                                                  *!/
/!* -------------------------------------------------------------------------- *!/

/!**
 * Responsável por uma operação sobre usuários: o Administrador autenticado que
 * a executou.
 *
 * Continua entrando nas operações porque é ele que as regras do portal leem
 * para reconhecer a autoedição — desativar a si mesmo, trocar o próprio perfil.
 * Não alimenta registro nenhum: o Histórico do navegador foi removido, e as
 * operações que não consultam o responsável deixaram de recebê-lo.
 *!/
export type UserActionActor = { id: string; name: string }

/!* -------------------------------------------------------------------------- *!/
/!* Regras do portal                                                           *!/
/!* -------------------------------------------------------------------------- *!/

/!**
 * Perfil do Sistema da linha, lido pelo CÓDIGO do tipo de perfil.
 *
 * Nunca pelo `name`: o nome da linha de `profile_types` é texto de exibição e
 * muda de ambiente para ambiente, enquanto o código é a chave estável. null
 * quando o serviço devolveu um tipo que o portal não sabe ler.
 *!/
function profileOf(user: CoreUser): UserProfile | null {
    return userProfileFromCode(user.profile_type?.code)
}

/!**
 * true quando o usuário é o único Administrador ativo da coleção. Regra única
 * da proteção, compartilhada pela desativação e pelas edições de perfil: o
 * portal nunca pode ficar sem nenhum Administrador ativo.
 *!/
function isLastActiveAdministrator(collection: readonly CoreUser[], current: CoreUser): boolean {
    if (profileOf(current) !== 'Administrador' || current.status !== 'active') return false

    const activeAdministrators = collection.filter(
        (user) => profileOf(user) === 'Administrador' && user.status === 'active',
    ).length

    return activeAdministrators <= 1
}

/!** Nome e e-mail normalizados, ou o motivo da recusa. *!/
type BasicDataValidation =
    | { ok: true; name: string; email: string }
    | { ok: false; reason: 'invalid-name' | 'invalid-email' | 'email-taken' }

/!**
 * Regra única de validação dos dados básicos, compartilhada pelas edições e
 * pela criação: nome sem espaços nas pontas e obrigatório, e-mail sem espaços,
 * em caixa baixa e no formato simples, e nenhum outro id usando o mesmo
 * e-mail. Nas edições, `currentId` identifica o alvo, que pode manter o
 * próprio e-mail; na criação não há alvo (null) e qualquer e-mail já em uso,
 * inclusive de usuários inativos, é recusado.
 *
 * O serviço confere o e-mail de novo e responde `409`; a conferência aqui
 * existe para a recusa chegar com a frase do portal, antes da chamada.
 *!/
function validateBasicData(
    collection: readonly CoreUser[],
    currentId: string | null,
    input: { name: string; email: string },
): BasicDataValidation {
    const name = input.name.trim()
    if (!name) return {ok: false, reason: 'invalid-name'}

    const email = input.email.trim().toLowerCase()
    if (!isValidUserEmail(email)) return {ok: false, reason: 'invalid-email'}

    const emailTaken = collection.some(
        (user) => user.id !== currentId && user.email.toLowerCase() === email,
    )
    if (emailTaken) return {ok: false, reason: 'email-taken'}

    return {ok: true, name, email}
}

/!**
 * Por que a escolha de Perfil do Sistema e Perfil de Acesso foi recusada.
 *
 * As quatro recusas são coisas diferentes e continuam diferentes até a
 * interface: tipo que sumiu, escolha que falta, perfil que não existe mais e
 * catálogo que não pôde ser lido pedem correções diferentes.
 *
 * `incompatible-access-profile` era a quinta, e saiu: um Perfil de Acesso não
 * pertence mais a um tipo de perfil, então não existe par incompatível.
 *!/
export type UserAssignmentFailureReason =
    | 'unknown-system-profile'
    | 'access-profile-required'
    | 'unknown-access-profile'
    | 'access-profile-unavailable'

/!** Escolha conferida contra os catálogos do serviço, pronta para a gravação. *!/
type ResolvedAssignment =
    | { ok: true; profile: UserProfile; profileSystemId: string; accessProfileId: string }
    | { ok: false; reason: UserAssignmentFailureReason }
    | UserServiceFailure

/!**
 * Única porta pela qual a escolha do formulário vira os dois UUIDs enviados ao
 * serviço.
 *
 * Os catálogos são relidos aqui, e não confiados ao formulário: entre abrir o
 * modal e clicar em Salvar, um perfil de acesso pode ter sido excluído na tela
 * Perfis de acesso. O tipo precisa existir e ser um dos três que o portal sabe
 * ler; o perfil de acesso precisa existir na coleção do serviço.
 *!/
async function resolveAssignment(
    profileSystemId: string,
    accessProfileId: string | null,
): Promise<ResolvedAssignment> {
    let types: Awaited<ReturnType<typeof profileTypesService.listProfileTypes>>
    let accesses: Awaited<ReturnType<typeof accessProfileService.listCoreAccesses>>

    try {
        ;[types, accesses] = await Promise.all([
            profileTypesService.listProfileTypes(),
            accessProfileService.listCoreAccesses(),
        ])
    } catch {
        return {ok: false, reason: 'access-profile-unavailable'}
    }

    const type = types.find((candidate) => candidate.id === profileSystemId.trim())
    if (!type) return {ok: false, reason: 'unknown-system-profile'}

    const profile = userProfileFromCode(type.code)
    if (profile === null) {
        return serviceFailure(
            new CoreUserMappingError(
                `O serviço devolveu um tipo de perfil que o portal não reconhece (${type.code}).`,
            ),
        )
    }

    const chosen = normalizeStoredAccessProfileId(accessProfileId)
    if (chosen === null) return {ok: false, reason: 'access-profile-required'}

    const access = accesses.find((candidate) => candidate.id === chosen)
    if (!access) return {ok: false, reason: 'unknown-access-profile'}

    return {ok: true, profile, profileSystemId: type.id, accessProfileId: access.id}
}

/!* -------------------------------------------------------------------------- *!/
/!* Tradutor para o domínio do portal                                          *!/
/!* -------------------------------------------------------------------------- *!/

/!** Tradutor de usuários do serviço para o domínio do portal. *!/
type CoreUserTranslator = (core: CoreUser) => Promise<User>

/!**
 * Cria um tradutor com memória de UMA carga.
 *
 * A memória é o motivo de ser uma fábrica, e não uma função solta: uma lista de
 * cinquenta usuários costuma ter meia dúzia de perfis de acesso distintos, e as
 * concessões de cada um são buscadas uma vez só, por perfil, e não por usuário.
 * A memória morre com o tradutor, então a carga seguinte lê o serviço de novo e
 * enxerga perfis editados nesse meio-tempo.
 *!/
function createCoreUserTranslator(): CoreUserTranslator {
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
                    apiService.get<CoreAccess>(`v1/access/${accessId}`),
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

/!* -------------------------------------------------------------------------- *!/
/!* Catálogo do formulário                                                     *!/
/!* -------------------------------------------------------------------------- *!/

/!** Os dois catálogos que o cadastro de usuários oferece para escolha. *!/
export type UserFormCatalog = {
    /!** Linhas de `profile_types`, na ordem do serviço, só as que o portal sabe ler. *!/
    profileTypes: SystemProfileOption[]
    /!** Linhas de `access`, na ordem do serviço, com os departamentos concedidos. *!/
    accessProfiles: AccessProfile[]
}

/!* -------------------------------------------------------------------------- *!/
/!* Contratos das operações                                                    *!/
/!* -------------------------------------------------------------------------- *!/

/!** Motivo pelo qual uma troca de status foi recusada pelo portal. *!/
export type UserStatusChangeFailureReason =
    | 'not-found'
    | 'self-deactivation'
    | 'last-active-administrator'
    /!** Ainda `pending`: não há o que ativar nem desativar antes de haver senha. *!/
    | 'pending-first-access'

/!**
 * Resultado explícito das operações de status: sucesso carrega a linha do
 * serviço (changed indica se houve transição real), a recusa do portal carrega o
 * motivo e a recusa do serviço carrega a frase dele.
 *!/
export type UserStatusChangeResult =
    | { ok: true; user: CoreUser; changed: boolean }
    | { ok: false; reason: UserStatusChangeFailureReason }
    | UserServiceFailure

/!** O que o formulário envia: dados básicos e os dois UUIDs escolhidos. *!/
export type UserFormInput = {
    name: string
    email: string
    /!** UUID da linha de `profile_types` escolhida no campo Perfil do Sistema. *!/
    profileSystemId: string
    /!** UUID da linha de `access` escolhida no campo Perfil de Acesso. *!/
    accessProfileId: string | null
}

/!**
 * Motivo pelo qual a atualização conjunta de dados, Perfil do Sistema e Perfil
 * de Acesso foi recusada pelo portal.
 *!/
export type UserDetailsUpdateFailureReason =
    | 'not-found'
    | 'invalid-name'
    | 'invalid-email'
    | 'email-taken'
    | 'self-access-change'
    | 'last-active-administrator'
    | UserAssignmentFailureReason

/!** Mesmo contrato das operações de status. *!/
export type UserDetailsUpdateResult =
    | { ok: true; user: CoreUser; changed: boolean }
    | { ok: false; reason: UserDetailsUpdateFailureReason }
    | UserServiceFailure

/!** Motivo pelo qual uma criação de usuário foi recusada pelo portal. *!/
export type UserCreateFailureReason =
    | 'invalid-name'
    | 'invalid-email'
    | 'email-taken'
    | UserAssignmentFailureReason

/!**
 * Contrato das demais operações, sem o `changed`: uma criação aceita sempre
 * acrescenta um usuário novo, então o sucesso carrega apenas o usuário criado.
 *!/
export type UserCreateResult =
    | { ok: true; user: CoreUser }
    | { ok: false; reason: UserCreateFailureReason }
    | UserServiceFailure

/!** Motivo pelo qual o portal recusou o reenvio antes de chamar o serviço. *!/
export type FirstAccessResendFailureReason =
    | 'not-found'
    /!** O usuário já definiu a senha: não há primeiro acesso a reenviar. *!/
    | 'already-active'
    /!** O link atual ainda está no prazo, e reenviar o derrubaria. *!/
    | 'invite-still-valid'

export type FirstAccessResendResult =
    | { ok: true; user: CoreUser }
    | { ok: false; reason: FirstAccessResendFailureReason }
    | UserServiceFailure

/!** Motivo pelo qual o portal recusou o cadastro direto da senha. *!/
export type FirstAccessPasswordFailureReason =
    | 'not-found'
    /!** O usuário já definiu a senha. Trocá-la não é papel deste caminho. *!/
    | 'already-active'
    /!** A senha não atende à regra de composição. *!/
    | 'weak-password'

export type FirstAccessPasswordResult =
    | { ok: true; user: CoreUser }
    | {
    ok: false
    reason: FirstAccessPasswordFailureReason
    /!** Frase do serviço, só quando ele recusou a senha. A tela tem a própria. *!/
    message?: string | null
}
    | UserServiceFailure

/!** Motivo pelo qual a troca de senha não aconteceu. *!/
export type UserPasswordChangeFailureReason =
    | 'not-found'
    /!**
     * Recusa do SERVIÇO, com a frase dele: senha do administrador incorreta, ou
     * conta que ainda não definiu senha nenhuma.
     *
     * Um motivo só para os dois casos porque o portal não tem como distingui-los
     * sem ler o texto da resposta, e não precisa: os dois viram a mesma coisa na
     * tela, a frase do serviço mostrada dentro do diálogo.
     *!/
    | 'refused'
    /!** A senha nova não atende à regra de composição. *!/
    | 'weak-password'

export type UserPasswordChangeResult =
    | { ok: true }
    | {
    ok: false
    reason: UserPasswordChangeFailureReason
    /!** Frase do serviço, quando é ele quem recusa. A tela tem a própria. *!/
    message?: string | null
}
    | UserServiceFailure

/!** As duas senhas de uma troca, cada uma de um dono diferente. *!/
export type UserPasswordChangeInput = {
    /!** A senha que a conta passa a ter. *!/
    newPassword: string
    /!**
     * A senha de QUEM ESTÁ TROCANDO, como confirmação de identidade.
     *
     * Objeto nomeado, e não dois parâmetros de texto em sequência, justamente
     * por isto: trocar a ordem de duas senhas na chamada mandaria a senha do
     * administrador para dentro da conta de outra pessoa, e nada no tipo
     * acusaria.
     *!/
    authenticatedPassword: string
}

class UsersService {

    /!* ---------------------------------------------------------------------- *!/
    /!* Chamadas cruas                                                        *!/
    /!* ---------------------------------------------------------------------- *!/

    /!** Cria o usuário. Exige Administrador. *!/
    private createCoreUser(payload: CoreUserCreate): Promise<CoreUser> {
        return apiService.post<CoreUser>('v1/users', payload)
    }

    /!** Altera só os campos enviados. Exige Administrador. *!/
    private updateCoreUser(id: string, payload: CoreUserUpdate): Promise<CoreUser> {
        return apiService.put<CoreUser>(`v1/users/${id}`, payload)
    }

    /!**
     * Troca a senha do usuário, confirmada com a senha de quem está autenticado.
     *
     * Não confundir com o `password` de `updateCoreUser`: lá o administrador grava
     * a primeira senha de quem ainda não tem nenhuma, sem confirmar nada; aqui a
     * conta já tem senha, e o serviço só troca contra a senha do próprio
     * administrador. A resposta traz só a frase de confirmação.
     *!/
    private changeCoreUserPassword(
        id: string,
        payload: CoreUserPasswordChange,
    ): Promise<{ message: string }> {
        return apiService.post<{ message: string }>(`v1/users/${id}/password`, payload)
    }

    /!**
     * Reenvia o e-mail de primeiro acesso, com um link novo de 10 minutos.
     *
     * O token anterior é DERRUBADO pelo serviço: o link antigo deixa de valer no
     * momento em que este é gerado. A resposta traz só a frase de confirmação, e o
     * link em si nunca chega ao portal fora de `ENV=local`.
     *!/
    private resendCoreFirstAccess(id: string): Promise<{ message: string }> {
        return apiService.post<{ message: string }>(`v1/users/${id}/first-access`)
    }

    /!* ---------------------------------------------------------------------- *!/
    /!* Leitura                                                               *!/
    /!* ---------------------------------------------------------------------- *!/

    /!** Usuário autenticado pelo token atual. Qualquer perfil pode chamar. *!/
    async getMe(): Promise<CoreUser> {
        return apiService.get<CoreUser>('v1/users/me')
    }

    /!**
     * Coleção completa de `users`, na ordem de CADASTRO, percorrendo as páginas do
     * serviço.
     *
     * A rota é paginada e o portal pagina no navegador: parar na primeira página
     * esconderia usuários sem dizer que eles existem. A ordem é a de criação, do
     * mais antigo para o mais novo, porque o serviço lista ao contrário e a tabela
     * depende disto para saltar até o usuário recém-criado depois de salvar.
     *!/
    async getUserList(): Promise<CoreUser[]> {
        const users: CoreUser[] = []

        for (let page = 1; ; page += 1) {
            const result = await apiService.get<PaginatedResponse<CoreUser>>('v1/users', {
                params: {page, size: PAGE_SIZE},
            })

            users.push(...result.list)

            if (!result.pagination.next || result.list.length === 0) break
        }

        return users.sort(compareByCreation)
    }

    /!**
     * A mesma coleção, já no domínio do portal.
     *
     * Custa uma leitura de `GET /access/{id}` por Perfil de Acesso distinto, e é
     * por isso que ela não é a leitura padrão da tela Usuários: quem precisa dos
     * departamentos e páginas concedidos de cada pessoa é a tela Perfis de acesso.
     *!/
    async listUsers(): Promise<User[]> {
        const translate = createCoreUserTranslator()

        return Promise.all((await this.getUserList()).map(translate))
    }

    /!** Usuário autenticado, já no domínio do portal. É o que a sessão guarda. *!/
    async getCurrentUser(): Promise<User> {
        const translate = createCoreUserTranslator()

        return translate(await this.getMe())
    }

    /!**
     * Carrega os catálogos do formulário a partir do serviço.
     *
     * Perfil do Sistema vem de `profile_types` e Perfil de Acesso vem de `access`.
     * A coleção de perfis é a mesma que a tela Perfis de acesso lista, e qualquer
     * usuário pode receber qualquer perfil.
     *
     * Uma leitura só, das duas fontes em paralelo. Quem chama decide quando reler.
     *!/
    async loadUserFormCatalog(): Promise<UserFormCatalog> {
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

    /!* ---------------------------------------------------------------------- *!/
    /!* Situação                                                              *!/
    /!* ---------------------------------------------------------------------- *!/

    /!**
     * Executa uma transição de status já autorizada: envia só a situação ao
     * serviço e devolve a linha que ele respondeu.
     *
     * O tipo do parâmetro exclui `pending` de propósito: o par ativar/desativar é
     * das contas que já têm senha, e sair de pendente é consequência de a senha
     * passar a existir, nunca de uma troca de situação enviada sozinha. O serviço
     * recusaria com `422`, e quem chama aqui já barrou antes.
     *!/
    private async applyStatusChange(
        current: CoreUser,
        status: 'active' | 'inactive',
    ): Promise<UserStatusChangeResult> {
        try {
            return {ok: true, user: await this.updateCoreUser(current.id, {status}), changed: true}
        } catch (cause) {
            return serviceFailure(cause)
        }
    }

    async deactivateUser(id: string, actor: UserActionActor): Promise<UserStatusChangeResult> {
        const normalized = id.trim()
        if (!normalized) return {ok: false, reason: 'not-found'}

        let collection: CoreUser[]
        try {
            collection = await this.getUserList()
        } catch (cause) {
            return serviceFailure(cause)
        }

        const current = collection.find((user) => user.id === normalized)
        if (!current) return {ok: false, reason: 'not-found'}

        // Pendente não se desativa: a conta ainda não entra no portal, e marcá-la
        // inativa a devolveria ao balde ambíguo que `pending` veio separar. O
        // serviço recusa igual, com `422`; esta guarda é a mesma regra que
        // desabilita o botão na linha, repetida aqui para que nenhum outro chamador a
        // contorne.
        if (current.status === 'pending') return {ok: false, reason: 'pending-first-access'}

        // Já inativo: idempotente, avaliado antes das proteções (não há nova desativação).
        if (current.status !== 'active') return {ok: true, user: current, changed: false}

        if (current.id === actor.id) return {ok: false, reason: 'self-deactivation'}

        if (isLastActiveAdministrator(collection, current)) {
            return {ok: false, reason: 'last-active-administrator'}
        }

        return this.applyStatusChange(current, 'inactive')
    }

    /!**
     * Reativação.
     *
     * Reativar é devolver o acesso a quem JÁ teve: só quem está inativo chega ao
     * serviço por aqui. Quem está pendente nunca teve senha, então não há acesso a
     * devolver, e o caminho dele é o primeiro acesso: o link do e-mail ou o
     * cadastro da senha pelo Administrador, que ativam a conta junto com a senha. O
     * serviço recusa o atalho com `422`, e a recusa aqui é a mesma regra, dita
     * antes da chamada.
     *!/
    async activateUser(id: string): Promise<UserStatusChangeResult> {
        const normalized = id.trim()
        if (!normalized) return {ok: false, reason: 'not-found'}

        let collection: CoreUser[]
        try {
            collection = await this.getUserList()
        } catch (cause) {
            return serviceFailure(cause)
        }

        const current = collection.find((user) => user.id === normalized)
        if (!current) return {ok: false, reason: 'not-found'}

        if (current.status === 'active') return {ok: true, user: current, changed: false}

        if (current.status === 'pending') return {ok: false, reason: 'pending-first-access'}

        return this.applyStatusChange(current, 'active')
    }

    /!* ---------------------------------------------------------------------- *!/
    /!* Edição                                                                *!/
    /!* ---------------------------------------------------------------------- *!/

    /!**
     * Atualiza dados básicos, perfil e acessos de um usuário em uma única chamada
     * ao serviço: as validações do portal acontecem todas antes, sobre a lista e
     * os catálogos recém-lidos, e só o que mudou é enviado. Se qualquer parte for
     * recusada, nada é enviado; se o serviço recusar, nada muda no portal e a frase
     * dele chega à tela.
     *
     * Dados básicos e acessos são avaliados separadamente, porque as proteções são
     * diferentes: o próprio Administrador pode editar seu nome e e-mail, mas uma
     * mudança de perfil ou de acessos sobre si mesmo é recusada. A proteção do
     * último Administrador ativo continua valendo para o alvo.
     *
     * O Perfil do Sistema e o Perfil de Acesso vão JUNTOS quando qualquer um dos
     * dois muda: a chave estrangeira do serviço exige que o perfil de acesso
     * exista, e mandar só um dos dois deixaria o par pela metade.
     *!/
    async updateUserDetails(
        id: string,
        input: UserFormInput,
        actor: UserActionActor,
    ): Promise<UserDetailsUpdateResult> {
        const normalizedId = id.trim()
        if (!normalizedId) return {ok: false, reason: 'not-found'}

        let collection: CoreUser[]
        try {
            collection = await this.getUserList()
        } catch (cause) {
            return serviceFailure(cause)
        }

        const current = collection.find((user) => user.id === normalizedId)
        if (!current) return {ok: false, reason: 'not-found'}

        const validation = validateBasicData(collection, current.id, input)
        if (!validation.ok) return {ok: false, reason: validation.reason}

        const {name, email} = validation

        const resolved = await resolveAssignment(input.profileSystemId, input.accessProfileId)
        if (!resolved.ok) return resolved

        const basicDataChanged = name !== current.name || email !== current.email
        const accessChanged =
            resolved.profile !== profileOf(current) ||
            resolved.accessProfileId !== normalizeStoredAccessProfileId(current.access_profile_id)

        // Nada mudou: idempotente, sem chamada ao serviço.
        if (!basicDataChanged && !accessChanged) {
            return {ok: true, user: current, changed: false}
        }

        // Autoedição: nome e e-mail seguem permitidos, perfil e acessos não.
        if (accessChanged && current.id === actor.id) {
            return {ok: false, reason: 'self-access-change'}
        }

        // O portal não pode ficar sem Administrador ativo: o último deles mantém o perfil.
        if (
            accessChanged &&
            resolved.profile !== 'Administrador' &&
            isLastActiveAdministrator(collection, current)
        ) {
            return {ok: false, reason: 'last-active-administrator'}
        }

        try {
            const payload: CoreUserUpdate = {}

            if (basicDataChanged) {
                payload.name = name
                payload.email = email
            }

            if (accessChanged) {
                payload.profile_system_id = resolved.profileSystemId
                payload.access_profile_id = resolved.accessProfileId
            }

            return {
                ok: true,
                user: await this.updateCoreUser(current.id, payload),
                changed: true,
            }
        } catch (cause) {
            return serviceFailure(cause)
        }
    }

    /!* ---------------------------------------------------------------------- *!/
    /!* Criação                                                               *!/
    /!* ---------------------------------------------------------------------- *!/

    /!**
     * Cria o usuário no serviço com os dados básicos e os perfis escolhidos no
     * formulário. As validações de nome, e-mail e escolha são as mesmas das
     * edições, com uma diferença: não existe alvo a preservar, então qualquer
     * e-mail já em uso, inclusive de usuários inativos, é recusado.
     *
     * O usuário nasce PENDENTE e sem senha, de propósito. É o fluxo de primeiro
     * acesso que a tela descreve: o serviço envia ao e-mail cadastrado o link em
     * que a própria pessoa define a senha, e é aí que a conta passa a ativa. O
     * serviço nem aceita o contrário: um usuário ativo exige senha no cadastro, e
     * senha digitada por um terceiro é senha que outra pessoa conheceu.
     *
     * `pending` diz na própria situação que a senha ainda não existe, e é o que
     * mantém a conta fora do par ativar/desativar até ela existir.
     *
     * O id vem do serviço (UUID).
     *!/
    async createUser(input: UserFormInput): Promise<UserCreateResult> {
        let collection: CoreUser[]
        try {
            collection = await this.getUserList()
        } catch (cause) {
            return serviceFailure(cause)
        }

        const validation = validateBasicData(collection, null, input)
        if (!validation.ok) return {ok: false, reason: validation.reason}

        const {name, email} = validation

        // Nenhum usuário nasce sem Perfil de Acesso válido: a recusa acontece aqui, e
        // não apenas no formulário, para que nenhum outro chamador possa contorná-la.
        const resolved = await resolveAssignment(input.profileSystemId, input.accessProfileId)
        if (!resolved.ok) return resolved

        try {
            const payload: CoreUserCreate = {
                name,
                email,
                profile_system_id: resolved.profileSystemId,
                access_profile_id: resolved.accessProfileId,
                status: 'pending',
            }

            return {ok: true, user: await this.createCoreUser(payload)}
        } catch (cause) {
            return serviceFailure(cause)
        }
    }

    /!* ---------------------------------------------------------------------- *!/
    /!* Primeiro acesso                                                       *!/
    /!* ---------------------------------------------------------------------- *!/

    /!**
     * Reenvia o convite de primeiro acesso e devolve o usuário com a validade nova.
     *
     * As duas recusas do portal existem para a pessoa receber uma frase, e não um
     * código HTTP, e valem contra a lista RECÉM-LIDA do serviço: o botão da tabela
     * pode estar olhando um estado de alguns minutos atrás, e o convite pode ter
     * sido usado ou reenviado por outro administrador nesse meio-tempo.
     *
     * `invite-still-valid` é a regra que justifica o botão desabilitado: cada
     * reenvio gera um token novo e mata o anterior, então disparar um segundo e-mail
     * enquanto o primeiro vale invalidaria justamente o link que a pessoa tem em
     * mãos.
     *
     * A releitura ao final não é enfeite: é dela que sai a nova
     * `set_password_expire`, e é ela que faz o botão voltar a ficar desabilitado
     * pelos próximos dez minutos.
     *!/
    async resendFirstAccess(id: string): Promise<FirstAccessResendResult> {
        const normalized = id.trim()
        if (!normalized) return {ok: false, reason: 'not-found'}

        let collection: CoreUser[]
        try {
            collection = await this.getUserList()
        } catch (cause) {
            return serviceFailure(cause)
        }

        const current = collection.find((user) => user.id === normalized)
        if (!current) return {ok: false, reason: 'not-found'}

        const state = firstAccessInviteState(current, new Date())
        if (state === 'not-applicable') return {ok: false, reason: 'already-active'}
        if (state === 'pending') return {ok: false, reason: 'invite-still-valid'}

        try {
            await this.resendCoreFirstAccess(normalized)

            const updated = (await this.getUserList()).find((user) => user.id === normalized)
            if (!updated) return {ok: false, reason: 'not-found'}

            return {ok: true, user: updated}
        } catch (cause) {
            return serviceFailure(cause)
        }
    }

    /!**
     * Cadastra a senha do usuário e ativa a conta, no lugar do link por e-mail.
     *
     * É a saída para o e-mail que nunca chega: sem ela, uma pessoa cadastrada em um
     * ambiente onde o envio falha fica inativa para sempre, porque o portal não tem
     * outro jeito de lhe dar uma senha.
     *
     * Senha e situação vão na MESMA chamada, e não em duas: o serviço recusa ativar
     * quem não tem senha (`422`), então separá-las deixaria uma janela em que a
     * primeira gravação passa e a segunda falha, com a conta parada no meio.
     *
     * O convite de primeiro acesso pendente é derrubado pelo serviço junto com a
     * gravação. O link que já estava na caixa de entrada deixa de valer, e ninguém
     * o usa depois para trocar a senha que o administrador acabou de definir.
     *
     * `already-active` recusa QUEM NÃO ESTÁ PENDENTE, e não só quem está ativo:
     * desativado também já definiu a senha, e dar-lhe uma senha nova por aqui
     * reativaria a conta de tabela, desfazendo a decisão de quem a desativou. Isso
     * não é primeiro acesso; a recuperação de senha e a reativação são os caminhos
     * dos dois casos.
     *
     * Nome distinto do `setFirstAccessPassword` de `services/auth/authService` de
     * propósito: lá quem define a senha é a PRÓPRIA pessoa, com o token do e-mail e
     * sem sessão; aqui é o administrador autenticado, pelo cadastro.
     *!/
    async setUserPassword(id: string, password: string): Promise<FirstAccessPasswordResult> {
        const normalized = id.trim()
        if (!normalized) return {ok: false, reason: 'not-found'}

        if (!isPasswordAccepted(password)) return {ok: false, reason: 'weak-password'}

        let collection: CoreUser[]
        try {
            collection = await this.getUserList()
        } catch (cause) {
            return serviceFailure(cause)
        }

        const current = collection.find((user) => user.id === normalized)
        if (!current) return {ok: false, reason: 'not-found'}
        if (current.status !== 'pending') return {ok: false, reason: 'already-active'}

        try {
            return {
                ok: true,
                user: await this.updateCoreUser(normalized, {password, status: 'active'}),
            }
        } catch (cause) {
            // `422` aqui é a regra de composição do serviço recusando a senha, e só
            // acontece se ela divergir da que o portal aplicou acima. A frase dele é
            // mais precisa, e chega limpa do prefixo técnico do Pydantic.
            if (cause instanceof ApiError && cause.status === 422) {
                return {
                    ok: false,
                    reason: 'weak-password',
                    message: authService.readableValidationMessage(cause.message),
                }
            }

            return serviceFailure(cause)
        }
    }

    /!* ---------------------------------------------------------------------- *!/
    /!* Troca de senha                                                        *!/
    /!* ---------------------------------------------------------------------- *!/

    /!**
     * Troca a senha de um usuário pelo cadastro, confirmada pela senha de quem está
     * autenticado.
     *
     * Caminho distinto de `setUserPassword`, logo acima, e a diferença é a conta
     * ter senha ou não: lá o administrador cadastra a PRIMEIRA senha de quem está
     * parado no primeiro acesso, e a conta é ativada junto; aqui a conta já entra no
     * portal, e a troca só acontece com a senha do próprio administrador.
     *
     * A senha da conta trocada não é pedida em lugar nenhum, e é o que faz este
     * caminho servir a quem esqueceu a própria senha.
     *
     * A composição da senha nova é conferida ANTES da chamada, como no cadastro:
     * é a mesma régua do serviço, e recusar aqui devolve a frase do portal em vez
     * de um 422.
     *
     * Nada é relido ao final. A troca não muda nenhuma coluna da tabela, e uma
     * recarga da lista aqui seria leitura à toa.
     *!/
    async changeUserPassword(
        id: string,
        {newPassword, authenticatedPassword}: UserPasswordChangeInput,
    ): Promise<UserPasswordChangeResult> {
        const normalized = id.trim()
        if (!normalized) return {ok: false, reason: 'not-found'}

        if (!isPasswordAccepted(newPassword)) return {ok: false, reason: 'weak-password'}

        try {
            await this.changeCoreUserPassword(normalized, {
                current_password: authenticatedPassword,
                new_password: newPassword,
            })

            return {ok: true}
        } catch (cause) {
            if (cause instanceof ApiError) {
                if (cause.status === 404) return {ok: false, reason: 'not-found'}

                // 400 é a recusa de regra do serviço, e a frase dele já é a explicação
                // final: a senha do administrador não confere, ou a conta ainda não
                // definiu senha nenhuma.
                if (cause.status === 400) {
                    return {ok: false, reason: 'refused', message: cause.message}
                }

                // 422 só acontece se a régua do serviço divergir da que o portal
                // aplicou acima; a frase dele é mais precisa que a genérica da tela.
                if (cause.status === 422) {
                    return {
                        ok: false,
                        reason: 'weak-password',
                        message: authService.readableValidationMessage(cause.message),
                    }
                }
            }

            return serviceFailure(cause)
        }
    }
}

export const usersService = new UsersService()

*/
