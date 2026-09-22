import { EXECUTIVE_ACCESS_PROFILE_NAME } from '../config/accessProfileCatalog'
import { biAreas, type BiArea } from '../config/biAreas'
import { departmentPages, type DepartmentPageDefinition } from '../config/departmentPages'
import type {
  AccessProfile,
  AccessProfileAudience,
  AccessProfileCapabilities,
  AccessProfileCreationDraft,
  AccessProfileCreationValidation,
  AccessProfileDraft,
  AccessProfileDraftError,
  AccessProfileDraftErrorCode,
  AccessProfileDraftValidation,
  AccessProfileEvaluation,
  AccessProfileIssue,
  AccessProfileIssueCode,
  AccessProfileLifecycle,
  AccessProfileOperationalStatus,
  DepartmentPageAccess,
  DepartmentPageReference,
  NormalizedAccessProfileName,
  StandardAccessProfileAudience,
  UserProfile,
} from '../types/access'

/**
 * Regras puras do perfil de acesso reutilizável.
 *
 * Domínio isolado: nenhuma função daqui é chamada pela aplicação neste momento.
 * O modelo granular por usuário (`userAccessRules`, `accessControl`, `User`)
 * continua valendo sem alteração, e este módulo não o substitui nem o consulta.
 *
 * Os departamentos e as páginas vêm exclusivamente de `biAreas` e
 * `departmentPages`: nenhuma lista paralela é declarada aqui. O índice por id é
 * montado neste módulo, a partir do mesmo catálogo, para que o domínio novo não
 * dependa de nenhuma função do modelo granular antigo. É uma linha de código
 * repetida, e não uma lista de departamentos duplicada: a fonte continua sendo
 * `biAreas`, e um departamento novo aparece aqui sem nenhuma alteração.
 *
 * Módulo puro: não lê nem grava estado, não conhece armazenamento e não decide
 * quem pode aplicar a mudança.
 *
 * Diferença deliberada em relação a `normalizeSelections` de `userAccessRules`:
 * lá, um departamento ou uma página fora do catálogo é descartado em silêncio,
 * porque a entrada vem de um formulário que acabou de ser preenchido. Aqui, o
 * que está fora do catálogo é PRESERVADO e vira pendência, porque a entrada é um
 * perfil que já estava gravado quando o catálogo mudou. Descartar em silêncio
 * apagaria justamente a informação que o Administrador precisa revisar.
 */

/**
 * Formato do id técnico de um perfil de acesso, no mesmo padrão dos ids de
 * usuário (`usr-001`): o prefixo `acp-` seguido de no mínimo três dígitos, e
 * nada além de dígitos.
 *
 * O mínimo de três é o mesmo preenchimento que a geração aplica, então `acp-1` e
 * `acp-12` não são apenas incomuns, são ids que este domínio nunca produz. Não
 * existe máximo: a sequência pode passar de 999 e `acp-1000` continua válido.
 *
 * A geração do próximo id é responsabilidade do repositório e não pertence a
 * este bloco: aqui o formato é apenas verificado.
 */
export const ACCESS_PROFILE_ID_PATTERN = /^acp-\d{3,}$/

/**
 * Rótulos do estado operacional, separados dos valores técnicos de propósito:
 * o dado gravado nunca é o texto exibido.
 */
export const accessProfileOperationalStatusLabels: Record<
  AccessProfileOperationalStatus,
  string
> = {
  active: 'Ativo',
  inactive: 'Inativo',
  'needs-review': 'Revisão necessária',
}

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                   */
/* -------------------------------------------------------------------------- */

/** Índice id técnico para departamento, montado uma vez a partir de `biAreas`. */
const departmentById = new Map<string, BiArea>(biAreas.map((area) => [area.id, area]))

/**
 * Departamento do catálogo oficial pelo id técnico, ou null quando o id não está
 * mais no catálogo. Interno ao módulo de propósito: o domínio novo resolve o
 * catálogo por conta própria, sem passar pelo modelo granular antigo.
 */
function findCatalogDepartment(departmentId: string): BiArea | null {
  return departmentById.get(departmentId.trim()) ?? null
}

/**
 * Página do catálogo de um departamento, ou null quando o departamento não
 * existe ou não tem essa página. Uma chave de página só faz sentido dentro de um
 * departamento, então os dois são resolvidos juntos.
 */
export function findDepartmentPage(
  departmentId: string,
  pageKey: string,
): DepartmentPageDefinition | null {
  const area = findCatalogDepartment(departmentId)
  if (!area) return null

  return departmentPages[area.id].find((page) => page.key === pageKey) ?? null
}

/**
 * true quando a página existe no catálogo daquele departamento e não está em
 * desenvolvimento. "Disponível" é sobre o catálogo, não sobre permissão: um
 * perfil pode conceder uma página indisponível, e é isso que vira pendência.
 */
export function isDepartmentPageAvailable(departmentId: string, pageKey: string): boolean {
  const page = findDepartmentPage(departmentId, pageKey)

  return page !== null && !page.disabled
}

