import { biAreas } from '../../config/biAreas'
import {
  availableDepartmentPageKeys,
  normalizeAccessProfileGrants,
  validateAccessProfileCreationDraft,
  validateAccessProfileDraft,
} from '../../lib/accessProfileRules'
import type {
  AccessProfile,
  AccessProfileDraft,
  AccessProfileDraftError,
  DepartmentPageAccess,
  DepartmentPageReference,
  StandardAccessProfile,
  StandardAccessProfileAudience,
  SystemAccessProfile,
} from '../../types/access'
import {
  SYSTEM_ACCESS_PROFILE_ID,
  SYSTEM_ACCESS_PROFILE_NAME,
  readStoredAccessProfiles,
  writeStoredAccessProfiles,
} from './accessProfileStorage'

/**
 * Acesso central à coleção de perfis de acesso.
 *
 * A coleção tem duas origens que nunca se misturam: o perfil do sistema, montado
 * a partir dos catálogos a cada leitura, e os perfis comuns, que vivem no
 * localStorage. Este módulo junta as duas na leitura e grava somente a segunda.
 *
 * Não existe coleção em memória. Cada leitura reconstrói o perfil do sistema e
 * relê os perfis comuns do armazenamento, então nenhuma referência interna
 * existe para escapar: o que a interface receber pode ser alterado à vontade sem
 * atingir o estado gravado. Sem semente para sustentar, uma coleção em memória
 * só teria o efeito de exibir como salvo aquilo que não foi.
 *
 * Este bloco cobre carregar, listar, buscar, criar e editar. Desativação,
 * reativação, exclusão, transferência de usuários e a marcação de `hasBeenUsed`
 * pertencem aos blocos seguintes e não estão aqui, nem parcialmente.
 */

/* -------------------------------------------------------------------------- */
/* Perfil automático do Administrador                                         */
/* -------------------------------------------------------------------------- */

/**
 * Identidade do perfil automático, declarada em `accessProfileStorage` porque é
 * lá que ela precisa ser recusada, e reexportada aqui para quem consome o
 * repositório continuar tendo uma origem só.
 *
 * O id fica deliberadamente fora do padrão `acp-NNN`: o gerador de ids só
 * enxerga números, então ele nunca entra no cálculo do próximo e nunca colide
 * com um perfil comum. Pelo mesmo motivo ele também é recusado por
 * `validateAccessProfileDraft` como formato inválido, o que impede que alguém
 * crie um perfil comum tentando ocupar o lugar dele.
 */
export { SYSTEM_ACCESS_PROFILE_ID, SYSTEM_ACCESS_PROFILE_NAME }

/**
 * Primeira página disponível do portal, na ordem oficial dos catálogos, ou null
 * quando nenhuma página está publicada.
 */
function firstAvailablePage(): DepartmentPageReference | null {
  for (const area of biAreas) {
    const [pageKey] = availableDepartmentPageKeys(area.id)
    if (pageKey) return { departmentId: area.id, pageKey }
  }

  return null
}

/**
 * Perfil automático do Administrador, montado agora a partir dos catálogos.
 *
 * Concede todos os departamentos de `biAreas` com as páginas que estão
 * disponíveis hoje. Página em desenvolvimento não é concedida: ela entra sozinha
 * na leitura seguinte à publicação, e é isso que dispensa qualquer edição manual
 * quando o catálogo cresce. Um departamento sem nenhuma página publicada continua
 * na lista, com concessão vazia, e passa a conceder assim que a primeira página
 * dele sair do desenvolvimento.
 *
 * `hasBeenUsed` nasce true: o perfil é permanente e vale para todo Administrador,
 * então ele nunca esteve disponível para exclusão. As capacidades já recusam as
 * quatro operações pelo tipo `system`, e a marca mantém a coerência do dado.
 *
 * O destino é `administrator`, e é o único perfil que o tem: `Acesso Total` é o
 * Perfil de Acesso do Administrador, e nenhum perfil comum pode ocupar esse
 * lugar.
 *
 * Nada aqui é persistido, e nenhuma lista manual de departamentos ou páginas é
 * declarada: o catálogo é a única fonte.
 */
