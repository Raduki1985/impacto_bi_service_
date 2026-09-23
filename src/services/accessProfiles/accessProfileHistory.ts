import { departmentPages } from '../../config/departmentPages'
import { findDepartment } from '../../lib/userAccessRules'
import type { AccessProfile, DepartmentPageAccess } from '../../types/access'
import type { AccessProfileHistoryAction, AccessProfileHistoryEvent } from '../../types/userHistory'

/**
 * Eventos do Histórico dos Perfis de Acesso.
 *
 * Só monta texto e evento a partir de estado já calculado: quem grava é o
 * repositório, depois de o serviço confirmar a alteração. Módulo puro, sem
 * armazenamento e sem rede, para o vocabulário da auditoria ser verificável sem
 * navegador.
 *
 * Os rótulos exibidos na tela Perfis de acesso continuam no modelo de
 * apresentação dela; o vocabulário daqui é o da auditoria.
 */

/* -------------------------------------------------------------------------- */
/* Responsável                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Responsável por uma alteração de Perfil de Acesso.
 *
 * Chega de fora, do usuário autenticado da tela, e é COPIADO para o evento. O
 * responsável nunca é reconstruído depois a partir do estado atual: o Histórico
 * registra quem fez, e não quem estaria logado agora.
 */
export type AccessProfileActor = { id: string; name: string }

/** Responsável com id e nome preenchidos, ou null: evento sem responsável não existe. */
export function normalizeActor(actor: AccessProfileActor | null | undefined): AccessProfileActor | null {
  const id = actor?.id.trim() ?? ''
  const name = actor?.name.trim() ?? ''

  return id && name ? { id, name } : null
}

/* -------------------------------------------------------------------------- */
/* Vocabulário                                                                */
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

/** Enumeração legível em português: 'A', 'A e B', 'A, B e C'. */
function formatList(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]

  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/** `COP (3 páginas)`, com a flexão acompanhando a contagem. */
function describeGrant(access: DepartmentPageAccess): string {
  const count = access.pageKeys.length

  return `${departmentLabelOf(access.departmentId)} (${count} ${count === 1 ? 'página' : 'páginas'})`
}

/** Cobertura completa do perfil, na ordem gravada. */
function describeGrants(access: readonly DepartmentPageAccess[]): string {
  if (access.length === 0) return 'Nenhum departamento concedido'

  return formatList(access.map(describeGrant))
}

/* -------------------------------------------------------------------------- */
/* Evento                                                                     */
/* -------------------------------------------------------------------------- */

/** Sequência da execução: garante ids distintos para eventos do mesmo instante. */
let accessProfileEventSequence = 0

function nextAccessProfileEventId(occurredAt: string, profileId: string): string {
  accessProfileEventSequence += 1

  return `${occurredAt}-${profileId}-${accessProfileEventSequence}`
}

/** Perfil como o evento precisa dele: identidade e nome do momento. */
export type HistoryProfileRef = Pick<AccessProfile, 'id' | 'name'>

/** Monta o evento a partir do estado já calculado da operação. */
export function buildAccessProfileEvent(
  action: AccessProfileHistoryAction,
  occurredAt: string,
  profile: HistoryProfileRef,
  actor: AccessProfileActor,
  details: string[],
): AccessProfileHistoryEvent {
  return {
    id: nextAccessProfileEventId(occurredAt, profile.id),
    targetType: 'access-profile',
    action,
    occurredAt,
    targetAccessProfileId: profile.id,
    // Nome do momento do evento: renomear o perfil depois não reescreve o passado.
    targetAccessProfileName: profile.name,
    actorUserId: actor.id,
    actorName: actor.name,
    details,
  }
}

/* -------------------------------------------------------------------------- */
/* Transições de usuários                                                     */
/* -------------------------------------------------------------------------- */

/** Usuário que passou a apontar para o perfil salvo nesta operação. */
export type MembershipChange = {
  userName: string
  /** Nome do Perfil de Acesso anterior, ou null quando ele não tinha nenhum. */
  fromProfileName: string | null
}

/**
 * Ausência de Perfil de Acesso, dos dois lados de uma transição. É o mesmo
 * texto do indicador `Sem perfil definido` da página Perfis de acesso, de
 * propósito: um estado só, um vocabulário só.
 */
const NO_ACCESS_PROFILE_LABEL = 'Sem perfil definido'

/**
 * Uma mudança de Perfil de Acesso, sempre no formato `origem → destino`, com o
 * nome do usuário DENTRO da própria linha. `null` em qualquer um dos lados é a
 * ausência de perfil, e não um caso à parte com frase própria.
 */
export function describeAccessProfileTransition(
  userName: string,
  fromProfileName: string | null,
  toProfileName: string | null,
): string {
  const from = fromProfileName ?? NO_ACCESS_PROFILE_LABEL
  const to = toProfileName ?? NO_ACCESS_PROFILE_LABEL

  return `Perfil de Acesso de ${userName}: ${from} → ${to}`
}

/** Uma transição por usuário que passou a apontar para o perfil salvo. */
function describeMembershipChanges(
  changes: readonly MembershipChange[],
  toProfileName: string,
): string[] {
  return changes.map((change) =>
    describeAccessProfileTransition(change.userName, change.fromProfileName, toProfileName),
  )
}

