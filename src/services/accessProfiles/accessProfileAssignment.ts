import { departmentPages } from '../../config/departmentPages'
import { ADMIN_USERS_READ_PERMISSION } from '../../config/permissions'
import type { User } from '../../data/dashboardTypes'
import {
  findMigrationAccessProfile,
  isAccessProfileAssignableToUserProfile,
  normalizeAccessProfileGrants,
  normalizeStoredAccessProfileId,
  resolveAccessProfileHomePage,
  validateAccessProfileCreationDraft,
  validateAccessProfileDraft,
} from '../../lib/accessProfileRules'
import { deriveUserAccess, findDepartment, type DerivedUserAccess } from '../../lib/userAccessRules'
import type {
  AccessProfile,
  AccessProfileDraftError,
  DepartmentPageAccess,
  StandardAccessProfile,
  StandardAccessProfileAudience,
  UserProfile,
} from '../../types/access'
import type {
  AccessProfileHistoryAction,
  AccessProfileHistoryEvent,
  HistoryEvent,
} from '../../types/userHistory'
import { readStoredUserHistory } from '../users/userHistoryStorage'
import {
  accessProfileLinkMigrationEntry,
  readAccessProfileLinkMigrationDone,
  readStoredUsers,
  writeStoredUsersWithEntries,
  type StorageEntry,
} from '../users/userStorage'
import { getSystemAccessProfile } from './accessProfileRepository'
import {
  accessProfilesStorageEntries,
  readStoredAccessProfiles,
  SYSTEM_ACCESS_PROFILE_ID,
} from './accessProfileStorage'
import {
  ensureInitialAccessProfiles,
  refreshInitialAccessProfiles,
} from './initialAccessProfiles'

/**
 * Vínculo persistente entre usuários e Perfis de Acesso.
 *
 * Existe porque as duas coleções deixaram de ser independentes: atribuir um
 * perfil a alguém muda o usuário E pode marcar o perfil como já utilizado, e
 * editar os acessos de um perfil muda o perfil E todos os usuários vinculados a
 * ele. Nenhum dos dois repositórios pode responder por isso sozinho, e deixar a
 * coordenação na interface produziria exatamente as gravações parciais que este
 * bloco existe para impedir.
 *
 * É deliberadamente estreito. Não substitui `userRepository` nem
 * `accessProfileRepository`: ele coordena o que precisa acontecer junto, e nada
 * além disso. A exclusão de um Perfil de Acesso entrou aqui porque é exatamente
 * uma dessas operações conjuntas: apagar o perfil e desvincular os usuários dele
 * precisa ser uma coisa só. A primeira atribuição a um usuário que está sem
 * perfil entrou pela mesma razão, e como operação FOCADA: ela grava o vínculo de
 * uma pessoa, marca o perfil como já utilizado e registra o evento, sem simular
 * uma edição completa do perfil de destino. O evento do Histórico entrou pelo
 * mesmo motivo: uma alteração gravada sem o registro dela, ou um registro sem a
 * alteração, seriam as duas metades que este módulo existe para não deixar
 * acontecer. Desativação continua fora daqui.
 *
 * Atomicidade: o localStorage não tem transação, e as coleções vivem em chaves
 * diferentes. A consistência vem de gravar tudo em uma operação só, com o
 * rollback que `writeStoredUsersWithEntries` já implementa: as entradas da
 * coleção de perfis são montadas pelo módulo dono dela e entregues prontas, e o
 * Histórico é lido inteiro antes e regravado com o evento novo no fim, de modo
 * que ou todas ficam gravadas, ou o armazenamento volta exatamente ao estado
 * anterior.
 *
 * Módulo de serviço: lê e grava armazenamento, mas nenhuma regra de domínio
 * nasce aqui. Compatibilidade, correspondência de migração e página inicial vêm
 * de `lib/accessProfileRules`, e o acesso expandido continua sendo derivado por
 * `lib/userAccessRules`.
 */

/* -------------------------------------------------------------------------- */
/* Leitura do vínculo                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Perfil de Acesso vinculado ao usuário, ou null.
 *
 * Único ponto do projeto que lê `accessProfileId` diretamente. Propriedade
 * ausente, `undefined`, valor que não é texto e texto vazio devolvem null, que é
 * a ausência EXPLÍCITA de vínculo: nenhum deles autentica, e nenhum deles é
 * tratado como "ainda não migrado".
 */
export function storedAccessProfileId(user: Pick<User, 'accessProfileId'>): string | null {
  return normalizeStoredAccessProfileId(user.accessProfileId)
}

/* -------------------------------------------------------------------------- */
/* Acesso expandido derivado do perfil                                        */
/* -------------------------------------------------------------------------- */

/**
 * Campos expandidos de acesso que o usuário deve ter por estar vinculado àquele
 * perfil, ou null quando o perfil não descreve um acesso derivável.
 *
 * As rotas ainda consultam `permissionKeys` e `departmentPageAccess` do usuário,
 * e não o perfil. Enquanto for assim, o vínculo sozinho não concede nada: toda
 * atribuição precisa reescrever os campos expandidos, e é isso que esta função
 * calcula.
 *
 * Administrador é o único caso em que o perfil não descreve a concessão: o
 * `Acesso do Sistema` é derivado do catálogo a cada leitura, e o acesso global do
 * Administrador já é a regra oficial de `deriveUserAccess`. Usar a regra oficial
 * mantém o Administrador com o catálogo inteiro, inclusive o Modelo e as páginas
 * em desenvolvimento, exatamente como hoje.
 *
 * Executivo e Analista compartilham a mesma FORMA de concessão (departamentos e
 * páginas), e por isso passam os dois pela mesma derivação. O que os distingue
 * está fora da concessão: o Executivo mantém o Perfil do Sistema dele e a leitura
 * de Usuários (`admin.users.read`), que não vem de departamento nenhum.
 *
 * A Visão Geral de cada departamento concedido é imposta por `deriveUserAccess`,
 * e continua sendo: um departamento visível na navegação sem página de entrada
 * autorizada deixaria um item sem destino. Não é acesso extra escolhido aqui, é a
 * regra de acesso do portal aplicada ao que o perfil concedeu.
 */
export function deriveAccessFromAccessProfile(
  profile: AccessProfile,
  userProfile: UserProfile,
): DerivedUserAccess | null {
  if (userProfile === 'Administrador') return deriveUserAccess({ profile: 'Administrador' })

  const granted = deriveUserAccess({
    profile: 'Analista',
    departments: profile.departmentPageAccess.map((access) => ({
      departmentId: access.departmentId,
      pageKeys: access.pageKeys,
    })),
  })
  if (!granted) return null

  if (userProfile === 'Analista') return granted

  const executive = deriveUserAccess({ profile: 'Executivo' })
  if (!executive) return null

  return {
    profile: 'Executivo',
    // Texto de apresentação do perfil funcional, lido da regra oficial em vez de
    // reescrito aqui.
    permissions: executive.permissions,
    permissionKeys: [...new Set([...granted.permissionKeys, ADMIN_USERS_READ_PERMISSION])],
    departments: granted.departments,
    departmentPageAccess: granted.departmentPageAccess,
  }
}

