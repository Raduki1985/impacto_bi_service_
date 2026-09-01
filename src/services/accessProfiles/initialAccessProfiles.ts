import {
  EXECUTIVE_ACCESS_PROFILE_NAME,
  TECHNICAL_OPERATIONS_ACCESS_PROFILE_NAME,
  TECHNICAL_OPERATIONS_DEPARTMENT_IDS,
} from '../../config/accessProfileCatalog'
import { biAreas, type BiAreaId } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import {
  availableDepartmentPageKeys,
  validateAccessProfileCreationDraft,
} from '../../lib/accessProfileRules'
import { MODEL_PAGE_KEY, OVERVIEW_PAGE_KEY } from '../../lib/userAccessRules'
import type {
  AccessProfile,
  AccessProfileDraftError,
  DepartmentPageAccess,
  DepartmentPageReference,
  StandardAccessProfile,
  StandardAccessProfileAudience,
} from '../../types/access'
import { getSystemAccessProfile } from './accessProfileRepository'
import {
  readAccessProfilesStorageState,
  readStoredAccessProfiles,
  writeStoredAccessProfiles,
} from './accessProfileStorage'

/**
 * Coleção inicial de Perfis de Acesso.
 *
 * São entidades comuns do domínio, e não presets paralelos: nascem
 * `kind: standard`, ativas, nunca utilizadas, com id no padrão `acp-NNN` e
 * passam pela mesma validação que uma criação feita pelo Administrador. Depois
 * de gravadas, são perfis como quaisquer outros, editáveis e sem proteção.
 *
 * A montagem é pura e não toca no armazenamento. A gravação vive em
 * `ensureInitialAccessProfiles`, que é a única operação com efeito, para que
 * ninguém acabe semeando a base ao chamar uma função de leitura.
 *
 * Departamentos, páginas e nomes vêm dos catálogos oficiais (`biAreas`,
 * `departmentPages` e `config/accessProfileCatalog`): nenhuma lista paralela é
 * declarada aqui, e um departamento novo entra na coleção sozinho.
 *
 * `MODEL_PAGE_KEY` é importado de `userAccessRules` porque é lá que a chave da
 * página Modelo já está declarada uma única vez no projeto. Repeti-la como
 * literal aqui criaria um segundo lugar para ela ficar desatualizada.
 */

/* -------------------------------------------------------------------------- */
/* Desenho da coleção                                                         */
/* -------------------------------------------------------------------------- */

/** Um perfil da coleção inicial antes de virar entidade. */
export type InitialAccessProfileDesign = {
  name: string
  description: string
  audience: StandardAccessProfileAudience
  /** Departamentos que o perfil reúne, na ordem em que devem ser concedidos. */
  departmentIds: readonly BiAreaId[]
  /**
   * Quando declarado, o perfil concede SOMENTE estas páginas dentro dos
   * departamentos dele. Ausente, vale a regra geral: todas as páginas
   * publicadas, menos o Modelo.
   */
  pageKeys?: readonly string[]
}

/**
 * Recorte temporário do `Acesso Executivo`, aprovado pelo Mário em 01/09/2026.
 *
 * Enquanto só duas páginas estão prontas para leitura executiva, o perfil
 * concede exatamente estas, e não o portal inteiro: Ordens de Serviço e
 * Comercial, apenas a Visão Geral de cada um. As demais páginas continuam
 * publicadas e continuam alcançáveis pelos perfis de Analista; o que muda é o
 * que um Executivo recebe ao entrar.
 *
 * A restrição vale para o que o perfil concede, e por isso alcança sozinha tudo
 * o que deriva dele: a lista de departamentos da Página Inicial, os itens da
 * sidebar, o acesso direto por URL e as opções do seletor de página inicial nas
 * Preferências, que são montadas a partir dos acessos reais e não de uma lista
 * própria.
 *
 * Para devolver o portal inteiro ao Executivo, basta remover `departmentIds` e
 * `pageKeys` do desenho dele e voltar à regra geral. Nenhuma outra parte do
 * projeto conhece este recorte.
 */