/**
 * Chaves das páginas publicadas do departamento, na ordem do catálogo.
 *
 * "Publicada" é o oposto de `disabled`: a página existe no catálogo e já pode
 * ser aberta. Departamento fora do catálogo devolve lista vazia, e não erro,
 * porque o id pode ter vindo de um perfil gravado antes de o catálogo mudar.
 *
 * É a lista que responde tanto o que um perfil deve conceder quanto o total de
 * páginas de um departamento, e por isso mora aqui: sem ela, cada camada
 * repetiria o mesmo filtro e uma delas acabaria contando as páginas em
 * desenvolvimento junto com as publicadas.
 */
export function availableDepartmentPageKeys(departmentId: string): string[] {
  const area = findCatalogDepartment(departmentId)
  if (!area) return []

  return departmentPages[area.id].filter((page) => !page.disabled).map((page) => page.key)
}

/* -------------------------------------------------------------------------- */
/* Normalização                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Nome do perfil em duas formas.
 *
 * `displayName` remove os espaços das pontas e reduz qualquer sequência interna
 * de espaços a um só, preservando a grafia escolhida. `comparisonKey` é a mesma
 * string em caixa baixa, usada só para detectar duplicidade.
 *
 * Acentuação é preservada na comparação: "Análise" e "Analise" são nomes
 * diferentes. Dobrar as duas em uma só exigiria decidir que acento não distingue
 * nomes, o que é decisão de negócio e não está confirmada.
 */
export function normalizeAccessProfileName(name: string): NormalizedAccessProfileName {
  const displayName = name.trim().replace(/\s+/g, ' ')

  return { displayName, comparisonKey: displayName.toLowerCase() }
}

/** Descrição sem espaços nas pontas; texto vazio vira ausência de descrição. */
export function normalizeAccessProfileDescription(
  description: string | undefined,
): string | undefined {
  const normalized = description?.trim()

  return normalized ? normalized : undefined
}

/** Páginas de um departamento na ordem do catálogo; as desconhecidas vão para o fim. */
function orderPageKeys(departmentId: string, pageKeys: readonly string[]): string[] {
  const area = findCatalogDepartment(departmentId)
  if (!area) return [...pageKeys]

  const position = new Map(departmentPages[area.id].map((page, index) => [page.key, index]))

  const known = pageKeys.filter((pageKey) => position.has(pageKey))
  const unknown = pageKeys.filter((pageKey) => !position.has(pageKey))

  known.sort((first, second) => (position.get(first) ?? 0) - (position.get(second) ?? 0))

  return [...known, ...unknown]
}

/**
 * Normaliza os departamentos e páginas concedidos: agrupa departamentos
 * repetidos, remove chaves de página duplicadas e devolve tudo na ordem oficial
 * dos catálogos.
 *
 * O que não está no catálogo é mantido, e não descartado: departamentos e
 * páginas desconhecidos vão para o fim da respectiva lista, na ordem em que
 * apareceram, para que `findAccessProfileIssues` possa apontá-los. A ordem dos
 * conhecidos é sempre a de `biAreas` e `departmentPages`.
 *
 * Não impõe a Visão Geral, não acrescenta nenhuma página que não tenha sido
 * informada e não amplia acesso em nenhuma hipótese.
 */
export function normalizeAccessProfileGrants(
  entries: readonly DepartmentPageAccess[],
): DepartmentPageAccess[] {
  const grouped = new Map<string, string[]>()

  for (const entry of entries) {
    const area = findCatalogDepartment(entry.departmentId)
    const departmentId = area ? area.id : entry.departmentId.trim()
    if (!departmentId) continue

    const pageKeys = grouped.get(departmentId) ?? []

    for (const rawPageKey of Array.isArray(entry.pageKeys) ? entry.pageKeys : []) {
      const pageKey = rawPageKey.trim()
      if (!pageKey || pageKeys.includes(pageKey)) continue

      pageKeys.push(pageKey)
    }

    grouped.set(departmentId, pageKeys)
  }

  const catalogPosition = new Map<string, number>(biAreas.map((area, index) => [area.id, index]))

  // Map preserva a ordem de inserção: os desconhecidos saem na ordem de entrada.
  const known: string[] = []
  const unknown: string[] = []

  for (const departmentId of grouped.keys()) {
    if (catalogPosition.has(departmentId)) known.push(departmentId)
    else unknown.push(departmentId)
  }

  known.sort(
    (first, second) => (catalogPosition.get(first) ?? 0) - (catalogPosition.get(second) ?? 0),
  )

  return [...known, ...unknown].map((departmentId) => ({
    departmentId,
    pageKeys: orderPageKeys(departmentId, grouped.get(departmentId) ?? []),
  }))
}

/* -------------------------------------------------------------------------- */
/* Consulta de concessão                                                      */
/* -------------------------------------------------------------------------- */

/**
 * true quando o perfil concede exatamente aquele par departamento e página.
 *
 * Sem nenhum atalho: `admin.full` e os demais bypasses pertencem ao perfil
 * funcional e não têm efeito aqui, porque o perfil de acesso não guarda
 * permissões administrativas.
 */
