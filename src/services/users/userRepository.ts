import { users as seedUsers } from '../../data/mockAdminData'
import type { User } from '../../data/dashboardTypes'
import { departmentPages } from '../../config/departmentPages'
import type { DepartmentPageAccess } from '../../types/access'
import type { UserHistoryAction, UserHistoryEvent } from '../../types/userHistory'
import { initials } from '../../lib/formatters'
import {
  MODEL_PAGE_KEY,
  deriveUserAccess,
  findDepartment,
  type DepartmentPageSelection,
  type DerivedUserAccess,
  type UserAccessConfig,
} from '../../lib/userAccessRules'
import { readStoredUserHistory } from './userHistoryStorage'
import { readStoredUsers, writeStoredUsers, writeStoredUsersWithHistory } from './userStorage'

/** A configuração de acesso é o contrato de entrada desta camada; reexportada
    para quem chama o repositório não precisar conhecer o módulo de regras. */
export type { DepartmentPageSelection, UserAccessConfig }

/**
 * Acesso central à coleção mockada de usuários. A base vive no localStorage e
 * é inicializada a partir do seed na primeira execução; quando o armazenamento
 * falha, um fallback em memória sustenta a mesma coleção até o fim da
 * execução. Toda leitura devolve cópias defensivas: nenhuma referência interna
 * ou do seed escapa deste módulo.
 */

/** Responsável por uma operação sobre usuários, registrado na auditoria. */
export type UserActionActor = Pick<User, 'id' | 'name'>

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
    audit: user.audit ? { ...user.audit } : undefined,
  }
}

function cloneUsers(users: User[]): User[] {
  return users.map(cloneUser)
}

/** Última coleção conhecida da execução atual; sustenta falhas do storage. */
let inMemoryUsers: User[] | null = null

/**
 * Quando uma gravação falha, o storage pode ainda guardar a versão antiga.
 * Esta flag faz as leituras preferirem o fallback em memória até que uma
 * gravação volte a funcionar, evitando que a versão antiga sobrescreva a nova.
 */
let preferInMemoryUsers = false

/** Coleção persistida, fallback da execução ou seed, nessa ordem. */
function loadUsers(): User[] {
  if (preferInMemoryUsers && inMemoryUsers) return inMemoryUsers

  const stored = readStoredUsers()

  if (stored) {
    inMemoryUsers = cloneUsers(stored)
    return inMemoryUsers
  }

  // Storage vazio ou inacessível: reaproveita a coleção já obtida nesta execução.
  if (inMemoryUsers) return inMemoryUsers

  const initial = cloneUsers(seedUsers)
  inMemoryUsers = initial
  preferInMemoryUsers = !writeStoredUsers(initial)

  return inMemoryUsers
}

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
 * Grava a coleção alterada e o evento que a descreve em uma operação só, e
 * atualiza a memória apenas depois da persistência confirmada.
 *
 * Devolve false em dois casos, ambos tratados como falha de armazenamento pelas
 * operações: o Histórico atual não pôde ser lido, e aí um evento novo
 * sobrescreveria um histórico corrompido que ninguém conseguiu ler, ou a
 * gravação conjunta falhou, e aí o armazenamento já voltou ao estado anterior.
 * Nos dois casos nada é aplicado: nem usuário, nem evento, nem memória.
 */
function commitWithHistoryEvent(next: User[], event: UserHistoryEvent): boolean {
  const history = readStoredUserHistory()
  if (!history) return false

  if (!writeStoredUsersWithHistory(cloneUsers(next), [...history, event])) return false

  inMemoryUsers = cloneUsers(next)
  preferInMemoryUsers = false

  return true
}

export function listUsers(): User[] {
  return cloneUsers(loadUsers())
}

export function findUserById(id: string): User | null {
  const normalized = id.trim()
  if (!normalized) return null

  const match = loadUsers().find((user) => user.id === normalized)

  return match ? cloneUser(match) : null
}

export function findUserByEmail(email: string): User | null {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const match = loadUsers().find((user) => user.email.toLowerCase() === normalized)

  return match ? cloneUser(match) : null
}

/** Motivo pelo qual uma troca de status foi recusada. */
export type UserStatusChangeFailureReason =
  | 'not-found'
  | 'self-deactivation'
  | 'last-active-administrator'
  | 'storage-failure'

