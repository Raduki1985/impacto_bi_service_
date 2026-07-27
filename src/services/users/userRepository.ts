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

/** Campos mutáveis ganham arrays novos; os primitivos vêm pelo spread. */
function cloneUser(user: User): User {
  return {
    ...user,
    permissionKeys: [...user.permissionKeys],
    departments: [...user.departments],
    departmentPageAccess: user.departmentPageAccess.map((access) => ({
      ...access,
      pageKeys: [...access.pageKeys],
    })),
  }
}

function cloneUsers(users: User[]): User[] {
  return users.map(cloneUser)
}

/** Última coleção conhecida da execução atual; sustenta falhas do storage. */
let inMemoryUsers: User[] | null = null

/** Coleção persistida, fallback da execução ou seed, nessa ordem. */
function loadUsers(): User[] {
  const stored = readStoredUsers()

  if (stored) {
    inMemoryUsers = cloneUsers(stored)
    return inMemoryUsers
  }

  // Storage vazio ou inacessível: reaproveita a coleção já obtida nesta execução.
  if (inMemoryUsers) return inMemoryUsers

  const initial = cloneUsers(seedUsers)
  writeStoredUsers(initial)
  inMemoryUsers = initial

  return inMemoryUsers
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