/* -------------------------------------------------------------------------- */
/* Detalhes de cada operação                                                  */
/* -------------------------------------------------------------------------- */

/** O que a criação e a edição precisam saber do perfil para descrevê-lo. */
export type HistoryProfileSnapshot = {
  name: string
  description?: string
  departmentPageAccess: readonly DepartmentPageAccess[]
}

/**
 * Descreve a criação: cobertura inicial e quem já nasceu vinculado.
 *
 * A linha `Destino` saiu: o perfil de acesso deixou de ter destino quando o
 * serviço parou de guardar a qual tipo de perfil ele pertencia. Os eventos JÁ
 * GRAVADOS continuam mostrando a linha que tinham, porque o Histórico guarda o
 * texto pronto e não o recalcula.
 *
 * A cobertura entra resumida por departamento, e não página a página: o perfil
 * recém-criado pode conceder dezenas de páginas, e a lista inteira ocuparia o
 * Histórico para descrever uma única decisão.
 */
export function buildProfileCreationDetails(
  profile: HistoryProfileSnapshot,
  changes: readonly MembershipChange[],
): string[] {
  const details = [`Cobertura inicial: ${describeGrants(profile.departmentPageAccess)}`]

  const membership = describeMembershipChanges(changes, profile.name)
  details.push(...(membership.length ? membership : ['Nenhum usuário vinculado na criação']))

  return details
}

/** Departamentos e páginas que entraram e saíram, agrupados como na aba Usuários. */
function buildGrantChangeDetails(
  previous: readonly DepartmentPageAccess[],
  next: readonly DepartmentPageAccess[],
): string[] {
  const details: string[] = []

  const previousAccess = new Map(previous.map((access) => [access.departmentId, access.pageKeys]))
  const nextAccess = new Map(next.map((access) => [access.departmentId, access.pageKeys]))

  const addedDepartments: string[] = []
  const removedDepartments: string[] = []

  for (const departmentId of nextAccess.keys()) {
    if (!previousAccess.has(departmentId)) addedDepartments.push(departmentLabelOf(departmentId))
  }

  for (const departmentId of previousAccess.keys()) {
    if (!nextAccess.has(departmentId)) removedDepartments.push(departmentLabelOf(departmentId))
  }

  if (addedDepartments.length) {
    const label =
      addedDepartments.length === 1 ? 'Departamento adicionado' : 'Departamentos adicionados'
    details.push(`${label}: ${formatList(addedDepartments)}`)
  }

  if (removedDepartments.length) {
    const label =
      removedDepartments.length === 1 ? 'Departamento removido' : 'Departamentos removidos'
    details.push(`${label}: ${formatList(removedDepartments)}`)
  }

  // Duas listas separadas para que todas as liberações apareçam antes de todas
  // as remoções, mesmo com vários departamentos alterados na mesma edição.
  const addedPages: string[] = []
  const removedPages: string[] = []

  for (const [departmentId, pageKeys] of nextAccess) {
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
      const label = added.length === 1 ? 'Página adicionada em' : 'Páginas adicionadas em'
      addedPages.push(`${label} ${department}: ${formatList(added)}`)
    }

    if (removed.length) {
      const label = removed.length === 1 ? 'Página removida de' : 'Páginas removidas de'
      removedPages.push(`${label} ${department}: ${formatList(removed)}`)
    }
  }

  details.push(...addedPages, ...removedPages)

  return details
}

/**
 * Descreve a edição. SOMENTE mudanças efetivas: uma lista vazia significa que o
 * salvamento não alterou nada, e nesse caso nenhum evento é gerado.
 */
export function buildProfileUpdateDetails(
  previous: HistoryProfileSnapshot,
  updated: HistoryProfileSnapshot,
  changes: readonly MembershipChange[],
): string[] {
  const details: string[] = []

  if (previous.name !== updated.name) {
    details.push(`Nome alterado: ${previous.name} → ${updated.name}`)
  }

  const previousDescription = previous.description ?? ''
  const updatedDescription = updated.description ?? ''

  if (previousDescription !== updatedDescription) {
    if (!previousDescription) details.push(`Descrição definida: ${updatedDescription}`)
    else if (!updatedDescription) details.push('Descrição removida')
    else details.push(`Descrição alterada: ${previousDescription} → ${updatedDescription}`)
  }

  details.push(...buildGrantChangeDetails(previous.departmentPageAccess, updated.departmentPageAccess))
  // O destino da transição é o nome SALVO nesta operação: quando a edição
  // renomeia o perfil, é o nome novo que passa a valer para quem entrou nele.
  details.push(...describeMembershipChanges(changes, updated.name))

  return details
}

/**
 * Descreve a exclusão: nome e a constatação de que o perfil estava vazio, que é
 * a condição que autorizou a exclusão.
 */
export function buildProfileDeletionDetails(
  profile: Pick<HistoryProfileSnapshot, 'name'>,
): string[] {
  return [
    `Perfil excluído: ${profile.name}`,
    'Nenhum usuário estava vinculado a este perfil',
  ]
}
