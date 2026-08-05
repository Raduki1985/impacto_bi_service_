import { FULL_ACCESS_PROFILE_NAME } from '../../config/accessProfileCatalog'
import {
  ACCESS_PROFILE_ID_PATTERN,
  isStandardAccessProfileAudience,
  normalizeAccessProfileName,
} from '../../lib/accessProfileRules'
import type {
  DepartmentPageAccess,
  DepartmentPageReference,
  StandardAccessProfile,
} from '../../types/access'

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
 *
 * O nome vem de `config/accessProfileCatalog`, que é onde os nomes aprovados dos
 * Perfis de Acesso já viviam para as telas: com uma constante própria aqui, o
 * portal teria dois textos concorrentes para o mesmo perfil.
 */
export const SYSTEM_ACCESS_PROFILE_ID = 'acp-system'
export const SYSTEM_ACCESS_PROFILE_NAME = FULL_ACCESS_PROFILE_NAME

/** Chave de comparação do nome reservado, para pegar também "acesso  TOTAL". */
const RESERVED_NAME_KEY = normalizeAccessProfileName(SYSTEM_ACCESS_PROFILE_NAME).comparisonKey

/** Coleção de perfis comuns. Mesmo padrão de nomenclatura de `impacto-bi.users`. */
export const ACCESS_PROFILES_STORAGE_KEY = 'impacto-bi.accessProfiles'

/**
 * Marca de versão do formato gravado, em chave separada da coleção.
 *
 * Versão 1: formato inicial dos perfis comuns, sem destino.
 * Versão 2: o destino (`audience`) passa a ser obrigatório em cada perfil comum.
 *
 * A marca continua sendo gravada e não lida: quem decide a versão de uma coleção
 * é o conteúdo dela, e não esta chave. As duas podem discordar (uma base editada
 * à mão, uma chave apagada sozinha), e nesse caso é o conteúdo que diz o que
 * pode ou não ser lido. A marca serve de registro do formato que esta versão
 * grava.
 */