export function hasAccessProfilePageGrant(
  profile: AccessProfile,
  departmentId: string,
  pageKey: string,
): boolean {
  return profile.departmentPageAccess.some(
    (access) => access.departmentId === departmentId && access.pageKeys.includes(pageKey),
  )
}

/** Total de páginas concedidas somando todos os departamentos. */
function grantedPageCount(profile: AccessProfile): number {
  return profile.departmentPageAccess.reduce(
    (total, access) => total + access.pageKeys.length,
    0,
  )
}

/* -------------------------------------------------------------------------- */
/* Pendências                                                                 */
/* -------------------------------------------------------------------------- */

/** Textos fixos de cada código, para a identidade da pendência não depender de string livre. */
const issueTexts: Record<
  AccessProfileIssueCode,
  { reason: string; impact: string; requiredAction: string }
> = {
  'home-page-missing-from-catalog': {
    reason: 'A página inicial configurada não existe mais no catálogo do portal.',
    impact: 'O perfil não tem para onde direcionar quem entra com ele.',
    requiredAction: 'Escolha uma nova página inicial entre as páginas concedidas.',
  },
  'home-page-not-granted': {
    reason: 'A página inicial configurada não está entre as páginas concedidas pelo perfil.',
    impact: 'O perfil aponta para uma página que ele mesmo não libera.',
    requiredAction: 'Conceda essa página ao perfil ou escolha outra página inicial.',
  },
  'home-page-disabled': {
    reason: 'A página inicial configurada está em desenvolvimento.',
    impact: 'A página existe e está concedida, mas ainda não pode ser aberta.',
    requiredAction: 'Escolha uma página inicial já disponível enquanto esta não é publicada.',
  },
  'department-missing-from-catalog': {
    reason: 'O departamento concedido não existe mais no catálogo do portal.',
    impact: 'Nenhuma página desse departamento pode ser aberta.',
    requiredAction: 'Remova o departamento do perfil.',
  },
  'granted-page-missing-from-catalog': {
    reason: 'A página concedida não existe mais no catálogo do departamento.',
    impact: 'A concessão não corresponde a nenhuma página do portal.',
    requiredAction: 'Remova a página do perfil.',
  },
  'granted-page-disabled': {
    reason: 'A página concedida está em desenvolvimento.',
    impact: 'A página aparece como concedida, mas ainda não pode ser aberta.',
    requiredAction: 'Mantenha a concessão até a publicação ou remova a página do perfil.',
  },
  'no-pages-granted': {
    reason: 'O perfil não concede nenhuma página.',
    impact: 'Quem usa este perfil não enxerga nada no portal.',
    requiredAction: 'Selecione ao menos uma página para o perfil.',
  },
  'no-available-page': {
    reason: 'Nenhuma das páginas concedidas está disponível hoje.',
    impact: 'Quem usa este perfil não consegue abrir nenhuma página.',
    requiredAction: 'Conceda ao menos uma página já disponível.',
  },
}

function issue(
  code: AccessProfileIssueCode,
  location?: { departmentId?: string; pageKey?: string },
): AccessProfileIssue {
  return { code, ...issueTexts[code], ...location }
}

/**
 * Pendência da página inicial, no máximo uma.
 *
 * A ordem é do problema mais fundamental para o menos: uma página que não existe
 * no catálogo não pode ser avaliada quanto a concessão nem quanto a
 * desenvolvimento, e uma página que não foi concedida não precisa ser avaliada
 * quanto a desenvolvimento. Apontar as três de uma vez daria ao Administrador
 * instruções concorrentes para o mesmo campo.
 */
function findHomePageIssue(profile: AccessProfile): AccessProfileIssue | null {
  const { departmentId, pageKey } = profile.homePage
  const location = { departmentId, pageKey }

  const page = findDepartmentPage(departmentId, pageKey)
  if (!page) return issue('home-page-missing-from-catalog', location)

  if (!hasAccessProfilePageGrant(profile, departmentId, pageKey)) {
    return issue('home-page-not-granted', location)
  }

  if (page.disabled) return issue('home-page-disabled', location)

  return null
}

/**
 * Todas as pendências do perfil diante do catálogo atual.
 *
 * A ordem é por severidade decrescente: primeiro o que inutiliza o perfil
 * inteiro, depois a página inicial, que decide para onde ele aponta, e por fim
 * os itens individuais da seleção.
 *
 * `no-available-page` não é emitida junto de `no-pages-granted`: um perfil sem
 * nenhuma página também não tem página disponível, e as duas linhas diriam a
 * mesma coisa. As páginas de um departamento inexistente também não são
 * inspecionadas uma a uma, porque a pendência do departamento já as cobre.
 */
