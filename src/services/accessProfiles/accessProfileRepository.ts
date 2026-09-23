import { CoreApiError } from '../../data/api/coreApiClient'
import type { User } from '../../data/dashboardTypes'
import { normalizeStoredAccessProfileId } from '../../lib/accessProfileRules'
import type { AccessProfile, DepartmentPageAccess } from '../../types/access'
import type { AccessProfileHistoryEvent } from '../../types/userHistory'
import { updateCoreUser } from '../users/userApi'
import { CoreUserMappingError } from '../users/userApiMapper'
import { appendStoredUserHistoryEvent } from '../users/userHistoryStorage'
import { loadUsers } from '../users/userRepository'
import {
  createAccessProfileOnApi,
  deleteAccessProfileOnApi,
  loadAccessProfilesFromApi,
  updateAccessProfileOnApi,
} from './accessProfileApi'
import {
  buildAccessProfileEvent,
  buildProfileCreationDetails,
  buildProfileDeletionDetails,
  buildProfileUpdateDetails,
  describeAccessProfileTransition,
  normalizeActor,
  type AccessProfileActor,
  type MembershipChange,
} from './accessProfileHistory'

/**
 * Acesso central à coleção de Perfis de Acesso, que vive no `impacto-bi-service`.
 *
 * A coleção local do navegador acabou: não existe mais semente inicial, nem
 * armazenamento, nem migração. A tela Perfis de acesso lista as linhas de
 * `access` do serviço, e criar, editar, excluir e vincular usuários são chamadas
 * ao serviço. Os dois UUIDs, do perfil e do tipo, são os de lá.
 *
 * O que continua no portal, e por quê:
 *
 * - as REGRAS de vínculo que a tela sempre teve, aplicadas sobre a lista de
 *   usuários RECÉM-LIDA do serviço: quem já está no perfil não pode ser
 *   desmarcado sem receber outro, o destino precisa servir ao Perfil do Sistema
 *   da pessoa, e um perfil com gente dentro não é excluído. O serviço confere
 *   parte disso de novo (chave estrangeira, 409 na exclusão); a conferência aqui
 *   existe para a recusa chegar com a frase do portal, antes da chamada;
 * - o HISTÓRICO, que o serviço não expõe, gravado no navegador depois de o
 *   serviço confirmar.
 *
 * Vínculos são gravados usuário a usuário (`PUT /users/{id}`): o serviço não
 * tem transação entre o perfil e os usuários dele. O perfil é salvo primeiro, e
 * cada vínculo que falhar é relatado por nome, sem desfazer o que já deu certo.
 */

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
  if (cause instanceof CoreApiError || cause instanceof CoreUserMappingError) {
    return { ok: false, reason: 'service-failure', message: cause.message }
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

export type AccessProfileListResult =
  | { ok: true; profiles: AccessProfile[] }
  | AccessProfileServiceFailure

/** Coleção completa do serviço, na ordem dele. */
export async function loadAccessProfiles(): Promise<AccessProfileListResult> {
  try {
    return { ok: true, profiles: await loadAccessProfilesFromApi() }
  } catch (cause) {
    return serviceFailure(cause)
  }
}

/** As duas coleções que toda gravação precisa ler antes de decidir. */
type Collections = { profiles: AccessProfile[]; users: User[] }

type CollectionsResult =
  | { ok: true; value: Collections }
  | { ok: false; reason: 'users-unavailable' }
  | AccessProfileServiceFailure

async function loadCollections(): Promise<CollectionsResult> {
  const [profiles, users] = await Promise.all([loadAccessProfiles(), loadUsers()])

  if (!profiles.ok) return profiles
  if (!users.ok) return { ok: false, reason: 'users-unavailable' }

  return { ok: true, value: { profiles: profiles.profiles, users: users.users } }
}

/* -------------------------------------------------------------------------- */
/* Histórico                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Grava o evento no Histórico do navegador, depois de o serviço confirmar. Um
 * Histórico ilegível perde o REGISTRO local, e não a alteração, que já está
 * feita. Por isso nada aqui vira erro para quem chamou.
 */
function recordHistory(event: AccessProfileHistoryEvent): void {
  appendStoredUserHistoryEvent(event)
}

/* -------------------------------------------------------------------------- */
/* Vínculos                                                                   */
/* -------------------------------------------------------------------------- */

/** Usuário que precisa passar a apontar para o perfil, e de onde ele vem. */
type PendingAssignment = { user: User; change: MembershipChange }

/** Quem muda de perfil nesta operação, ou a recusa. */
type MembershipResolution =
  | { ok: true; pending: PendingAssignment[]; assignedUserIds: string[] }
  | { ok: false; reason: 'unknown-user' | 'unassignment-not-allowed' }

/**
 * Aplica a lista final de vinculados a um perfil sobre a coleção de usuários.
 *
 * Três decisões acontecem aqui, e nenhuma delas pertence à interface:
 *
 * - quem está na lista passa a apontar para este perfil. Se já apontava para
 *   outro, isso é uma TRANSFERÊNCIA: o vínculo é único, então entrar aqui é sair
 *   de lá;
 * - quem já apontava para este perfil e continua na lista não é reenviado: o
 *   serviço já conhece o vínculo, e os acessos dele saem do próprio perfil;
 * - quem já apontava para este perfil e NÃO está na lista faz a operação inteira
 *   ser recusada. Retirar alguém de um perfil sem dar outro a ele o deixaria sem
 *   acesso ao portal, e o caminho para isso é a transferência, não a desmarcação.
 */
function resolveMembership(
  users: readonly User[],
  profile: Pick<AccessProfile, 'id'>,
  userIds: readonly string[],
  profiles: readonly AccessProfile[],
): MembershipResolution {
  const target = new Set(userIds)

  for (const user of users) {
    if (normalizeStoredAccessProfileId(user.accessProfileId) === profile.id && !target.has(user.id)) {
      return { ok: false, reason: 'unassignment-not-allowed' }
    }
  }

  const known = new Map(users.map((user) => [user.id, user]))
  for (const userId of target) {
    if (!known.has(userId)) return { ok: false, reason: 'unknown-user' }
  }

  const pending: PendingAssignment[] = []

  for (const userId of target) {
    const user = known.get(userId)
    if (!user) continue

    const previousId = normalizeStoredAccessProfileId(user.accessProfileId)
    if (previousId === profile.id) continue

    const source = previousId === null ? null : profiles.find((item) => item.id === previousId)

    pending.push({ user, change: { userName: user.name, fromProfileName: source?.name ?? null } })
  }

  return { ok: true, pending, assignedUserIds: [...target] }
}

/** Resultado dos vínculos gravados um a um. */
type AssignmentOutcome = { applied: MembershipChange[]; failed: string[] }

/**
 * Grava cada vínculo no serviço, em sequência, sem parar no primeiro que falhar:
 * cada pessoa é uma decisão independente, e as demais não precisam esperar uma
 * correção que só diz respeito a uma delas.
 */
async function applyAssignments(
  pending: readonly PendingAssignment[],
  accessProfileId: string,
): Promise<AssignmentOutcome> {
  const applied: MembershipChange[] = []
  const failed: string[] = []

  for (const { user, change } of pending) {
    try {
      await updateCoreUser(user.id, { access_profile_id: accessProfileId })
      applied.push(change)
    } catch (cause) {
      failed.push(`${user.name} (${serviceFailure(cause).message})`)
    }
  }

  return { applied, failed }
}

/** Frase do aviso quando o perfil foi salvo mas algum vínculo não. */
function assignmentWarning(profileName: string, failed: readonly string[]): string | null {
  if (failed.length === 0) return null

  const count = failed.length

  return (
    `${profileName} foi salvo, mas ${count} ${count === 1 ? 'usuário não pôde' : 'usuários não puderam'} ` +
    `ser vinculado${count === 1 ? '' : 's'}: ${failed.join('; ')}.`
  )
}

/* -------------------------------------------------------------------------- */
/* Criação e edição de perfil com atribuições                                 */
/* -------------------------------------------------------------------------- */

export type { AccessProfileActor }

/** Conteúdo editável do perfil mais a lista final de usuários vinculados. */
export type AccessProfileSaveInput = {
  name: string
  description?: string
  departmentPageAccess: DepartmentPageAccess[]
  /**
   * Ids dos usuários que devem estar vinculados a este perfil ao final.
   *
   * É o estado final, e não um delta: quem está aqui passa a apontar para este
   * perfil (transferindo-se do anterior, quando havia um), e quem não está
   * continua exatamente onde está.
   */
  userIds: readonly string[]
  /** Administrador autenticado que está salvando, copiado para o Histórico. */
  actor: AccessProfileActor
}

/**
 * A criação pede exatamente os mesmos campos da edição.
 *
 * Carregava também o DESTINO, que só existia no momento de criar. Ele sumiu com
 * a coluna de tipo de `access`: um perfil nasce com nome, descrição e menus.
 */
export type AccessProfileCreateWithUsersInput = AccessProfileSaveInput

export type AccessProfileSaveFailureReason =
  | 'not-found'
  | 'unknown-user'
  | 'unassignment-not-allowed'
  | 'users-unavailable'
  | 'actor-required'

export type AccessProfileSaveResult =
  | {
      ok: true
      profile: AccessProfile
      assignedUserIds: string[]
      /** Presente quando o perfil foi salvo mas algum vínculo falhou no serviço. */
      warning: string | null
    }
  | { ok: false; reason: AccessProfileSaveFailureReason }
  | AccessProfileServiceFailure

/**
 * Cria um Perfil de Acesso no serviço e grava as atribuições dele em seguida.
 *
 * O destino é obrigatório e definido aqui, uma única vez: a edição não o alcança.
 * A página inicial não vem do formulário: o domínio a deriva das páginas
 * concedidas.
 *
 * A validação dos vínculos acontece ANTES da criação, sobre a lista recém-lida:
 * se ela recusar, nada é enviado ao serviço.
 */
export async function createAccessProfileWithUsers(
  input: AccessProfileCreateWithUsersInput,
): Promise<AccessProfileSaveResult> {
  const actor = normalizeActor(input.actor)
  if (!actor) return { ok: false, reason: 'actor-required' }

  const loaded = await loadCollections()
  if (!loaded.ok) return loaded

  const { profiles, users } = loaded.value

  // O perfil ainda não existe, então o id é vazio: nenhum usuário pode já
  // apontar para ele, que é a única coisa que `resolveMembership` lê daqui.
  const membership = resolveMembership(users, { id: '' }, input.userIds, profiles)
  if (!membership.ok) return { ok: false, reason: membership.reason }

  let created: AccessProfile
  try {
    created = await createAccessProfileOnApi({
      name: input.name,
      description: input.description,
      departmentPageAccess: input.departmentPageAccess,
    })
  } catch (cause) {
    return serviceFailure(cause)
  }

  const outcome = await applyAssignments(membership.pending, created.id)

  recordHistory(
    buildAccessProfileEvent(
      'access-profile-created',
      new Date().toISOString(),
      created,
      actor,
      buildProfileCreationDetails(created, outcome.applied),
    ),
  )

  return {
    ok: true,
    profile: created,
    assignedUserIds: membership.assignedUserIds,
    warning: assignmentWarning(created.name, outcome.failed),
  }
}

/**
 * Edita um Perfil de Acesso no serviço e sincroniza os vínculos em seguida.
 *
 * Id, tipo e destino vêm do perfil atual e não do formulário: o destino é
 * escolhido uma única vez, na criação, e uma edição capaz de informá-lo seria
 * uma edição capaz de trocá-lo, mudando de uma vez o acesso de todos os
 * vinculados.
 */
export async function updateAccessProfileWithUsers(
  id: string,
  input: AccessProfileSaveInput,
): Promise<AccessProfileSaveResult> {
  const actor = normalizeActor(input.actor)
  if (!actor) return { ok: false, reason: 'actor-required' }

  const normalizedId = id.trim()
  if (!normalizedId) return { ok: false, reason: 'not-found' }

  const loaded = await loadCollections()
  if (!loaded.ok) return loaded

  const { profiles, users } = loaded.value

  const current = profiles.find((profile) => profile.id === normalizedId)
  if (!current) return { ok: false, reason: 'not-found' }

  const membership = resolveMembership(users, current, input.userIds, profiles)
  if (!membership.ok) return { ok: false, reason: membership.reason }

  let updated: AccessProfile
  try {
    updated = await updateAccessProfileOnApi(current.id, {
      name: input.name,
      description: input.description,
      departmentPageAccess: input.departmentPageAccess,
    })
  } catch (cause) {
    return serviceFailure(cause)
  }

  const outcome = await applyAssignments(membership.pending, updated.id)

  // Somente mudanças efetivas viram evento: uma edição que não alterou nome,
  // descrição, concessões nem vínculos não tem o que registrar.
  const details = buildProfileUpdateDetails(current, updated, outcome.applied)
  if (details.length > 0) {
    recordHistory(
      buildAccessProfileEvent(
        'access-profile-updated',
        new Date().toISOString(),
        updated,
        actor,
        details,
      ),
    )
  }

  return {
    ok: true,
    profile: updated,
    assignedUserIds: membership.assignedUserIds,
    warning: assignmentWarning(updated.name, outcome.failed),
  }
}

/* -------------------------------------------------------------------------- */
/* Atribuição direta a um usuário sem Perfil de Acesso                        */
/* -------------------------------------------------------------------------- */

export type AccessProfileDirectAssignmentFailureReason =
  | 'user-not-found'
  | 'user-already-assigned'
  | 'access-profile-required'
  | 'unknown-access-profile'
  | 'users-unavailable'
  | 'actor-required'

export type AccessProfileDirectAssignmentResult =
  | {
      ok: true
      profile: AccessProfile
      userId: string
      /** Nome do usuário no momento da atribuição, o mesmo copiado para o evento. */
      userName: string
    }
  | { ok: false; reason: AccessProfileDirectAssignmentFailureReason }
  | AccessProfileServiceFailure

/**
 * Dá um Perfil de Acesso a UM usuário que está sem nenhum.
 *
 * ESTADO REVALIDADO NA GRAVAÇÃO: o usuário precisa continuar sem Perfil de
 * Acesso. A tela abriu o modal porque ele estava sem perfil, mas entre aquela
 * leitura e esta gravação outra aba pode ter atribuído um. Nesse caso a operação
 * é RECUSADA, e não convertida em transferência: trocar um vínculo que ninguém
 * pediu para trocar retiraria o acesso que a outra decisão acabou de conceder.
 */
export async function assignAccessProfileToUser(input: {
  userId: string
  accessProfileId: string
  actor: AccessProfileActor
}): Promise<AccessProfileDirectAssignmentResult> {
  const actor = normalizeActor(input.actor)
  if (!actor) return { ok: false, reason: 'actor-required' }

  const userId = input.userId.trim()
  if (!userId) return { ok: false, reason: 'user-not-found' }

  const accessProfileId = normalizeStoredAccessProfileId(input.accessProfileId)
  if (accessProfileId === null) return { ok: false, reason: 'access-profile-required' }

  const loaded = await loadCollections()
  if (!loaded.ok) return loaded

  const { profiles, users } = loaded.value

  const current = users.find((candidate) => candidate.id === userId)
  if (!current) return { ok: false, reason: 'user-not-found' }

  if (normalizeStoredAccessProfileId(current.accessProfileId) !== null) {
    return { ok: false, reason: 'user-already-assigned' }
  }

  const target = profiles.find((candidate) => candidate.id === accessProfileId)
  if (!target) return { ok: false, reason: 'unknown-access-profile' }

  try {
    await updateCoreUser(current.id, { access_profile_id: target.id })
  } catch (cause) {
    return serviceFailure(cause)
  }

  // Alteração do perfil, e não do usuário: quem mudou de conteúdo foi a
  // composição de usuários daquele Perfil de Acesso, e é por ele que o
  // Administrador procura no Histórico.
  recordHistory(
    buildAccessProfileEvent('access-profile-updated', new Date().toISOString(), target, actor, [
      describeAccessProfileTransition(current.name, null, target.name),
    ]),
  )

  return { ok: true, profile: target, userId: current.id, userName: current.name }
}

/* -------------------------------------------------------------------------- */
/* Exclusão de perfil, permitida apenas sem usuários dentro                   */
/* -------------------------------------------------------------------------- */

export type AccessProfileDeleteFailureReason =
  | 'not-found'
  | 'profile-has-users'
  | 'users-unavailable'
  | 'actor-required'

export type AccessProfileDeleteResult =
  | { ok: true; profile: AccessProfile }
  | { ok: false; reason: AccessProfileDeleteFailureReason }
  | AccessProfileServiceFailure

/**
 * Exclui um Perfil de Acesso comum que não tem nenhum usuário dentro.
 *
 * A presença de gente RECUSA a exclusão: apagar um perfil não pode ser o caminho
 * para tirar o acesso de alguém sem que essa tenha sido a decisão. A saída é
 * transferir as pessoas para outro Perfil de Acesso e só então excluir o que
 * ficou vazio. O serviço confere de novo e recusa com 409.
 *
 * A base de usuários é lida antes de qualquer decisão: é ela quem responde se
 * o perfil está vazio, e excluir sem poder conferir os vínculos é exatamente o
 * que esta regra impede.
 */
export async function deleteAccessProfile(
  id: string,
  actorInput: AccessProfileActor,
): Promise<AccessProfileDeleteResult> {
  const normalizedId = id.trim()
  if (!normalizedId) return { ok: false, reason: 'not-found' }

  const actor = normalizeActor(actorInput)
  if (!actor) return { ok: false, reason: 'actor-required' }

  const loaded = await loadCollections()
  if (!loaded.ok) return loaded

  const { profiles, users } = loaded.value

  const current = profiles.find((profile) => profile.id === normalizedId)
  if (!current) return { ok: false, reason: 'not-found' }

  if (users.some((user) => normalizeStoredAccessProfileId(user.accessProfileId) === current.id)) {
    return { ok: false, reason: 'profile-has-users' }
  }

  try {
    await deleteAccessProfileOnApi(current.id)
  } catch (cause) {
    return serviceFailure(cause)
  }

  recordHistory(
    buildAccessProfileEvent(
      'access-profile-deleted',
      new Date().toISOString(),
      current,
      actor,
      buildProfileDeletionDetails(current),
    ),
  )

  return { ok: true, profile: current }
}