export function getSystemAccessProfile(): SystemAccessProfile {
  const departmentPageAccess = normalizeAccessProfileGrants(
    biAreas.map((area) => ({
      departmentId: area.id,
      pageKeys: availableDepartmentPageKeys(area.id),
    })),
  )

  // Catálogo sem nenhuma página publicada é estado degenerado do portal: o perfil
  // nasce sem página inicial utilizável e a avaliação do domínio já o classifica
  // como Revisão necessária, em vez de este módulo inventar um destino.
  const homePage = firstAvailablePage() ?? { departmentId: '', pageKey: '' }

  return {
    id: SYSTEM_ACCESS_PROFILE_ID,
    name: SYSTEM_ACCESS_PROFILE_NAME,
    kind: 'system',
    audience: 'administrator',
    lifecycle: 'active',
    departmentPageAccess,
    homePage,
    hasBeenUsed: true,
  }
}

/* -------------------------------------------------------------------------- */
/* Leitura                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Motivo pelo qual os perfis comuns não puderam ser usados.
 *
 * 'storage-failure' é falha de leitura: ninguém sabe o que está gravado.
 * 'audience-classification-required' é uma base íntegra no formato anterior, sem
 * destino em nenhum perfil, à espera de alguém dizer quais são de Executivos e
 * quais são de Analistas.
 *
 * Os dois bloqueiam a escrita, e é por motivos opostos que não podem ser um só:
 * o primeiro se resolve sozinho quando o armazenamento volta, e o segundo só se
 * resolve por decisão do Administrador.
 */
export type AccessProfileStorageFailureReason =
  | 'storage-failure'
  | 'audience-classification-required'

/**
 * Resultado de uma leitura da coleção.
 *
 * `profiles` vem preenchido nos dois casos, porque o perfil do sistema existe
 * mesmo sem armazenamento; `ok` é o que separa "estes são todos os perfis" de
 * "estes são os perfis que consegui montar". Uma coleção comum ilegível não pode
 * ser apresentada como coleção vazia: quem só olhasse a lista concluiria que os
 * perfis foram apagados, e a interface criaria de novo o que já existe.
 */
export type AccessProfileLoadResult =
  | { ok: true; profiles: AccessProfile[] }
  | { ok: false; reason: AccessProfileStorageFailureReason; profiles: AccessProfile[] }

/** Resultado de uma busca por id: o perfil, ou o motivo de não devolvê-lo. */
export type AccessProfileFindResult =
  | { ok: true; profile: AccessProfile }
  | { ok: false; reason: 'not-found' | AccessProfileStorageFailureReason }

/**
 * Coleção completa: o perfil do sistema primeiro, depois os perfis comuns na
 * ordem em que foram gravados, que é a ordem de criação.
 *
 * O perfil do sistema abre a lista porque é o único que existe sempre, com ou
 * sem base persistida. Quando os perfis comuns não podem ser usados, a resposta
 * traz `ok: false` com o motivo e apenas ele: a falha fica visível e nada do que
 * está gravado é apagado ou reescrito por causa de uma leitura ruim nem por
 * causa de uma base ainda sem destino.
 *
 * Armazenamento vazio não é falha: é uma base sem nenhum perfil comum, e
 * responde `ok: true` com o perfil do sistema sozinho.
 */
export function loadAccessProfiles(): AccessProfileLoadResult {
  const stored = readStoredAccessProfiles()

  if (!stored.ok) {
    return { ok: false, reason: stored.reason, profiles: [getSystemAccessProfile()] }
  }

  return { ok: true, profiles: [getSystemAccessProfile(), ...stored.profiles] }
}

/** Mesma leitura de `loadAccessProfiles`, com o nome que a listagem usa. */
export function listAccessProfiles(): AccessProfileLoadResult {
  return loadAccessProfiles()
}

/**
 * Perfil do sistema ou perfil comum pelo id técnico.
 *
 * O perfil do sistema é resolvido antes de qualquer leitura: ele é derivado do
 * catálogo e continua existindo mesmo com o armazenamento indisponível, ilegível
 * ou pendente de classificação. Para um perfil comum a distinção é preservada:
 * 'not-found' significa que a coleção foi lida e não tem esse id, e os motivos
 * de armazenamento significam que ninguém sabe se tem.
 */
