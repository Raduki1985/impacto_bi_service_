import type { User } from '../../data/dashboardTypes'
import {
  ensureUsersIntelligenceAccess,
  ensureUsersOverviewAccess,
  realignUsersAccess,
} from '../../lib/userAccessRules'
import type { UserHistoryEvent } from '../../types/userHistory'

/**
 * Único ponto do projeto autorizado a tocar o localStorage da base de
 * usuários. Sem regras de negócio próprias: seed, cópias e buscas ficam no
 * userRepository e a derivação dos acessos das migrações fica em
 * `userAccessRules`.
 *
 * As chaves e o acesso ao armazenamento moram aqui, inclusive a do Histórico,
 * porque usuários e Histórico precisam ser gravados na mesma operação. A
 * leitura do Histórico fica em `userHistoryStorage`, que reaproveita a chave e
 * o acesso daqui.
 */
const USERS_STORAGE_KEY = 'impacto-bi.users'

/** Coleção de eventos do Histórico, separada da coleção de usuários. */
export const USER_HISTORY_STORAGE_KEY = 'impacto-bi.userHistory'

/**
 * Marca de versão dos acessos, gravada em chave separada da coleção. Bases
 * escritas por esta versão do código já seguem as regras vigentes, então cada
 * migração de acessos só roda enquanto a marca estiver abaixo da versão que a
 * introduziu. É isso que impede que páginas retiradas manualmente pelo
 * Administrador voltem a ser reintroduzidas em uma leitura posterior.
 *
 * Versão 1: realinhamento completo aos padrões por perfil, para bases criadas
 * com as regras antigas (Executivo só com páginas prontas, Analista só com a
 * Visão Geral).
 *
 * Versão 2: Visão Geral obrigatória em cada departamento de um Analista.
 * Acrescenta somente a página que falta, sem reaplicar padrões, porque a essa
 * altura já existem remoções manuais que precisam ser mantidas.
 *
 * Versão 3: Inteligência (IA), acrescentada aos catálogos depois que já havia
 * base persistida. Distribui a página aos departamentos que o Analista já
 * possui, também sem reaplicar padrões.
 */
const USERS_ACCESS_VERSION_KEY = 'impacto-bi.users.accessVersion'
const ACCESS_DEFAULTS_VERSION = 1
const OVERVIEW_REQUIRED_VERSION = 2
const INTELLIGENCE_REQUIRED_VERSION = 3
const USERS_ACCESS_VERSION = INTELLIGENCE_REQUIRED_VERSION

/**
 * Nomes antigos do perfil que hoje é o Analista, na ordem em que existiram:
 * "Gestor" primeiro, "Usuário Departamental" depois. Coleções salvas antes de
 * cada renomeação ainda podem carregá-los, mesmo já não existindo no tipo
 * UserProfile, e por isso os dois continuam sendo reconhecidos na leitura.
 */
const LEGACY_ANALYST_PROFILES: readonly string[] = ['Gestor', 'Usuário Departamental']
const ANALYST_PROFILE: User['profile'] = 'Analista'