export function findAccessProfileIssues(profile: AccessProfile): AccessProfileIssue[] {
  const issues: AccessProfileIssue[] = []

  if (grantedPageCount(profile) === 0) {
    issues.push(issue('no-pages-granted'))
  } else if (!hasAvailableAccessProfilePage(profile)) {
    issues.push(issue('no-available-page'))
  }

  const homePageIssue = findHomePageIssue(profile)
  if (homePageIssue) issues.push(homePageIssue)

  for (const access of profile.departmentPageAccess) {
    const { departmentId } = access

    if (!findCatalogDepartment(departmentId)) {
      issues.push(issue('department-missing-from-catalog', { departmentId }))
      continue
    }

    for (const pageKey of access.pageKeys) {
      const page = findDepartmentPage(departmentId, pageKey)
      const location = { departmentId, pageKey }

      if (!page) {
        issues.push(issue('granted-page-missing-from-catalog', location))
        continue
      }

      if (page.disabled) issues.push(issue('granted-page-disabled', location))
    }
  }

  return issues
}

/* -------------------------------------------------------------------------- */
/* Status operacional                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Estado apresentado ao usuário, sempre calculado.
 *
 * O ciclo de vida decide primeiro: um perfil desativado continua Inativo mesmo
 * com a configuração impecável, e não vira "Revisão necessária". Só um perfil
 * ativo é avaliado pelas pendências, e por isso um perfil corrigido volta
 * sozinho para Ativo, sem nenhum estado gravado para atualizar.
 */
export function resolveAccessProfileOperationalStatus(
  lifecycle: AccessProfileLifecycle,
  issues: readonly AccessProfileIssue[],
): AccessProfileOperationalStatus {
  if (lifecycle === 'inactive') return 'inactive'

  return issues.length ? 'needs-review' : 'active'
}

/* -------------------------------------------------------------------------- */
/* Página inicial efetiva                                                     */
/* -------------------------------------------------------------------------- */

/** true quando o perfil concede ao menos uma página que está disponível hoje. */
export function hasAvailableAccessProfilePage(profile: AccessProfile): boolean {
  return resolveEffectiveAccessProfileHomePage(profile) !== null
}

/**
 * Página que o perfil deve abrir de fato.
 *
 * A página inicial configurada é usada quando está concedida e disponível.
 * Quando não está, o lugar dela é ocupado por outra página que o PRÓPRIO perfil
 * já concede e que esteja disponível, procurada na ordem oficial do catálogo
 * (departamentos na ordem de `biAreas`, páginas na ordem de `departmentPages`),
 * e não na ordem em que o perfil foi montado, para que o resultado não dependa
 * de como a seleção foi digitada.
 *
 * Sem nenhuma página disponível, devolve null. Não existe fallback para a Visão
 * Geral nem para qualquer outro departamento: nenhuma substituição concede o que
 * o perfil não concedia, porque um perfil quebrado abrindo uma página a mais é
 * pior do que um perfil que não abre nada.
 */
export function resolveEffectiveAccessProfileHomePage(
  profile: AccessProfile,
): DepartmentPageReference | null {
  return resolveAccessProfileHomePage(profile.departmentPageAccess, profile.homePage)
}

/**
 * A mesma decisão da página inicial, a partir das concessões soltas.
 *
 * Existe porque a criação e a edição precisam dela ANTES de haver um perfil:
 * o formulário não expõe a página inicial, então ela é calculada a partir do que
 * foi concedido. `current` é a página inicial que o perfil já tinha, ausente na
 * criação; ela é preservada enquanto continuar concedida e disponível, e só
 * então dá lugar à primeira página válida na ordem oficial dos catálogos.
 *
 * A Visão Geral Executiva não é candidata em nenhuma hipótese: ela é um contexto
 * global do portal, não está em `departmentPages` e por isso não tem par
 * departamento e página para ocupar este campo.
 */
export function resolveAccessProfileHomePage(
  grants: readonly DepartmentPageAccess[],
  current: DepartmentPageReference | null,
): DepartmentPageReference | null {
  const granted = (departmentId: string, pageKey: string): boolean =>
    grants.some(
      (access) =>
        access.departmentId === departmentId &&
        Array.isArray(access.pageKeys) &&
        access.pageKeys.includes(pageKey),
    )

  if (
    current &&
    granted(current.departmentId, current.pageKey) &&
    isDepartmentPageAvailable(current.departmentId, current.pageKey)
  ) {
    return { departmentId: current.departmentId, pageKey: current.pageKey }
  }

  for (const area of biAreas) {
    for (const page of departmentPages[area.id]) {
      if (page.disabled) continue
      if (!granted(area.id, page.key)) continue

      return { departmentId: area.id, pageKey: page.key }
    }
  }

  return null
}

/* -------------------------------------------------------------------------- */
/* Avaliação completa                                                         */
/* -------------------------------------------------------------------------- */

/** Pendências, status operacional e página inicial efetiva de uma só vez. */
export function evaluateAccessProfile(profile: AccessProfile): AccessProfileEvaluation {
  const issues = findAccessProfileIssues(profile)

  return {
    issues,
    operationalStatus: resolveAccessProfileOperationalStatus(profile.lifecycle, issues),
    effectiveHomePage: resolveEffectiveAccessProfileHomePage(profile),
  }
}