export function findAccessProfileById(id: string): AccessProfileFindResult {
  const normalized = id.trim()
  if (!normalized) return { ok: false, reason: 'not-found' }

  const system = getSystemAccessProfile()
  if (normalized === system.id) return { ok: true, profile: system }

  const stored = readStoredAccessProfiles()
  if (!stored.ok) return { ok: false, reason: stored.reason }

  const match = stored.profiles.find((profile) => profile.id === normalized)

  return match ? { ok: true, profile: match } : { ok: false, reason: 'not-found' }
}

/* -------------------------------------------------------------------------- */
/* Geração de id                                                              */
/* -------------------------------------------------------------------------- */

/** Padrão numérico dos ids de perfil comum: acp- seguido do número sequencial. */
const ACCESS_PROFILE_ID_NUMBER_PATTERN = /^acp-(\d+)$/

/**
 * Próximo id livre no padrão acp-XXX: o maior número já usado mais um, com ao
 * menos três dígitos. Ids fora do padrão são ignorados no cálculo e não colidem
 * com o id gerado, que sempre segue o padrão; é por aí que o id do perfil do
 * sistema fica de fora sem precisar de exceção escrita.
 */
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

/* -------------------------------------------------------------------------- */
/* Escrita                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Campos editáveis de um perfil comum, e somente eles.
 *
 * Id, tipo, destino, ciclo de vida e indicador de utilização não estão aqui de
 * propósito: o id é gerado na criação e preservado na edição, o destino é
 * escolhido uma única vez na criação, e os outros três são estado do perfil, não
 * conteúdo de formulário. A página inicial pode estar ausente enquanto o
 * formulário não foi concluído, e nesse caso a recusa vem do domínio.
 *
 * É este o contrato da EDIÇÃO. Um campo de destino aqui seria, por definição, um
 * campo capaz de trocá-lo.
 */
export type AccessProfileInput = {
  name: string
  description?: string
  departmentPageAccess: DepartmentPageAccess[]
  homePage: DepartmentPageReference | null
}

/**
 * Contrato da CRIAÇÃO: os mesmos campos editáveis mais o destino, obrigatório e
 * limitado a Executivos ou Analistas.
 */
export type AccessProfileCreateInput = AccessProfileInput & {
  audience: StandardAccessProfileAudience
}

/** Motivo pelo qual uma criação de perfil foi recusada. */
export type AccessProfileCreateFailureReason =
  | 'invalid-draft'
  | AccessProfileStorageFailureReason

/** Motivo pelo qual uma edição de perfil foi recusada. */
export type AccessProfileUpdateFailureReason =
  | 'not-found'
  | 'system-profile'
  | 'invalid-draft'
  | AccessProfileStorageFailureReason

/**
 * Recusa estruturada: o motivo identifica a falha para a interface, e `errors`
 * carrega os códigos do domínio quando a recusa veio de
 * `validateAccessProfileDraft`, sem tradução nem perda.
 */
type AccessProfileWriteFailure<Reason> = {
  ok: false
  reason: Reason
  /** Presente somente quando `reason` é 'invalid-draft'. */
  errors?: AccessProfileDraftError[]
}

/** Sucesso carrega o perfil resultante; recusa carrega o motivo. */
export type AccessProfileCreateResult =
  | { ok: true; profile: AccessProfile }
  | AccessProfileWriteFailure<AccessProfileCreateFailureReason>

export type AccessProfileUpdateResult =
  | { ok: true; profile: AccessProfile }
  | AccessProfileWriteFailure<AccessProfileUpdateFailureReason>

/** Rascunho montado pelo repositório: o id nunca vem de quem chama. */
function buildDraft(id: string, input: AccessProfileInput): AccessProfileDraft {
  return {
    id,
    name: input.name,
    description: input.description,
    departmentPageAccess: input.departmentPageAccess,
    homePage: input.homePage,
  }
}

