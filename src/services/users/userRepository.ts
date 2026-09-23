import {departmentPages} from '../../config/departmentPages'
import {CoreApiError} from '../../data/api/coreApiClient'
import type {User} from '../../data/dashboardTypes'
import {normalizeStoredAccessProfileId} from '../../lib/accessProfileRules'
import {findDepartment} from '../../lib/userAccessRules'
import {isValidUserEmail} from '../../lib/userEmail'
import type {UserProfile} from '../../types/access'
import type {CoreUserCreate, CoreUserUpdate} from '../../types/coreApi'
import type {UserHistoryAction, UserHistoryEvent} from '../../types/userHistory'
import {fetchAllCoreAccesses, loadCoreProfileTypes} from '../accessProfiles/accessProfileApi'
import {createCoreUser, createCoreUserTranslator, fetchAllCoreUsers, updateCoreUser,} from './userApi'
import {compareByCreation, CoreUserMappingError, userProfileFromCode} from './userApiMapper'
import {appendStoredUserHistoryEvent} from './userHistoryStorage'

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
 * - o HISTÓRICO, que o serviço não expõe. Os eventos continuam sendo gravados no
 *   navegador, depois de o serviço confirmar, com o mesmo vocabulário de sempre.
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
/* Histórico                                                                  */
/* -------------------------------------------------------------------------- */

/** Responsável por uma operação sobre usuários, registrado na auditoria. */
export type UserActionActor = Pick<User, 'id' | 'name'>

/** Sequência da execução: garante ids distintos para eventos do mesmo instante. */
let historyEventSequence = 0

function nextHistoryEventId(occurredAt: string, targetUserId: string): string {
    historyEventSequence += 1

    return `${occurredAt}-${targetUserId}-${historyEventSequence}`
}

/** Monta o evento a partir do estado já calculado da operação. */
function buildHistoryEvent(
    action: UserHistoryAction,
    occurredAt: string,
    target: User,
    actor: UserActionActor,
    details: string[],
): UserHistoryEvent {
    return {
        id: nextHistoryEventId(occurredAt, target.id),
        action,
        occurredAt,
        targetUserId: target.id,
        // Nome do momento do evento: renomear o usuário depois não reescreve o passado.
        targetUserName: target.name,
        actorUserId: actor.id,
        actorName: actor.name,
        details,
    }
}

/**
 * Grava o evento no Histórico do navegador.
 *
 * Depois do serviço confirmar, e nunca antes: o evento descreve o que
 * aconteceu, e o que aconteceu foi decidido lá. Um Histórico ilegível, ou um
 * armazenamento que recusa, perdem o REGISTRO local, e não a alteração, que já
 * está feita. Por isso nada aqui vira erro para quem chamou.
 */
function recordHistory(event: UserHistoryEvent): void {
    appendStoredUserHistoryEvent(event)
}

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
/* Descrição das alterações para o Histórico                                  */

/* -------------------------------------------------------------------------- */

/** Rótulo oficial do departamento; fora do catálogo, o próprio id. */
function departmentLabelOf(departmentId: string): string {
    return findDepartment(departmentId)?.label ?? departmentId
}

/** Rótulo oficial da página; fora do catálogo, a própria chave técnica. */
function pageLabelOf(departmentId: string, pageKey: string): string {
    const area = findDepartment(departmentId)
    if (!area) return pageKey

    return departmentPages[area.id].find((page) => page.key === pageKey)?.label ?? pageKey
}

/** Enumeração legível em português: 'A', 'A e B', 'A, B e C'. Lista vazia
 devolve string vazia, e quem chama decide se a linha faz sentido. */
