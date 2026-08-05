import {
  EXECUTIVE_ACCESS_PROFILE_NAME,
  FULL_ACCESS_PROFILE_NAME,
  TECHNICAL_OPERATIONS_ACCESS_PROFILE_NAME,
  TECHNICAL_OPERATIONS_DEPARTMENT_IDS,
} from '../../config/accessProfileCatalog'
import { biAreas, type BiArea, type BiAreaId } from '../../config/biAreas'
import type { User } from '../../data/dashboardTypes'
import {
  MODEL_PAGE_KEY,
  defaultDepartmentPageKeys,
  deriveUserAccess,
  type DepartmentPageSelection,
  type DerivedUserAccess,
  type UserAccessConfig,
} from '../../lib/userAccessRules'
import type { UserProfile } from '../../types/access'

/**
 * Perfis de Acesso na camada de apresentação da página Usuários.
 *
 * Compatibilidade temporária, e nada além disso. O portal ainda não tem vínculo
 * persistido entre usuário e Perfil de Acesso: `User` continua guardando
 * departamentos e páginas, e `createUser`/`updateUserDetails` continuam
 * recebendo `UserAccessConfig`. Este módulo faz as duas traduções que a
 * interface precisa enquanto esse vínculo não existe:
 *
 * - reconhecer, a partir dos acessos gravados, qual Perfil de Acesso aprovado
 *   aquele usuário representa hoje;
 * - converter o Perfil de Acesso escolhido no drawer para o `UserAccessConfig`
 *   que o repositório já aceita.
 *
 * Nenhum identificador de perfil é persistido, nenhum campo novo é acrescentado
 * ao tipo `User` e nenhum serviço, repositório ou domínio é alterado. Os ids
 * usados aqui (`technical-operations`, `department:comercial`) existem somente
 * para o seletor da página e nunca chegam ao armazenamento.
 *
 * Módulo puro: não lê nem grava estado, não conhece o armazenamento e não muta
 * nada do que recebe.
 *
 * Departamentos, páginas e nomes vêm sempre das fontes oficiais: `biAreas`,
 * `defaultDepartmentPageKeys()` e `config/accessProfileCatalog`, que guarda os
 * nomes aprovados e a combinação técnica para todas as telas que falam de
 * Perfil de Acesso. Nenhuma lista de departamentos ou de páginas é escrita à
 * mão aqui, e esta página não depende de nenhuma outra rota.
 */

/* -------------------------------------------------------------------------- */
/* Identidades locais                                                         */
/* -------------------------------------------------------------------------- */

/** Perfil automático do Administrador. Identidade local, nunca persistida. */
export const FULL_ACCESS_PROFILE_ID = 'full-access'

/** Perfil automático do Executivo. Identidade local, nunca persistida. */
export const EXECUTIVE_ACCESS_PROFILE_ID = 'executive-access'

/** Combinação técnica aprovada. Identidade local, nunca persistida. */
export const TECHNICAL_OPERATIONS_ACCESS_PROFILE_ID = 'technical-operations'

/** Prefixo dos perfis departamentais: `department:` mais o id técnico do catálogo. */
const DEPARTMENT_ACCESS_PROFILE_PREFIX = 'department:'

/**
 * Estado de leitura de quem não corresponde a nenhum perfil aprovado.
 *
 * Não é um perfil: não aparece nas opções do seletor, não é convertido em
 * acesso e não é persistido. Descreve apenas o que está gravado hoje.
 */
export const UNPROFILED_ACCESS_LABEL = 'Acesso atual sem perfil'

/** Perfil de Acesso como o seletor e a tabela precisam dele. */
export type AccessProfileOption = {
  /** Identidade local e estável, usada apenas pela interface desta página. */
  id: string
  /** Nome oficial exibido. */
  name: string
}

export const FULL_ACCESS_PROFILE: AccessProfileOption = {
  id: FULL_ACCESS_PROFILE_ID,
  name: FULL_ACCESS_PROFILE_NAME,
}

export const EXECUTIVE_ACCESS_PROFILE: AccessProfileOption = {
  id: EXECUTIVE_ACCESS_PROFILE_ID,
  name: EXECUTIVE_ACCESS_PROFILE_NAME,
}