const EXECUTIVE_PREVIEW_DEPARTMENT_IDS: readonly BiAreaId[] = ['os', 'comercial']
const EXECUTIVE_PREVIEW_PAGE_KEYS: readonly string[] = [OVERVIEW_PAGE_KEY]

/**
 * O desenho da coleção, na ordem oficial de exibição.
 *
 * `Acesso Executivo` primeiro, `Operações Técnicas` depois, e por fim um perfil
 * por departamento na ordem de `biAreas`. É essa ordem que vira a ordem dos ids
 * (`acp-001`, `acp-002`, ...) e, com ela, a ordem de gravação: como o
 * armazenamento preserva a sequência, a lista da tela já sai na ordem aprovada
 * sem nenhuma reordenação de apresentação, e os perfis criados depois entram
 * atrás dos iniciais.
 *
 * O nome de um perfil exclusivo de departamento é o rótulo oficial do
 * departamento, sem prefixo: `COP`, e não `Acesso COP`.
 */
/**
 * O desenho do `Acesso Executivo` ANTES do recorte, com o portal inteiro.
 *
 * Registro histórico, e não uma segunda regra ativa: é a assinatura que os
 * navegadores que já abriram o portal têm gravada, e é ela que permite
 * reconhecer um `Acesso Executivo` intocado para atualizá-lo. Sai de cena junto
 * com o recorte, quando o Executivo voltar a receber o portal inteiro.
 */
function executiveDesignBeforePreview(): InitialAccessProfileDesign {
  return {
    name: EXECUTIVE_ACCESS_PROFILE_NAME,
    description: 'Páginas disponíveis de todos os departamentos do portal.',
    audience: 'executive',
    departmentIds: biAreas.map((area) => area.id),
  }
}

export function initialAccessProfileDesigns(): InitialAccessProfileDesign[] {
  return [
    {
      name: EXECUTIVE_ACCESS_PROFILE_NAME,
      description: 'Visão Geral de Ordens de Serviço e do Comercial.',
      audience: 'executive',
      departmentIds: EXECUTIVE_PREVIEW_DEPARTMENT_IDS,
      pageKeys: EXECUTIVE_PREVIEW_PAGE_KEYS,
    },
    {
      name: TECHNICAL_OPERATIONS_ACCESS_PROFILE_NAME,
      description: 'Páginas disponíveis dos departamentos das operações técnicas.',
      audience: 'analyst',
      departmentIds: TECHNICAL_OPERATIONS_DEPARTMENT_IDS,
    },
    ...biAreas.map((area) => ({
      name: area.label,
      description: `Páginas disponíveis do departamento ${area.label}.`,
      audience: 'analyst' as const,
      departmentIds: [area.id],
    })),
  ]
}

/** A mesma coleção, com o `Acesso Executivo` como ele era antes do recorte. */
function designsBeforeExecutivePreview(): InitialAccessProfileDesign[] {
  return initialAccessProfileDesigns().map((design) =>
    design.name === EXECUTIVE_ACCESS_PROFILE_NAME ? executiveDesignBeforePreview() : design,
  )
}

/* -------------------------------------------------------------------------- */
/* Montagem                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Páginas publicadas de um departamento, em um determinado momento do catálogo.
 *
 * O parâmetro existe por um motivo só: além da coleção de hoje, o módulo precisa
 * reconstruir a assinatura EXATA que a coleção inicial tinha antes de as páginas
 * departamentais serem publicadas, para reconhecer com segurança um perfil
 * inicial ainda intacto no armazenamento. As duas montagens passam pelo mesmo
 * caminho, e não por duas cópias que poderiam divergir.
 */
type PublishedPageKeysResolver = (departmentId: BiAreaId) => readonly string[]

/**
 * Páginas que o portal publicava na assinatura ANTERIOR da coleção inicial:
 * Ordens de Serviço com o catálogo inteiro, e os demais departamentos apenas com
 * a Visão Geral.
 *
 * É um registro histórico, e não um catálogo paralelo: continua sendo derivado
 * de `departmentPages`, descreve um estado que não volta e existe apenas para
 * comparar com o que está gravado. Nenhuma decisão de navegação, de acesso ou de
 * apresentação passa por aqui.
 */