/** null quando indisponível (SSR, modo privado ou bloqueio do navegador). */
export function getStorage(): Storage | null {
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

/** Par chave e conteúdo já serializado, na ordem em que deve ser gravado. */
type StorageEntry = { key: string; value: string }

/**
 * Grava um conjunto de chaves como uma única operação lógica.
 *
 * O localStorage não tem transação, então a consistência entre as chaves é
 * garantida por rollback: os valores anteriores de todas elas são lidos antes
 * de qualquer escrita e repostos se qualquer gravação falhar. Só devolve true
 * quando todas foram concluídas.
 *
 * É a única implementação de rollback do módulo, usada tanto pela gravação de
 * usuários e versão quanto pela gravação conjunta com o Histórico. A montagem
 * das entradas acontece dentro da mesma proteção, para uma serialização
 * problemática também virar falha, e não exceção.
 */
function persistEntries(storage: Storage, buildEntries: () => StorageEntry[]): boolean {
  let entries: StorageEntry[]
  let previous: { key: string; value: string | null }[]

  try {
    entries = buildEntries()
    previous = entries.map((entry) => ({ key: entry.key, value: storage.getItem(entry.key) }))
  } catch {
    // Sem os valores anteriores não existe rollback possível: nada é gravado.
    return false
  }

  try {
    for (const entry of entries) storage.setItem(entry.key, entry.value)
    return true
  } catch {
    for (const entry of previous) restoreEntry(storage, entry.key, entry.value)
    return false
  }
}

/**
 * Coleção de usuários e marca de versão andam sempre juntas: uma coleção nova
 * marcada com a versão antiga faria a leitura seguinte reaplicar as migrações
 * de acesso e reintroduzir páginas retiradas manualmente.
 */
function userEntries(users: User[]): StorageEntry[] {
  return [
    { key: USERS_STORAGE_KEY, value: JSON.stringify(users) },
    { key: USERS_ACCESS_VERSION_KEY, value: String(USERS_ACCESS_VERSION) },
  ]
}

function persistUsersAndVersion(users: User[], storage: Storage): boolean {
  return persistEntries(storage, () => userEntries(users))
}

/**
 * Migração das duas renomeações já aplicadas ao mesmo perfil:
 *
 * - "Gestor" → "Analista";
 * - "Usuário Departamental" → "Analista".
 *
 * O JSON persistido é dado externo e pode trazer qualquer um dos dois valores
 * legados, inclusive uma base antiga que nunca passou pela primeira renomeação.
 * Converte somente o campo profile e preserva todos os demais campos por
 * espalhamento, sem tocar em acessos, auditoria ou ordem dos arrays.
 *
 * Administrador e Executivo nunca entram aqui, e uma coleção já normalizada como
 * Analista devolve `changed: false` e a própria coleção intocada, o que é o que
 * impede uma regravação a cada leitura.
 */
function migrateLegacyProfiles(users: User[]): { users: User[]; changed: boolean } {
  let changed = false

  const normalized = users.map((user) => {
    const profile: unknown = (user as { profile?: unknown }).profile
    if (typeof profile !== 'string' || !LEGACY_ANALYST_PROFILES.includes(profile)) return user

    changed = true
    return { ...user, profile: ANALYST_PROFILE }
  })

  return { users: normalized, changed }
}

/**
 * Aplica as migrações pendentes e regrava a coleção na mesma chave, para as
 * conversões acontecerem uma única vez.
 *
 * Cada etapa é decidida pela marca de versão da base e roda na ordem em que foi
 * introduzida: uma base sem marca passa pelo realinhamento completo e, em
 * seguida, pelas etapas aditivas, que nesse caso não têm nada a fazer, porque o
 * realinhamento já aplicou os padrões vigentes; uma base já na versão 1 passa
 * somente pelas etapas posteriores a ela, e assim por diante.
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
  const intelligenceOutdated = version < INTELLIGENCE_REQUIRED_VERSION

  let migrated = profiles.users
  if (defaultsOutdated) migrated = realignUsersAccess(migrated)
  if (overviewOutdated) migrated = ensureUsersOverviewAccess(migrated)
  if (intelligenceOutdated) migrated = ensureUsersIntelligenceAccess(migrated)

  if (profiles.changed || defaultsOutdated || overviewOutdated || intelligenceOutdated) {
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

/**
 * Grava a coleção de usuários, a marca de versão e a coleção de Histórico como
 * uma operação só. É o caminho das ações que registram evento: ou o usuário
 * alterado e o evento ficam gravados juntos, ou nenhum dos dois é aplicado e o
 * armazenamento volta exatamente ao estado anterior, inclusive removendo a
 * chave de Histórico que ainda não existia.
 *
 * `writeStoredUsers` continua atendendo as gravações que não geram Histórico,
 * como a carga inicial do seed e as migrações.
 */
export function writeStoredUsersWithHistory(users: User[], history: UserHistoryEvent[]): boolean {
  const storage = getStorage()
  if (!storage) return false

  return persistEntries(storage, () => [
    ...userEntries(users),
    { key: USER_HISTORY_STORAGE_KEY, value: JSON.stringify(history) },
  ])
}
