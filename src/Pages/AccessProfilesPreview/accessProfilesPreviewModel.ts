import { EXECUTIVE_ACCESS_PROFILE_NAME } from '../../config/accessProfileCatalog'
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
  isAccessProfileCompatibleWithUserProfile,
  normalizeAccessProfileName,
} from '../../lib/accessProfileRules'
import type {
  AccessProfile,
  AccessProfileAudience,
  AccessProfileKind,
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
 * A correspondência entre usuário e perfil é PROVISÓRIA e somente leitura: o
 * portal ainda não persiste vínculo entre usuário e Perfil de Acesso. Quem tem o
 * alcance definido pelo Perfil do Sistema corresponde por ele (Administrador ao
 * `Acesso do Sistema`, Executivo ao `Acesso Executivo`); o Analista corresponde
 * pela combinação efetiva de acessos, porque o alcance dele é justamente o que
 * está gravado. Nada é gravado no usuário nem no perfil por causa disso.
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
  /** `Executivos`, `Analistas` ou `Administradores`. */
  audienceLabel: string
  /** Perfil do Sistema do destino, para o badge reusar a cor da tela Usuários. */
  audienceProfile: User['profile']
  /** Acesso do Sistema é o único perfil do sistema, e não é editável. */
  isSystem: boolean
  /** Visão Geral Executiva pertence a quem não é Analista. */
  hasCorporateAccess: boolean
  /** Usuários que correspondem provisoriamente a este perfil. */
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
function describeProfileDepartments(profile: AccessProfile): PreviewDepartment[] {
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
/* Correspondência provisória                                                 */
/* -------------------------------------------------------------------------- */

/** Endereço de uma página dentro do departamento, para comparar acessos. */
function grantKey(departmentId: string, pageKey: string): string {
  return `${departmentId}::${pageKey}`
}

/**
 * Páginas DISPONÍVEIS que aquelas concessões liberam, por
 * `departmentId + pageKey`.
 *
 * É a forma efetiva do acesso, e é o que permite comparar um usuário com um
 * Perfil de Acesso sem comparar nomes nem rótulos. Três filtros a definem:
 *
 * - o que não está no catálogo fica de fora dos dois lados;
 * - páginas em desenvolvimento ficam de fora, porque o domínio recusa a seleção
 *   delas e nenhum perfil real pode tê-las: mantê-las faria todo Analista
 *   deixar de corresponder ao perfil do próprio departamento;
 * - a página Modelo NÃO tem tratamento especial: ela é uma página disponível
 *   como outra qualquer, então um usuário que a tem e um perfil que não a
 *   concede simplesmente deixam de ter a mesma combinação.
 */
function effectiveGrantKeys(entries: readonly DepartmentPageAccess[]): Set<string> {
  const keys = new Set<string>()

  for (const access of entries) {
    const area = findArea(access.departmentId)
    if (!area) continue

    const availableKeys = new Set(availableDepartmentPageKeys(area.id))

    for (const pageKey of storedPageKeys(access)) {
      if (availableKeys.has(pageKey)) keys.add(grantKey(area.id, pageKey))
    }
  }

  return keys
}

function sameKeys(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
  return first.size === second.size && [...first].every((key) => second.has(key))
}

/** Perfil e a forma efetiva do acesso dele, calculada uma vez por perfil. */
type ProfileMatchCandidate = {
  profile: AccessProfile
  grants: Set<string>
}

/**
 * Chave de comparação do nome oficial do perfil executivo padrão.
 *
 * A comparação é a do próprio domínio, e não uma igualdade de string escrita
 * aqui: espaços excedentes e diferença de caixa não fazem de um perfil gravado
 * um perfil diferente, e é a mesma regra que impede dois perfis de nascerem com
 * esse nome.
 */
const EXECUTIVE_ACCESS_PROFILE_KEY = normalizeAccessProfileName(
  EXECUTIVE_ACCESS_PROFILE_NAME,
).comparisonKey

/**
 * true somente para o perfil executivo padrão do portal.
 *
 * As três exigências valem juntas: perfil comum, destinado a Executivos e com o
 * nome oficial `Acesso Executivo`. Nenhuma posição, índice ou id presumido
 * participa da decisão, e nenhum outro perfil executivo é aceito, mesmo quando é
 * o único da coleção.
 */
function isDefaultExecutiveProfile(profile: AccessProfile): boolean {
  return (
    profile.kind === 'standard' &&
    profile.audience === 'executive' &&
    normalizeAccessProfileName(profile.name).comparisonKey === EXECUTIVE_ACCESS_PROFILE_KEY
  )
}

/**
 * Perfil que corresponde provisoriamente ao usuário, ou null.
 *
 * Administrador corresponde ao perfil destinado a Administradores, que é o do
 * sistema, sem comparar combinação nenhuma: o alcance dele vem do Perfil do
 * Sistema, e não das páginas gravadas.
 *
 * Executivo corresponde ao perfil executivo padrão, `Acesso Executivo`, também
 * sem comparar combinação nenhuma. A comparação por páginas gravadas descrevia
 * mal esse caso: o Executivo recebe o alcance pelo Perfil do Sistema, e qualquer
 * diferença entre o que está gravado nele e o que o perfil concede hoje o
 * deixava fora do próprio perfil. É EXATAMENTE UM perfil, identificado pelo tipo,
 * pelo destino e pelo nome oficial: sem ele na coleção, ou com mais de um
 * candidato, o usuário fica sem correspondência, e nenhum outro perfil executivo
 * ocupa esse lugar.
 *
 * Analista só pode corresponder a um perfil de destino compatível, pela mesma
 * regra do domínio que autoriza a atribuição. Entre os compatíveis, corresponde
 * apenas quando existe EXATAMENTE UM com a mesma combinação efetiva: nenhum ou
 * mais de um o deixam em Acessos atuais sem perfil, porque escolher um deles
 * seria adivinhar.
 *
 * Nada é gravado no usuário nem no perfil: esta é uma leitura da coleção
 * mockada, e o vínculo persistido continua sendo assunto de outro bloco.
 */
function matchProfile(user: User, candidates: readonly ProfileMatchCandidate[]): AccessProfile | null {
  const compatible = candidates.filter((candidate) =>
    isAccessProfileCompatibleWithUserProfile(candidate.profile, user.profile),
  )

  if (user.profile === 'Administrador') {
    return compatible.length === 1 ? compatible[0].profile : null
  }

  if (user.profile === 'Executivo') {
    const standard = compatible.filter((candidate) => isDefaultExecutiveProfile(candidate.profile))

    return standard.length === 1 ? standard[0].profile : null
  }

  const userGrants = effectiveGrantKeys(storedAccess(user))
  if (userGrants.size === 0) return null

  const matches = compatible.filter((candidate) => sameKeys(candidate.grants, userGrants))

  return matches.length === 1 ? matches[0].profile : null
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

  const candidates: ProfileMatchCandidate[] = profiles.map((profile) => ({
    profile,
    grants: effectiveGrantKeys(storedAccess(profile)),
  }))

  const membersByProfileId = new Map<string, User[]>()
  const unassignedUsers: PreviewUnassignedUser[] = []

  for (const user of users) {
    const matched = matchProfile(user, candidates)

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