function previouslyPublishedPageKeys(departmentId: BiAreaId): readonly string[] {
  if (departmentId === 'os') return departmentPages.os.map((page) => page.key)

  return departmentPages[departmentId]
    .filter((page) => page.key === OVERVIEW_PAGE_KEY)
    .map((page) => page.key)
}

/**
 * Páginas que o perfil concede em um departamento: as publicadas, menos a página
 * Modelo.
 *
 * A página em desenvolvimento fica de fora porque o domínio recusa a seleção
 * dela (`disabled-page`), e o Modelo fica de fora porque nunca é automático em
 * nenhum perfil que não seja o do Administrador.
 */
function grantedPageKeys(
  departmentId: BiAreaId,
  publishedPageKeys: PublishedPageKeysResolver,
  allowedPageKeys?: readonly string[],
): string[] {
  return publishedPageKeys(departmentId)
    .filter((pageKey) => pageKey !== MODEL_PAGE_KEY)
    // O recorte do desenho é uma interseção, e nunca uma concessão: uma página
    // listada nele que o departamento não publica continua de fora.
    .filter((pageKey) => allowedPageKeys === undefined || allowedPageKeys.includes(pageKey))
}

/**
 * Concessões do perfil, já sem os departamentos que não contribuem com nenhuma
 * página.
 *
 * Um departamento sem página publicada entraria como concessão vazia, que não
 * libera nada e não voltaria a crescer sozinha: diferente do perfil do sistema,
 * que é derivado do catálogo a cada leitura, um perfil comum é gravado uma vez
 * e permanece como foi gravado.
 */
function buildGrants(
  departmentIds: readonly BiAreaId[],
  publishedPageKeys: PublishedPageKeysResolver,
  allowedPageKeys?: readonly string[],
): DepartmentPageAccess[] {
  return departmentIds.flatMap((departmentId) => {
    const pageKeys = grantedPageKeys(departmentId, publishedPageKeys, allowedPageKeys)

    return pageKeys.length ? [{ departmentId, pageKeys }] : []
  })
}

/**
 * Primeira página disponível entre as que o próprio perfil concede, na ordem
 * oficial dos catálogos (departamentos por `biAreas`, páginas por
 * `departmentPages`), ou null quando o perfil não concede nenhuma.
 *
 * A ordem é a do catálogo, e não a da montagem, para a página inicial não
 * depender de como as concessões foram escritas.
 */
function firstGrantedAvailablePage(
  grants: readonly DepartmentPageAccess[],
): DepartmentPageReference | null {
  for (const area of biAreas) {
    const granted = grants.find((grant) => grant.departmentId === area.id)
    if (!granted) continue

    for (const page of departmentPages[area.id]) {
      if (page.disabled) continue
      if (granted.pageKeys.includes(page.key)) return { departmentId: area.id, pageKey: page.key }
    }
  }

  return null
}

/** Por que um perfil do desenho não pôde ser montado com o catálogo atual. */
export type InitialAccessProfileRejection = {
  name: string
  /** 'no-granted-page' é catálogo sem página publicada; 'invalid-draft' é recusa do domínio. */
  reason: 'no-granted-page' | 'invalid-draft'
  /** Presentes somente quando a recusa veio da validação do domínio. */
  errors?: AccessProfileDraftError[]
}

export type InitialAccessProfilesBuild = {
  profiles: StandardAccessProfile[]
  /** Perfis do desenho que o catálogo atual não permite montar validamente. */
  rejected: InitialAccessProfileRejection[]
}

