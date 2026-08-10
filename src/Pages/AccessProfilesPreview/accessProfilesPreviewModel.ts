import {
  biAreas,
  CORPORATE_OVERVIEW_PATH,
  getActiveNavigationContext,
  type BiArea,
  type BiAreaId,
} from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import type { User } from '../../data/dashboardTypes'
import {
  availableDepartmentPageKeys,
  isAccessProfileAssignableToUserProfile,
  isAccessProfileCompatibleWithUserProfile,
} from '../../lib/accessProfileRules'
// Chaves técnicas, e não rótulos: o auxílio de seleção do formulário identifica
// as duas páginas que ficam fora da seleção padrão pelo id do catálogo, para não
// depender do texto exibido em nenhum idioma nem de uma segunda lista própria.
import { INTELLIGENCE_PAGE_KEY, MODEL_PAGE_KEY } from '../../lib/userAccessRules'
import { storedAccessProfileId } from '../../services/accessProfiles/accessProfileAssignment'
import type {
  AccessProfile,
  AccessProfileAudience,
  AccessProfileKind,
  AccessProfileLifecycle,
  DepartmentPageAccess,
  StandardAccessProfileAudience,
} from '../../types/access'

/**
 * Modelo de apresentação da tela Perfis de Acesso.
 *
 * Camada de apresentação e nada além disso: recebe os Perfis de Acesso reais do
 * repositório e a coleção de usuários, e traduz os dois para o que a tela
 * exibe. Função pura, sem leitura de armazenamento, sem escrita e sem criação
 * de perfil, e por isso testável sem navegador.
 *
 * A identidade dos perfis vem inteira do domínio: id, nome, destino, ciclo de
 * vida e departamentos são os que estão gravados. Esta tela não fabrica mais
 * perfis a partir dos acessos dos usuários, e não existe aqui nenhuma taxonomia
 * paralela de apresentação: o que separa um perfil de outro é `kind`,
 * `audience`, o id real e o conteúdo real de `departmentPageAccess`.
 *
 * A correspondência entre usuário e perfil deixou de ser calculada: ela é o
 * VÍNCULO GRAVADO (`accessProfileId`), confrontado com a coleção recebida. Não
 * existe mais comparação de páginas para descobrir a qual perfil alguém
 * pertence, e por isso dois perfis com as mesmas concessões deixaram de ser
 * ambíguos. Esta camada continua somente leitura: nada é gravado aqui.
 *
 * Departamentos, páginas e rótulos vêm exclusivamente dos catálogos oficiais
 * (`biAreas` e `departmentPages`): nenhuma lista paralela é declarada aqui, e
 * nenhuma contagem é escrita à mão.
 */

/* -------------------------------------------------------------------------- */
/* Vocabulário da tela                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Acesso corporativo, modelado só aqui.
 *
 * A rota já existe no catálogo de navegação como contexto global do portal, e
 * não como departamento: ela não está em `departmentPages` e não deve ser
 * forçada para dentro de nenhum departamento. O nome é lido do próprio catálogo
 * a partir da rota oficial, para a tela não manter uma segunda grafia dele.
 */
export const CORPORATE_ACCESS_PATH = CORPORATE_OVERVIEW_PATH
export const CORPORATE_ACCESS_LABEL =
  getActiveNavigationContext(CORPORATE_OVERVIEW_PATH)?.label ?? 'Visão Geral Executiva'

/**
 * Rótulo do destino do perfil, no plural: ele descreve a quem o perfil serve,
 * e não uma pessoa. Texto de apresentação, separado dos valores técnicos do
 * domínio, como todo rótulo deste projeto.
 */
export const accessProfileAudienceLabels: Record<AccessProfileAudience, string> = {
  administrator: 'Administradores',
  executive: 'Executivos',
  analyst: 'Analistas',
}

/**
 * Perfil do Sistema correspondente ao destino.
 *
 * Existe para a tela reaproveitar as cores de perfil já usadas na tabela de
 * Usuários sem manter uma segunda paleta: o rótulo exibido continua no plural,
 * porque descreve um grupo, e a cor vem do mesmo lugar de sempre.
 */
export const accessProfileAudienceProfiles: Record<AccessProfileAudience, User['profile']> = {
  administrator: 'Administrador',
  executive: 'Executivo',
  analyst: 'Analista',
}

/* -------------------------------------------------------------------------- */
/* Estruturas da tela                                                         */
/* -------------------------------------------------------------------------- */