/**
 * Resultado explícito das operações de status: sucesso carrega o usuário
 * (changed indica se houve transição real) e recusa carrega o motivo, para a
 * interface exibir a mensagem adequada sem reconstruir a regra.
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

/**
 * Executa uma transição de status já autorizada: gera o timestamp, registra os
 * últimos eventos de auditoria da categoria sem apagar os anteriores e persiste
 * a coleção junto com o evento de Histórico.
 *
 * O evento usa o mesmo timestamp da auditoria e descreve a transição real. Se a
 * persistência conjunta falhar, o status não muda, o evento não existe e a
 * memória fica como estava: a interface recebe 'storage-failure'.
 */
function applyStatusChange(
  collection: User[],
  current: User,
  actor: UserActionActor,
  status: User['status'],
  action: UserHistoryAction,
  auditFields: (timestamp: string) => Partial<User['audit']>,
): UserStatusChangeResult {
  const timestamp = new Date().toISOString()
  const updated: User = {
    ...cloneUser(current),
    status,
    audit: {
      ...current.audit,
      updatedAt: timestamp,
      updatedByUserId: actor.id,
      updatedByName: actor.name,
      ...auditFields(timestamp),
    },
  }

  const next = collection.map((user) => (user.id === current.id ? updated : user))
  const event = buildHistoryEvent(action, timestamp, updated, actor, [
    `Status: ${current.status} → ${status}`,
  ])

  if (!commitWithHistoryEvent(next, event)) return { ok: false, reason: 'storage-failure' }

  return { ok: true, user: cloneUser(updated), changed: true }
}

export function deactivateUser(id: string, actor: UserActionActor): UserStatusChangeResult {
  const normalized = id.trim()
  if (!normalized) return { ok: false, reason: 'not-found' }

  const collection = loadUsers()
  const current = collection.find((user) => user.id === normalized)
  if (!current) return { ok: false, reason: 'not-found' }

  // Já Inativo: idempotente, avaliado antes das proteções (não há nova desativação).
  if (current.status === 'Inativo') return { ok: true, user: cloneUser(current), changed: false }

  if (current.id === actor.id) return { ok: false, reason: 'self-deactivation' }

  if (isLastActiveAdministrator(collection, current)) {
    return { ok: false, reason: 'last-active-administrator' }
  }

  return applyStatusChange(collection, current, actor, 'Inativo', 'deactivated', (timestamp) => ({
    deactivatedAt: timestamp,
    deactivatedByUserId: actor.id,
    deactivatedByName: actor.name,
  }))
}

/** Validação simples de formato de e-mail: algo@algo.algo, sem espaços. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Motivo pelo qual uma atualização de dados básicos foi recusada. */
export type UserBasicDataUpdateFailureReason =
  | 'not-found'
  | 'invalid-name'
  | 'invalid-email'
  | 'email-taken'
  | 'storage-failure'

/** Mesmo contrato das operações de status: sucesso carrega o usuário (changed
    indica se algo mudou de fato) e recusa carrega o motivo para a interface. */
export type UserBasicDataUpdateResult =
  | {
      ok: true
      user: User
      changed: boolean
    }
  | {
      ok: false
      reason: UserBasicDataUpdateFailureReason
    }

/** Nome e e-mail normalizados, ou o motivo da recusa. */
type BasicDataValidation =
  | { ok: true; name: string; email: string }
  | { ok: false; reason: 'invalid-name' | 'invalid-email' | 'email-taken' }

/**
 * Regra única de validação dos dados básicos, compartilhada pelas duas
 * operações de edição: nome sem espaços nas pontas e obrigatório, e-mail sem
 * espaços, em caixa baixa e no formato simples, e nenhum outro id usando o
 * mesmo e-mail. Manter o próprio e-mail é sempre permitido.
 */
function validateBasicData(
  collection: readonly User[],
  current: User,
  input: { name: string; email: string },
): BasicDataValidation {
  const name = input.name.trim()
  if (!name) return { ok: false, reason: 'invalid-name' }

  const email = input.email.trim().toLowerCase()
  if (!email || !EMAIL_PATTERN.test(email)) return { ok: false, reason: 'invalid-email' }

  // O próprio e-mail é permitido; o de qualquer outro id, não (sem diferenciar caixa).
  const emailTaken = collection.some(
    (user) => user.id !== current.id && user.email.toLowerCase() === email,
  )
  if (emailTaken) return { ok: false, reason: 'email-taken' }

  return { ok: true, name, email }
}

