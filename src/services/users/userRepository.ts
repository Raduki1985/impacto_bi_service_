import {CoreApiError} from '../../data/api/coreApiClient'
import type {User} from '../../data/dashboardTypes'
import {normalizeStoredAccessProfileId} from '../../lib/accessProfileRules'
import {firstAccessInviteState} from '../../lib/firstAccessInvite'
import {isPasswordAccepted} from '../../lib/passwordPolicy'
import {readableValidationMessage} from '../auth/passwordFlows'
import {isValidUserEmail} from '../../lib/userEmail'
import type {UserProfile} from '../../types/access'
import type {CoreUserCreate, CoreUserUpdate} from '../../types/coreApi'
import {fetchAllCoreAccesses, loadCoreProfileTypes} from '../accessProfiles/accessProfileApi'
import {
    changeCoreUserPassword,
    createCoreUser,
    createCoreUserTranslator,
    fetchAllCoreUsers,
    resendCoreFirstAccess,
    updateCoreUser,
} from './userApi'
import {compareByCreation, CoreUserMappingError, userProfileFromCode} from './userApiMapper'

/**
 * Acesso central à coleção de usuários, que vive no `impacto-bi-service`.
 *
 * A base mockada acabou: não existe mais seed, nem armazenamento local, e
 * nenhum usuário nasce no navegador. Toda leitura e toda gravação passam pelo
 * serviço, e é ele quem confere e-mail repetido, tipo de perfil, perfil de
 * acesso e quem pode fazer o quê.
 *
 * Perfil do Sistema e Perfil de Acesso são os do serviço: o formulário escolhe
 * entre as linhas de `profile_types` e de `access`, e os dois UUIDs vão direto
 * na gravação.
 *
 * O que continua no portal, e por quê:
 *
 * - as REGRAS que o serviço não conhece e a tela sempre teve: nome obrigatório,
 *   formato do e-mail, idempotência (salvar sem mudar nada não grava), a
 *   proteção do último Administrador ativo e a recusa da autoedição de perfil.
 *   Elas rodam contra a lista RECÉM-LIDA do serviço, antes da chamada, para a
 *   pessoa receber a mensagem do portal, e não um código HTTP;
 * - a CONFERÊNCIA da escolha contra os catálogos do serviço, pelo mesmo motivo:
 *   tipo inexistente, perfil inexistente e perfil de outro tipo viram frases do
 *   portal antes de virar um 422;
 * O HISTÓRICO saiu daqui. As operações gravavam um evento no `localStorage` do
 * navegador depois de o serviço confirmar; esse registro foi removido e nada o
 * substitui, porque o serviço ainda não expõe auditoria.
 *
 * Toda leitura devolve cópias defensivas: nenhuma referência interna escapa.
 */

/* -------------------------------------------------------------------------- */
/* Cópias                                                                     */

/* -------------------------------------------------------------------------- */

/** Campos mutáveis ganham arrays e objetos novos; os primitivos vêm pelo spread. */
function cloneUser(user: User): User {
    return {
        ...user,
        permissionKeys: [...user.permissionKeys],
        departments: [...user.departments],
        departmentPageAccess: user.departmentPageAccess.map((access) => ({
            ...access,
            pageKeys: [...access.pageKeys],
        })),
        audit: user.audit ? {...user.audit} : undefined,
    }
}

function cloneUsers(users: readonly User[]): User[] {
    return users.map(cloneUser)
}

/* -------------------------------------------------------------------------- */
/* Falha do serviço                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Recusa vinda do serviço, ou falha ao falar com ele.
 *
 * Carrega a FRASE, e não um código, ao contrário das demais recusas deste
 * módulo: o serviço explica a própria recusa (`Email já cadastrado`, `Usuário
 * sem senha definida não pode ser ativado`), e traduzi-la para um código fechado
 * perderia justamente a parte útil. `reason` fixo é o que permite à tela
 * distinguir esta variante das que ela traduz sozinha.
 */
export type UserServiceFailure = { ok: false; reason: 'service-failure'; message: string }