/** Usuário como a tela precisa dele: identidade, perfil funcional e situação. */
export type PreviewUser = {
  id: string
  name: string
  email: string
  /**
   * Iniciais do usuário, como estão gravadas na coleção.
   *
   * Vêm do dado, e não de um cálculo desta tela: a tabela de Usuários mostra
   * exatamente estas letras, e recalcular pelo nome faria as duas telas
   * divergirem no dia em que a regra de iniciais mudasse em um lugar só.
   */
  initials: string
  /** Perfil do Sistema, no mesmo tipo da coleção: a tela reaproveita as cores já
      usadas na tabela de Usuários sem converter texto. */
  profile: User['profile']
  status: User['status']
}

/**
 * Página concedida, sempre resolvida contra o catálogo.
 *
 * `inDevelopment` traduz o `disabled` do catálogo: a página existe e está
 * concedida, mas ainda não abre. Os dois estados nunca somam no mesmo número.
 */
export type PreviewPage = {
  pageKey: string
  label: string
  inDevelopment: boolean
}

export type AccessProfilePageTotals = {
  available: number
  inDevelopment: number
}

/**
 * Cobertura do perfil dentro de um departamento, que é o que o chip mostra.
 *
 * O denominador é o total de páginas PUBLICADAS do departamento no catálogo, e
 * o numerador é quantas delas o perfil libera. Páginas em desenvolvimento não
 * entram em nenhum dos dois: elas não podem ser abertas, e contá-las descreveria
 * uma cobertura que o portal não entrega hoje.
 */
export type DepartmentCoverage = {
  /** Páginas publicadas que o perfil libera. */
  granted: number
  /** Páginas publicadas que o departamento tem no catálogo. */
  total: number
  /** 0 a 100, sempre finito: um departamento sem página publicada devolve 0. */
  percent: number
  /** `8/10`, exatamente como aparece no chip. */
  fraction: string
  /** Nome acessível completo, para a leitura não depender da cor nem do desenho. */
  accessibleLabel: string
}

/**
 * Página do departamento como o detalhamento de cobertura precisa dela: TODAS
 * as do catálogo, e não apenas as concedidas.
 *
 * É o que permite dizer o que o perfil não libera sem inventar lista nenhuma. Os
 * três estados são mutuamente exclusivos e saem do próprio catálogo:
 *
 * - concedida: o perfil libera e a página abre;
 * - em desenvolvimento: a página existe no portal mas ainda não abre, e por isso
 *   nenhum perfil pode concedê-la;
 * - não liberada: a página abre, mas este perfil não a concede.
 */
export type PreviewCatalogPage = {
  pageKey: string
  label: string
  granted: boolean
  inDevelopment: boolean
}

export type PreviewDepartment = {
  departmentId: BiAreaId
  label: string
  /** Páginas concedidas neste departamento, na ordem do catálogo. */
  pages: PreviewPage[]
  /** Todas as páginas do departamento, na ordem do catálogo, com o estado de cada uma. */
  catalogPages: PreviewCatalogPage[]
  pageTotals: AccessProfilePageTotals
  coverage: DepartmentCoverage
}

export type PreviewProfile = {
  /** Id técnico real do perfil, o mesmo do domínio. */
  id: string
  name: string
  /** Texto vazio quando o perfil não tem descrição gravada. */
  description: string
  kind: AccessProfileKind
  audience: AccessProfileAudience
  /**
   * Ciclo de vida gravado.
   *
   * Não muda a exibição do card: quem está vinculado a um perfil desativado
   * continua aparecendo dentro dele. Existe porque a ATRIBUIÇÃO exige perfil
   * ativo, e `kind`, `audience` e `lifecycle` juntos são exatamente o que a regra
   * de domínio `isAccessProfileAssignableToUserProfile` examina: com os três
   * aqui, a tela pergunta ao domínio em vez de reescrever a regra.
   */
  lifecycle: AccessProfileLifecycle
  /** `Executivos`, `Analistas` ou `Administradores`. */
  audienceLabel: string
  /** Perfil do Sistema do destino, para o badge reusar a cor da tela Usuários. */
  audienceProfile: User['profile']
  /** Acesso do Sistema é o único perfil do sistema, e não é editável. */
  isSystem: boolean
  /** Visão Geral Executiva pertence a quem não é Analista. */
  hasCorporateAccess: boolean
  /** Usuários vinculados a este perfil pelo `accessProfileId` gravado. */
  users: PreviewUser[]
  userCount: number
  departments: PreviewDepartment[]
  departmentCount: number
  pageTotals: AccessProfilePageTotals
}