/* -------------------------------------------------------------------------- */
/* Perfil do sistema                                                          */
/* -------------------------------------------------------------------------- */

export function isSystemAccessProfile(profile: Pick<AccessProfile, 'kind'>): boolean {
  return profile.kind === 'system'
}

/**
 * O que pode ser feito com o perfil agora, dado o estado dele e quantos usuários
 * estão vinculados a ele neste momento.
 *
 * Perfil do sistema é somente leitura: recusa as quatro operações, qualquer que
 * seja o resto do estado.
 *
 * Perfil comum é sempre editável e renomeável, inclusive quando está em uso:
 * mudar as páginas de um perfil é justamente como o acesso de quem o utiliza é
 * mantido em dia.
 *
 * Desativar e excluir exigem a MESMA condição: nenhum usuário vinculado. Os dois
 * tiram o perfil de circulação, e fazê-lo com gente dentro deixaria essas pessoas
 * sem acesso ao portal sem que ninguém tivesse decidido isso por elas. A
 * transferência vem antes, e não depois. Desativar exige ainda que o perfil esteja
 * ativo, porque um perfil já inativo não é desativado de novo.
 *
 * A exclusão com usuários vinculados chegou a ser permitida, e voltou a ser
 * bloqueada por decisão do Mário em 21/09/2026: a saída de um perfil passa a ser
 * sempre transferir as pessoas para outro Perfil de Acesso e só então excluir. A
 * transferência não é individual, o formulário do perfil de destino move todas de
 * uma vez.
 *
 * `hasBeenUsed` continua no domínio, porque descreve um fato do perfil e é lido
 * por outras operações, mas não bloqueia a exclusão: o que bloqueia é a presença
 * de gente agora, e não o passado do perfil.
 *
 * A contagem de vínculos é recebida por parâmetro, e não lida do perfil: quantos
 * usuários usam o perfil é pergunta para a coleção de usuários, e gravar esse
 * número dentro do perfil criaria um segundo lugar para ele ficar desatualizado.
 * Ela decide as duas operações e é também o número que a confirmação da exclusão
 * precisa mostrar.
 *
 * Reativação e transferência de usuários não são decididas aqui: são operações
 * do bloco seguinte, e nenhuma delas está representada nestas capacidades.
 */
export function accessProfileCapabilities(
  profile: Pick<AccessProfile, 'kind' | 'lifecycle' | 'hasBeenUsed'>,
  linkedUserCount: number,
): AccessProfileCapabilities {
  if (isSystemAccessProfile(profile)) {
    return { canEdit: false, canRename: false, canDeactivate: false, canDelete: false }
  }

  const hasLinkedUsers = linkedUserCount > 0

  return {
    canEdit: true,
    canRename: true,
    canDeactivate: profile.lifecycle === 'active' && !hasLinkedUsers,
    canDelete: !hasLinkedUsers,
  }
}

/* -------------------------------------------------------------------------- */
/* Destino e compatibilidade                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Destinos que um perfil comum aceita, na ordem em que a interface futura deve
 * oferecê-los. `administrator` não está aqui: ele pertence ao perfil do sistema.
 */
export const STANDARD_ACCESS_PROFILE_AUDIENCES: readonly StandardAccessProfileAudience[] = [
  'executive',
  'analyst',
]

/**
 * true quando o valor é um destino aceito por um perfil comum.
 *
 * Existe para o que chega de fora do TypeScript: formulário, armazenamento e
 * qualquer outra entrada em que o tipo não prova nada.
 */
export function isStandardAccessProfileAudience(
  value: unknown,
): value is StandardAccessProfileAudience {
  return STANDARD_ACCESS_PROFILE_AUDIENCES.some((audience) => audience === value)
}

/**
 * Correspondência entre Perfil do Sistema e destino do Perfil de Acesso.
 *
 * Uma para uma, nos dois sentidos. Declarada como `Record` e não como uma
 * sequência de comparações para que um quarto Perfil do Sistema não caia em um
 * caso padrão em silêncio: sem a entrada dele, isto não compila.
 */
const audienceByUserProfile: Record<UserProfile, AccessProfileAudience> = {
  Administrador: 'administrator',
  Executivo: 'executive',
  Analista: 'analyst',
}

/** Destino do Perfil de Acesso que corresponde a um Perfil do Sistema. */
export function accessProfileAudienceForUserProfile(
  userProfile: UserProfile,
): AccessProfileAudience {
  return audienceByUserProfile[userProfile]
}

/**
 * true quando o Perfil de Acesso pode ser usado por quem tem aquele Perfil do
 * Sistema.
 *
 * Regra pura de leitura: responde se a combinação é permitida e nada mais. Não
 * atribui perfil a usuário, não altera usuário, não grava vínculo e não toca em
 * acesso granular. A atribuição em si é assunto de outro bloco.
 *
 * O tipo do perfil entra na resposta junto com o destino porque as duas coisas
 * precisam concordar: Administrador só recebe `Acesso do Sistema`, que é o perfil
 * sistema, e Executivo e Analista só recebem perfis comuns. Um par impossível
 * (perfil comum destinado a Administradores, por exemplo) não é aceito por
 * nenhum Perfil do Sistema, e não por um deles apenas.
 */
