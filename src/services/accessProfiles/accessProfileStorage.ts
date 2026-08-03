import { ACCESS_PROFILE_ID_PATTERN, normalizeAccessProfileName } from '../../lib/accessProfileRules'
import type { AccessProfile, DepartmentPageAccess, DepartmentPageReference } from '../../types/access'

/**
 * Único ponto do projeto autorizado a tocar o localStorage dos perfis de acesso.
 * Sem regras de negócio próprias: montagem, validação de domínio e geração de id
 * ficam em `accessProfileRepository`, e as regras puras continuam em
 * `lib/accessProfileRules`.
 *
 * Somente os perfis COMUNS são persistidos. O perfil do sistema é derivado dos
 * catálogos a cada leitura e por isso não tem lugar aqui: gravá-lo congelaria uma
 * fotografia do catálogo e exigiria migrar essa cópia toda vez que uma página
 * nova fosse publicada.
 *
 * O acesso ao armazenamento é redeclarado neste módulo, e não importado de
 * `userStorage`: os dois domínios convivem sem se conhecer, e um import aqui
 * amarraria o domínio novo ao modelo antigo justamente no ponto que o Bloco 1A
 * separou.
 *
 * O conteúdo persistido é dado externo: pode ter sido escrito por uma versão
 * anterior, editado à mão ou truncado. Por isso a coleção inteira é validada
 * campo a campo antes de ser devolvida, no mesmo critério já adotado no
 * Histórico: nada é corrigido nem descartado em silêncio, e conteúdo inválido
 * vira falha de leitura e permanece intocado no armazenamento.
 */

/**
 * Identidade reservada do perfil automático do Administrador.
 *
 * Mora neste módulo, e não no repositório, porque é aqui que ela precisa ser
 * recusada: o armazenamento guarda apenas perfis comuns, e nenhum deles pode
 * ocupar o id nem o nome do perfil que o portal deriva do catálogo. O
 * repositório importa as duas constantes para montar o perfil e as reexporta,
 * de modo que quem consome o repositório continua vendo uma origem só.
 */
export const SYSTEM_ACCESS_PROFILE_ID = 'acp-system'
export const SYSTEM_ACCESS_PROFILE_NAME = 'Acesso total'

/** Chave de comparação do nome reservado, para pegar também "acesso  TOTAL". */
const RESERVED_NAME_KEY = normalizeAccessProfileName(SYSTEM_ACCESS_PROFILE_NAME).comparisonKey

/** Coleção de perfis comuns. Mesmo padrão de nomenclatura de `impacto-bi.users`. */
export const ACCESS_PROFILES_STORAGE_KEY = 'impacto-bi.accessProfiles'

/**
 * Marca de versão do formato gravado, em chave separada da coleção.
 *
 * Versão 1: formato inicial dos perfis comuns. Nenhuma migração existe ainda, e
 * por isso a marca é gravada e ainda não é lida: ela precisa existir desde a
 * primeira base para que a primeira migração futura consiga distinguir uma base
 * escrita por esta versão de uma base anterior a ela.
 */
const ACCESS_PROFILES_VERSION_KEY = 'impacto-bi.accessProfiles.version'
const ACCESS_PROFILES_VERSION = 1

/** null quando indisponível (SSR, modo privado ou bloqueio do navegador). */
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Validação do conteúdo persistido                                           */
/* -------------------------------------------------------------------------- */

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDepartmentPageAccess(value: unknown): value is DepartmentPageAccess {
  if (!isPlainObject(value)) return false

  return (
    isNonEmptyString(value.departmentId) &&
    Array.isArray(value.pageKeys) &&
    value.pageKeys.every(isNonEmptyString)
  )
}

function isDepartmentPageReference(value: unknown): value is DepartmentPageReference {
  if (!isPlainObject(value)) return false

  return isNonEmptyString(value.departmentId) && isNonEmptyString(value.pageKey)
}

/**
 * Estrutura de um perfil isolado: só é aceito com todos os campos presentes e
 * no formato certo.
 *
 * `kind` precisa ser 'standard': só perfil comum é gravado, então um perfil do
 * sistema encontrado no armazenamento é conteúdo estranho a este domínio, e não
 * um registro a ser aproveitado.
 *
 * O id é conferido aqui apenas como texto não vazio. O padrão `acp-NNN`, os ids
 * duplicados, os nomes duplicados e a identidade reservada do perfil do sistema
 * são avaliados depois, em `isValidAccessProfileCollection`, porque dependem da
 * coleção inteira e não de um perfil sozinho.
 */
function isStoredAccessProfile(value: unknown): value is AccessProfile {
  if (!isPlainObject(value)) return false

  const description = value.description

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    (description === undefined || typeof description === 'string') &&
    value.kind === 'standard' &&
    (value.lifecycle === 'active' || value.lifecycle === 'inactive') &&
    Array.isArray(value.departmentPageAccess) &&
    value.departmentPageAccess.every(isDepartmentPageAccess) &&
    isDepartmentPageReference(value.homePage) &&
    typeof value.hasBeenUsed === 'boolean'
  )
}

/**
 * Integridade da coleção inteira, avaliada depois de cada perfil já ter sido
 * aceito individualmente.
 *
 * Um perfil pode estar impecável sozinho e ainda assim ser inaceitável ao lado
 * dos outros: id repetido faz a edição alcançar dois perfis de uma vez, nome
 * repetido torna a lista ambígua para quem escolhe um perfil, e o id ou o nome
 * do perfil do sistema fariam o portal exibir dois "Acesso total", um deles
 * editável e congelado no catálogo de ontem.
 *
 * As regras de formato e de comparação vêm do domínio, e não são reescritas
 * aqui: o padrão do id é `ACCESS_PROFILE_ID_PATTERN` e a comparação de nome é a
 * chave de `normalizeAccessProfileName`, a mesma que recusa nome duplicado na
 * criação.
 */