/**
 * Usuário cujos acessos atuais não correspondem a exatamente um Perfil de
 * Acesso existente.
 *
 * Não é erro nem pendência: é a leitura honesta de que aquele acesso ainda não
 * tem um perfil equivalente, ou de que tem mais de um. Por isso ele não entra
 * em perfil nenhum.
 */
export type PreviewUnassignedUser = {
  id: string
  name: string
  /**
   * E-mail gravado na coleção.
   *
   * Substituiu a lista de departamentos acessados. Aquela lista descrevia o
   * acesso antigo do usuário, que é justamente o que ainda não virou Perfil de
   * Acesso: ela repetia o motivo de a pessoa estar nesta seção sem ajudar a
   * identificá-la. O e-mail identifica, e é o mesmo dado que a tabela de
   * Usuários e a aba Usuários do formulário já mostram.
   */
  email: string
  /** Iniciais gravadas na coleção, as mesmas da tabela de Usuários. */
  initials: string
  profile: User['profile']
}

export type AccessProfilesPreviewModel = {
  /**
   * Acesso do Sistema, quando a coleção recebida o traz.
   *
   * Continua identificado à parte porque as REGRAS dele são diferentes: não é
   * editável, não é excluível e não é atribuível por escolha. O que deixou de
   * ser separado é a APRESENTAÇÃO: a página o exibe como primeiro item da mesma
   * coleção, e é `orderedProfiles` que entrega essa ordem.
   */
  systemProfile: PreviewProfile | null
  /** Perfis comuns, na mesma ordem em que o repositório os devolveu. */
  profiles: PreviewProfile[]
  /**
   * Coleção única exibida pela página: o perfil do sistema primeiro, os comuns
   * na ordem do repositório em seguida.
   *
   * A ordem é decidida aqui, e não na tela, para lista e grade não terem chance
   * de discordar sobre qual perfil vem primeiro.
   */
  orderedProfiles: PreviewProfile[]
  unassignedUsers: PreviewUnassignedUser[]
  /** Perfis comuns exibidos. O perfil do sistema não entra na contagem. */
  profileCount: number
  /** Perfis exibidos na coleção única, com o perfil do sistema incluído. */
  totalProfileCount: number
  /** Usuários distintos que correspondem a um perfil comum. */
  matchedUserCount: number
  /**
   * Usuários distintos que correspondem a QUALQUER perfil exibido, com o
   * Acesso do Sistema incluído.
   *
   * É este o número que o resumo da página mostra, porque a coleção passou a
   * ser única: contar só os perfis comuns deixaria os Administradores de fora
   * de um total que a tela apresenta como o total de correspondências.
   *
   * Distintos, e não a soma dos `userCount` de cada perfil: um usuário
   * corresponde a no máximo um perfil, e somar por perfil daria o mesmo número
   * hoje, mas passaria a mentir no dia em que a correspondência deixasse de ser
   * exclusiva.
   */
  totalMatchedUserCount: number
  unassignedUserCount: number
  /** Usuários que podem corresponder a perfis comuns: sem Administradores. */
  assignableUsers: PreviewUser[]
}

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                   */
/* -------------------------------------------------------------------------- */

const areaById = new Map<string, BiArea>(biAreas.map((area) => [area.id, area]))

/** Área oficial pelo id exato, ou null quando o id não está no catálogo. */
function findArea(departmentId: string): BiArea | null {
  return areaById.get(departmentId) ?? null
}

/** Concessões de um perfil ou de um usuário, tolerante a dado fora de forma. */
function storedAccess(source: { departmentPageAccess?: unknown }): DepartmentPageAccess[] {
  return Array.isArray(source.departmentPageAccess) ? source.departmentPageAccess : []
}

function storedPageKeys(access: DepartmentPageAccess): string[] {
  return Array.isArray(access.pageKeys) ? access.pageKeys : []
}

function countPages(pages: readonly PreviewPage[]): AccessProfilePageTotals {
  return {
    available: pages.filter((page) => !page.inDevelopment).length,
    inDevelopment: pages.filter((page) => page.inDevelopment).length,
  }
}

function sumTotals(departments: readonly PreviewDepartment[]): AccessProfilePageTotals {
  return departments.reduce<AccessProfilePageTotals>(
    (totals, department) => ({
      available: totals.available + department.pageTotals.available,
      inDevelopment: totals.inDevelopment + department.pageTotals.inDevelopment,
    }),
    { available: 0, inDevelopment: 0 },
  )
}