function formatList(items: readonly string[]): string {
    if (items.length === 0) return ''
    if (items.length === 1) return items[0]

    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/**
 * O que o usuário enxerga, em uma frase. Administrador e Executivo têm alcance
 * fixo pelo perfil, então enumerar os departamentos deles só faria a linha
 * crescer sem informar nada. O Analista é o único com escopo
 * escolhido, e por isso é o único listado.
 *
 * "Nenhum departamento" cobre o perfil de acesso ainda sem menus no serviço: o
 * Histórico descreve o que encontrou, não o que deveria existir.
 */
function visibilityScopeOf(user: User): string {
    if (user.profile === 'Administrador') return 'Todos os departamentos e páginas'
    if (user.profile === 'Executivo') return 'Todos os departamentos'

    return user.departments.length ? formatList(user.departments) : 'Nenhum departamento'
}

/**
 * Descreve, em texto legível, o que mudou entre o usuário anterior e o
 * atualizado. Só entram campos realmente alterados, na ordem nome, e-mail,
 * perfil, escopo de visualização, departamentos e páginas.
 *
 * Troca de perfil é resumida, não detalhada: o perfil já redefine departamentos
 * e páginas por inteiro, então a comparação granular listaria dezenas de linhas
 * para descrever uma única decisão. Nesse caso o par de escopos diz tudo, e a
 * comparação item a item nem chega a rodar.
 *
 * Com o perfil mantido, a comparação granular acontece, agrupada: um texto para
 * os departamentos que entraram, um para os que saíram e um por departamento
 * para as páginas. Departamento inteiro que entra ou sai não repete as páginas
 * dele, então a comparação página a página fica nos departamentos presentes
 * antes e depois.
 */
function buildUpdateDetails(previous: User, updated: User): string[] {
    const details: string[] = []

    if (previous.name !== updated.name) {
        details.push(`Nome alterado: ${previous.name} → ${updated.name}`)
    }
    if (previous.email !== updated.email) {
        details.push(`E-mail alterado: ${previous.email} → ${updated.email}`)
    }

    // Nome e e-mail já entraram: a troca de perfil resume os acessos e encerra,
    // sem descartar o que mudou junto com ela.
    if (previous.profile !== updated.profile) {
        details.push(`Perfil alterado: ${previous.profile} → ${updated.profile}`)

        if (updated.profile === 'Administrador') {
            details.push('Acesso administrativo global concedido')
        } else if (previous.profile === 'Administrador') {
            details.push('Acesso administrativo global removido')
        }

        details.push(
            `Escopo de visualização: ${visibilityScopeOf(previous)} → ${visibilityScopeOf(updated)}`,
        )

        return details
    }

    const previousAccess = new Map(
        previous.departmentPageAccess.map((access) => [access.departmentId, access.pageKeys]),
    )
    const updatedAccess = new Map(
        updated.departmentPageAccess.map((access) => [access.departmentId, access.pageKeys]),
    )

    const addedDepartments: string[] = []
    const removedDepartments: string[] = []

    for (const departmentId of updatedAccess.keys()) {
        if (!previousAccess.has(departmentId)) addedDepartments.push(departmentLabelOf(departmentId))
    }

    for (const departmentId of previousAccess.keys()) {
        if (!updatedAccess.has(departmentId)) removedDepartments.push(departmentLabelOf(departmentId))
    }

    if (addedDepartments.length) {
        const label = addedDepartments.length === 1 ? 'Departamento adicionado' : 'Departamentos adicionados'
        details.push(`${label}: ${formatList(addedDepartments)}`)
    }

    if (removedDepartments.length) {
        const label = removedDepartments.length === 1 ? 'Departamento removido' : 'Departamentos removidos'
        details.push(`${label}: ${formatList(removedDepartments)}`)
    }

    // Duas listas separadas para que todas as liberações apareçam antes de todas
    // as remoções, mesmo com vários departamentos alterados na mesma edição.
    const addedPages: string[] = []
    const removedPages: string[] = []

    for (const [departmentId, pageKeys] of updatedAccess) {
        const previousPageKeys = previousAccess.get(departmentId)
        if (!previousPageKeys) continue

        const department = departmentLabelOf(departmentId)

        const added = pageKeys
            .filter((pageKey) => !previousPageKeys.includes(pageKey))
            .map((pageKey) => pageLabelOf(departmentId, pageKey))
        const removed = previousPageKeys
            .filter((pageKey) => !pageKeys.includes(pageKey))
            .map((pageKey) => pageLabelOf(departmentId, pageKey))

        if (added.length) {
            const label = added.length === 1 ? 'Página liberada em' : 'Páginas liberadas em'
            addedPages.push(`${label} ${department}: ${formatList(added)}`)
        }

        if (removed.length) {
            const label = removed.length === 1 ? 'Página removida de' : 'Páginas removidas de'
            removedPages.push(`${label} ${department}: ${formatList(removed)}`)
        }
    }

    details.push(...addedPages, ...removedPages)

    // Rede de segurança: uma alteração de acesso que nenhuma linha acima soube
    // descrever (troca de Perfil de Acesso com as mesmas concessões, por
    // exemplo) ainda precisa aparecer.
    if (!details.length) details.push('Acessos atualizados.')

    return details
}

/**
 * Descreve o cadastro no Histórico: perfil, status e escopo de visualização
 * iniciais, na mesma linguagem das edições. Como na troca de perfil de uma
 * edição, os acessos aparecem resumidos pelo escopo, não página a página: o
 * cadastro estabelece o perfil, e o escopo diz o que ele enxerga.
 */
function buildCreationDetails(user: User): string[] {
    const details = [
        `Perfil inicial: ${user.profile}`,
        `Status inicial: ${user.status}`,
        `Escopo de visualização: ${visibilityScopeOf(user)}`,
    ]

    if (user.profile === 'Administrador') details.push('Acesso administrativo global concedido')

    return details
}

/* -------------------------------------------------------------------------- */
/* Situação                                                                   */
/* -------------------------------------------------------------------------- */

/** Motivo pelo qual uma troca de status foi recusada pelo portal. */
export type UserStatusChangeFailureReason =
    | 'not-found'
    | 'self-deactivation'
    | 'last-active-administrator'

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
 * serviço, traduz o usuário que ele devolveu e registra o evento de Histórico
 * com o timestamp da confirmação.
 */
async function applyStatusChange(
    current: User,
    actor: UserActionActor,
    status: User['status'],
    action: UserHistoryAction,
): Promise<UserStatusChangeResult> {
    try {
        const translate = createCoreUserTranslator()
        const updated = await translate(
            await updateCoreUser(current.id, {status: status === 'Ativo' ? 'active' : 'inactive'}),
        )

        recordHistory(
            buildHistoryEvent(action, new Date().toISOString(), updated, actor, [
                `Status alterado: ${current.status} → ${updated.status}`,
            ]),
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

    // Já Inativo: idempotente, avaliado antes das proteções (não há nova desativação).
    if (current.status === 'Inativo') return {ok: true, user: cloneUser(current), changed: false}

    if (current.id === actor.id) return {ok: false, reason: 'self-deactivation'}

    if (isLastActiveAdministrator(collection, current)) {
        return {ok: false, reason: 'last-active-administrator'}
    }

    return applyStatusChange(current, actor, 'Inativo', 'deactivated')
}

/**
 * Reativação.
 *
 * O serviço recusa reativar quem nunca definiu senha (`422`): a pessoa criada
 * pelo portal nasce inativa e só passa a ativa pelo link de primeiro acesso. A
 * frase do serviço chega à tela como veio.
 */
export async function activateUser(
    id: string,
    actor: UserActionActor,
): Promise<UserStatusChangeResult> {
    const normalized = id.trim()
    if (!normalized) return {ok: false, reason: 'not-found'}

    const loaded = await loadUsers()
    if (!loaded.ok) return loaded

    const current = loaded.users.find((user) => user.id === normalized)
    if (!current) return {ok: false, reason: 'not-found'}

    if (current.status === 'Ativo') return {ok: true, user: cloneUser(current), changed: false}

    return applyStatusChange(current, actor, 'Ativo', 'reactivated')
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

    // Nada mudou: idempotente, sem chamada ao serviço e sem evento.
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

        recordHistory(
            buildHistoryEvent(
                'updated',
                new Date().toISOString(),
                updated,
                actor,
                buildUpdateDetails(current, updated),
            ),
        )

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
 * O usuário nasce INATIVO e sem senha, de propósito. É o fluxo de primeiro
 * acesso que a tela descreve: o serviço envia ao e-mail cadastrado o link em
 * que a própria pessoa define a senha, e é aí que a conta passa a ativa. O
 * serviço nem aceita o contrário: um usuário ativo exige senha no cadastro, e
 * senha digitada por um terceiro é senha que outra pessoa conheceu.
 *
 * O id vem do serviço (UUID), e o evento de Histórico é gravado no navegador
 * depois da confirmação, com o mesmo vocabulário de sempre.
 */
export async function createUser(
    input: UserFormInput,
    actor: UserActionActor,
): Promise<UserCreateResult> {
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
            status: 'inactive',
        }

        const translate = createCoreUserTranslator()
        const created = await translate(await createCoreUser(payload))

        recordHistory(
            buildHistoryEvent(
                'created',
                new Date().toISOString(),
                created,
                actor,
                buildCreationDetails(created),
            ),
        )

        return {ok: true, user: cloneUser(created)}
    } catch (cause) {
        return serviceFailure(cause)
    }
}
