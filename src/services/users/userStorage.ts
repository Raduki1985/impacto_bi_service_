import type { User } from '../../data/dashboardTypes'
import { ensureUsersOverviewAccess, realignUsersAccess } from '../../lib/userAccessRules'

/**
 * Único ponto do projeto autorizado a tocar o localStorage da base de
 * usuários. Sem regras de negócio próprias: seed, cópias e buscas ficam no
 * userRepository e a derivação dos acessos das migrações fica em
 * `userAccessRules`.
 */
const USERS_STORAGE_KEY = 'impacto-bi.users'

/**
 * Marca de versão dos acessos, gravada em chave separada da coleção. Bases
 * escritas por esta versão do código já seguem as regras vigentes, então cada
 * migração de acessos só roda enquanto a marca estiver abaixo da versão que a
 * introduziu. É isso que impede que páginas retiradas manualmente pelo
 * Administrador voltem a ser reintroduzidas em uma leitura posterior.
 *
 * Versão 1: realinhamento completo aos padrões por perfil, para bases criadas
 * com as regras antigas (Executivo só com páginas prontas, Usuário
 * Departamental só com a Visão Geral).
 *
 * Versão 2: Visão Geral obrigatória em cada departamento de um Usuário
 * Departamental. Acrescenta somente a página que falta, sem reaplicar padrões,
 * porque a essa altura já existem remoções manuais que precisam ser mantidas.
 */
const USERS_ACCESS_VERSION_KEY = 'impacto-bi.users.accessVersion'
const ACCESS_DEFAULTS_VERSION = 1
const OVERVIEW_REQUIRED_VERSION = 2
const USERS_ACCESS_VERSION = OVERVIEW_REQUIRED_VERSION

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

/** Versão de acessos já aplicada à base persistida; 0 quando ausente ou ilegível. */
function readAccessVersion(storage: Storage): number {
  try {
    const raw = storage.getItem(USERS_ACCESS_VERSION_KEY)
    if (raw === null) return 0

    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

/**
 * Recuperação de melhor esforço de uma chave: repõe o valor anterior ou remove
 * a chave que antes não existia. Nunca lança: o rollback é uma tentativa, e a
 * falha completa já é comunicada pelo retorno da operação.
 */
function restoreEntry(storage: Storage, key: string, previous: string | null): void {
  try {
    if (previous === null) storage.removeItem(key)
    else storage.setItem(key, previous)
  } catch {
    // Armazenamento indisponível: nada mais a fazer aqui. Quem chamou recebe
    // false e a base não é dada como alinhada à versão atual.
  }
}

/**
 * Grava a coleção e a marca de versão como uma única operação lógica.
 *
 * O localStorage não tem transação, então a consistência entre as duas chaves é
 * garantida por rollback: os valores anteriores são lidos antes de qualquer
 * escrita e repostos se alguma das duas gravações falhar. Só devolve true
 * quando as duas foram concluídas, porque uma coleção nova marcada com a versão
 * antiga faria a leitura seguinte reaplicar os padrões de acesso e reintroduzir
 * páginas retiradas manualmente.
 */
function persistUsersAndVersion(users: User[], storage: Storage): boolean {
  let previousUsers: string | null
  let previousVersion: string | null

  try {
    previousUsers = storage.getItem(USERS_STORAGE_KEY)
    previousVersion = storage.getItem(USERS_ACCESS_VERSION_KEY)
  } catch {
    // Sem os valores anteriores não existe rollback possível: nada é gravado.
    return false
  }

  try {
    storage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
    storage.setItem(USERS_ACCESS_VERSION_KEY, String(USERS_ACCESS_VERSION))
    return true
  } catch {
    restoreEntry(storage, USERS_STORAGE_KEY, previousUsers)
    restoreEntry(storage, USERS_ACCESS_VERSION_KEY, previousVersion)
    return false
  }
}

/**
 * Migração da renomeação "Gestor" → "Usuário Departamental": o JSON persistido
 * é dado externo e pode trazer o valor legado. Converte somente o campo
 * profile e preserva todos os demais campos por espalhamento. Sem ocorrência
 * legada, devolve a coleção intocada.
 */
function migrateLegacyProfiles(users: User[]): { users: User[]; changed: boolean } {
  let changed = false

  const normalized = users.map((user) => {
    if ((user as { profile?: unknown }).profile !== LEGACY_DEPARTMENTAL_PROFILE) return user

    changed = true
    return { ...user, profile: DEPARTMENTAL_PROFILE }
  })

  return { users: normalized, changed }
}

/**
 * Aplica as migrações pendentes e regrava a coleção na mesma chave, para as
 * conversões acontecerem uma única vez.
 *
 * Cada etapa é decidida pela marca de versão da base e roda na ordem em que foi
 * introduzida: uma base sem marca passa pelo realinhamento completo e, em
 * seguida, pela garantia da Visão Geral, que nesse caso não tem nada a fazer;
 * uma base já na versão 1 passa somente pela segunda etapa.
 *
 * Coleção e marca são persistidas juntas: se a gravação completa falhar, o
 * armazenamento volta ao estado anterior, com a coleção antiga e a versão
 * antiga, e a migração é tentada de novo na próxima leitura, sempre com o mesmo
 * resultado. Enquanto isso, a coleção migrada vale apenas em memória.
 */
function migrateStoredUsers(users: User[], storage: Storage): User[] {
  const profiles = migrateLegacyProfiles(users)
  const version = readAccessVersion(storage)
  const defaultsOutdated = version < ACCESS_DEFAULTS_VERSION
  const overviewOutdated = version < OVERVIEW_REQUIRED_VERSION

  let migrated = profiles.users
  if (defaultsOutdated) migrated = realignUsersAccess(migrated)
  if (overviewOutdated) migrated = ensureUsersOverviewAccess(migrated)

  if (profiles.changed || defaultsOutdated || overviewOutdated) {
    persistUsersAndVersion(migrated, storage)
  }

  return migrated
}

/** Coleção persistida, ou null quando ausente, corrompida ou inacessível. */
export function readStoredUsers(): User[] | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(USERS_STORAGE_KEY)
    if (raw === null) return null

    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? migrateStoredUsers(parsed as User[], storage) : null
  } catch {
    return null
  }
}

/**
 * true somente quando a coleção e a marca de versão foram gravadas em conjunto;
 * falha (quota, modo privado) retorna false sem lançar, com o armazenamento
 * revertido ao estado anterior.
 *
 * A coleção sai daqui já escrita pelas regras vigentes: alinhar a marca na mesma
 * operação é o que impede a migração de reaplicar padrões sobre edições
 * granulares em uma leitura posterior.
 */
export function writeStoredUsers(users: User[]): boolean {
  const storage = getStorage()
  if (!storage) return false

  return persistUsersAndVersion(users, storage)
}