export function isAccessProfileCompatibleWithUserProfile(
  profile: Pick<AccessProfile, 'kind' | 'audience'>,
  userProfile: UserProfile,
): boolean {
  const required = accessProfileAudienceForUserProfile(userProfile)

  if (profile.audience !== required) return false

  return required === 'administrator' ? profile.kind === 'system' : profile.kind === 'standard'
}

/* -------------------------------------------------------------------------- */
/* Vínculo entre usuário e Perfil de Acesso                                   */
/* -------------------------------------------------------------------------- */

/**
 * Id de Perfil de Acesso gravado em um usuário, na única forma que o portal
 * aceita: texto sem espaços nas pontas, ou `null`.
 *
 * Propriedade ausente, `undefined`, valor que não é texto e texto vazio são a
 * mesma coisa, e viram `null`. Nenhum deles é tratado como vínculo: o que sai
 * daqui como `null` nunca autentica.
 *
 * O que NÃO é decidido aqui: se o id existe, se o perfil está ativo e se ele
 * serve àquele Perfil do Sistema. Isso depende da coleção de perfis, e não do
 * formato do texto, e por isso é respondido por
 * `isAccessProfileAssignableToUserProfile` diante do perfil de verdade. O
 * formato `acp-NNN` também não é exigido: `acp-system` é um id legítimo e não o
 * segue.
 */
export function normalizeStoredAccessProfileId(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim()

  return normalized ? normalized : null
}

/**
 * true quando o perfil pode ser ATRIBUÍDO a quem tem aquele Perfil do Sistema.
 *
 * É a compatibilidade de `isAccessProfileCompatibleWithUserProfile` mais uma
 * exigência que só faz sentido na atribuição: o perfil precisa estar ativo. Um
 * perfil desativado continua descrevendo um acesso coerente, e por isso continua
 * compatível como leitura, mas ninguém novo entra nele.
 */
export function isAccessProfileAssignableToUserProfile(
  profile: Pick<AccessProfile, 'kind' | 'audience' | 'lifecycle'>,
  userProfile: UserProfile,
): boolean {
  if (profile.lifecycle !== 'active') return false

  return isAccessProfileCompatibleWithUserProfile(profile, userProfile)
}

/** Endereço de uma página dentro do departamento, para comparar concessões. */
function grantKey(departmentId: string, pageKey: string): string {
  return `${departmentId}::${pageKey}`
}

/**
 * Páginas DISPONÍVEIS que aquelas concessões liberam, por
 * `departmentId + pageKey`.
 *
 * É a forma efetiva do acesso, e é o que permite comparar um usuário com um
 * Perfil de Acesso sem comparar nomes, rótulos nem ordem de gravação. O que está
 * fora do catálogo e o que está em desenvolvimento ficam de fora dos dois lados:
 * o domínio recusa a seleção de página em desenvolvimento, então nenhum perfil
 * real pode tê-la, e mantê-la faria todo Analista deixar de corresponder ao
 * perfil do próprio departamento.
 */
export function accessProfileGrantKeys(
  entries: readonly DepartmentPageAccess[] | undefined,
): Set<string> {
  const keys = new Set<string>()
  if (!Array.isArray(entries)) return keys

  for (const access of entries) {
    if (!access || typeof access.departmentId !== 'string') continue

    const area = findCatalogDepartment(access.departmentId)
    if (!area) continue

    const available = new Set(availableDepartmentPageKeys(area.id))

    for (const pageKey of Array.isArray(access.pageKeys) ? access.pageKeys : []) {
      if (available.has(pageKey)) keys.add(grantKey(area.id, pageKey))
    }
  }

  return keys
}

function sameGrantKeys(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
  return first.size === second.size && [...first].every((key) => second.has(key))
}

/** Chave de comparação do nome oficial do perfil executivo padrão. */
const EXECUTIVE_ACCESS_PROFILE_KEY = normalizeAccessProfileName(
  EXECUTIVE_ACCESS_PROFILE_NAME,
).comparisonKey

/**
 * Perfil de Acesso que a MIGRAÇÃO pode atribuir com segurança a um usuário
 * legado, ou null quando não existe correspondência segura.
 *
 * As três correspondências são determinísticas e não se misturam:
 *
 * - Administrador recebe o perfil do sistema, identificado por `kind`, e não por
 *   um id escrito aqui. É o único perfil destinado a Administradores, e o
 *   armazenamento nunca aceita um segundo.
 * - Executivo recebe o perfil executivo padrão, que é EXATAMENTE UM: comum,
 *   ativo, destinado a Executivos e com o nome oficial `Acesso Executivo`. Outro
 *   perfil executivo, mesmo sendo o único da coleção, não ocupa esse lugar.
 * - Analista recebe o único perfil ativo, compatível e com a MESMA combinação
 *   efetiva de `departmentId + pageKey` que ele já tem gravada.
 *
 * Ausência, ambiguidade (mais de um candidato), perfil inativo e destino
 * incompatível devolvem null, sempre. Nenhum resultado é escolhido por posição,
 * por ordem da coleção nem por semelhança: adivinhar aqui daria acesso a quem
 * ninguém autorizou.
 */