function isValidAccessProfileCollection(profiles: readonly AccessProfile[]): boolean {
  const ids = new Set<string>()
  const nameKeys = new Set<string>()

  for (const profile of profiles) {
    // O reservado é avaliado antes do formato: a recusa aqui é pela identidade
    // do perfil do sistema, e não porque 'acp-system' também não casa com o
    // padrão numérico.
    if (profile.id === SYSTEM_ACCESS_PROFILE_ID) return false
    if (!ACCESS_PROFILE_ID_PATTERN.test(profile.id)) return false
    if (ids.has(profile.id)) return false
    ids.add(profile.id)

    const { comparisonKey } = normalizeAccessProfileName(profile.name)
    if (comparisonKey === RESERVED_NAME_KEY) return false
    if (nameKeys.has(comparisonKey)) return false
    nameKeys.add(comparisonKey)

    // Descrição ausente é o estado normal de um perfil sem descrição. Texto
    // vazio ou só com espaços é conteúdo que o domínio nunca grava.
    if (profile.description !== undefined && !profile.description.trim()) return false
  }

  return true
}

/** Cópia defensiva com os campos conhecidos: nada além do perfil atravessa. */
function cloneAccessProfile(profile: AccessProfile): AccessProfile {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    kind: profile.kind,
    lifecycle: profile.lifecycle,
    departmentPageAccess: profile.departmentPageAccess.map((access) => ({
      departmentId: access.departmentId,
      pageKeys: [...access.pageKeys],
    })),
    homePage: { ...profile.homePage },
    hasBeenUsed: profile.hasBeenUsed,
  }
}

export function cloneAccessProfiles(profiles: readonly AccessProfile[]): AccessProfile[] {
  return profiles.map(cloneAccessProfile)
}

/* -------------------------------------------------------------------------- */
/* Leitura                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Coleção persistida de perfis comuns.
 *
 * `[]` quando a chave ainda não existe, ou seja, nenhum perfil comum foi criado.
 * `null` quando a leitura falhou: armazenamento inacessível, JSON inválido,
 * conteúdo que não é um array ou qualquer perfil fora do formato. A distinção
 * importa porque quem grava precisa recusar a operação em vez de sobrescrever
 * uma coleção que ninguém conseguiu ler.
 *
 * A validação é da coleção inteira, e não item a item: um único perfil inválido
 * invalida a leitura, em vez de o registro sumir da lista sem ninguém notar. São
 * duas passagens, e as duas precisam passar: cada perfil isoladamente e depois a
 * coleção como conjunto, com ids únicos, nomes únicos e nada ocupando a
 * identidade reservada do perfil do sistema.
 */
export function readStoredAccessProfiles(): AccessProfile[] | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(ACCESS_PROFILES_STORAGE_KEY)
    if (raw === null) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null

    const profiles: unknown[] = parsed
    if (!profiles.every(isStoredAccessProfile)) return null
    if (!isValidAccessProfileCollection(profiles)) return null

    return cloneAccessProfiles(profiles)
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Escrita                                                                    */
/* -------------------------------------------------------------------------- */

/** Par chave e conteúdo já serializado, na ordem em que deve ser gravado. */
type StorageEntry = { key: string; value: string }

/**
 * Recuperação de melhor esforço de uma chave: repõe o valor anterior ou remove a
 * chave que antes não existia. Nunca lança: o rollback é uma tentativa, e a
 * falha completa já é comunicada pelo retorno da operação.
 */
function restoreEntry(storage: Storage, key: string, previous: string | null): void {
  try {
    if (previous === null) storage.removeItem(key)
    else storage.setItem(key, previous)
  } catch {
    // Armazenamento indisponível: nada mais a fazer aqui. Quem chamou recebe
    // false e trata a operação como não aplicada.
  }
}

/**
 * Grava coleção e marca de versão como uma única operação lógica.
 *
 * O localStorage não tem transação, então a consistência entre as duas chaves é
 * garantida por rollback: os valores anteriores são lidos antes de qualquer
 * escrita e repostos se qualquer gravação falhar. Só devolve true quando as duas
 * foram concluídas. A serialização acontece dentro da mesma proteção, para um
 * conteúdo problemático virar falha, e não exceção.
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
 * true somente quando a coleção e a marca de versão foram gravadas em conjunto;
 * falha (quota, modo privado) retorna false sem lançar, com o armazenamento
 * revertido exatamente ao estado anterior.
 *
 * A coleção passa pelas mesmas duas validações da leitura, e uma reprovação
 * devolve false sem tocar no armazenamento: o que sai daqui é sempre legível de
 * volta. É por aí que o perfil do sistema é recusado, junto com id repetido,
 * nome repetido, id fora do padrão e descrição vazia.
 */
export function writeStoredAccessProfiles(profiles: readonly AccessProfile[]): boolean {
  if (!profiles.every(isStoredAccessProfile)) return false
  if (!isValidAccessProfileCollection(profiles)) return false

  const storage = getStorage()
  if (!storage) return false

  return persistEntries(storage, () => [
    { key: ACCESS_PROFILES_STORAGE_KEY, value: JSON.stringify(cloneAccessProfiles(profiles)) },
    { key: ACCESS_PROFILES_VERSION_KEY, value: String(ACCESS_PROFILES_VERSION) },
  ])
}