/** Usuário com o vínculo e os campos expandidos alinhados ao perfil recebido. */
function linkUserToProfile(user: User, profile: AccessProfile): User | null {
  const access = deriveAccessFromAccessProfile(profile, user.profile)
  if (!access) return null

  return { ...user, accessProfileId: profile.id, ...access }
}

/* -------------------------------------------------------------------------- */
/* Coleção de perfis                                                          */
/* -------------------------------------------------------------------------- */

/** Perfil do sistema mais os perfis comuns gravados, ou null quando ilegíveis. */
function loadAssignableCollection(): AccessProfile[] | null {
  const stored = readStoredAccessProfiles()
  if (!stored.ok) return null

  return [getSystemAccessProfile(), ...stored.profiles]
}

/**
 * Prepara a coleção de Perfis de Acesso antes de qualquer decisão de vínculo.
 *
 * As duas operações são idempotentes e já existiam: a inicialização só grava
 * quando o armazenamento ainda não tem coleção nenhuma, e a atualização só
 * reescreve os perfis iniciais que continuam exatamente como a versão anterior os
 * criou. Chamá-las aqui é o que permite a um navegador que nunca abriu a página
 * Perfis de acesso ter perfis para vincular.
 */
function ensureAccessProfileCollection(): void {
  ensureInitialAccessProfiles()
  refreshInitialAccessProfiles()
}

/**
 * Conclui a migração dos vínculos legados ANTES de qualquer criação, edição ou
 * exclusão de perfil.
 *
 * Existe por causa da ordem dos acontecimentos. A migração é a única operação
 * que pode declarar a base analisada, e é ela quem grava a marca; a exclusão de
 * um perfil, por sua vez, precisa que a marca já esteja lá, senão os usuários que
 * ela desvincular de propósito seriam reconhecidos como legados na leitura
 * seguinte e religados a um perfil parecido. Rodá-la aqui resolve os dois lados:
 * a base legada é migrada de verdade, com todos os usuários percorridos, e só
 * depois a operação acontece.
 *
 * É idempotente e não grava nada em uma base já migrada. Uma migração que não
 * conseguiu persistir o que mudou recusa a operação: seguir adiante gravaria uma
 * alteração sobre uma base cuja migração ficou pela metade.
 */
function ensureLegacyLinksMigrated(): { ok: true } | { ok: false; reason: 'storage-failure' } {
  const migration = ensureAccessProfileLinks()

  return migration.writeFailed ? { ok: false, reason: 'storage-failure' } : { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Validação de uma atribuição                                                */
/* -------------------------------------------------------------------------- */

/** Por que um Perfil de Acesso não pode ser atribuído àquele usuário. */
export type AccessProfileAssignmentFailureReason =
  | 'access-profile-required'
  | 'unknown-access-profile'
  | 'inactive-access-profile'
  | 'incompatible-access-profile'
  | 'access-profile-unavailable'

export type AccessProfileAssignmentCheck =
  | { ok: true; profile: AccessProfile }
  | { ok: false; reason: AccessProfileAssignmentFailureReason }

/**
 * Perfil que aquele usuário pode receber, ou o motivo da recusa.
 *
 * As quatro recusas são coisas diferentes e continuam diferentes até a
 * interface: um id vazio é escolha que falta, um id desconhecido é escolha que
 * não existe mais, um perfil inativo é escolha que deixou de valer e um destino
 * incompatível é escolha que nunca valeu para aquele Perfil do Sistema. Uma
 * mensagem só para as quatro mandaria o Administrador adivinhar o que corrigir.
 *
 * A regra é a do domínio, e não uma releitura: `acp-system` é recusado a quem não
 * é Administrador, e um perfil comum é recusado ao Administrador, porque o
 * destino de um e o tipo do outro não correspondem.
 */
export function checkAccessProfileAssignment(
  accessProfileId: string | null,
  userProfile: UserProfile,
  profiles: readonly AccessProfile[],
): AccessProfileAssignmentCheck {
  const normalized = normalizeStoredAccessProfileId(accessProfileId)
  if (normalized === null) return { ok: false, reason: 'access-profile-required' }

  const profile = profiles.find((candidate) => candidate.id === normalized)
  if (!profile) return { ok: false, reason: 'unknown-access-profile' }

  if (profile.lifecycle !== 'active') return { ok: false, reason: 'inactive-access-profile' }

  if (!isAccessProfileAssignableToUserProfile(profile, userProfile)) {
    return { ok: false, reason: 'incompatible-access-profile' }
  }

  return { ok: true, profile }
}

/** A mesma checagem, lendo a coleção gravada. */
export function resolveAccessProfileAssignment(
  accessProfileId: string | null,
  userProfile: UserProfile,
): AccessProfileAssignmentCheck {
  ensureAccessProfileCollection()

  const profiles = loadAssignableCollection()
  if (!profiles) return { ok: false, reason: 'access-profile-unavailable' }

  return checkAccessProfileAssignment(accessProfileId, userProfile, profiles)
}

/**
 * Perfis que aquele Perfil do Sistema pode receber hoje, na ordem da coleção.
 *
 * É o que o seletor da tela Usuários oferece: somente ativos e somente
 * compatíveis. O Administrador recebe uma lista de um item só, o `Acesso do
 * Sistema`, porque é o único perfil destinado a ele.
 */
export function listAssignableAccessProfiles(userProfile: UserProfile): AccessProfile[] {
  ensureAccessProfileCollection()

  const profiles = loadAssignableCollection()
  if (!profiles) return []

  return profiles.filter((profile) =>
    isAccessProfileAssignableToUserProfile(profile, userProfile),
  )
}

/**
 * Perfil de Acesso que o Administrador recebe automaticamente.
 *
 * Reexportado a partir do armazenamento, que é onde a identidade reservada mora,
 * para a interface não precisar conhecer dois módulos para dizer a mesma coisa.
 */
export { SYSTEM_ACCESS_PROFILE_ID }

/* -------------------------------------------------------------------------- */
/* Migração dos vínculos                                                      */
/* -------------------------------------------------------------------------- */

export type AccessProfileLinkMigrationResult = {
  /** Usuários que ganharam um vínculo nesta passagem. */
  linkedUserIds: string[]
  /** Usuários cujo vínculo inválido foi explicitamente zerado. */
  unlinkedUserIds: string[]
  /** Usuários já vinculados cujos acessos expandidos foram realinhados. */
  synchronizedUserIds: string[]
  /** true quando a passagem terminou sem conseguir gravar o que mudou. */
  writeFailed: boolean
}

const EMPTY_MIGRATION: AccessProfileLinkMigrationResult = {
  linkedUserIds: [],
  unlinkedUserIds: [],
  synchronizedUserIds: [],
  writeFailed: false,
}

function sameOrderedValues(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index])
}