export const TECHNICAL_OPERATIONS_ACCESS_PROFILE: AccessProfileOption = {
  id: TECHNICAL_OPERATIONS_ACCESS_PROFILE_ID,
  name: TECHNICAL_OPERATIONS_ACCESS_PROFILE_NAME,
}

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                   */
/* -------------------------------------------------------------------------- */

const areaById = new Map<string, BiArea>(biAreas.map((area) => [area.id, area]))

/**
 * Perfil exclusivo de um departamento, derivado do catálogo.
 *
 * O nome é o rótulo oficial do departamento, sem prefixo: `COP`, e não `Acesso
 * COP`. O id continua sendo a identidade local desta página, e não o nome.
 */
function departmentAccessProfile(area: BiArea): AccessProfileOption {
  return { id: departmentAccessProfileId(area.id), name: area.label }
}

/** Identidade local do perfil de um departamento. */
export function departmentAccessProfileId(departmentId: string): string {
  return `${DEPARTMENT_ACCESS_PROFILE_PREFIX}${departmentId}`
}

/** Departamento oficial por trás de uma identidade local, ou null fora do catálogo. */
function departmentIdFromAccessProfileId(optionId: string): BiAreaId | null {
  if (!optionId.startsWith(DEPARTMENT_ACCESS_PROFILE_PREFIX)) return null

  const departmentId = optionId.slice(DEPARTMENT_ACCESS_PROFILE_PREFIX.length)

  return areaById.get(departmentId)?.id ?? null
}

/**
 * Opções do seletor do Analista: a combinação técnica aprovada e um
 * perfil por departamento oficial, na ordem do catálogo.
 *
 * Acesso Total e Acesso Executivo ficam de fora de propósito: os dois são
 * automáticos do Perfil do Sistema e não são escolhidos aqui.
 */
export const analystAccessProfileOptions: readonly AccessProfileOption[] = [
  TECHNICAL_OPERATIONS_ACCESS_PROFILE,
  ...biAreas.map(departmentAccessProfile),
]

/** Perfil de Acesso definido pelo Perfil do Sistema, ou null quando é escolhido. */
export function automaticAccessProfile(profile: UserProfile): AccessProfileOption | null {
  if (profile === 'Administrador') return FULL_ACCESS_PROFILE
  if (profile === 'Executivo') return EXECUTIVE_ACCESS_PROFILE

  return null
}

/* -------------------------------------------------------------------------- */
/* Reconhecimento                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Departamentos concedidos e as páginas de cada um, ou null quando a estrutura
 * gravada não pode ser interpretada com segurança.
 *
 * A leitura é estrita porque o resultado decide um nome exibido: id fora do
 * catálogo, departamento repetido, página repetida ou estrutura fora de forma
 * não viram interpretação parcial, viram ausência de reconhecimento. O acesso do
 * usuário continua intacto em todos esses casos: aqui nada é escrito.
 *
 * Só ids técnicos e chaves técnicas participam; rótulos exibidos, não.
 */
function readGrantedDepartments(user: User): Map<BiAreaId, Set<string>> | null {
  const stored: unknown = user.departmentPageAccess
  if (!Array.isArray(stored)) return null

  const granted = new Map<BiAreaId, Set<string>>()

  for (const entry of stored as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return null

    const { departmentId, pageKeys } = entry as { departmentId?: unknown; pageKeys?: unknown }
    if (typeof departmentId !== 'string' || !Array.isArray(pageKeys)) return null

    const area = areaById.get(departmentId)
    if (!area) return null

    // O mesmo departamento em duas entradas descreve um acesso ambíguo.
    if (granted.has(area.id)) return null

    const keys = new Set<string>()

    for (const pageKey of pageKeys as unknown[]) {
      if (typeof pageKey !== 'string') return null
      // Repetição é base fora de forma: reconhecer aqui faria o salvamento
      // seguinte reescrever o acesso só para eliminar a duplicata.
      if (keys.has(pageKey)) return null

      keys.add(pageKey)
    }

    granted.set(area.id, keys)
  }

  return granted
}

/** Comparação de conjunto, independente da ordem em que os valores foram gravados. */
function hasExactly(values: ReadonlySet<string>, expected: readonly string[]): boolean {
  return values.size === expected.length && expected.every((value) => values.has(value))
}

