import type { User } from '../../data/dashboardTypes'

/**
 * Único ponto do projeto autorizado a tocar o localStorage da base de
 * usuários. Sem regras de negócio: seed, cópias e buscas ficam no
 * userRepository.
 */
const USERS_STORAGE_KEY = 'impacto-bi.users'

/** Nome antigo do perfil departamental; coleções salvas antes da renomeação
    ainda podem carregá-lo, mesmo já não existindo no tipo UserProfile. */
const LEGACY_DEPARTMENTAL_PROFILE = 'Gestor'
const DEPARTMENTAL_PROFILE: User['profile'] = 'Usuário Departamental'

/** null quando indisponível (SSR, modo privado ou bloqueio do navegador). */
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Migração da renomeação "Gestor" → "Usuário Departamental": o JSON persistido
 * é dado externo e pode trazer o valor legado. Converte somente o campo
 * profile, preserva todos os demais campos por espalhamento e regrava a
 * coleção na mesma chave, para a conversão acontecer uma única vez. Sem
 * ocorrência legada, devolve a coleção intocada e não regrava nada.
 */
function migrateLegacyProfiles(users: User[], storage: Storage): User[] {
  let migrated = false

  const normalized = users.map((user) => {
    if ((user as { profile?: unknown }).profile !== LEGACY_DEPARTMENTAL_PROFILE) return user

    migrated = true
    return { ...user, profile: DEPARTMENTAL_PROFILE }
  })

  if (migrated) {
    try {
      storage.setItem(USERS_STORAGE_KEY, JSON.stringify(normalized))
    } catch {
      // Quota ou bloqueio: segue com a coleção normalizada em memória; a
      // próxima gravação bem-sucedida persiste o formato novo.
    }
  }

  return normalized
}

/** Coleção persistida, ou null quando ausente, corrompida ou inacessível. */
export function readStoredUsers(): User[] | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(USERS_STORAGE_KEY)
    if (raw === null) return null

    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? migrateLegacyProfiles(parsed as User[], storage) : null
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