export function findMigrationAccessProfile(
  user: { profile: UserProfile; departmentPageAccess?: readonly DepartmentPageAccess[] },
  profiles: readonly AccessProfile[],
): AccessProfile | null {
  const assignable = profiles.filter((profile) =>
    isAccessProfileAssignableToUserProfile(profile, user.profile),
  )

  if (user.profile === 'Administrador') {
    return assignable.length === 1 ? assignable[0] : null
  }

  if (user.profile === 'Executivo') {
    const standard = assignable.filter(
      (profile) =>
        normalizeAccessProfileName(profile.name).comparisonKey === EXECUTIVE_ACCESS_PROFILE_KEY,
    )

    return standard.length === 1 ? standard[0] : null
  }

  const userGrants = accessProfileGrantKeys(user.departmentPageAccess)
  if (userGrants.size === 0) return null

  const matches = assignable.filter((profile) =>
    sameGrantKeys(accessProfileGrantKeys(profile.departmentPageAccess), userGrants),
  )

  return matches.length === 1 ? matches[0] : null
}

/* -------------------------------------------------------------------------- */
/* Validação de rascunho                                                      */
/* -------------------------------------------------------------------------- */

/** Textos das recusas, na mesma lógica das pendências: o código é a identidade. */
const draftErrorMessages: Record<AccessProfileDraftErrorCode, string> = {
  'invalid-id': 'Identificador do perfil fora do formato esperado.',
  'duplicate-id': 'Já existe um perfil de acesso com este identificador.',
  'immutable-id': 'O identificador do perfil não pode ser alterado.',
  'unknown-profile': 'O perfil que está sendo editado não existe mais.',
  'invalid-name': 'Informe o nome do perfil de acesso.',
  'duplicate-name': 'Já existe um perfil de acesso com este nome.',
  'invalid-audience': 'Escolha se o perfil de acesso é de Executivo ou de Analista.',
  'no-pages-selected': 'Selecione ao menos uma página para o perfil.',
  'missing-home-page': 'Escolha a página inicial do perfil.',
  'home-page-not-selected': 'A página inicial precisa estar entre as páginas selecionadas.',
  'home-page-unavailable': 'A página inicial escolhida não está disponível no portal.',
  'unknown-department': 'Departamento não encontrado no catálogo do portal.',
  'unknown-page': 'Página não encontrada no catálogo deste departamento.',
  'disabled-page': 'Página em desenvolvimento não pode ser adicionada ao perfil.',
}

function draftError(
  code: AccessProfileDraftErrorCode,
  location?: { departmentId?: string; pageKey?: string },
): AccessProfileDraftError {
  return { code, message: draftErrorMessages[code], ...location }
}

/**
 * Perfil da coleção que já usa o mesmo nome, ou null quando o nome está livre.
 *
 * A comparação ignora caixa e espaços excedentes, pela chave normalizada.
 *
 * `currentProfileId` é o perfil que está sendo editado, e é o único que fica de
 * fora da comparação: em uma edição, manter o nome atual não é duplicidade. Na
 * criação o parâmetro não é informado, e aí nenhum perfil é ignorado. O id do
 * rascunho não serve para essa decisão: quem está criando poderia digitar o id
 * de um perfil existente e, com isso, escapar da checagem de nome dele.
 */
export function findAccessProfileNameConflict(
  name: string,
  profiles: readonly AccessProfile[],
  currentProfileId?: string,
): AccessProfile | null {
  const { comparisonKey } = normalizeAccessProfileName(name)
  if (!comparisonKey) return null

  const conflict = profiles.find(
    (profile) =>
      profile.id !== currentProfileId &&
      normalizeAccessProfileName(profile.name).comparisonKey === comparisonKey,
  )

  return conflict ?? null
}

/**
 * Valida um rascunho de perfil comum para criação ou para edição.
 *
 * `currentProfileId` é o que separa as duas operações, e é sempre explícito:
 * ausente é criação, presente é edição do perfil de mesmo id. O rascunho não
 * decide isso sozinho, porque `draft.id` é conteúdo de formulário e pode estar
 * errado justamente quando a distinção importa.
 *
 * Na criação o id precisa ter o formato esperado e ainda não pode existir na
 * coleção. Na edição o perfil original precisa existir e o id do rascunho
 * precisa continuar igual ao dele: o id é permanente, e alterá-lo não é renomear
 * um perfil, é apontar para outro, deixando para trás os usuários e o histórico
 * que se referem ao id antigo.
 *
 * Todas as recusas são coletadas em uma passagem, e não apenas a primeira: o
 * Administrador corrige o formulário inteiro de uma vez. O sucesso devolve o
 * rascunho já normalizado, com a página inicial garantida.
 *
 * Nenhum erro é corrigido por conta própria. Uma página desconhecida ou em
 * desenvolvimento é recusada, e não retirada da seleção; uma página inicial fora
 * da seleção é recusada, e não concedida junto. Corrigir sozinho seria decidir
 * pelo Administrador, e no caso da página inicial seria ampliar o acesso para
 * fazer o formulário passar.
 *
 * Perfis do sistema não passam por aqui: eles não são criados nem editados.
 *
 * O destino do perfil não é avaliado aqui, e é justamente por isso que a edição
 * usa esta função diretamente: o que ela valida é o conteúdo editável, que é o
 * mesmo nas duas operações. A criação passa por
 * `validateAccessProfileCreationDraft`, que acrescenta o destino.
 */