/**
 * Perfil de Acesso que descreve os acessos atuais do usuário, ou null quando a
 * combinação gravada não corresponde a nenhum perfil aprovado.
 *
 * Administrador e Executivo são decididos pelo Perfil do Sistema, e não pelos
 * acessos gravados: os dois têm alcance definido pelo próprio perfil. Para o
 * Analista vale a combinação exata, sempre por ids técnicos de
 * departamento e chaves técnicas de página, sem depender da ordem dos arrays:
 * a combinação técnica aprovada, ou um único departamento, e em ambos os casos
 * com exatamente as páginas de `defaultDepartmentPageKeys()`. Qualquer outra
 * combinação fica sem perfil, sem nome inventado e sem nome composto.
 *
 * Não altera o usuário recebido.
 */
export function recognizeUserAccessProfile(user: User): AccessProfileOption | null {
  const automatic = automaticAccessProfile(user.profile)
  if (automatic) return automatic

  if (user.profile !== 'Analista') return null

  const granted = readGrantedDepartments(user)
  if (!granted || granted.size === 0) return null

  // Páginas padrão exatas em todo departamento concedido: uma página a mais, uma
  // a menos, ou o Modelo Dimensional já descaracterizam o perfil.
  for (const [departmentId, pageKeys] of granted) {
    if (!hasExactly(pageKeys, defaultDepartmentPageKeys(departmentId))) return null
  }

  if (hasExactly(new Set(granted.keys()), TECHNICAL_OPERATIONS_DEPARTMENT_IDS)) {
    return TECHNICAL_OPERATIONS_ACCESS_PROFILE
  }

  if (granted.size === 1) {
    const [departmentId] = [...granted.keys()]
    const area = areaById.get(departmentId)

    return area ? departmentAccessProfile(area) : null
  }

  return null
}

/** Nome exibido do Perfil de Acesso, ou o estado de leitura de quem não tem um. */
export function userAccessProfileLabel(user: User): string {
  return recognizeUserAccessProfile(user)?.name ?? UNPROFILED_ACCESS_LABEL
}

/**
 * Opção que o seletor deve carregar ao abrir a edição.
 *
 * Só o Analista tem escolha: Administrador e Executivo recebem o
 * perfil automático, e o rascunho do Analista nasce vazio para quem vier de um
 * desses dois perfis. Analista sem perfil reconhecido também nasce
 * sem seleção, e é isso que preserva os acessos atuais dele.
 */
export function initialAccessProfileId(user: User | null): string | null {
  if (!user || user.profile !== 'Analista') return null

  return recognizeUserAccessProfile(user)?.id ?? null
}

/**
 * Rascunho aceito pelo seletor do Analista.
 *
 * O seletor só renderiza `analystAccessProfileOptions`, e um `select`
 * controlado com valor fora das opções exibe a primeira delas: a tela mostraria
 * um perfil escolhido que o formulário não tem, e o salvamento recusaria por
 * falta de escolha logo depois. Por isso todo valor que entra no rascunho passa
 * por aqui, e o que não for opção do seletor do Analista vira null, que é a
 * ausência de escolha, e não um perfil escolhido por conta própria.
 *
 * As identidades dos perfis automáticos caem em null junto com o resto: Acesso
 * Total e Acesso Executivo pertencem ao Perfil do Sistema, nunca ao seletor.
 * `initialAccessProfileId` já devolve null para esses dois perfis, então hoje
 * nenhuma delas chega até aqui; a garantia fica escrita no lugar onde o valor
 * entra, em vez de depender de uma condição distante continuar existindo.
 */
export function analystAccessProfileDraft(optionId: string | null): string | null {
  if (optionId === null) return null

  return analystAccessProfileOptions.some((option) => option.id === optionId) ? optionId : null
}

/* -------------------------------------------------------------------------- */
/* Conversão para o acesso aceito hoje                                        */
/* -------------------------------------------------------------------------- */

/** Departamento com as páginas padrão do catálogo, nunca declaradas à mão. */
function departmentSelection(departmentId: BiAreaId): DepartmentPageSelection {
  return { departmentId, pageKeys: defaultDepartmentPageKeys(departmentId) }
}

/**
 * Converte um Perfil de Acesso selecionável em `UserAccessConfig`.
 *
 * Devolve null para uma identidade que não corresponde a nenhum perfil aprovado,
 * inclusive a de um perfil automático: Acesso Total e Acesso Executivo vêm do
 * Perfil do Sistema, e não desta conversão.
 */