/**
 * Atualiza somente os dados básicos (nome e e-mail) de um usuário existente,
 * localizado pelo id imutável. As iniciais derivam do nome novo e a auditoria
 * registra quem atualizou; todos os demais campos são preservados. Diferente
 * das trocas de status, a gravação aqui é tudo-ou-nada: se o storage recusar,
 * a memória não muda e a interface recebe 'storage-failure' com a coleção
 * exatamente como estava.
 *
 * Mantida para compatibilidade: o fluxo oficial da interface é
 * `updateUserDetails`, que grava dados básicos, acessos e o evento de Histórico
 * na mesma operação. Esta função não registra Histórico.
 */
export function updateUserBasicData(
  id: string,
  input: { name: string; email: string },
  actor: UserActionActor,
): UserBasicDataUpdateResult {
  const normalizedId = id.trim()
  if (!normalizedId) return { ok: false, reason: 'not-found' }

  const collection = loadUsers()
  const current = collection.find((user) => user.id === normalizedId)
  if (!current) return { ok: false, reason: 'not-found' }

  const validation = validateBasicData(collection, current, input)
  if (!validation.ok) return { ok: false, reason: validation.reason }

  const { name, email } = validation

  // Nada mudou: idempotente, sem gravação e sem tocar a auditoria.
  if (name === current.name && email === current.email) {
    return { ok: true, user: cloneUser(current), changed: false }
  }

  const updated: User = {
    ...cloneUser(current),
    name,
    email,
    initials: initials(name),
    audit: {
      ...current.audit,
      updatedAt: new Date().toISOString(),
      updatedByUserId: actor.id,
      updatedByName: actor.name,
    },
  }

  const next = collection.map((user) => (user.id === current.id ? updated : user))

  if (!writeStoredUsers(cloneUsers(next))) return { ok: false, reason: 'storage-failure' }

  inMemoryUsers = cloneUsers(next)
  preferInMemoryUsers = false

  return { ok: true, user: cloneUser(updated), changed: true }
}

/** Motivo pelo qual uma atualização de perfil e acessos foi recusada. */
export type UserAccessUpdateFailureReason =
  | 'not-found'
  | 'self-access-change'
  | 'last-active-administrator'
  | 'invalid-access-configuration'
  | 'storage-failure'

/** Mesmo contrato das demais operações: sucesso carrega o usuário (changed
    indica se algo mudou de fato) e recusa carrega o motivo para a interface. */
export type UserAccessUpdateResult =
  | {
      ok: true
      user: User
      changed: boolean
    }
  | {
      ok: false
      reason: UserAccessUpdateFailureReason
    }

function sameStringList(current: readonly string[], next: readonly string[]): boolean {
  return current.length === next.length && current.every((value, index) => value === next[index])
}

function samePageAccess(
  current: readonly DepartmentPageAccess[],
  next: readonly DepartmentPageAccess[],
): boolean {
  return (
    current.length === next.length &&
    current.every(
      (access, index) =>
        access.departmentId === next[index].departmentId &&
        sameStringList(access.pageKeys, next[index].pageKeys),
    )
  )
}

/** true quando o acesso derivado é idêntico ao que o usuário já tem. */
function hasSameAccess(user: User, access: DerivedUserAccess): boolean {
  return (
    user.profile === access.profile &&
    user.permissions === access.permissions &&
    sameStringList(user.permissionKeys, access.permissionKeys) &&
    sameStringList(user.departments, access.departments) &&
    samePageAccess(user.departmentPageAccess, access.departmentPageAccess)
  )
}

/**
 * Atualiza perfil e acessos de um usuário existente, localizado pelo id
 * imutável. As regras fixas de cada perfil são impostas aqui, não pela
 * interface: a configuração recebida passa por `deriveUserAccess`, que
 * normaliza departamentos e páginas contra o catálogo, elimina duplicidades,
 * ignora ids desconhecidos e devolve os quatro campos de acesso já coerentes
 * entre si. Nome, e-mail, iniciais, status, último acesso e auditorias
 * anteriores são preservados.
 *
 * A recusa por autoedição vem depois da verificação de idempotência: reenviar a
 * configuração que o próprio usuário já tem não altera nada e por isso não é
 * tratado como tentativa de mudar os próprios acessos.
 *
 * Mantida para compatibilidade: o fluxo oficial da interface é
 * `updateUserDetails`. Esta função não registra Histórico.
 *
 * Como em `updateUserBasicData`, a gravação é tudo-ou-nada: se o storage
 * recusar, a memória não muda e a interface recebe 'storage-failure'.
 */