/**
 * Monta a coleção inicial a partir dos catálogos.
 *
 * Cada perfil passa por `validateAccessProfileCreationDraft` com a coleção já
 * montada até ali, o perfil do sistema incluído: é a mesma porta da criação
 * feita pelo Administrador, então nome duplicado, id fora do padrão, página
 * desconhecida, página em desenvolvimento e página inicial inválida recusam o
 * perfil aqui também.
 *
 * O que não passa é registrado em `rejected` e fica de fora, sem nenhum
 * fallback: um perfil montado com páginas que ninguém escolheu, ou apontando
 * para uma página que ele não concede, seria pior do que a ausência dele. Os
 * ids continuam contíguos porque são atribuídos a partir dos perfis aceitos.
 *
 * Função pura: não lê nem grava armazenamento.
 */
export function buildInitialAccessProfiles(): InitialAccessProfilesBuild {
  return buildDesignedAccessProfiles(availableDepartmentPageKeys)
}

/**
 * Todas as assinaturas anteriores conhecidas da coleção inicial, da mais antiga
 * para a mais recente.
 *
 * São duas porque o armazenamento mockado passou por duas mudanças, e um
 * navegador pode ter parado em qualquer uma delas:
 *
 * 1. antes de as páginas departamentais serem publicadas, quando só Ordens de
 *    Serviço tinha catálogo e os demais departamentos só a Visão Geral;
 * 2. depois disso e antes do recorte do Executivo, quando ele ainda concedia o
 *    portal inteiro.
 *
 * Reconhecer as duas é o que faz a atualização alcançar tanto quem abriu o
 * portal há muito tempo quanto quem abriu ontem. Um perfil que não seja
 * idêntico a nenhuma delas continua intocado, como sempre.
 */
function previousInitialAccessProfileSignatures(): InitialAccessProfilesBuild[] {
  const beforePreview = designsBeforeExecutivePreview()

  return [
    buildDesignedAccessProfiles(previouslyPublishedPageKeys, beforePreview),
    buildDesignedAccessProfiles(availableDepartmentPageKeys, beforePreview),
  ]
}