/* -------------------------------------------------------------------------- */
/* Cobertura                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Cobertura de um departamento a partir do que o perfil libera nele.
 *
 * `granted` nunca passa de `total` porque as duas contagens saem da mesma lista
 * do catálogo: chaves desconhecidas e páginas em desenvolvimento ficam de fora
 * dos dois lados, e a duplicata some porque a contagem é sobre as páginas do
 * catálogo, e não sobre as chaves gravadas.
 *
 * Departamento sem nenhuma página publicada devolve `0/0` com 0%, e não uma
 * divisão por zero: o texto acessível diz que não existe página disponível, em
 * vez de sugerir que o perfil deixou de liberar algo.
 */
export function describeDepartmentCoverage(
  area: BiArea,
  grantedKeys: ReadonlySet<string>,
): DepartmentCoverage {
  const availableKeys = availableDepartmentPageKeys(area.id)
  const total = availableKeys.length
  const granted = availableKeys.filter((pageKey) => grantedKeys.has(pageKey)).length

  const percent = total === 0 ? 0 : Math.min(100, Math.max(0, (granted / total) * 100))

  return {
    granted,
    total,
    percent,
    fraction: `${granted}/${total}`,
    accessibleLabel:
      total === 0
        ? `${area.label}: nenhuma página disponível no departamento`
        : `${area.label}: ${granted} de ${total} ${
            total === 1 ? 'página disponível liberada' : 'páginas disponíveis liberadas'
          }`,
  }
}

/**
 * Departamento descrito pelo catálogo, com as páginas concedidas na ordem
 * oficial. As chaves são filtradas pelo catálogo: uma chave que ele não
 * reconhece não nomeia nenhuma página do portal e não teria rótulo a exibir.
 */
function describeDepartment(area: BiArea, grantedKeys: ReadonlySet<string>): PreviewDepartment {
  // Uma passada só sobre o catálogo: as concedidas são um recorte das do
  // catálogo, e derivar as duas listas da mesma origem impede que elas
  // discordem sobre rótulo ou ordem.
  const catalogPages: PreviewCatalogPage[] = departmentPages[area.id].map((page) => ({
    pageKey: page.key,
    label: page.label,
    granted: grantedKeys.has(page.key),
    inDevelopment: page.disabled,
  }))

  const pages: PreviewPage[] = catalogPages
    .filter((page) => page.granted)
    .map(({ pageKey, label, inDevelopment }) => ({ pageKey, label, inDevelopment }))

  return {
    departmentId: area.id,
    label: area.label,
    pages,
    catalogPages,
    pageTotals: countPages(pages),
    coverage: describeDepartmentCoverage(area, grantedKeys),
  }
}

/**
 * Departamentos concedidos pelo perfil, na ordem do catálogo.
 *
 * A ordem é a de `biAreas`, e não a ordem em que as concessões foram gravadas:
 * é a ordem em que o portal apresenta os departamentos na navegação, e é a que
 * mantém os chips previsíveis de um card para o outro.
 */
export function describeProfileDepartments(profile: AccessProfile): PreviewDepartment[] {
  const grantedByDepartment = new Map<BiAreaId, Set<string>>()

  for (const access of storedAccess(profile)) {
    const area = findArea(access.departmentId)
    if (!area) continue

    const keys = grantedByDepartment.get(area.id) ?? new Set<string>()
    for (const pageKey of storedPageKeys(access)) keys.add(pageKey)
    grantedByDepartment.set(area.id, keys)
  }

  return biAreas.flatMap((area) => {
    const keys = grantedByDepartment.get(area.id)

    return keys ? [describeDepartment(area, keys)] : []
  })
}

/* -------------------------------------------------------------------------- */
/* Vínculo gravado                                                            */
/* -------------------------------------------------------------------------- */

/** Endereço de uma página dentro do departamento, usado pela seleção do formulário. */
function grantKey(departmentId: string, pageKey: string): string {
  return `${departmentId}::${pageKey}`
}

