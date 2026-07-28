import type { User } from '../../data/dashboardTypes'

/**
 * Único ponto do projeto autorizado a tocar o localStorage da base de
 * usuários. Sem regras de negócio: seed, cópias e buscas ficam no
 * userRepository.
 */
const USERS_STORAGE_KEY = 'impacto-bi.users'

/** null quando indisponível (SSR, modo privado ou bloqueio do navegador). */
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Coleção persistida, ou null quando ausente, corrompida ou inacessível. */
export function readStoredUsers(): User[] | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(USERS_STORAGE_KEY)
    if (raw === null) return null

    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as User[]) : null
  } catch {
    return null
  }
}

/** true quando gravou; falha (quota, modo privado) retorna false sem lançar. */
export function writeStoredUsers(users: User[]): boolean {
  const storage = getStorage()
  if (!storage) return false

  try {
    storage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
    return true
  } catch {
    return false
  }
}