export function accessConfigFromAccessProfile(optionId: string): UserAccessConfig | null {
  if (optionId === TECHNICAL_OPERATIONS_ACCESS_PROFILE_ID) {
    return {
      profile: 'Analista',
      departments: TECHNICAL_OPERATIONS_DEPARTMENT_IDS.map((departmentId) =>
        departmentSelection(departmentId),
      ),
    }
  }

  const departmentId = departmentIdFromAccessProfileId(optionId)
  if (!departmentId) return null

  return { profile: 'Analista', departments: [departmentSelection(departmentId)] }
}

/**
 * Departamentos em que o Modelo Dimensional já está liberado.
 *
 * O acesso global do Administrador não é liberação granular e por isso não
 * semeia nada. Nos demais perfis, a liberação existente é preservada: a seção
 * granular saiu da interface, mas retirar em silêncio um acesso já concedido
 * seria alterar o que ninguém pediu para alterar.
 */
export function preservedModelDepartmentIds(user: User | null): string[] {
  if (!user || user.profile === 'Administrador') return []

  const stored: unknown = user.departmentPageAccess
  if (!Array.isArray(stored)) return []

  return (stored as unknown[]).flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []

    const { departmentId, pageKeys } = entry as { departmentId?: unknown; pageKeys?: unknown }
    if (typeof departmentId !== 'string' || !Array.isArray(pageKeys)) return []

    return pageKeys.includes(MODEL_PAGE_KEY) ? [departmentId] : []
  })
}

/* -------------------------------------------------------------------------- */
/* Preservação do acesso atual                                                */
/* -------------------------------------------------------------------------- */

function sameOrderedList(current: readonly string[], next: readonly string[]): boolean {
  return current.length === next.length && current.every((value, index) => value === next[index])
}

/**
 * true quando o acesso derivado é exatamente o que o usuário já tem gravado.
 *
 * A comparação repete, campo a campo e na mesma ordem, a que o repositório faz
 * para decidir se há algo a gravar. É deliberadamente uma leitura própria: a do
 * repositório é interna, e o objetivo aqui é justamente antecipar o veredito
 * dele antes de chamar a gravação.
 */
function reproducesStoredAccess(user: User, derived: DerivedUserAccess): boolean {
  const storedPageAccess = Array.isArray(user.departmentPageAccess) ? user.departmentPageAccess : []

  return (
    user.profile === derived.profile &&
    user.permissions === derived.permissions &&
    sameOrderedList(user.permissionKeys ?? [], derived.permissionKeys) &&
    sameOrderedList(user.departments ?? [], derived.departments) &&
    storedPageAccess.length === derived.departmentPageAccess.length &&
    storedPageAccess.every(
      (access, index) =>
        access.departmentId === derived.departmentPageAccess[index].departmentId &&
        sameOrderedList(access.pageKeys ?? [], derived.departmentPageAccess[index].pageKeys),
    )
  )
}

/** Seleção equivalente ao que está gravado, sem acrescentar nem retirar nada. */
function storedSelections(user: User): DepartmentPageSelection[] | null {
  const stored: unknown = user.departmentPageAccess
  if (!Array.isArray(stored)) return null

  const selections: DepartmentPageSelection[] = []

  for (const entry of stored as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return null

    const { departmentId, pageKeys } = entry as { departmentId?: unknown; pageKeys?: unknown }
    if (typeof departmentId !== 'string' || !Array.isArray(pageKeys)) return null

    selections.push({ departmentId, pageKeys: [...(pageKeys as string[])] })
  }

  return selections
}

/** A configuração, se ela reproduz o acesso gravado exatamente; senão, null. */
function configIfIdentical(user: User, config: UserAccessConfig): UserAccessConfig | null {
  const derived = deriveUserAccess(config)

  return derived && reproducesStoredAccess(user, derived) ? config : null
}