/**
 * Perfil ao qual o usuário está vinculado, ou null.
 *
 * Deixou de ser uma correspondência calculada. O portal passou a persistir o
 * vínculo (`accessProfileId`), então quem decide a qual perfil alguém pertence é
 * o dado gravado, e não a semelhança entre as páginas de um e as do outro. Com
 * isso, dois perfis com exatamente as mesmas concessões deixaram de ser
 * ambíguos, e um usuário com uma página a mais ou a menos deixou de sumir do
 * próprio perfil.
 *
 * O id gravado não é aceito sozinho: ele é confrontado com a coleção recebida, e
 * o destino do perfil precisa continuar servindo ao Perfil do Sistema do
 * usuário. Um vínculo que aponta para um perfil inexistente, ou para um perfil
 * de outro destino, não coloca ninguém em lugar nenhum.
 *
 * O ciclo de vida NÃO entra aqui: quem está vinculado a um perfil desativado
 * continua sendo usuário dele, e esconder essas pessoas faria o perfil parecer
 * vazio justamente quando é preciso transferi-las.
 *
 * Somente leitura: nada é gravado no usuário nem no perfil.
 */
function linkedProfile(
  user: User,
  profilesById: ReadonlyMap<string, AccessProfile>,
): AccessProfile | null {
  const linkedId = storedAccessProfileId(user)
  if (linkedId === null) return null

  const profile = profilesById.get(linkedId)
  if (!profile) return null

  return isAccessProfileCompatibleWithUserProfile(profile, user.profile) ? profile : null
}

/* -------------------------------------------------------------------------- */
/* Montagem                                                                   */
/* -------------------------------------------------------------------------- */

function toPreviewUser(user: User): PreviewUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    initials: user.initials,
    profile: user.profile,
    status: user.status,
  }
}

function describeUnassignedUser(user: User): PreviewUnassignedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    initials: user.initials,
    profile: user.profile,
  }
}

/** Perfil do domínio traduzido para a tela, com os usuários correspondentes. */
function describeProfile(profile: AccessProfile, members: readonly User[]): PreviewProfile {
  const departments = describeProfileDepartments(profile)

  return {
    id: profile.id,
    name: profile.name,
    description: profile.description ?? '',
    kind: profile.kind,
    audience: profile.audience,
    lifecycle: profile.lifecycle,
    audienceLabel: accessProfileAudienceLabels[profile.audience],
    audienceProfile: accessProfileAudienceProfiles[profile.audience],
    isSystem: profile.kind === 'system',
    // A Visão Geral Executiva é do Administrador e do Executivo, por regra do
    // portal, e não uma página que um perfil conceda: ela não está em
    // `departmentPages` e não aparece em `departmentPageAccess` de ninguém.
    hasCorporateAccess: profile.audience !== 'analyst',
    users: members.map(toPreviewUser),
    userCount: members.length,
    departments,
    departmentCount: departments.length,
    pageTotals: sumTotals(departments),
  }
}

/**
 * Monta a tela a partir dos perfis reais e da coleção de usuários.
 *
 * A ordem dos perfis comuns é a que o repositório entregou, que é a ordem de
 * gravação: a coleção inicial é criada na ordem aprovada (Acesso Executivo,
 * Operações Técnicas e os departamentos na ordem do catálogo), e um perfil
 * criado depois entra atrás dos iniciais. Nenhuma reordenação de apresentação é
 * aplicada aqui, porque ela desfaria justamente essa ordem.
 *
 * Cada usuário entra em exatamente um destino: um perfil correspondente ou a
 * lista de acessos atuais sem perfil. Nenhuma das duas coleções recebidas é
 * alterada em nenhum ponto, nada é gravado e nenhum repositório é consultado.
 */
export function buildAccessProfilesPreviewModel(input: {
  profiles: readonly AccessProfile[]
  users: readonly User[]
}): AccessProfilesPreviewModel {
  const { profiles, users } = input

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))

  const membersByProfileId = new Map<string, User[]>()
  const unassignedUsers: PreviewUnassignedUser[] = []

  for (const user of users) {
    const matched = linkedProfile(user, profilesById)

    if (!matched) {
      unassignedUsers.push(describeUnassignedUser(user))
      continue
    }

    const members = membersByProfileId.get(matched.id) ?? []
    members.push(user)
    membersByProfileId.set(matched.id, members)
  }

  const described = profiles.map((profile) =>
    describeProfile(profile, membersByProfileId.get(profile.id) ?? []),
  )

  const systemProfile = described.find((profile) => profile.isSystem) ?? null
  const standardProfiles = described.filter((profile) => !profile.isSystem)

  const matchedUserIds = new Set(
    standardProfiles.flatMap((profile) => profile.users.map((user) => user.id)),
  )

  // O perfil do sistema abre a coleção porque é o alcance máximo do portal, e
  // porque o Administrador espera encontrá-lo no topo. Os comuns o seguem na
  // ordem de gravação, que continua intacta.
  const orderedProfiles = systemProfile ? [systemProfile, ...standardProfiles] : standardProfiles

  const allMatchedUserIds = new Set(
    orderedProfiles.flatMap((profile) => profile.users.map((user) => user.id)),
  )

  return {
    systemProfile,
    profiles: standardProfiles,
    orderedProfiles,
    unassignedUsers,
    profileCount: standardProfiles.length,
    totalProfileCount: orderedProfiles.length,
    matchedUserCount: matchedUserIds.size,
    totalMatchedUserCount: allMatchedUserIds.size,
    unassignedUserCount: unassignedUsers.length,
    // Administrador tem alcance global pelo Perfil do Sistema e não é candidato
    // a um perfil comum.
    assignableUsers: users.filter((user) => user.profile !== 'Administrador').map(toPreviewUser),
  }
}