/** true quando vínculo e campos consumidos pelas rotas já refletem o perfil. */
function hasSameLinkedAccess(current: User, linked: User): boolean {
  return (
    storedAccessProfileId(current) === storedAccessProfileId(linked) &&
    current.profile === linked.profile &&
    current.permissions === linked.permissions &&
    sameOrderedValues(current.permissionKeys ?? [], linked.permissionKeys ?? []) &&
    sameOrderedValues(current.departments ?? [], linked.departments ?? []) &&
    current.departmentPageAccess.length === linked.departmentPageAccess.length &&
    current.departmentPageAccess.every((access, index) => {
      const next = linked.departmentPageAccess[index]

      return (
        next !== undefined &&
        access.departmentId === next.departmentId &&
        sameOrderedValues(access.pageKeys ?? [], next.pageKeys ?? [])
      )
    })
  )
}

/**
 * Garante que todo usuário persistido tenha um vínculo válido, ou `null`
 * explícito.
 *
 * É a migração dos usuários legados, e ela é DETERMINÍSTICA: as correspondências
 * vêm de `findMigrationAccessProfile`, que só aceita o perfil do sistema para o
 * Administrador, o perfil executivo padrão para o Executivo e o único perfil
 * ativo, compatível e com a mesma combinação efetiva de acessos para o Analista.
 * Ausência, ambiguidade, perfil inativo e destino incompatível deixam o usuário
 * com `null`, e nunca com um perfil escolhido por semelhança.
 *
 * Um vínculo que já é válido não é trocado por outro perfil, mas os campos
 * expandidos consumidos pelas rotas são realinhados ao perfil apontado. Só quem
 * não tem vínculo válido passa pela correspondência. Um vínculo inválido sem
 * correspondência vira `null` e PRESERVA os acessos expandidos atuais: o usuário
 * fica sem entrar no portal, mas nada do que ele já tinha é apagado pela
 * migração.
 *
 * Idempotente e auto-corretiva: a segunda passagem não encontra nada a fazer e
 * não grava. Uma passagem que não conseguiu ler os perfis, ou não conseguiu
 * gravar, não marca nada como concluído e é tentada de novo na leitura seguinte.
 *
 * As duas coleções são gravadas juntas, porque a atribuição também marca os
 * perfis alcançados como já utilizados: se a gravação falhar, nem o vínculo nem a
 * marca são aplicados.
 *
 * A CORRESPONDÊNCIA SÓ ACONTECE UMA VEZ POR BASE. Depois da primeira passagem
 * completa, a marca `USERS_ACCESS_PROFILE_LINK_MIGRATION_KEY` fica gravada, e daí
 * em diante um `accessProfileId: null` é resposta final, e não uma lacuna a
 * preencher. É isso que impede que um usuário deliberadamente desvinculado (pela
 * exclusão do Perfil de Acesso dele, por exemplo) seja religado a outro perfil na
 * leitura seguinte: sem a marca, o Executivo voltaria para o `Acesso Executivo` e
 * o Analista voltaria para qualquer perfil com o mesmo alcance, desfazendo a
 * decisão do Administrador sem ninguém pedir.
 *
 * O que continua acontecendo em toda passagem, com marca ou sem: realinhar os
 * acessos expandidos de quem tem vínculo válido e zerar um vínculo que aponta
 * para perfil inexistente, inativo ou incompatível. Essas duas são correções de
 * coerência, e não atribuição de acesso.
 */
export function ensureAccessProfileLinks(): AccessProfileLinkMigrationResult {
  ensureAccessProfileCollection()

  const stored = readStoredAccessProfiles()
  if (!stored.ok) return EMPTY_MIGRATION

  const profiles: AccessProfile[] = [getSystemAccessProfile(), ...stored.profiles]

  const users = readStoredUsers()
  if (!users) return EMPTY_MIGRATION

  const alreadyMigrated = readAccessProfileLinkMigrationDone()

  const linkedUserIds: string[] = []
  const unlinkedUserIds: string[] = []
  const synchronizedUserIds: string[] = []
  const usedProfileIds = new Set<string>()

  const next = users.map((user) => {
    const currentId = storedAccessProfileId(user)
    const current = currentId === null ? null : profiles.find((item) => item.id === currentId)

    if (current && isAccessProfileAssignableToUserProfile(current, user.profile)) {
      usedProfileIds.add(current.id)

      const synchronized = linkUserToProfile(user, current)
      if (!synchronized || hasSameLinkedAccess(user, synchronized)) return user

      synchronizedUserIds.push(user.id)
      return synchronized
    }

    // Base já migrada: a ausência de vínculo é intencional, e procurar uma
    // correspondência aqui seria devolver acesso a quem foi desvinculado.
    const matched = alreadyMigrated ? null : findMigrationAccessProfile(user, profiles)
    const linked = matched ? linkUserToProfile(user, matched) : null

    if (!matched || !linked) {
      // Sem correspondência segura: o vínculo fica explicitamente vazio e os
      // acessos expandidos atuais permanecem intocados.
      if (currentId === null) return user

      unlinkedUserIds.push(user.id)
      return { ...user, accessProfileId: null }
    }

    usedProfileIds.add(matched.id)
    linkedUserIds.push(user.id)

    return linked
  })

  const nextProfiles = markProfilesAsUsed(stored.profiles, usedProfileIds)
  const usersChanged =
    linkedUserIds.length > 0 || unlinkedUserIds.length > 0 || synchronizedUserIds.length > 0
  const profilesChanged = !sameProfileCollection(stored.profiles, nextProfiles)

  // Nada a mudar e marca já gravada: a passagem termina sem tocar no
  // armazenamento. Sem a marca, ela ainda precisa ser gravada, e é a própria
  // passagem completa que autoriza isso.
  if (!usersChanged && !profilesChanged && alreadyMigrated) return EMPTY_MIGRATION

  // Único ponto do projeto que grava a marca: a passagem acima percorreu TODOS
  // os usuários persistidos, que é exatamente o que a marca declara. Migração
  // não é auditoria, então nenhum evento de Histórico é criado aqui.
  const written = persistUsersAndProfiles(next, nextProfiles, stored.profiles, {
    history: null,
    markMigrationDone: true,
  })

  return { linkedUserIds, unlinkedUserIds, synchronizedUserIds, writeFailed: !written }
}

/**
 * Marca como já utilizados os perfis comuns alcançados pela operação.
 *
 * `hasBeenUsed` é irreversível e só cresce: um perfil que já valeu para alguém
 * nunca volta a ser inédito, mesmo depois de todos os usuários saírem dele. A
 * coleção só é reescrita quando algum perfil de fato mudou, para uma operação
 * que não alterou nenhum não regravar a coleção inteira.
 */