function serviceFailure(cause: unknown): UserServiceFailure {
    if (cause instanceof CoreApiError || cause instanceof CoreUserMappingError) {
        return {ok: false, reason: 'service-failure', message: cause.message}
    }

    return {
        ok: false,
        reason: 'service-failure',
        message: 'Falha inesperada ao falar com o serviço do portal.',
    }
}

/* -------------------------------------------------------------------------- */
/* Leitura                                                                    */
/* -------------------------------------------------------------------------- */

export type UserListResult = { ok: true; users: User[] } | UserServiceFailure

/**
 * Lista completa do serviço, já no domínio do portal e na ordem de cadastro.
 *
 * É a única porta pela qual a coleção entra no portal: a tabela de Usuários, as
 * validações das gravações e a tela Perfis de acesso enxergam o que saiu daqui.
 */
export async function loadUsers(): Promise<UserListResult> {
    try {
        const translate = createCoreUserTranslator()
        const cores = [...(await fetchAllCoreUsers())].sort(compareByCreation)
        const users = await Promise.all(cores.map(translate))

        return {ok: true, users: cloneUsers(users)}
    } catch (cause) {
        return serviceFailure(cause)
    }
}

/* -------------------------------------------------------------------------- */
/* Responsável pela operação                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Responsável por uma operação sobre usuários: o Administrador autenticado que
 * a executou.
 *
 * Continua entrando nas operações porque é ele que as regras do portal leem
 * para reconhecer a autoedição — desativar a si mesmo, trocar o próprio perfil.
 * Não alimenta registro nenhum: o Histórico do navegador foi removido, e as
 * operações que não consultam o responsável deixaram de recebê-lo.
 */
export type UserActionActor = Pick<User, 'id' | 'name'>

/* -------------------------------------------------------------------------- */
/* Regras do portal                                                           */

/* -------------------------------------------------------------------------- */

/**
 * true quando o usuário é o único Administrador ativo da coleção. Regra única
 * da proteção, compartilhada pela desativação e pelas edições de perfil: o
 * portal nunca pode ficar sem nenhum Administrador ativo.
 */
function isLastActiveAdministrator(collection: readonly User[], current: User): boolean {
    if (current.profile !== 'Administrador' || current.status !== 'Ativo') return false

    const activeAdministrators = collection.filter(
        (user) => user.profile === 'Administrador' && user.status === 'Ativo',
    ).length

    return activeAdministrators <= 1
}

/** Nome e e-mail normalizados, ou o motivo da recusa. */
type BasicDataValidation =
    | { ok: true; name: string; email: string }
    | { ok: false; reason: 'invalid-name' | 'invalid-email' | 'email-taken' }

/**
 * Regra única de validação dos dados básicos, compartilhada pelas edições e
 * pela criação: nome sem espaços nas pontas e obrigatório, e-mail sem espaços,
 * em caixa baixa e no formato simples, e nenhum outro id usando o mesmo
 * e-mail. Nas edições, `currentId` identifica o alvo, que pode manter o
 * próprio e-mail; na criação não há alvo (null) e qualquer e-mail já em uso,
 * inclusive de usuários inativos, é recusado.
 *
 * O serviço confere o e-mail de novo e responde `409`; a conferência aqui
 * existe para a recusa chegar com a frase do portal, antes da chamada.
 */