/* -------------------------------------------------------------------------- */
/* Exclusão de perfil                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Frase que descreve o efeito da exclusão sobre quem usa o perfil.
 *
 * O número é o de usuários realmente vinculados, e a flexão acompanha a
 * contagem. As três formas são textos aprovados e ficam inteiras aqui, em vez de
 * montadas por concatenação de pedaços: é assim que nenhuma delas sai com
 * concordância errada quando a contagem muda.
 *
 * Mora no modelo de apresentação, e não na tela, porque é texto que precisa ser
 * verificável sem navegador.
 */
export function describeAccessProfileDeletionImpact(userCount: number): string {
  if (userCount === 0) return 'Este perfil não possui usuários vinculados.'

  if (userCount === 1) {
    return 'Este perfil possui 1 usuário. Ele ficará sem acesso ao portal enquanto um novo perfil de acesso for definido para o mesmo.'
  }

  return `Este perfil possui ${userCount} usuários. Eles ficarão sem acesso ao portal enquanto um novo perfil de acesso for definido para os mesmos.`
}

/* -------------------------------------------------------------------------- */
/* Compatibilidade entre destino e usuários                                   */
/* -------------------------------------------------------------------------- */

/**
 * Usuários que podem receber um perfil comum daquele destino.
 *
 * O destino do Perfil de Acesso e o Perfil do Sistema do usuário precisam
 * concordar, pela mesma regra do domínio que autoriza a atribuição: um perfil
 * destinado a Executivos só serve a Executivos. A correspondência entre os dois
 * vocabulários vem de `accessProfileAudienceProfiles`, e não de uma comparação
 * de texto escrita aqui.
 *
 * Sem destino escolhido devolve lista vazia, e não a lista inteira: enquanto o
 * Administrador não disser a quem o perfil serve, não existe conjunto de
 * usuários compatíveis a oferecer, e mostrar todos convidaria a escolher alguém
 * que o destino seguinte iria descartar.
 *
 * Administradores nunca aparecem: eles só recebem `Acesso do Sistema`, que não
 * é um perfil comum. Já saem de `assignableUsers`, e a comparação por Perfil do
 * Sistema os deixaria de fora de qualquer forma, porque nenhum destino de perfil
 * comum corresponde a `Administrador`.
 */
export function assignableUsersForAudience(
  users: readonly PreviewUser[],
  audience: StandardAccessProfileAudience | null,
): PreviewUser[] {
  if (audience === null) return []

  const requiredProfile = accessProfileAudienceProfiles[audience]

  return users.filter((user) => user.profile === requiredProfile)
}

/**
 * Perfis de Acesso que aquele usuário pode receber hoje.
 *
 * É o que o modal de `Definir perfil` oferece a quem está sem Perfil de Acesso, e
 * a regra é a MESMA do domínio, `isAccessProfileAssignableToUserProfile`: perfil
 * ativo, do tipo correto e com destino correspondente ao Perfil do Sistema da
 * pessoa. Nenhuma comparação de texto é escrita aqui, e nenhuma segunda regra de
 * compatibilidade nasce nesta camada.
 *
 * `Acesso do Sistema` nunca aparece: a coleção recebida é a dos perfis comuns, e a
 * própria regra recusaria o perfil do sistema a quem não é Administrador e um
 * perfil comum ao Administrador. Não existe caminho pela interface para atribuí-lo
 * por escolha.
 *
 * Somente leitura: a ordem é a da coleção recebida, e nada é gravado. A gravação
 * revalida tudo de novo, porque a coleção lida pela tela pode ter mudado depois.
 */