/**
 * Configuração que devolve ao repositório exatamente o acesso que o usuário já
 * tem, para nome e e-mail poderem ser editados sem que os acessos mudem.
 *
 * Vale para os três Perfis do Sistema, e não só para o Analista:
 * qualquer configuração enviada passa pela normalização do repositório, então a
 * do Administrador e a do Executivo também precisam ser conferidas antes de
 * seguir. A do Analista é reconstruída a partir do que está
 * gravado, sem acrescentar nem retirar nada e sem reordenar.
 *
 * Devolve null quando o fluxo atual não consegue reproduzir o acesso gravado:
 * o repositório normaliza a configuração recebida contra o catálogo, então uma
 * base com departamento desconhecido, página desconhecida, entrada repetida ou
 * ordem divergente da do catálogo sairia de lá diferente do que entrou. Nesse
 * caso a página recusa a gravação em vez de alterar em silêncio um acesso que
 * ninguém mandou alterar.
 */
export function preservedAccessConfig(user: User): UserAccessConfig | null {
  if (user.profile === 'Administrador') {
    return configIfIdentical(user, { profile: 'Administrador' })
  }

  if (user.profile === 'Executivo') {
    return configIfIdentical(user, {
      profile: 'Executivo',
      modelDepartmentIds: preservedModelDepartmentIds(user),
    })
  }

  if (user.profile !== 'Analista') return null

  const departments = storedSelections(user)
  if (!departments) return null

  return configIfIdentical(user, { profile: 'Analista', departments })
}

/* -------------------------------------------------------------------------- */
/* Entrada do repositório                                                     */
/* -------------------------------------------------------------------------- */

/** Por que o formulário ainda não tem um acesso válido para gravar. */
export type UserAccessConfigFailureReason =
  | 'access-profile-required'
  | 'current-access-not-preservable'

export type UserAccessConfigResolution =
  | { ok: true; access: UserAccessConfig }
  | { ok: false; reason: UserAccessConfigFailureReason }

/**
 * Traduz o que o drawer tem em mãos para a entrada que o repositório aceita.
 *
 * A pergunta que decide tudo é se houve alteração deliberada de perfil, e não
 * se o seletor está preenchido. Em uma edição em que nem o Perfil do Sistema
 * nem o Perfil de Acesso mudaram, o que segue para o repositório é o acesso
 * gravado, reproduzido exatamente: converter de novo o perfil reconhecido para
 * a forma canônica poderia reordenar departamentos ou páginas, e o repositório
 * compara os arrays por posição. Uma edição só de nome ou e-mail viraria uma
 * alteração de acessos com evento de auditoria, sem ninguém ter escolhido nada.
 *
 * O reconhecimento é por conjunto, de propósito: um acesso equivalente em outra
 * ordem continua exibindo o nome do perfil. Mas equivalente não é idêntico, e
 * quem grava é a comparação por posição, então o nome exibido nunca autoriza,
 * sozinho, uma regravação.
 *
 * Converte para a configuração aprovada em três casos, todos deliberados: é uma
 * criação, o Perfil do Sistema mudou, ou o Perfil de Acesso mudou. Aí sim
 * Administrador e Executivo ignoram qualquer seleção anterior do Analista, e
 * o Analista exige um perfil escolhido.
 */
export function resolveUserAccessConfig(input: {
  systemProfile: UserProfile
  /** Perfil escolhido no seletor; null quando nenhum foi escolhido. */
  accessProfileId: string | null
  /** Perfil reconhecido na abertura do drawer; null na criação. */
  loadedAccessProfileId: string | null
  /** Usuário em edição; null na criação. */
  currentUser: User | null
}): UserAccessConfigResolution {
  const { systemProfile, accessProfileId, loadedAccessProfileId, currentUser } = input

  if (currentUser) {
    const systemProfileChanged = systemProfile !== currentUser.profile
    const accessProfileChanged = accessProfileId !== loadedAccessProfileId

    if (!systemProfileChanged && !accessProfileChanged) {
      const preserved = preservedAccessConfig(currentUser)

      return preserved
        ? { ok: true, access: preserved }
        : { ok: false, reason: 'current-access-not-preservable' }
    }
  }

  if (systemProfile === 'Administrador') return { ok: true, access: { profile: 'Administrador' } }

  if (systemProfile === 'Executivo') {
    return {
      ok: true,
      access: {
        profile: 'Executivo',
        modelDepartmentIds: preservedModelDepartmentIds(currentUser),
      },
    }
  }

  if (accessProfileId === null) return { ok: false, reason: 'access-profile-required' }

  const access = accessConfigFromAccessProfile(accessProfileId)

  return access ? { ok: true, access } : { ok: false, reason: 'access-profile-required' }
}