function validateBasicData(
    collection: readonly User[],
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

/**
 * Por que a escolha de Perfil do Sistema e Perfil de Acesso foi recusada.
 *
 * As quatro recusas são coisas diferentes e continuam diferentes até a
 * interface: tipo que sumiu, escolha que falta, perfil que não existe mais e
 * catálogo que não pôde ser lido pedem correções diferentes.
 *
 * `incompatible-access-profile` era a quinta, e saiu: um Perfil de Acesso não
 * pertence mais a um tipo de perfil, então não existe par incompatível.
 */
export type UserAssignmentFailureReason =
    | 'unknown-system-profile'
    | 'access-profile-required'
    | 'unknown-access-profile'
    | 'access-profile-unavailable'

/** Escolha conferida contra os catálogos do serviço, pronta para a gravação. */
type ResolvedAssignment =
    | { ok: true; profile: UserProfile; profileSystemId: string; accessProfileId: string }
    | { ok: false; reason: UserAssignmentFailureReason }
    | UserServiceFailure

/**
 * Única porta pela qual a escolha do formulário vira os dois UUIDs enviados ao
 * serviço.
 *
 * Os catálogos são relidos aqui, e não confiados ao formulário: entre abrir o
 * modal e clicar em Salvar, um perfil de acesso pode ter sido excluído na tela
 * Perfis de acesso. O tipo precisa existir e ser um dos três que o portal sabe
 * ler; o perfil de acesso precisa existir e pertencer àquele tipo, que é a
 * mesma exigência da chave estrangeira do serviço.
 */
async function resolveAssignment(
    profileSystemId: string,
    accessProfileId: string | null,
): Promise<ResolvedAssignment> {
    let types: Awaited<ReturnType<typeof loadCoreProfileTypes>>
    let accesses: Awaited<ReturnType<typeof fetchAllCoreAccesses>>

    try {
        ;[types, accesses] = await Promise.all([loadCoreProfileTypes(), fetchAllCoreAccesses()])
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

/* -------------------------------------------------------------------------- */
/* Situação                                                                   */
/* -------------------------------------------------------------------------- */

/** Motivo pelo qual uma troca de status foi recusada pelo portal. */
export type UserStatusChangeFailureReason =
    | 'not-found'
    | 'self-deactivation'
    | 'last-active-administrator'
    /** Ainda `Pendente`: não há o que ativar nem desativar antes de haver senha. */
    | 'pending-first-access'

/**
 * Resultado explícito das operações de status: sucesso carrega o usuário
 * (changed indica se houve transição real), a recusa do portal carrega o motivo
 * e a recusa do serviço carrega a frase dele.
 */
export type UserStatusChangeResult =
    | {
    ok: true
    user: User
    changed: boolean
}
    | {
    ok: false
    reason: UserStatusChangeFailureReason
}
    | UserServiceFailure

/**
 * Executa uma transição de status já autorizada: envia só a situação ao
 * serviço e traduz o usuário que ele devolveu.
 *
 * O tipo do parâmetro exclui `Pendente` de propósito: o par ativar/desativar é
 * das contas que já têm senha, e sair de pendente é consequência de a senha
 * passar a existir, nunca de uma troca de situação enviada sozinha. O serviço
 * recusaria com `422`, e quem chama aqui já barrou antes.
 */
async function applyStatusChange(
    current: User,
    status: 'Ativo' | 'Inativo',
): Promise<UserStatusChangeResult> {
    try {
        const translate = createCoreUserTranslator()
        const updated = await translate(
            await updateCoreUser(current.id, {status: status === 'Ativo' ? 'active' : 'inactive'}),
        )

        return {ok: true, user: cloneUser(updated), changed: true}
    } catch (cause) {
        return serviceFailure(cause)
    }
}

export async function deactivateUser(
    id: string,
    actor: UserActionActor,
): Promise<UserStatusChangeResult> {
    const normalized = id.trim()
    if (!normalized) return {ok: false, reason: 'not-found'}

    const loaded = await loadUsers()
    if (!loaded.ok) return loaded

    const collection = loaded.users
    const current = collection.find((user) => user.id === normalized)
    if (!current) return {ok: false, reason: 'not-found'}

    // Pendente não se desativa: a conta ainda não entra no portal, e marcá-la
    // inativa a devolveria ao balde ambíguo que `Pendente` veio separar. O
    // serviço recusa igual, com `422`; esta guarda é a mesma regra que
    // desabilita o botão na linha, repetida aqui para que nenhum outro chamador a
    // contorne.
    if (current.status === 'Pendente') return {ok: false, reason: 'pending-first-access'}

    // Já Inativo: idempotente, avaliado antes das proteções (não há nova desativação).
    if (current.status === 'Inativo') return {ok: true, user: cloneUser(current), changed: false}

    if (current.id === actor.id) return {ok: false, reason: 'self-deactivation'}

    if (isLastActiveAdministrator(collection, current)) {
        return {ok: false, reason: 'last-active-administrator'}
    }

    return applyStatusChange(current, 'Inativo')
}

/**
 * Reativação.
 *
 * Reativar é devolver o acesso a quem JÁ teve: só `Inativo` chega ao serviço por
 * aqui. Quem está `Pendente` nunca teve senha, então não há acesso a devolver, e
 * o caminho dele é o primeiro acesso: o link do e-mail ou o cadastro da senha pelo
 * Administrador, que ativam a conta junto com a senha. O serviço recusa o atalho
 * com `422`, e a recusa aqui é a mesma regra, dita antes da chamada.
 */
export async function activateUser(id: string): Promise<UserStatusChangeResult> {
    const normalized = id.trim()
    if (!normalized) return {ok: false, reason: 'not-found'}

    const loaded = await loadUsers()
    if (!loaded.ok) return loaded

    const current = loaded.users.find((user) => user.id === normalized)
    if (!current) return {ok: false, reason: 'not-found'}

    if (current.status === 'Ativo') return {ok: true, user: cloneUser(current), changed: false}

    if (current.status === 'Pendente') return {ok: false, reason: 'pending-first-access'}

    return applyStatusChange(current, 'Ativo')
}

/* -------------------------------------------------------------------------- */
/* Edição                                                                     */
/* -------------------------------------------------------------------------- */

/** O que o formulário envia: dados básicos e os dois UUIDs escolhidos. */
export type UserFormInput = {
    name: string
    email: string
    /** UUID da linha de `profile_types` escolhida no campo Perfil do Sistema. */
    profileSystemId: string
    /** UUID da linha de `access` escolhida no campo Perfil de Acesso. */
    accessProfileId: string | null
}

/**
 * Motivo pelo qual a atualização conjunta de dados, Perfil do Sistema e Perfil
 * de Acesso foi recusada pelo portal.
 */
export type UserDetailsUpdateFailureReason =
    | 'not-found'
    | 'invalid-name'
    | 'invalid-email'
    | 'email-taken'
    | 'self-access-change'
    | 'last-active-administrator'
    | UserAssignmentFailureReason

/** Mesmo contrato das operações de status. */
export type UserDetailsUpdateResult =
    | {
    ok: true
    user: User
    changed: boolean
}
    | {
    ok: false
    reason: UserDetailsUpdateFailureReason
}
    | UserServiceFailure

/**
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
 * pertença ao tipo de perfil, e mandar só um dos dois seria recusado.
 */
export async function updateUserDetails(
    id: string,
    input: UserFormInput,
    actor: UserActionActor,
): Promise<UserDetailsUpdateResult> {
    const normalizedId = id.trim()
    if (!normalizedId) return {ok: false, reason: 'not-found'}

    const loaded = await loadUsers()
    if (!loaded.ok) return loaded

    const collection = loaded.users
    const current = collection.find((user) => user.id === normalizedId)
    if (!current) return {ok: false, reason: 'not-found'}

    const validation = validateBasicData(collection, current.id, input)
    if (!validation.ok) return {ok: false, reason: validation.reason}

    const {name, email} = validation

    const resolved = await resolveAssignment(input.profileSystemId, input.accessProfileId)
    if (!resolved.ok) return resolved

    const basicDataChanged = name !== current.name || email !== current.email
    const accessChanged =
        resolved.profile !== current.profile ||
        resolved.accessProfileId !== normalizeStoredAccessProfileId(current.accessProfileId)

    // Nada mudou: idempotente, sem chamada ao serviço.
    if (!basicDataChanged && !accessChanged) {
        return {ok: true, user: cloneUser(current), changed: false}
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

        const translate = createCoreUserTranslator()
        const updated = await translate(await updateCoreUser(current.id, payload))

        return {ok: true, user: cloneUser(updated), changed: true}
    } catch (cause) {
        return serviceFailure(cause)
    }
}

/* -------------------------------------------------------------------------- */
/* Criação                                                                    */
/* -------------------------------------------------------------------------- */

/** Motivo pelo qual uma criação de usuário foi recusada pelo portal. */
export type UserCreateFailureReason =
    | 'invalid-name'
    | 'invalid-email'
    | 'email-taken'
    | UserAssignmentFailureReason

/** Contrato das demais operações, sem o `changed`: uma criação aceita sempre
 acrescenta um usuário novo, então o sucesso carrega apenas o usuário criado. */
export type UserCreateResult =
    | {
    ok: true
    user: User
}
    | {
    ok: false
    reason: UserCreateFailureReason
}
    | UserServiceFailure

/**
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
 * mantém a conta fora do par ativar/desativar até ela existir. Era `inactive`
 * aqui, o mesmo valor de quem um Administrador desativou, e a tela precisava
 * distinguir os dois pela validade do convite.
 *
 * O id vem do serviço (UUID).
 */
export async function createUser(input: UserFormInput): Promise<UserCreateResult> {
    const loaded = await loadUsers()
    if (!loaded.ok) return loaded

    const validation = validateBasicData(loaded.users, null, input)
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

        const translate = createCoreUserTranslator()
        const created = await translate(await createCoreUser(payload))

        return {ok: true, user: cloneUser(created)}
    } catch (cause) {
        return serviceFailure(cause)
    }
}

/* -------------------------------------------------------------------------- */
/* Primeiro acesso                                                            */
/* -------------------------------------------------------------------------- */

/** Motivo pelo qual o portal recusou o reenvio antes de chamar o serviço. */
export type FirstAccessResendFailureReason =
    | 'not-found'
    /** O usuário já definiu a senha: não há primeiro acesso a reenviar. */
    | 'already-active'
    /** O link atual ainda está no prazo, e reenviar o derrubaria. */
    | 'invite-still-valid'

export type FirstAccessResendResult =
    | { ok: true; user: User }
    | { ok: false; reason: FirstAccessResendFailureReason }
    | UserServiceFailure

/**
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
 * `firstAccessExpiresAt`, e é ela que faz o botão voltar a ficar desabilitado
 * pelos próximos dez minutos.
 */
export async function resendFirstAccess(id: string): Promise<FirstAccessResendResult> {
    const normalized = id.trim()
    if (!normalized) return {ok: false, reason: 'not-found'}

    const loaded = await loadUsers()
    if (!loaded.ok) return loaded

    const current = loaded.users.find((user) => user.id === normalized)
    if (!current) return {ok: false, reason: 'not-found'}

    const state = firstAccessInviteState(current, new Date())
    if (state === 'not-applicable') return {ok: false, reason: 'already-active'}
    if (state === 'pending') return {ok: false, reason: 'invite-still-valid'}

    try {
        await resendCoreFirstAccess(normalized)

        const refreshed = await loadUsers()
        if (!refreshed.ok) return refreshed

        const updated = refreshed.users.find((user) => user.id === normalized)
        if (!updated) return {ok: false, reason: 'not-found'}

        return {ok: true, user: cloneUser(updated)}
    } catch (cause) {
        return serviceFailure(cause)
    }
}

/** Motivo pelo qual o portal recusou o cadastro direto da senha. */
export type FirstAccessPasswordFailureReason =
    | 'not-found'
    /** O usuário já definiu a senha. Trocá-la não é papel deste caminho. */
    | 'already-active'
    /** A senha não atende à regra de composição. */
    | 'weak-password'

export type FirstAccessPasswordResult =
    | { ok: true; user: User }
    | {
    ok: false
    reason: FirstAccessPasswordFailureReason
    /** Frase do serviço, só quando ele recusou a senha. A tela tem a própria. */
    message?: string | null
}
    | UserServiceFailure

/**
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
 * reativaria a conta de tabela, desfazendo a decisão de quem a desativou. Isso não
 * é primeiro acesso; a recuperação de senha e a reativação são os caminhos dos
 * dois casos.
 *
 * Nome distinto do `setFirstAccessPassword` de `services/auth/passwordFlows` de
 * propósito: lá quem define a senha é a PRÓPRIA pessoa, com o token do e-mail e
 * sem sessão; aqui é o administrador autenticado, pelo cadastro.
 */
export async function setUserPassword(
    id: string,
    password: string,
): Promise<FirstAccessPasswordResult> {
    const normalized = id.trim()
    if (!normalized) return {ok: false, reason: 'not-found'}

    if (!isPasswordAccepted(password)) return {ok: false, reason: 'weak-password'}

    const loaded = await loadUsers()
    if (!loaded.ok) return loaded

    const current = loaded.users.find((user) => user.id === normalized)
    if (!current) return {ok: false, reason: 'not-found'}
    if (current.status !== 'Pendente') return {ok: false, reason: 'already-active'}

    try {
        const translate = createCoreUserTranslator()
        const updated = await translate(
            await updateCoreUser(normalized, {password, status: 'active'}),
        )

        return {ok: true, user: cloneUser(updated)}
    } catch (cause) {
        // `422` aqui é a regra de composição do serviço recusando a senha, e só
        // acontece se ela divergir da que o portal aplicou acima. A frase dele é
        // mais precisa, e chega limpa do prefixo técnico do Pydantic.
        if (cause instanceof CoreApiError && cause.status === 422) {
            return {
                ok: false,
                reason: 'weak-password',
                message: readableValidationMessage(cause.message),
            }
        }

        return serviceFailure(cause)
    }
}


/* -------------------------------------------------------------------------- */
/* Troca de senha                                                             */
/* -------------------------------------------------------------------------- */

/** Motivo pelo qual a troca de senha não aconteceu. */
export type UserPasswordChangeFailureReason =
    | 'not-found'
    /**
     * Recusa do SERVIÇO, com a frase dele: senha do administrador incorreta, ou
     * conta que ainda não definiu senha nenhuma.
     *
     * Um motivo só para os dois casos porque o portal não tem como distingui-los
     * sem ler o texto da resposta, e não precisa: os dois viram a mesma coisa na
     * tela, a frase do serviço mostrada dentro do diálogo.
     */
    | 'refused'
    /** A senha nova não atende à regra de composição. */
    | 'weak-password'

export type UserPasswordChangeResult =
    | { ok: true }
    | {
    ok: false
    reason: UserPasswordChangeFailureReason
    /** Frase do serviço, quando é ele quem recusa. A tela tem a própria. */
    message?: string | null
}
    | UserServiceFailure

/** As duas senhas de uma troca, cada uma de um dono diferente. */
export type UserPasswordChangeInput = {
    /** A senha que a conta passa a ter. */
    newPassword: string
    /**
     * A senha de QUEM ESTÁ TROCANDO, como confirmação de identidade.
     *
     * Objeto nomeado, e não dois parâmetros de texto em sequência, justamente
     * por isto: trocar a ordem de duas senhas na chamada mandaria a senha do
     * administrador para dentro da conta de outra pessoa, e nada no tipo
     * acusaria.
     */
    authenticatedPassword: string
}

/**
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
 */
export async function changeUserPassword(
    id: string,
    {newPassword, authenticatedPassword}: UserPasswordChangeInput,
): Promise<UserPasswordChangeResult> {
    const normalized = id.trim()
    if (!normalized) return {ok: false, reason: 'not-found'}

    if (!isPasswordAccepted(newPassword)) return {ok: false, reason: 'weak-password'}

    try {
        await changeCoreUserPassword(normalized, {
            current_password: authenticatedPassword,
            new_password: newPassword,
        })

        return {ok: true}
    } catch (cause) {
        if (cause instanceof CoreApiError) {
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
                    message: readableValidationMessage(cause.message),
                }
            }
        }

        return serviceFailure(cause)
    }
}