/**
 * Cria um perfil comum a partir dos campos editáveis.
 *
 * O id é gerado aqui, a partir da coleção atual, e nunca aceito de quem chama:
 * é assim que o id permanece único e permanente. O rascunho passa por
 * `validateAccessProfileCreationDraft` com a coleção completa, o perfil do
 * sistema incluído, para que "Acesso Total" também conte como nome ocupado.
 *
 * O destino vem de quem chama e é obrigatório: sem ele não há criação, e ele
 * nunca é deduzido do nome nem das páginas escolhidas. É a única oportunidade de
 * defini-lo, porque a edição não o alcança.
 *
 * O perfil nasce comum, ativo e nunca utilizado. Perfil do sistema não é criado
 * por aqui, nem por ninguém: ele é derivado do catálogo, e um perfil comum
 * destinado a Administradores nem sequer é representável.
 *
 * A coleção só é dada como alterada depois da persistência confirmada. Se a
 * leitura da coleção atual falhar, ou se ela ainda estiver no formato anterior,
 * a criação é recusada antes de qualquer escrita: gravar por cima de um conteúdo
 * que ninguém conseguiu ler, ou que ninguém classificou, apagaria os perfis que
 * estão lá.
 */
export function createAccessProfile(input: AccessProfileCreateInput): AccessProfileCreateResult {
  const stored = readStoredAccessProfiles()
  if (!stored.ok) return { ok: false, reason: stored.reason }

  const collection: AccessProfile[] = [getSystemAccessProfile(), ...stored.profiles]

  const validation = validateAccessProfileCreationDraft(
    { ...buildDraft(nextAccessProfileId(collection), input), audience: input.audience },
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
    hasBeenUsed: false,
  }

  if (!writeStoredAccessProfiles([...stored.profiles, created])) {
    return { ok: false, reason: 'storage-failure' }
  }

  return { ok: true, profile: created }
}

/**
 * Edita um perfil comum existente, localizado pelo id imutável.
 *
 * Só o conteúdo editável é substituído. Id, tipo, destino, ciclo de vida e
 * `hasBeenUsed` vêm do perfil atual e não do formulário: um perfil comum não
 * vira perfil do sistema, um perfil de Analista não vira perfil de Executivo, um
 * perfil desativado não é reativado por uma edição de páginas e um perfil já
 * utilizado não volta a ser inédito. O rascunho é montado com o id atual, então
 * a alteração de id sequer chega a ser possível a partir daqui; a recusa
 * `immutable-id` do domínio continua valendo para qualquer outro chamador.
 *
 * O destino é preservado pela própria forma da operação: `AccessProfileInput`
 * não tem onde informá-lo, e o perfil resultante o copia do atual.
 *
 * O perfil do sistema é recusado antes de qualquer leitura do armazenamento: ele
 * não é editável nem renomeável em nenhuma circunstância, e essa recusa não pode
 * depender do estado do localStorage. Com a coleção comum ilegível, responder
 * 'storage-failure' a quem tentou editar "Acesso total" sugeriria que a edição
 * seria possível depois de o armazenamento voltar, e nunca será.
 *
 * Como na criação, a gravação é tudo ou nada: se o armazenamento recusar, nada
 * muda e quem chamou recebe 'storage-failure' com a coleção exatamente como
 * estava.
 */
export function updateAccessProfile(
  id: string,
  input: AccessProfileInput,
): AccessProfileUpdateResult {
  const normalizedId = id.trim()
  if (!normalizedId) return { ok: false, reason: 'not-found' }

  const system = getSystemAccessProfile()
  if (normalizedId === system.id) return { ok: false, reason: 'system-profile' }

  const stored = readStoredAccessProfiles()
  if (!stored.ok) return { ok: false, reason: stored.reason }

  // A busca é só entre os perfis comuns: o id do sistema já saiu acima, e o
  // armazenamento nunca aceita outro perfil com kind 'system'. A coleção
  // completa continua indo para a validação, porque o nome do perfil do sistema
  // também é um nome ocupado.
  const collection: AccessProfile[] = [system, ...stored.profiles]
  const current = stored.profiles.find((profile) => profile.id === normalizedId)
  if (!current) return { ok: false, reason: 'not-found' }

  const validation = validateAccessProfileDraft(
    buildDraft(current.id, input),
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
  }

  const next = stored.profiles.map((profile) => (profile.id === current.id ? updated : profile))

  if (!writeStoredAccessProfiles(next)) return { ok: false, reason: 'storage-failure' }

  return { ok: true, profile: updated }
}
