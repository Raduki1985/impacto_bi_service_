import { users as seedUsers } from '../../data/mockAdminData'
import type { User } from '../../data/dashboardTypes'
import { readStoredUsers, writeStoredUsers } from './userStorage'

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

/** Persiste a coleção inteira; em falha, o fallback vira a fonte da execução. */
function persistUsers(users: User[]): User[] {
  inMemoryUsers = cloneUsers(users)
  preferInMemoryUsers = !writeStoredUsers(inMemoryUsers)

  return cloneUsers(inMemoryUsers)
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
 * Executa uma transição de status já autorizada: gera o timestamp, registra os
 * últimos eventos de auditoria da categoria sem apagar os anteriores e
 * persiste a coleção inteira.
 */
function applyStatusChange(
  collection: User[],
  current: User,
  actor: UserActionActor,
  status: User['status'],
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

  persistUsers(collection.map((user) => (user.id === current.id ? updated : user)))

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

  if (current.profile === 'Administrador') {
    const activeAdministrators = collection.filter(
      (user) => user.profile === 'Administrador' && user.status === 'Ativo',
    ).length

    if (activeAdministrators <= 1) return { ok: false, reason: 'last-active-administrator' }
  }

  return applyStatusChange(collection, current, actor, 'Inativo', (timestamp) => ({
    deactivatedAt: timestamp,
    deactivatedByUserId: actor.id,
    deactivatedByName: actor.name,
  }))
}

export function activateUser(id: string, actor: UserActionActor): UserStatusChangeResult {
  const normalized = id.trim()
  if (!normalized) return { ok: false, reason: 'not-found' }

  const collection = loadUsers()
  const current = collection.find((user) => user.id === normalized)
  if (!current) return { ok: false, reason: 'not-found' }

  if (current.status === 'Ativo') return { ok: true, user: cloneUser(current), changed: false }

  return applyStatusChange(collection, current, actor, 'Ativo', (timestamp) => ({
    reactivatedAt: timestamp,
    reactivatedByUserId: actor.id,
    reactivatedByName: actor.name,
  }))
}