function buildDesignedAccessProfiles(
  publishedPageKeys: PublishedPageKeysResolver,
  designs: readonly InitialAccessProfileDesign[] = initialAccessProfileDesigns(),
): InitialAccessProfilesBuild {
  // O perfil do sistema entra na coleção de comparação, e não no resultado:
  // "Acesso do Sistema" é um nome ocupado, mas não é um perfil a ser gravado.
  const collection: AccessProfile[] = [getSystemAccessProfile()]
  const profiles: StandardAccessProfile[] = []
  const rejected: InitialAccessProfileRejection[] = []

  for (const design of designs) {
    const departmentPageAccess = buildGrants(
      design.departmentIds,
      publishedPageKeys,
      design.pageKeys,
    )
    const homePage = firstGrantedAvailablePage(departmentPageAccess)

    if (!homePage) {
      rejected.push({ name: design.name, reason: 'no-granted-page' })
      continue
    }

    const validation = validateAccessProfileCreationDraft(
      {
        id: `acp-${String(profiles.length + 1).padStart(3, '0')}`,
        name: design.name,
        description: design.description,
        departmentPageAccess,
        homePage,
        audience: design.audience,
      },
      collection,
    )

    if (!validation.ok) {
      rejected.push({ name: design.name, reason: 'invalid-draft', errors: validation.errors })
      continue
    }

    const profile: StandardAccessProfile = {
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

    profiles.push(profile)
    collection.push(profile)
  }

  return { profiles, rejected }
}

/* -------------------------------------------------------------------------- */
/* Gravação                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Resultado da inicialização da coleção.
 *
 * Cada situação tem nome próprio porque significam coisas diferentes para quem
 * chama: 'already-initialized' é o caso normal a partir da segunda execução,
 * 'storage-unavailable' e 'write-failed' são falhas de ambiente, e
 * 'nothing-to-seed' é um catálogo que não permite montar nenhum perfil.
 */
export type InitialAccessProfilesSeedResult =
  | { status: 'seeded'; profiles: StandardAccessProfile[]; rejected: InitialAccessProfileRejection[] }
  | { status: 'already-initialized' }
  | { status: 'storage-unavailable' }
  | { status: 'nothing-to-seed'; rejected: InitialAccessProfileRejection[] }
  | { status: 'write-failed'; rejected: InitialAccessProfileRejection[] }

/**
 * Grava a coleção inicial quando, e somente quando, a chave da coleção ainda
 * não existe.
 *
 * É a única operação deste módulo com efeito, e é deliberadamente estreita:
 *
 * - chave ausente: base nunca inicializada, e é o único caso que autoriza a
 *   gravação;
 * - qualquer conteúdo gravado, inclusive uma coleção vazia: nada é feito. O
 *   array vazio é uma base em que os perfis foram apagados de propósito, e
 *   semear de novo recriaria justamente o que alguém excluiu;
 * - coleção no formato anterior, conteúdo ilegível ou armazenamento
 *   indisponível: nada é feito, e nada é sobrescrito.
 *
 * Idempotente: a segunda chamada encontra a chave gravada e responde
 * 'already-initialized' sem montar nem escrever nada.
 */
export function ensureInitialAccessProfiles(): InitialAccessProfilesSeedResult {
  const state = readAccessProfilesStorageState()

  if (state === 'unavailable') return { status: 'storage-unavailable' }
  if (state === 'present') return { status: 'already-initialized' }

  const { profiles, rejected } = buildInitialAccessProfiles()
  if (profiles.length === 0) return { status: 'nothing-to-seed', rejected }

  // `writeStoredAccessProfiles` revalida a coleção e recusa gravar por cima de
  // uma base pendente de classificação: a decisão de escrever não fica só nesta
  // função.
  if (!writeStoredAccessProfiles(profiles)) return { status: 'write-failed', rejected }

  return { status: 'seeded', profiles, rejected }
}

/* -------------------------------------------------------------------------- */
/* Atualização da coleção inicial já gravada                                  */
/* -------------------------------------------------------------------------- */

/** Compara concessões por conteúdo E por ordem: a ordem é a do catálogo, e faz parte da assinatura. */
function sameGrants(
  first: readonly DepartmentPageAccess[],
  second: readonly DepartmentPageAccess[],
): boolean {
  if (first.length !== second.length) return false

  return first.every((access, index) => {
    const other = second[index]

    return (
      access.departmentId === other.departmentId &&
      access.pageKeys.length === other.pageKeys.length &&
      access.pageKeys.every((pageKey, position) => pageKey === other.pageKeys[position])
    )
  })
}

/**
 * Igualdade campo a campo de dois perfis comuns.
 *
 * Todos os campos entram, e não apenas o id e o nome: é essa exigência que
 * separa um perfil inicial intacto de um perfil que alguém editou, e de um
 * perfil personalizado que por acaso tenha nome ou id parecido.
 */
/**
 * O mesmo perfil, comparado por tudo o que o DESENHO determina, ignorando
 * apenas o indicador de utilização.
 *
 * `hasBeenUsed` não vem do desenho: ele é marcado quando um usuário passa a
 * usar o perfil, o que acontece já na primeira entrada de qualquer Executivo ou
 * Analista. Compará-lo aqui faria a atualização enxergar como "alterado pelo
 * Administrador" um perfil que ninguém tocou, e o reconhecimento deixaria de
 * funcionar justamente nos navegadores em que alguém já entrou, que são a
 * maioria. Todo o resto continua exigindo igualdade exata, então uma edição de
 * verdade segue protegida.
 */
function isSameAccessProfileDesign(
  first: StandardAccessProfile,
  second: StandardAccessProfile,
): boolean {
  return (
    first.id === second.id &&
    first.name === second.name &&
    first.description === second.description &&
    first.kind === second.kind &&
    first.audience === second.audience &&
    first.lifecycle === second.lifecycle &&
    first.homePage.departmentId === second.homePage.departmentId &&
    first.homePage.pageKey === second.homePage.pageKey &&
    sameGrants(first.departmentPageAccess, second.departmentPageAccess)
  )
}

/**
 * Resultado da atualização dos Perfis de Acesso iniciais já gravados.
 *
 * 'unchanged' é o caso normal a partir da segunda execução, e também o de uma
 * base sem nenhum perfil inicial reconhecível. As duas recusas de leitura ficam
 * separadas pelo mesmo motivo do restante do domínio: uma se resolve sozinha
 * quando o armazenamento volta, a outra só se resolve por decisão do
 * Administrador.
 */
export type InitialAccessProfilesRefreshResult =
  | { status: 'updated'; updatedProfileIds: string[] }
  | { status: 'unchanged' }
  | { status: 'storage-failure' }
  | { status: 'audience-classification-required' }
  | { status: 'write-failed'; updatedProfileIds: string[] }

/**
 * Atualiza as concessões dos Perfis de Acesso iniciais que ainda estão gravados
 * exatamente como a versão anterior os criou.
 *
 * Não é migração de produção nem semeadura: é a evolução estreita do
 * armazenamento mockado. Sem ela, os perfis iniciais de um navegador que já
 * visitou o portal continuariam concedendo somente a Visão Geral de cada
 * departamento, e os indicadores passariam a mostrar `1/10` onde antes mostravam
 * `1/1`.
 *
 * O reconhecimento é deliberadamente conservador: um perfil só é atualizado
 * quando é IDÊNTICO a UMA das assinaturas iniciais anteriores em todos os
 * campos que o desenho determina, ou seja id, nome, descrição, destino, tipo,
 * ciclo de vida, página inicial e a lista completa de departamentos e páginas,
 * na ordem. Basta um campo diferente para o perfil voltar intocado, o que
 * preserva qualquer edição feita pelo Administrador. O indicador de utilização
 * fica de fora da comparação e é preservado na atualização, pelo motivo
 * registrado em `isSameAccessProfileDesign`.
 *
 * O que nunca é tocado: perfil inicial modificado, perfil personalizado, perfil
 * desconhecido, coleção vazia, armazenamento ilegível e coleção no formato
 * anterior. Nenhum perfil é criado, excluído ou reordenado, e a coleção nunca é
 * apagada nem recriada.
 *
 * Idempotente: depois da primeira execução os perfis passam a ser iguais à
 * assinatura ATUAL, que é diferente da anterior, e a chamada seguinte responde
 * 'unchanged' sem gravar nada. Quando um perfil já concedia exatamente o que
 * concede hoje, ele também não é reescrito.
 */
export function refreshInitialAccessProfiles(): InitialAccessProfilesRefreshResult {
  const stored = readStoredAccessProfiles()

  if (!stored.ok) {
    return stored.reason === 'audience-classification-required'
      ? { status: 'audience-classification-required' }
      : { status: 'storage-failure' }
  }

  const previousSignatures = previousInitialAccessProfileSignatures().map(
    (build) => new Map(build.profiles.map((profile) => [profile.id, profile])),
  )
  const currentById = new Map(
    buildInitialAccessProfiles().profiles.map((profile) => [profile.id, profile]),
  )

  const updatedProfileIds: string[] = []

  const next = stored.profiles.map((profile) => {
    const current = currentById.get(profile.id)

    // Sem perfil correspondente na coleção de hoje não há o que reconhecer.
    if (!current) return profile

    // Basta ser idêntico a UMA das assinaturas anteriores conhecidas: o
    // navegador pode ter parado em qualquer uma delas.
    const recognized = previousSignatures.some((byId) => {
      const previous = byId.get(profile.id)

      return previous !== undefined && isSameAccessProfileDesign(profile, previous)
    })

    if (!recognized) return profile
    if (isSameAccessProfileDesign(profile, current)) return profile

    updatedProfileIds.push(profile.id)

    // O desenho passa a ser o de hoje; o indicador de utilização é estado de
    // uso e continua sendo o que estava gravado.
    return { ...current, hasBeenUsed: profile.hasBeenUsed }
  })

  if (updatedProfileIds.length === 0) return { status: 'unchanged' }

  if (!writeStoredAccessProfiles(next)) return { status: 'write-failed', updatedProfileIds }

  return { status: 'updated', updatedProfileIds }
}