function markProfilesAsUsed(
  profiles: readonly StandardAccessProfile[],
  usedProfileIds: ReadonlySet<string>,
): StandardAccessProfile[] {
  return profiles.map((profile) =>
    usedProfileIds.has(profile.id) && !profile.hasBeenUsed
      ? { ...profile, hasBeenUsed: true }
      : profile,
  )
}

/** true quando as duas coleções têm exatamente o mesmo conteúdo por referência. */
function sameProfileCollection(
  first: readonly StandardAccessProfile[],
  second: readonly StandardAccessProfile[],
): boolean {
  return first.length === second.length && first.every((profile, index) => profile === second[index])
}

/**
 * Grava usuários, perfis e, quando houver, o evento do Histórico como uma
 * operação só.
 *
 * Quando a coleção de perfis não mudou, só a base de usuários é gravada: montar
 * entradas idênticas às que já estão lá reescreveria a coleção inteira sem
 * motivo. Quando ela mudou, as duas vão juntas, e uma falha em qualquer chave
 * devolve o armazenamento ao estado anterior, inclusive removendo as que ainda
 * não existiam.
 *
 * `history` é a coleção INTEIRA do Histórico já com o evento novo no fim, lida
 * antes por quem chama; `null` nas operações que não registram evento, e nesse
 * caso a chave do Histórico não é tocada.
 *
 * `markMigrationDone` é o que separa a migração de vínculos de uma operação
 * comum. A marca declara que TODA a base legada já foi analisada, e só a própria
 * migração pode afirmar isso: ela percorre todos os usuários persistidos antes de
 * gravar. Criar, editar ou excluir um perfil alcança apenas os usuários daquele
 * perfil, então nunca pede a marca. Quando pedida, ela vai por último nas
 * entradas: a ordem não muda o resultado, porque a gravação é atômica com
 * rollback, mas mantém as coleções antes do metadado, e uma falha nunca deixa a
 * marca gravada sem elas.
 */
function persistUsersAndProfiles(
  users: User[],
  profiles: readonly StandardAccessProfile[],
  previousProfiles: readonly StandardAccessProfile[],
  options: { history: HistoryEvent[] | null; markMigrationDone: boolean },
): boolean {
  const profileEntries = sameProfileCollection(previousProfiles, profiles)
    ? []
    : accessProfilesStorageEntries(profiles)

  if (!profileEntries) return false

  return writeStoredUsersWithEntries(users, options.history, [
    ...profileEntries,
    ...(options.markMigrationDone ? [accessProfileLinkMigrationEntry()] : []),
  ])
}

export type AccessProfileUsageEntriesResult =
  | { ok: true; entries: StorageEntry[] }
  | { ok: false; reason: 'access-profile-unavailable' | 'unknown-access-profile' }

/**
 * Entradas necessárias para marcar um perfil comum como já utilizado.
 *
 * A tela Usuários grava a pessoa e o Histórico pelo repositório próprio. Este
 * serviço entrega apenas as entradas da coleção de perfis, para as três coisas
 * seguirem na mesma operação lógica. O perfil do sistema é derivado e nunca é
 * persistido, portanto não gera entrada adicional.
 */
export function accessProfileUsageEntries(
  profile: AccessProfile,
): AccessProfileUsageEntriesResult {
  if (profile.kind === 'system') return { ok: true, entries: [] }

  const stored = readStoredAccessProfiles()
  if (!stored.ok) return { ok: false, reason: 'access-profile-unavailable' }

  const current = stored.profiles.find((candidate) => candidate.id === profile.id)
  if (!current) return { ok: false, reason: 'unknown-access-profile' }
  if (current.hasBeenUsed) return { ok: true, entries: [] }

  const next = stored.profiles.map((candidate) =>
    candidate.id === current.id ? { ...candidate, hasBeenUsed: true } : candidate,
  )
  const entries = accessProfilesStorageEntries(next)

  return entries
    ? { ok: true, entries }
    : { ok: false, reason: 'access-profile-unavailable' }
}

/* -------------------------------------------------------------------------- */
/* Histórico dos Perfis de Acesso                                             */
/* -------------------------------------------------------------------------- */

/**
 * Responsável por uma alteração de Perfil de Acesso.
 *
 * Chega de fora, do usuário autenticado da tela, e é COPIADO para o evento. O
 * responsável nunca é reconstruído depois a partir do estado atual: o Histórico
 * registra quem fez, e não quem estaria logado agora. Tipo próprio, e não o do
 * `userRepository`, porque aquele módulo já importa este e um import de volta
 * fecharia um ciclo.
 */
export type AccessProfileActor = { id: string; name: string }

/** Responsável com id e nome preenchidos, ou null: evento sem responsável não existe. */
function normalizeActor(actor: AccessProfileActor | null | undefined): AccessProfileActor | null {
  const id = actor?.id.trim() ?? ''
  const name = actor?.name.trim() ?? ''

  return id && name ? { id, name } : null
}

/**
 * Destino do perfil em texto, para os detalhes do Histórico.
 *
 * Vocabulário da auditoria, declarado aqui porque o evento é gravado por este
 * módulo e precisa ser verificável sem navegador. Os rótulos exibidos na tela
 * Perfis de acesso continuam no modelo de apresentação dela, que importa este
 * serviço e não poderia ser importado de volta.
 */