export function assignableProfilesForUser(
  profiles: readonly PreviewProfile[],
  userProfile: User['profile'],
): PreviewProfile[] {
  return profiles.filter((profile) => isAccessProfileAssignableToUserProfile(profile, userProfile))
}

/**
 * Seleções do formulário sem as que deixaram de ser compatíveis.
 *
 * O mapa de atribuições é a composição visual da tela: id do usuário para id do
 * perfil, `null` quando ele foi retirado de todos, e CHAVE AUSENTE quando ele
 * continua como está hoje. Remover a chave, e não gravar `null`, é o que
 * devolve o usuário à situação original em vez de transformá-lo em alguém sem
 * perfil por causa de uma escolha desfeita no rascunho.
 *
 * Serve aos dois momentos com a mesma regra:
 *
 * - trocar o destino: `keepUserIds` recebe os usuários compatíveis com o destino
 *   novo, e quem não está lá sai da seleção;
 * - cancelar ou fechar a criação: `keepUserIds` vem vazio, e o rascunho inteiro
 *   é limpo.
 *
 * Só mexe em quem aponta para `profileId`: uma seleção feita em outro perfil não
 * é assunto deste formulário e permanece intacta.
 */
export function withoutAssignmentsTo(
  assignments: ReadonlyMap<string, string | null>,
  profileId: string,
  keepUserIds: ReadonlySet<string>,
): Map<string, string | null> {
  const next = new Map(assignments)

  for (const [userId, assignedProfileId] of assignments) {
    if (assignedProfileId !== profileId) continue
    if (keepUserIds.has(userId)) continue

    next.delete(userId)
  }

  return next
}

/* -------------------------------------------------------------------------- */
/* Catálogo para os formulários                                               */
/* -------------------------------------------------------------------------- */

export type CatalogPage = {
  pageKey: string
  label: string
  inDevelopment: boolean
}

export type CatalogDepartment = {
  departmentId: BiAreaId
  label: string
  pages: CatalogPage[]
  pageTotals: AccessProfilePageTotals
}

/**
 * Chave de uma página dentro da seleção do formulário.
 *
 * O par é indivisível: a mesma chave de página existe em vários departamentos,
 * e sozinha ela não identifica nada.
 */
export function pageSelectionKey(departmentId: string, pageKey: string): string {
  return grantKey(departmentId, pageKey)
}

/**
 * Catálogo oficial completo, na ordem do portal, para os formulários visuais.
 *
 * As páginas em desenvolvimento entram na lista porque existem no portal; o que
 * as distingue é o selo, não a ausência.
 */
export function buildCatalogDepartments(): CatalogDepartment[] {
  return biAreas.map((area) => {
    const pages: CatalogPage[] = departmentPages[area.id].map((page) => ({
      pageKey: page.key,
      label: page.label,
      inDevelopment: page.disabled,
    }))

    return {
      departmentId: area.id,
      label: area.label,
      pages,
      pageTotals: {
        available: pages.filter((page) => !page.inDevelopment).length,
        inDevelopment: pages.filter((page) => page.inDevelopment).length,
      },
    }
  })
}

/** Seleção inicial do formulário a partir do que o perfil concede hoje. */
export function selectionFromDepartments(departments: readonly PreviewDepartment[]): Set<string> {
  return new Set(
    departments.flatMap((department) =>
      department.pages.map((page) => pageSelectionKey(department.departmentId, page.pageKey)),
    ),
  )
}

/* -------------------------------------------------------------------------- */
/* Seleção padrão de um departamento no formulário                            */
/* -------------------------------------------------------------------------- */

/**
 * Páginas que a seleção padrão do formulário NÃO marca.
 *
 * `Inteligência (IA)` é uma evolução futura do portal, e `Modelo Dimensional` é
 * conteúdo técnico: as duas existem, abrem e continuam selecionáveis à mão, mas
 * nenhuma delas entra em um perfil novo por conveniência. Concedê-las é uma
 * decisão, e uma decisão não vem embutida em um botão de atalho.
 *
 * São as CHAVES TÉCNICAS do catálogo, importadas do domínio: o comportamento não
 * depende dos rótulos exibidos, que podem mudar sem mudar a regra.
 *
 * O alcance é este auxílio de seleção, e nada além dele. `defaultDepartmentPageKeys`,
 * as concessões já gravadas, os perfis iniciais e a evolução dos usuários
 * persistidos continuam exatamente como estão: nada aqui reescreve nem retira
 * acesso de ninguém.
 */