export function updateUserAccess(
  id: string,
  input: UserAccessConfig,
  actor: UserActionActor,
): UserAccessUpdateResult {
  const normalizedId = id.trim()
  if (!normalizedId) return { ok: false, reason: 'not-found' }

  const collection = loadUsers()
  const current = collection.find((user) => user.id === normalizedId)
  if (!current) return { ok: false, reason: 'not-found' }

  const access = deriveUserAccess(input)
  if (!access) return { ok: false, reason: 'invalid-access-configuration' }

  // Nada mudou: idempotente, sem gravação e sem tocar a auditoria.
  if (hasSameAccess(current, access)) return { ok: true, user: cloneUser(current), changed: false }

  // Um Administrador edita o próprio nome e e-mail, mas nunca o próprio perfil
  // ou os próprios acessos.
  if (current.id === actor.id) return { ok: false, reason: 'self-access-change' }

  // O portal não pode ficar sem Administrador ativo: o último deles mantém o perfil.
  if (access.profile !== 'Administrador' && isLastActiveAdministrator(collection, current)) {
    return { ok: false, reason: 'last-active-administrator' }
  }

  const updated: User = {
    ...cloneUser(current),
    ...access,
    audit: {
      ...current.audit,
      updatedAt: new Date().toISOString(),
      updatedByUserId: actor.id,
      updatedByName: actor.name,
    },
  }

  const next = collection.map((user) => (user.id === current.id ? updated : user))

  if (!writeStoredUsers(cloneUsers(next))) return { ok: false, reason: 'storage-failure' }

  inMemoryUsers = cloneUsers(next)
  preferInMemoryUsers = false

  return { ok: true, user: cloneUser(updated), changed: true }
}

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

/**
 * Descreve, em texto legível, o que mudou entre o usuário anterior e o
 * atualizado. Só entram campos realmente alterados, na ordem nome, e-mail,
 * perfil, departamentos adicionados, departamentos removidos, páginas
 * adicionadas e páginas removidas.
 *
 * Departamento inteiro que entra ou sai vira uma linha só: listar todas as
 * páginas dele seria repetir a mesma informação dezenas de vezes. Por isso a
 * comparação página a página acontece apenas nos departamentos presentes antes
 * e depois. O Modelo tem texto próprio, porque é acesso especial e não uma
 * página comum qualquer.
 */
function buildUpdateDetails(previous: User, updated: User): string[] {
  const details: string[] = []

  if (previous.name !== updated.name) details.push(`Nome: ${previous.name} → ${updated.name}`)
  if (previous.email !== updated.email) details.push(`E-mail: ${previous.email} → ${updated.email}`)
  if (previous.profile !== updated.profile) {
    details.push(`Perfil: ${previous.profile} → ${updated.profile}`)
  }

  const previousAccess = new Map(
    previous.departmentPageAccess.map((access) => [access.departmentId, access.pageKeys]),
  )
  const updatedAccess = new Map(
    updated.departmentPageAccess.map((access) => [access.departmentId, access.pageKeys]),
  )

  for (const departmentId of updatedAccess.keys()) {
    if (!previousAccess.has(departmentId)) {
      details.push(`Departamento adicionado: ${departmentLabelOf(departmentId)}`)
    }
  }

  for (const departmentId of previousAccess.keys()) {
    if (!updatedAccess.has(departmentId)) {
      details.push(`Departamento removido: ${departmentLabelOf(departmentId)}`)
    }
  }

  const addedPages: string[] = []
  const removedPages: string[] = []

  for (const [departmentId, pageKeys] of updatedAccess) {
    const previousPageKeys = previousAccess.get(departmentId)
    if (!previousPageKeys) continue

    const department = departmentLabelOf(departmentId)

    for (const pageKey of pageKeys) {
      if (previousPageKeys.includes(pageKey)) continue

      addedPages.push(
        pageKey === MODEL_PAGE_KEY
          ? `Modelo liberado: ${department}`
          : `Página adicionada em ${department}: ${pageLabelOf(departmentId, pageKey)}`,
      )
    }

    for (const pageKey of previousPageKeys) {
      if (pageKeys.includes(pageKey)) continue

      removedPages.push(
        pageKey === MODEL_PAGE_KEY
          ? `Modelo removido: ${department}`
          : `Página removida em ${department}: ${pageLabelOf(departmentId, pageKey)}`,
      )
    }
  }

  details.push(...addedPages, ...removedPages)

  // Rede de segurança: uma alteração de acesso que nenhuma linha acima soube
  // descrever (base antiga fora de forma, por exemplo) ainda precisa aparecer.
  if (!details.length) details.push('Acessos atualizados.')

  return details
}