const audienceHistoryLabels: Record<StandardAccessProfileAudience, string> = {
  executive: 'Executivos',
  analyst: 'Analistas',
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

/**
 * Sequência da execução: garante ids distintos para eventos do mesmo instante,
 * pelo mesmo critério já usado nos eventos de usuário.
 */
let accessProfileEventSequence = 0

function nextAccessProfileEventId(occurredAt: string, profileId: string): string {
  accessProfileEventSequence += 1

  return `${occurredAt}-${profileId}-${accessProfileEventSequence}`
}

/** Monta o evento a partir do estado já calculado da operação. */
function buildAccessProfileEvent(
  action: AccessProfileHistoryAction,
  occurredAt: string,
  profile: StandardAccessProfile,
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

/** Usuário que passou a apontar para o perfil salvo nesta operação. */
type MembershipChange = {
  userName: string
  /** Nome do Perfil de Acesso anterior, ou null quando ele não tinha nenhum. */
  fromProfileName: string | null
}

/**
 * Ausência de Perfil de Acesso, dos dois lados de uma transição.
 *
 * É o mesmo texto do indicador `Sem perfil definido` da página Perfis de acesso,
 * de propósito: a primeira atribuição vem DE lá, e a desvinculação causada por
 * uma exclusão vai PARA lá. Um estado só, um vocabulário só.
 */
const NO_ACCESS_PROFILE_LABEL = 'Sem perfil definido'

/**
 * Uma mudança de Perfil de Acesso, sempre no formato `origem → destino`.
 *
 * Antes, o mesmo acontecimento aparecia com três redações diferentes conforme
 * fosse primeira atribuição, transferência ou desvinculação, e os usuários eram
 * agrupados em uma frase só ("Usuários transferidos de outro Perfil de Acesso: A
 * (vindo de X) e B (vindo de Y)"). As três são a mesma coisa: o vínculo saiu de
 * um lugar e foi para outro. `null` em qualquer um dos lados é a ausência de
 * perfil, e não um caso à parte com frase própria.
 *
 * Uma linha por usuário afetado, com o nome dele DENTRO da própria linha: é o que
 * permite ler no Histórico o que aconteceu com uma pessoa sem separar nomes de
 * uma enumeração.
 *
 * Os nomes do usuário e dos perfis são os do momento do evento, copiados por
 * quem chama. Eventos já gravados não são reescritos: o formato novo vale para os
 * eventos criados daqui em diante.
 */
function describeAccessProfileTransition(
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

/**
 * Descreve a criação: destino, cobertura inicial e quem já nasceu vinculado.
 *
 * A cobertura entra resumida por departamento, e não página a página: o perfil
 * recém-criado pode conceder dezenas de páginas, e a lista inteira ocuparia o
 * Histórico para descrever uma única decisão. As páginas exatas continuam
 * visíveis no próprio perfil.
 */
function buildProfileCreationDetails(
  profile: StandardAccessProfile,
  changes: readonly MembershipChange[],
): string[] {
  const details = [
    `Destino: ${audienceHistoryLabels[profile.audience]}`,
    `Cobertura inicial: ${describeGrants(profile.departmentPageAccess)}`,
  ]

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
function buildProfileUpdateDetails(
  previous: StandardAccessProfile,
  updated: StandardAccessProfile,
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
 * Descreve a exclusão: o que o perfil concedia e quem ficou sem Perfil de
 * Acesso por causa dela. Os nomes são os dos usuários no momento do evento.
 *
 * A desvinculação também é uma transição, e usa o mesmo formato das outras: o
 * perfil excluído é a origem, e a ausência de perfil é o destino. Uma linha por
 * usuário afetado, no lugar da enumeração única de antes, que obrigava a separar
 * nomes de dentro de uma frase para saber quem tinha ficado sem acesso.
 */
function buildProfileDeletionDetails(
  profile: StandardAccessProfile,
  unlinkedUserNames: readonly string[],
): string[] {
  const details = [
    `Perfil excluído: ${profile.name}`,
    `Destino: ${audienceHistoryLabels[profile.audience]}`,
  ]

  if (unlinkedUserNames.length === 0) {
    details.push('Nenhum usuário estava vinculado a este perfil')

    return details
  }

  details.push(
    `Usuários desvinculados: ${unlinkedUserNames.length}`,
    ...unlinkedUserNames.map((userName) =>
      describeAccessProfileTransition(userName, profile.name, null),
    ),
  )

  return details
}

/**
 * Coleção do Histórico já com o evento novo no fim, ou null quando o Histórico
 * atual não pôde ser lido.
 *
 * A leitura acontece ANTES de qualquer gravação, de propósito: gravar um evento
 * novo sobre um histórico ilegível o substituiria por uma lista de um item só.
 * Quem chama transforma o null em recusa da operação inteira.
 */
function historyWithEvent(event: AccessProfileHistoryEvent): HistoryEvent[] | null {
  const history = readStoredUserHistory()
  if (!history) return null

  return [...history, event]
}

/* -------------------------------------------------------------------------- */
/* Criação e edição de perfil com atribuições                                 */
/* -------------------------------------------------------------------------- */

/** Conteúdo editável do perfil mais a lista final de usuários vinculados. */
export type AccessProfileSaveInput = {
  name: string
  description?: string
  departmentPageAccess: DepartmentPageAccess[]
  /**
   * Ids dos usuários que devem estar vinculados a este perfil ao final.
   *
   * É o estado final, e não um delta: quem está aqui passa a apontar para este
   * perfil (transferindo-se do anterior, quando havia um), e quem não está
   * continua exatamente onde está. Retirar alguém deste perfil sem dar outro a
   * ele não é uma operação deste formulário, e é recusada.
   */
  userIds: readonly string[]
  /**
   * Administrador autenticado que está salvando, copiado para o evento do
   * Histórico. Obrigatório: uma alteração de Perfil de Acesso sem responsável
   * identificado não é registrável, e por isso não é gravada.
   */
  actor: AccessProfileActor
}

export type AccessProfileCreateWithUsersInput = AccessProfileSaveInput & {
  audience: StandardAccessProfileAudience
}

export type AccessProfileSaveFailureReason =
  | 'invalid-draft'
  | 'not-found'
  | 'system-profile'
  | 'inactive-access-profile'
  | 'unknown-user'
  | 'incompatible-user'
  | 'unassignment-not-allowed'
  | 'invalid-access-configuration'
  | 'users-unavailable'
  | 'storage-failure'
  | 'audience-classification-required'
  | 'actor-required'
  | 'history-unavailable'

export type AccessProfileSaveResult =
  | { ok: true; profile: StandardAccessProfile; assignedUserIds: string[] }
  | {
      ok: false
      reason: AccessProfileSaveFailureReason
      /** Presente somente quando `reason` é 'invalid-draft'. */
      errors?: AccessProfileDraftError[]
    }

/** Padrão numérico dos ids de perfil comum, o mesmo do repositório. */
const ACCESS_PROFILE_ID_NUMBER_PATTERN = /^acp-(\d+)$/

function nextAccessProfileId(collection: readonly AccessProfile[]): string {
  let highest = 0

  for (const profile of collection) {
    const match = ACCESS_PROFILE_ID_NUMBER_PATTERN.exec(profile.id)
    if (!match) continue

    const value = Number.parseInt(match[1], 10)
    if (value > highest) highest = value
  }

  return `acp-${String(highest + 1).padStart(3, '0')}`
}

/** Usuários da coleção final, os ids vinculados e o que mudou, ou a recusa. */
type MembershipResolution =
  | { ok: true; users: User[]; assignedUserIds: string[]; changes: MembershipChange[] }
  | { ok: false; reason: AccessProfileSaveFailureReason }

/**
 * Aplica a lista final de vinculados a um perfil sobre a coleção de usuários.
 *
 * Três decisões acontecem aqui, e nenhuma delas pertence à interface:
 *
 * - quem está na lista passa a apontar para este perfil e tem os acessos
 *   expandidos reescritos a partir dele. Se já apontava para outro perfil
 *   compatível, isso é uma TRANSFERÊNCIA: o vínculo é único, então entrar aqui é
 *   sair de lá, na mesma gravação;
 * - quem já apontava para este perfil e continua na lista também é reescrito,
 *   porque as concessões do perfil podem ter mudado nesta mesma operação. É por
 *   isso que editar os acessos de um perfil sincroniza todos os usuários dele;
 * - quem já apontava para este perfil e NÃO está na lista faz a operação inteira
 *   ser recusada. Retirar alguém de um perfil sem dar outro a ele o deixaria sem
 *   acesso ao portal, e o caminho para isso é a transferência, não a
 *   desmarcação.
 *
 * `changes` registra só quem MUDOU de perfil nesta operação, com o nome do
 * perfil de origem quando havia um. É o que permite ao Histórico distinguir uma
 * transferência de uma primeira vinculação sem recalcular nada depois, e é por
 * isso que a coleção completa de perfis é recebida aqui.
 */
function resolveMembership(
  users: readonly User[],
  profile: AccessProfile,
  userIds: readonly string[],
  collection: readonly AccessProfile[],
): MembershipResolution {
  const target = new Set(userIds)

  for (const user of users) {
    if (storedAccessProfileId(user) === profile.id && !target.has(user.id)) {
      return { ok: false, reason: 'unassignment-not-allowed' }
    }
  }

  const known = new Set(users.map((user) => user.id))
  for (const userId of target) {
    if (!known.has(userId)) return { ok: false, reason: 'unknown-user' }
  }

  const next: User[] = []
  const changes: MembershipChange[] = []

  for (const user of users) {
    if (!target.has(user.id)) {
      next.push(user)
      continue
    }

    if (!isAccessProfileAssignableToUserProfile(profile, user.profile)) {
      return { ok: false, reason: 'incompatible-user' }
    }

    const linked = linkUserToProfile(user, profile)
    if (!linked) return { ok: false, reason: 'invalid-access-configuration' }

    const previousId = storedAccessProfileId(user)
    if (previousId !== profile.id) {
      const source = previousId === null ? null : collection.find((item) => item.id === previousId)

      changes.push({ userName: user.name, fromProfileName: source?.name ?? null })
    }

    next.push(linked)
  }

  return { ok: true, users: next, assignedUserIds: [...target], changes }
}

/**
 * Cria um Perfil de Acesso e grava as atribuições dele na mesma operação.
 *
 * A página inicial NÃO vem do formulário: ela é a primeira página concedida e
 * disponível, na ordem oficial dos catálogos. Expor o campo obrigaria o
 * Administrador a escolher um detalhe técnico que o próprio conjunto de páginas
 * já responde, e permitiria apontar para uma página que o perfil não concede.
 *
 * O destino é obrigatório e definido aqui, uma única vez: a edição não o alcança.
 *
 * Nada é gravado quando qualquer parte é recusada, e uma falha de armazenamento
 * devolve todas as chaves ao estado anterior.
 *
 * O evento do Histórico é gravado na mesma operação, com o responsável recebido.
 */
export function createAccessProfileWithUsers(
  input: AccessProfileCreateWithUsersInput,
): AccessProfileSaveResult {
  const actor = normalizeActor(input.actor)
  if (!actor) return { ok: false, reason: 'actor-required' }

  const migration = ensureLegacyLinksMigrated()
  if (!migration.ok) return { ok: false, reason: migration.reason }

  const stored = readStoredAccessProfiles()
  if (!stored.ok) {
    return {
      ok: false,
      reason:
        stored.reason === 'audience-classification-required'
          ? 'audience-classification-required'
          : 'storage-failure',
    }
  }

  const collection: AccessProfile[] = [getSystemAccessProfile(), ...stored.profiles]
  const departmentPageAccess = normalizeAccessProfileGrants(input.departmentPageAccess)

  const validation = validateAccessProfileCreationDraft(
    {
      id: nextAccessProfileId(collection),
      name: input.name,
      description: input.description,
      departmentPageAccess,
      homePage: resolveAccessProfileHomePage(departmentPageAccess, null),
      audience: input.audience,
    },
    collection,
  )
  if (!validation.ok) return { ok: false, reason: 'invalid-draft', errors: validation.errors }

  const created: StandardAccessProfile = {
    id: validation.draft.id,
    name: validation.draft.name,
    description: validation.draft.description,
    kind: 'standard',
    audience: validation.draft.audience,
    lifecycle: 'active',
    departmentPageAccess: validation.draft.departmentPageAccess,
    homePage: validation.draft.homePage,
    hasBeenUsed: input.userIds.length > 0,
  }

  return commitProfileSave({
    previousProfiles: stored.profiles,
    nextProfiles: [...stored.profiles, created],
    saved: created,
    previous: null,
    collection,
    userIds: input.userIds,
    actor,
  })
}

/**
 * Edita um Perfil de Acesso e sincroniza os usuários vinculados na mesma
 * operação.
 *
 * Id, tipo, destino e ciclo de vida vêm do perfil atual e não do formulário: o
 * destino é escolhido uma única vez, na criação, e uma edição capaz de informá-lo
 * seria uma edição capaz de trocá-lo, mudando de uma vez o acesso de todos os
 * vinculados.
 *
 * A página inicial atual é preservada enquanto continuar concedida e disponível;
 * quando deixa de ser, dá lugar à primeira página válida do próprio perfil.
 *
 * Todos os usuários vinculados são reescritos com as concessões novas, porque é
 * justamente assim que o acesso de quem usa o perfil é mantido em dia.
 */
export function updateAccessProfileWithUsers(
  id: string,
  input: AccessProfileSaveInput,
): AccessProfileSaveResult {
  const actor = normalizeActor(input.actor)
  if (!actor) return { ok: false, reason: 'actor-required' }

  const normalizedId = id.trim()
  if (!normalizedId) return { ok: false, reason: 'not-found' }
  if (normalizedId === SYSTEM_ACCESS_PROFILE_ID) return { ok: false, reason: 'system-profile' }

  const migration = ensureLegacyLinksMigrated()
  if (!migration.ok) return { ok: false, reason: migration.reason }

  const stored = readStoredAccessProfiles()
  if (!stored.ok) {
    return {
      ok: false,
      reason:
        stored.reason === 'audience-classification-required'
          ? 'audience-classification-required'
          : 'storage-failure',
    }
  }

  const current = stored.profiles.find((profile) => profile.id === normalizedId)
  if (!current) return { ok: false, reason: 'not-found' }

  if (current.lifecycle !== 'active' && input.userIds.length > 0) {
    return { ok: false, reason: 'inactive-access-profile' }
  }

  const collection: AccessProfile[] = [getSystemAccessProfile(), ...stored.profiles]
  const departmentPageAccess = normalizeAccessProfileGrants(input.departmentPageAccess)

  const validation = validateAccessProfileDraft(
    {
      id: current.id,
      name: input.name,
      description: input.description,
      departmentPageAccess,
      homePage: resolveAccessProfileHomePage(departmentPageAccess, current.homePage),
    },
    collection,
    current.id,
  )
  if (!validation.ok) return { ok: false, reason: 'invalid-draft', errors: validation.errors }

  const updated: StandardAccessProfile = {
    ...current,
    name: validation.draft.name,
    description: validation.draft.description,
    departmentPageAccess: validation.draft.departmentPageAccess,
    homePage: validation.draft.homePage,
    hasBeenUsed: current.hasBeenUsed || input.userIds.length > 0,
  }

  const nextProfiles = stored.profiles.map((profile) =>
    profile.id === current.id ? updated : profile,
  )

  return commitProfileSave({
    previousProfiles: stored.profiles,
    nextProfiles,
    saved: updated,
    previous: current,
    collection,
    userIds: input.userIds,
    actor,
  })
}

/**
 * Fecha as duas metades da operação: a coleção de perfis já calculada e os
 * usuários que passam a apontar para o perfil salvo.
 *
 * A base de usuários precisa ser legível para qualquer decisão de vínculo. Sem
 * ela, a operação é recusada mesmo quando a seleção recebida está vazia: gravar
 * um perfil sem saber quem está vinculado a ele hoje poderia retirar acessos sem
 * que o formulário percebesse.
 *
 * O evento do Histórico entra na MESMA gravação, e é aqui que a regra de
 * mudança efetiva vive: uma edição que não alterou nome, descrição, concessões
 * nem vínculos não gera evento nenhum, porque não houve o que registrar. A
 * criação sempre gera, porque um perfil que não existia passou a existir.
 *
 * Quando há evento, o Histórico atual precisa ser legível: sem isso a operação
 * inteira é recusada, em vez de substituir um histórico ilegível por um evento
 * só.
 */
function commitProfileSave(input: {
  previousProfiles: readonly StandardAccessProfile[]
  nextProfiles: readonly StandardAccessProfile[]
  saved: StandardAccessProfile
  /** Perfil como estava gravado, ou null quando a operação é uma criação. */
  previous: StandardAccessProfile | null
  collection: readonly AccessProfile[]
  userIds: readonly string[]
  actor: AccessProfileActor
}): AccessProfileSaveResult {
  const { previousProfiles, nextProfiles, saved, previous, collection, userIds, actor } = input

  const users = readStoredUsers()
  if (!users) return { ok: false, reason: 'users-unavailable' }

  const membership = resolveMembership(users, saved, userIds, collection)
  if (!membership.ok) return { ok: false, reason: membership.reason }

  const details =
    previous === null
      ? buildProfileCreationDetails(saved, membership.changes)
      : buildProfileUpdateDetails(previous, saved, membership.changes)

  let history: HistoryEvent[] | null = null

  if (details.length > 0) {
    const event = buildAccessProfileEvent(
      previous === null ? 'access-profile-created' : 'access-profile-updated',
      new Date().toISOString(),
      saved,
      actor,
      details,
    )

    history = historyWithEvent(event)
    if (!history) return { ok: false, reason: 'history-unavailable' }
  }

  if (
    !persistUsersAndProfiles(membership.users, nextProfiles, previousProfiles, {
      history,
      markMigrationDone: false,
    })
  ) {
    return { ok: false, reason: 'storage-failure' }
  }

  return { ok: true, profile: saved, assignedUserIds: membership.assignedUserIds }
}

/* -------------------------------------------------------------------------- */
/* Atribuição direta a um usuário sem Perfil de Acesso                        */
/* -------------------------------------------------------------------------- */

export type AccessProfileDirectAssignmentFailureReason =
  | 'user-not-found'
  | 'user-already-assigned'
  | 'access-profile-required'
  | 'unknown-access-profile'
  | 'system-profile'
  | 'inactive-access-profile'
  | 'incompatible-access-profile'
  | 'invalid-access-configuration'
  | 'users-unavailable'
  | 'storage-failure'
  | 'audience-classification-required'
  | 'actor-required'
  | 'history-unavailable'

export type AccessProfileDirectAssignmentResult =
  | {
      ok: true
      profile: StandardAccessProfile
      userId: string
      /** Nome do usuário no momento da atribuição, o mesmo copiado para o evento. */
      userName: string
    }
  | { ok: false; reason: AccessProfileDirectAssignmentFailureReason }

/**
 * Dá um Perfil de Acesso a UM usuário que está sem nenhum.
 *
 * É a primeira atribuição, e nada além dela. Existe como operação própria porque
 * o caminho alternativo seria a tela simular uma edição completa do perfil de
 * destino: mandar o conteúdo inteiro dele de volta (nome, descrição, concessões)
 * mais a lista final de vinculados, só para acrescentar uma pessoa. Aquele
 * caminho recusaria a operação se qualquer parte do conteúdo reenviado não
 * correspondesse ao gravado, gravaria uma edição do perfil onde não houve
 * nenhuma, e transformaria um erro de estado em uma reescrita silenciosa das
 * concessões.
 *
 * ESTADO REVALIDADO NA GRAVAÇÃO: o usuário precisa continuar sem Perfil de
 * Acesso. A tela abriu o modal porque ele estava sem perfil, mas entre aquela
 * leitura e esta gravação outra aba pode ter atribuído um. Nesse caso a operação
 * é RECUSADA, e não convertida em transferência: trocar um vínculo que ninguém
 * pediu para trocar retiraria o acesso que a outra decisão acabou de conceder.
 *
 * A compatibilidade é a do domínio, pela mesma `checkAccessProfileAssignment` que
 * a tela Usuários usa: perfil existente, ativo e com destino correspondente ao
 * Perfil do Sistema da pessoa. O `Acesso do Sistema` é recusado antes de
 * qualquer leitura, porque ele não é atribuível por escolha em lugar nenhum do
 * portal.
 *
 * Tudo em uma gravação só, com o mesmo rollback das demais operações deste
 * módulo: vínculo, acessos expandidos, marca de perfil já utilizado e evento do
 * Histórico. Uma falha em qualquer chave devolve o armazenamento ao estado
 * anterior, e nunca existe usuário vinculado sem o registro da mudança.
 */
export function assignAccessProfileToUser(input: {
  userId: string
  accessProfileId: string
  actor: AccessProfileActor
}): AccessProfileDirectAssignmentResult {
  const actor = normalizeActor(input.actor)
  if (!actor) return { ok: false, reason: 'actor-required' }

  const userId = input.userId.trim()
  if (!userId) return { ok: false, reason: 'user-not-found' }

  const accessProfileId = normalizeStoredAccessProfileId(input.accessProfileId)
  if (accessProfileId === null) return { ok: false, reason: 'access-profile-required' }
  if (accessProfileId === SYSTEM_ACCESS_PROFILE_ID) return { ok: false, reason: 'system-profile' }

  const migration = ensureLegacyLinksMigrated()
  if (!migration.ok) return { ok: false, reason: migration.reason }

  const stored = readStoredAccessProfiles()
  if (!stored.ok) {
    return {
      ok: false,
      reason:
        stored.reason === 'audience-classification-required'
          ? 'audience-classification-required'
          : 'storage-failure',
    }
  }

  const users = readStoredUsers()
  if (!users) return { ok: false, reason: 'users-unavailable' }

  const current = users.find((candidate) => candidate.id === userId)
  if (!current) return { ok: false, reason: 'user-not-found' }

  if (storedAccessProfileId(current) !== null) {
    return { ok: false, reason: 'user-already-assigned' }
  }

  const target = stored.profiles.find((candidate) => candidate.id === accessProfileId)
  if (!target) return { ok: false, reason: 'unknown-access-profile' }

  const collection: AccessProfile[] = [getSystemAccessProfile(), ...stored.profiles]
  const check = checkAccessProfileAssignment(target.id, current.profile, collection)

  if (!check.ok) {
    return {
      ok: false,
      // 'access-profile-unavailable' não sai da checagem pura, que já recebeu a
      // coleção lida; mapeá-lo mantém o tipo honesto sem inventar um motivo novo.
      reason: check.reason === 'access-profile-unavailable' ? 'storage-failure' : check.reason,
    }
  }

  const linked = linkUserToProfile(current, target)
  if (!linked) return { ok: false, reason: 'invalid-access-configuration' }

  const nextUsers = users.map((user) => (user.id === linked.id ? linked : user))
  const nextProfiles = markProfilesAsUsed(stored.profiles, new Set([target.id]))

  // Alteração do perfil, e não do usuário: quem mudou de conteúdo foi a
  // composição de usuários daquele Perfil de Acesso, e é por ele que o
  // Administrador procura no Histórico. A transferência feita pela aba Usuários
  // do formulário grava o mesmo tipo de evento, com a mesma linha de transição.
  const event = buildAccessProfileEvent(
    'access-profile-updated',
    new Date().toISOString(),
    target,
    actor,
    [describeAccessProfileTransition(current.name, null, target.name)],
  )

  const history = historyWithEvent(event)
  if (!history) return { ok: false, reason: 'history-unavailable' }

  if (
    !persistUsersAndProfiles(nextUsers, nextProfiles, stored.profiles, {
      history,
      markMigrationDone: false,
    })
  ) {
    return { ok: false, reason: 'storage-failure' }
  }

  return { ok: true, profile: target, userId: linked.id, userName: current.name }
}

/* -------------------------------------------------------------------------- */
/* Exclusão de perfil com desvinculação dos usuários                          */
/* -------------------------------------------------------------------------- */

export type AccessProfileDeleteFailureReason =
  | 'not-found'
  | 'system-profile'
  | 'users-unavailable'
  | 'storage-failure'
  | 'audience-classification-required'
  | 'actor-required'
  | 'history-unavailable'

export type AccessProfileDeleteResult =
  | {
      ok: true
      profile: StandardAccessProfile
      /** Usuários que ficaram sem Perfil de Acesso por causa desta exclusão. */
      unlinkedUserIds: string[]
    }
  | { ok: false; reason: AccessProfileDeleteFailureReason }

/**
 * Exclui um Perfil de Acesso comum e desvincula, na mesma operação, todos os
 * usuários que apontavam para ele.
 *
 * Um perfil comum pode ser excluído mesmo com usuários vinculados, mesmo já
 * utilizado e em qualquer ciclo de vida: é a decisão de negócio aprovada, e ela
 * substitui a regra anterior que obrigava a transferir cada pessoa antes. O
 * `Acesso do Sistema` continua absolutamente inexcluível, e a recusa acontece
 * ANTES de qualquer leitura do armazenamento, para não depender do estado dele:
 * chamar este serviço diretamente com `acp-system` recebe 'system-profile' em
 * qualquer circunstância.
 *
 * Os usuários afetados ficam com `accessProfileId: null` e conservam nome,
 * e-mail, Perfil do Sistema, status e todo o restante do cadastro. O acesso
 * expandido também é preservado, pelo mesmo motivo da migração: apagá-lo não
 * acrescenta segurança, porque quem autoriza a entrada é o vínculo, e destruiria
 * a informação de onde a pessoa estava. Sem vínculo válido, o login já é recusado
 * por `resolveAccessProfileAssignment`, e a pessoa aparece em
 * `Sem perfil definido` até alguém a selecionar em outro perfil.
 *
 * Tudo ou nada: perfil e usuários vão para o armazenamento em uma gravação só,
 * com o rollback de `writeStoredUsersWithEntries`. Uma falha em qualquer chave
 * devolve as duas coleções exatamente ao estado anterior, e nunca existe um
 * perfil removido com usuários ainda apontando para ele, nem o contrário.
 *
 * A migração dos vínculos legados é concluída ANTES da exclusão, por
 * `ensureLegacyLinksMigrated`, e é ela quem grava a marca. Com a marca já no
 * lugar, os usuários que esta exclusão deixar sem perfil não são reconhecidos
 * como legados na leitura seguinte e não são religados a um perfil parecido. A
 * exclusão em si não escreve a marca: ela não analisa a base inteira.
 *
 * O evento do Histórico entra na mesma gravação, com o responsável recebido. Um
 * Histórico ilegível recusa a exclusão inteira.
 */
export function deleteAccessProfileWithUsers(
  id: string,
  actorInput: AccessProfileActor,
): AccessProfileDeleteResult {
  const normalizedId = id.trim()
  if (!normalizedId) return { ok: false, reason: 'not-found' }
  if (normalizedId === SYSTEM_ACCESS_PROFILE_ID) return { ok: false, reason: 'system-profile' }

  const actor = normalizeActor(actorInput)
  if (!actor) return { ok: false, reason: 'actor-required' }

  const migration = ensureLegacyLinksMigrated()
  if (!migration.ok) return { ok: false, reason: migration.reason }

  const stored = readStoredAccessProfiles()
  if (!stored.ok) {
    return {
      ok: false,
      reason:
        stored.reason === 'audience-classification-required'
          ? 'audience-classification-required'
          : 'storage-failure',
    }
  }

  const current = stored.profiles.find((profile) => profile.id === normalizedId)
  if (!current) return { ok: false, reason: 'not-found' }

  // A base de usuários precisa ser legível ANTES de qualquer decisão: remover o
  // perfil sem saber quem aponta para ele deixaria vínculos órfãos gravados.
  const users = readStoredUsers()
  if (!users) return { ok: false, reason: 'users-unavailable' }

  const unlinkedUserIds: string[] = []
  const unlinkedUserNames: string[] = []

  const nextUsers = users.map((user) => {
    if (storedAccessProfileId(user) !== current.id) return user

    unlinkedUserIds.push(user.id)
    // Nome copiado agora: o evento descreve quem ficou sem perfil no momento da
    // exclusão, e não quem tem esse nome hoje.
    unlinkedUserNames.push(user.name)

    return { ...user, accessProfileId: null }
  })

  const nextProfiles = stored.profiles.filter((profile) => profile.id !== current.id)

  const event = buildAccessProfileEvent(
    'access-profile-deleted',
    new Date().toISOString(),
    current,
    actor,
    buildProfileDeletionDetails(current, unlinkedUserNames),
  )

  const history = historyWithEvent(event)
  if (!history) return { ok: false, reason: 'history-unavailable' }

  if (
    !persistUsersAndProfiles(nextUsers, nextProfiles, stored.profiles, {
      history,
      markMigrationDone: false,
    })
  ) {
    return { ok: false, reason: 'storage-failure' }
  }

  return { ok: true, profile: current, unlinkedUserIds }
}