const ACCESS_PROFILES_VERSION_KEY = 'impacto-bi.accessProfiles.version'
const ACCESS_PROFILES_VERSION = 2

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
 * Campos que a versão 1 e a versão 2 do formato têm em comum: tudo, menos o
 * destino.
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
function hasStoredAccessProfileContent(value: unknown): value is Record<string, unknown> {
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
 * Estrutura de um perfil isolado no formato atual: o conteúdo comum mais o
 * destino, que precisa ser um dos dois aceitos por perfil comum.
 */
function isStoredAccessProfile(value: unknown): value is StandardAccessProfile {
  return hasStoredAccessProfileContent(value) && isStandardAccessProfileAudience(value.audience)
}

/** Perfil comum como a versão 1 do formato o gravava: sem destino. */
type LegacyStoredAccessProfile = Omit<StandardAccessProfile, 'audience'>

/**
 * Perfil gravado pela versão 1 do formato: idêntico ao atual, exceto por não ter
 * destino nenhum.
 *
 * A ausência precisa ser exatamente ausência. Um perfil com `audience` presente
 * e fora dos valores aceitos não é um registro antigo, é um registro corrompido,
 * e tratá-lo como antigo colocaria conteúdo estragado na fila de classificação.
 */
function isLegacyStoredAccessProfile(value: unknown): value is LegacyStoredAccessProfile {
  return hasStoredAccessProfileContent(value) && value.audience === undefined
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
function isValidAccessProfileCollection(
  profiles: readonly { id: string; name: string; description?: string }[],
): boolean {
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

/**
 * Cópia defensiva com os campos conhecidos: nada além do perfil atravessa.
 *
 * O destino é copiado como qualquer outro campo do perfil. Ele não é recalculado
 * nem preenchido aqui: uma cópia que inventasse destino faria exatamente a
 * dedução silenciosa que este bloco existe para impedir.
 */
function cloneAccessProfile(profile: StandardAccessProfile): StandardAccessProfile {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    kind: profile.kind,
    audience: profile.audience,
    lifecycle: profile.lifecycle,
    departmentPageAccess: profile.departmentPageAccess.map((access) => ({
      departmentId: access.departmentId,
      pageKeys: [...access.pageKeys],
    })),
    homePage: { ...profile.homePage },
    hasBeenUsed: profile.hasBeenUsed,
  }
}

export function cloneAccessProfiles(
  profiles: readonly StandardAccessProfile[],
): StandardAccessProfile[] {
  return profiles.map(cloneAccessProfile)
}

/* -------------------------------------------------------------------------- */
/* Leitura                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Resultado de uma leitura da coleção persistida.
 *
 * As duas recusas são coisas diferentes e precisam continuar diferentes até
 * quem decide o que fazer:
 *
 * 'storage-failure' é falha de leitura: armazenamento inacessível, JSON
 * inválido, conteúdo que não é um array ou coleção fora de forma. Ninguém sabe o
 * que está gravado, e por isso ninguém pode gravar por cima.
 *
 * 'audience-classification-required' é o oposto: a coleção foi lida por inteiro
 * e está íntegra, só que no formato anterior, sem destino em nenhum perfil. Não
 * é defeito, é uma base que precede este bloco. O conteúdo permanece exatamente
 * como está no armazenamento até alguém dizer quais perfis são de Executivos e
 * quais são de Analistas.
 */
export type StoredAccessProfilesResult =
  | { ok: true; profiles: StandardAccessProfile[] }
  | { ok: false; reason: 'storage-failure' }
  | {
      ok: false
      reason: 'audience-classification-required'
      /** Quantos perfis antigos aguardam classificação. Nenhum deles é alterado. */
      profileCount: number
    }

/**
 * Estado da chave da coleção, antes de qualquer interpretação do conteúdo.
 *
 * Responde uma pergunta que `readStoredAccessProfiles` não responde: se a chave
 * chegou a existir. Lá, uma chave ausente e uma coleção gravada como `[]` são a
 * mesma resposta de sucesso com nenhum perfil, o que é correto para quem vai
 * listar. Para quem vai SEMEAR a coleção inicial, os dois estados são opostos:
 * a ausência é uma base que nunca foi inicializada, e o array vazio é uma base
 * em que alguém apagou todos os perfis. Semear a segunda recriaria justamente
 * os perfis que foram excluídos de propósito.
 *
 * 'present' cobre qualquer conteúdo gravado, inclusive o ilegível e o do
 * formato anterior: nenhum deles autoriza escrita.
 */
export type AccessProfilesStorageState = 'missing' | 'present' | 'unavailable'

export function readAccessProfilesStorageState(): AccessProfilesStorageState {
  const storage = getStorage()
  if (!storage) return 'unavailable'

  try {
    return storage.getItem(ACCESS_PROFILES_STORAGE_KEY) === null ? 'missing' : 'present'
  } catch {
    return 'unavailable'
  }
}

/**
 * Coleção persistida de perfis comuns.
 *
 * Coleção vazia quando a chave ainda não existe, ou seja, nenhum perfil comum
 * foi criado. Uma base antiga vazia também responde sucesso: não existe registro
 * para classificar, e a próxima gravação já sai no formato novo sem perder nada.
 *
 * A validação é da coleção inteira, e não item a item: um único perfil inválido
 * invalida a leitura, em vez de o registro sumir da lista sem ninguém notar. São
 * duas passagens, e as duas precisam passar: cada perfil isoladamente e depois a
 * coleção como conjunto, com ids únicos, nomes únicos e nada ocupando a
 * identidade reservada do perfil do sistema.
 *
 * A ordem das tentativas é formato atual primeiro, formato anterior depois. Uma
 * coleção só é dada como antiga quando TODOS os perfis dela estão sem destino e
 * o conjunto passaria na validação: uma coleção com destino em uns e não em
 * outros, ou com id repetido, não é uma base anterior a este bloco, é uma base
 * fora de forma, e vira falha de leitura.
 *
 * Nada é convertido, nem gravado, nem apagado por uma leitura.
 */
export function readStoredAccessProfiles(): StoredAccessProfilesResult {
  const storage = getStorage()
  if (!storage) return { ok: false, reason: 'storage-failure' }

  try {
    const raw = storage.getItem(ACCESS_PROFILES_STORAGE_KEY)
    if (raw === null) return { ok: true, profiles: [] }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return { ok: false, reason: 'storage-failure' }

    const profiles: unknown[] = parsed

    if (profiles.every(isStoredAccessProfile)) {
      if (!isValidAccessProfileCollection(profiles)) return { ok: false, reason: 'storage-failure' }

      return { ok: true, profiles: cloneAccessProfiles(profiles) }
    }

    if (profiles.every(isLegacyStoredAccessProfile) && isValidAccessProfileCollection(profiles)) {
      // Coleção antiga vazia não chega aqui: `every` de um array vazio é true no
      // primeiro teste, e ela já saiu como sucesso com nenhum perfil.
      return {
        ok: false,
        reason: 'audience-classification-required',
        profileCount: profiles.length,
      }
    }

    return { ok: false, reason: 'storage-failure' }
  } catch {
    return { ok: false, reason: 'storage-failure' }
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
 * volta. É por aí que o perfil do sistema é recusado, junto com perfil sem
 * destino, id repetido, nome repetido, id fora do padrão e descrição vazia.
 *
 * Uma base antiga pendente de classificação também recusa a gravação, e essa é a
 * única checagem que olha o que já está no armazenamento. Sem ela, a primeira
 * escrita substituiria a coleção inteira pela lista que veio de fora, e os
 * perfis que ninguém classificou desapareceriam justamente por serem antigos.
 */
export function writeStoredAccessProfiles(profiles: readonly StandardAccessProfile[]): boolean {
  if (!profiles.every(isStoredAccessProfile)) return false
  if (!isValidAccessProfileCollection(profiles)) return false

  const storage = getStorage()
  if (!storage) return false

  const current = readStoredAccessProfiles()
  if (!current.ok && current.reason === 'audience-classification-required') return false

  return persistEntries(storage, () => [
    { key: ACCESS_PROFILES_STORAGE_KEY, value: JSON.stringify(cloneAccessProfiles(profiles)) },
    { key: ACCESS_PROFILES_VERSION_KEY, value: String(ACCESS_PROFILES_VERSION) },
  ])
}