export const NON_DEFAULT_SELECTION_PAGE_KEYS: readonly string[] = [
  INTELLIGENCE_PAGE_KEY,
  MODEL_PAGE_KEY,
]

/**
 * Chaves de seleção que o atalho de páginas padrão marca naquele departamento.
 *
 * Todas as páginas DISPONÍVEIS, menos as duas de concessão intencional. Página em
 * desenvolvimento fica de fora porque não é selecionável em nenhum caminho: o
 * domínio recusa a concessão dela.
 */
export function defaultSelectionKeysOf(department: CatalogDepartment): string[] {
  return department.pages
    .filter(
      (page) =>
        !page.inDevelopment && !NON_DEFAULT_SELECTION_PAGE_KEYS.includes(page.pageKey),
    )
    .map((page) => pageSelectionKey(department.departmentId, page.pageKey))
}

/** Todas as chaves de seleção do departamento, inclusive as de concessão intencional. */
function allSelectionKeysOf(department: CatalogDepartment): string[] {
  return department.pages
    .filter((page) => !page.inDevelopment)
    .map((page) => pageSelectionKey(department.departmentId, page.pageKey))
}

/**
 * Situação do departamento diante do atalho de páginas padrão.
 *
 * - `empty`: nenhuma página daquele departamento está marcada;
 * - `complete`: todas as páginas padrão estão marcadas;
 * - `partial`: existe marcação, mas falta alguma página padrão.
 *
 * Um departamento com IA marcada e mais nada é `partial`, e não `empty`: existe
 * concessão ali. Um departamento com todas as padrão e também IA continua
 * `complete`, porque o atalho já entregou tudo o que se propõe a entregar.
 */
export type DepartmentSelectionState = 'empty' | 'partial' | 'complete'

export function describeDepartmentSelectionState(
  department: CatalogDepartment,
  selection: ReadonlySet<string>,
): DepartmentSelectionState {
  const all = allSelectionKeysOf(department)
  if (!all.some((key) => selection.has(key))) return 'empty'

  const defaults = defaultSelectionKeysOf(department)

  return defaults.length > 0 && defaults.every((key) => selection.has(key)) ? 'complete' : 'partial'
}

/**
 * Seleção com as páginas padrão daquele departamento acrescentadas.
 *
 * ACRESCENTA, e não substitui: uma escolha manual de IA ou de Modelo Dimensional
 * feita antes continua valendo, porque o atalho existe para poupar cliques e não
 * para desfazer decisões. Nenhum outro departamento é tocado, e a seleção recebida
 * não é alterada.
 */
export function withDepartmentDefaultPages(
  selection: ReadonlySet<string>,
  department: CatalogDepartment,
): Set<string> {
  const next = new Set(selection)

  for (const key of defaultSelectionKeysOf(department)) next.add(key)

  return next
}

/**
 * Seleção sem nenhuma página daquele departamento.
 *
 * Limpa o departamento inteiro, inclusive IA e Modelo Dimensional: é a volta ao
 * estado em que ele não concede nada. Os demais departamentos permanecem
 * exatamente como estavam.
 */
export function withoutDepartmentPages(
  selection: ReadonlySet<string>,
  department: CatalogDepartment,
): Set<string> {
  const next = new Set(selection)

  for (const page of department.pages) {
    next.delete(pageSelectionKey(department.departmentId, page.pageKey))
  }

  return next
}

/** Resumo da seleção do formulário, separado por estado da página. */
export type CatalogSelectionSummary = {
  departmentCount: number
  availablePageCount: number
  inDevelopmentPageCount: number
}

export function summarizeCatalogSelection(
  catalog: readonly CatalogDepartment[],
  selection: ReadonlySet<string>,
): CatalogSelectionSummary {
  let departmentCount = 0
  let availablePageCount = 0
  let inDevelopmentPageCount = 0

  for (const department of catalog) {
    const selected = department.pages.filter((page) =>
      selection.has(pageSelectionKey(department.departmentId, page.pageKey)),
    )

    if (selected.length > 0) departmentCount += 1

    availablePageCount += selected.filter((page) => !page.inDevelopment).length
    inDevelopmentPageCount += selected.filter((page) => page.inDevelopment).length
  }

  return { departmentCount, availablePageCount, inDevelopmentPageCount }
}