export function validateAccessProfileDraft(
  draft: AccessProfileDraft,
  profiles: readonly AccessProfile[],
  currentProfileId?: string,
): AccessProfileDraftValidation {
  const errors: AccessProfileDraftError[] = []

  const id = draft.id.trim()

  if (currentProfileId === undefined) {
    if (!ACCESS_PROFILE_ID_PATTERN.test(id)) errors.push(draftError('invalid-id'))
    else if (profiles.some((profile) => profile.id === id)) errors.push(draftError('duplicate-id'))
  } else {
    // O formato do id não é reavaliado na edição: ele veio da criação, e o que
    // importa aqui é que continue exatamente o mesmo.
    if (!profiles.some((profile) => profile.id === currentProfileId)) {
      errors.push(draftError('unknown-profile'))
    }

    if (id !== currentProfileId) errors.push(draftError('immutable-id'))
  }

  const { displayName } = normalizeAccessProfileName(draft.name)
  if (!displayName) errors.push(draftError('invalid-name'))
  else if (findAccessProfileNameConflict(displayName, profiles, currentProfileId)) {
    errors.push(draftError('duplicate-name'))
  }

  const departmentPageAccess = normalizeAccessProfileGrants(draft.departmentPageAccess)

  for (const access of departmentPageAccess) {
    const { departmentId } = access

    if (!findCatalogDepartment(departmentId)) {
      errors.push(draftError('unknown-department', { departmentId }))
      continue
    }

    for (const pageKey of access.pageKeys) {
      const page = findDepartmentPage(departmentId, pageKey)
      const location = { departmentId, pageKey }

      if (!page) {
        errors.push(draftError('unknown-page', location))
        continue
      }

      if (page.disabled) errors.push(draftError('disabled-page', location))
    }
  }

  const selectedPageCount = departmentPageAccess.reduce(
    (total, access) => total + access.pageKeys.length,
    0,
  )
  if (selectedPageCount === 0) errors.push(draftError('no-pages-selected'))

  const homePage = draft.homePage

  if (!homePage) {
    errors.push(draftError('missing-home-page'))
  } else {
    const location = { departmentId: homePage.departmentId, pageKey: homePage.pageKey }

    const selected = departmentPageAccess.some(
      (access) =>
        access.departmentId === homePage.departmentId &&
        access.pageKeys.includes(homePage.pageKey),
    )

    if (!selected) errors.push(draftError('home-page-not-selected', location))

    if (!isDepartmentPageAvailable(homePage.departmentId, homePage.pageKey)) {
      errors.push(draftError('home-page-unavailable', location))
    }
  }

  if (errors.length || !homePage) return { ok: false, errors }

  // Sucesso na edição implica id igual ao original: qualquer divergência já teria
  // virado `immutable-id` acima.
  return {
    ok: true,
    draft: {
      id,
      name: displayName,
      description: normalizeAccessProfileDescription(draft.description),
      departmentPageAccess,
      homePage: { departmentId: homePage.departmentId, pageKey: homePage.pageKey },
    },
  }
}

/**
 * Valida um rascunho de CRIAÇÃO de perfil comum.
 *
 * É a validação do conteúdo editável mais uma exigência que só existe aqui: o
 * destino precisa ser `executive` ou `analyst`. Um perfil comum sem destino
 * válido não é criado, porque não haveria como saber depois a qual Perfil do
 * Sistema ele serve, e o destino é imutável justamente para não ser decidido
 * mais tarde.
 *
 * Nada é deduzido do nome, dos departamentos nem das páginas: um perfil que
 * concede só o Comercial não é executivo nem analista por isso, e escolher por
 * conta própria seria decidir pelo Administrador.
 *
 * As recusas continuam vindo todas de uma vez: a do destino se soma às do
 * conteúdo, em vez de substituí-las.
 */
export function validateAccessProfileCreationDraft(
  draft: AccessProfileCreationDraft,
  profiles: readonly AccessProfile[],
): AccessProfileCreationValidation {
  const content = validateAccessProfileDraft(draft, profiles)
  const hasValidAudience = isStandardAccessProfileAudience(draft.audience)

  if (!content.ok || !hasValidAudience) {
    const errors = content.ok ? [] : [...content.errors]
    if (!hasValidAudience) errors.push(draftError('invalid-audience'))

    return { ok: false, errors }
  }

  return { ok: true, draft: { ...content.draft, audience: draft.audience } }
}