/** Motivo pelo qual a atualização conjunta de dados e acessos foi recusada. */
export type UserDetailsUpdateFailureReason =
  | 'not-found'
  | 'invalid-name'
  | 'invalid-email'
  | 'email-taken'
  | 'invalid-access-configuration'
  | 'self-access-change'
  | 'last-active-administrator'
  | 'storage-failure'

/** Mesmo contrato das demais operações: sucesso carrega o usuário (changed
    indica se algo mudou de fato) e recusa carrega o motivo para a interface. */
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

/**
 * Atualiza dados básicos, perfil e acessos de um usuário em uma única operação
 * atômica: as validações acontecem todas antes de qualquer escrita e a coleção
 * é gravada uma única vez, com um único timestamp. Se qualquer parte for
 * recusada, ou se o armazenamento falhar, nada é alterado, nem no storage nem
 * na memória, e a interface recebe o motivo. Não existe estado intermediário
 * com o nome novo e os acessos antigos.
 *
 * Dados básicos e acessos são avaliados separadamente, porque as proteções são
 * diferentes: o próprio Administrador pode editar seu nome e e-mail, mas uma
 * mudança de perfil ou de acessos sobre si mesmo é recusada. A proteção do
 * último Administrador ativo continua valendo para o alvo.
 *
 * Preserva id, status, último acesso e as auditorias anteriores de criação,
 * desativação e reativação.
 */
export function updateUserDetails(
  id: string,
  input: { name: string; email: string; access: UserAccessConfig },
  actor: UserActionActor,
): UserDetailsUpdateResult {
  const normalizedId = id.trim()
  if (!normalizedId) return { ok: false, reason: 'not-found' }

  const collection = loadUsers()
  const current = collection.find((user) => user.id === normalizedId)
  if (!current) return { ok: false, reason: 'not-found' }

  const validation = validateBasicData(collection, current, input)
  if (!validation.ok) return { ok: false, reason: validation.reason }

  const { name, email } = validation

  const access = deriveUserAccess(input.access)
  if (!access) return { ok: false, reason: 'invalid-access-configuration' }

  const basicDataChanged = name !== current.name || email !== current.email
  const accessChanged = !hasSameAccess(current, access)

  // Nada mudou: idempotente, sem gravação e sem tocar a auditoria.
  if (!basicDataChanged && !accessChanged) {
    return { ok: true, user: cloneUser(current), changed: false }
  }

  // Autoedição: nome e e-mail seguem permitidos, perfil e acessos não.
  if (accessChanged && current.id === actor.id) {
    return { ok: false, reason: 'self-access-change' }
  }

  // O portal não pode ficar sem Administrador ativo: o último deles mantém o perfil.
  if (
    accessChanged &&
    access.profile !== 'Administrador' &&
    isLastActiveAdministrator(collection, current)
  ) {
    return { ok: false, reason: 'last-active-administrator' }
  }

  const timestamp = new Date().toISOString()
  const updated: User = {
    ...cloneUser(current),
    ...access,
    name,
    email,
    initials: initials(name),
    audit: {
      ...current.audit,
      updatedAt: timestamp,
      updatedByUserId: actor.id,
      updatedByName: actor.name,
    },
  }

  const next = collection.map((user) => (user.id === current.id ? updated : user))
  // Mesmo timestamp da auditoria: o evento e o campo updatedAt descrevem o
  // mesmo acontecimento.
  const event = buildHistoryEvent(
    'updated',
    timestamp,
    updated,
    actor,
    buildUpdateDetails(current, updated),
  )

  if (!commitWithHistoryEvent(next, event)) return { ok: false, reason: 'storage-failure' }

  return { ok: true, user: cloneUser(updated), changed: true }
}

export function activateUser(id: string, actor: UserActionActor): UserStatusChangeResult {
  const normalized = id.trim()
  if (!normalized) return { ok: false, reason: 'not-found' }

  const collection = loadUsers()
  const current = collection.find((user) => user.id === normalized)
  if (!current) return { ok: false, reason: 'not-found' }

  if (current.status === 'Ativo') return { ok: true, user: cloneUser(current), changed: false }

  return applyStatusChange(collection, current, actor, 'Ativo', 'reactivated', (timestamp) => ({
    reactivatedAt: timestamp,
    reactivatedByUserId: actor.id,
    reactivatedByName: actor.name,
  }))
}
