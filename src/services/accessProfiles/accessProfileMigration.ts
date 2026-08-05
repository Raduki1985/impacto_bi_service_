import { biAreas, type BiArea } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import { ADMIN_FULL_PERMISSION } from '../../config/permissions'
import type { User } from '../../data/dashboardTypes'
import type { DepartmentPageReference, StandardAccessProfileAudience } from '../../types/access'
import { SYSTEM_ACCESS_PROFILE_ID, SYSTEM_ACCESS_PROFILE_NAME } from './accessProfileStorage'

/**
 * Analisador provisório da migração dos usuários atuais para perfis de acesso.
 *
 * Lê o modelo granular como ele está hoje e responde uma única pergunta: quais
 * usuários teriam o mesmo perfil de acesso. O resultado é material de revisão, e
 * nada mais: nenhum perfil é criado, nenhum usuário é alterado e nada é
 * persistido.
 *
 * "O mesmo perfil" são duas coisas ao mesmo tempo, e não uma: a mesma combinação
 * de acessos E o mesmo destino, porque um Perfil de Acesso serve a Executivos ou
 * a Analistas, nunca aos dois. Um Executivo e um Analista com exatamente as
 * mesmas páginas hoje precisam de dois perfis diferentes amanhã, e juntá-los em
 * um grupo só produziria um perfil que nenhum dos dois pode receber.
 *
 * O destino de cada grupo vem do Perfil do Sistema gravado no usuário, que é o
 * único dado que o diz. Não é deduzido dos departamentos, das páginas nem do
 * volume de acesso: quem não tiver um Perfil do Sistema reconhecido fica sem
 * grupo, e não recebe um destino escolhido pelo analisador.
 *
 * Função pura. Recebe a coleção por parâmetro, não conhece armazenamento, não
 * toca nos objetos recebidos e devolve estruturas novas.
 *
 * A comparação é feita pelo par departmentId + pageKey, com igualdade EXATA de
 * texto, sem aparar espaços nem normalizar caixa. É assim que a autorização
 * funciona hoje em `hasDepartmentPageAccess`: um id gravado como 'comercial ' não
 * libera 'comercial', e um analisador que os igualasse descreveria um acesso que
 * o portal não concede. Divergências desse tipo aparecem como pendência, e não
 * como correção silenciosa.
 *
 * Nada é acrescentado e nada é retirado. Visão Geral, Modelo, páginas padrão e
 * página inicial não são concedidas por conta própria, e páginas fora do
 * catálogo ou em desenvolvimento continuam na combinação, viram pendência e
 * seguem para a revisão.
 *
 * Quem tem estrutura ilegível não entra em grupo nenhum: a combinação lida dele
 * seria uma leitura parcial apresentada como se fosse o acesso inteiro, e um
 * usuário assim cairia junto de quem realmente não tem acesso. Esses usuários
 * saem em `unresolvedUsers`, com a parte legível preservada e a migração
 * bloqueada até a revisão.
 */

/* -------------------------------------------------------------------------- */
/* Pendências                                                                 */
/* -------------------------------------------------------------------------- */

export type AccessProfileMigrationIssueCode =
  | 'invalid-access-structure'
  | 'missing-department-id'
  | 'missing-page-key'
  | 'duplicate-page-access'
  | 'unknown-department'
  | 'unknown-page'
  | 'unavailable-page'
  | 'home-page-undefined'
  | 'administrator-without-bypass'
  | 'bypass-without-administrator-profile'
  | 'unknown-system-profile'

/** Textos fixos de cada código, no mesmo formato das pendências do domínio. */
const issueTexts: Record<
  AccessProfileMigrationIssueCode,
  { reason: string; impact: string; requiredAction: string }
> = {
  'invalid-access-structure': {
    reason: 'O acesso gravado do usuário não tem a estrutura esperada.',
    impact: 'A parte legível não representa o acesso inteiro, e o usuário fica fora dos grupos.',
    requiredAction: 'Revise o acesso desse usuário antes de migrá-lo.',
  },
  'missing-department-id': {
    reason: 'Há acesso gravado sem identificador de departamento.',
    impact: 'O acesso não aponta para nenhum departamento do portal.',
    requiredAction: 'Corrija ou remova esse acesso antes de migrar o usuário.',
  },
  'missing-page-key': {
    reason: 'Há acesso gravado sem chave de página.',
    impact: 'O acesso não aponta para nenhuma página do departamento.',
    requiredAction: 'Corrija ou remova esse acesso antes de migrar o usuário.',
  },
  'duplicate-page-access': {
    reason: 'O mesmo par de departamento e página aparece mais de uma vez no usuário.',
    impact: 'A repetição não altera o acesso, mas indica base fora de forma.',
    requiredAction: 'Remova a repetição na base de usuários.',
  },
  'unknown-department': {
    reason: 'O departamento concedido não existe no catálogo do portal.',
    impact: 'Nenhuma página desse departamento pode ser aberta.',
    requiredAction: 'Decida se o acesso deve ser removido antes de criar o perfil.',
  },
  'unknown-page': {
    reason: 'A página concedida não existe no catálogo do departamento.',
    impact: 'A concessão não corresponde a nenhuma página do portal.',
    requiredAction: 'Decida se o acesso deve ser removido antes de criar o perfil.',
  },
  'unavailable-page': {
    reason: 'A página concedida está em desenvolvimento.',
    impact: 'A página aparece concedida, mas ainda não pode ser aberta.',
    requiredAction: 'Confirme se o perfil deve nascer com essa página concedida.',
  },
  'home-page-undefined': {
    reason: 'O modelo atual não guarda página inicial por usuário.',
    impact: 'O grupo não tem como deduzir a página de entrada do futuro perfil.',
    requiredAction: 'Defina a página inicial entre as páginas do grupo antes de criar o perfil.',
  },
  'administrator-without-bypass': {
    reason: 'O usuário tem perfil Administrador, mas não tem a permissão global admin.full.',
    impact: 'O perfil e o acesso efetivo gravados discordam entre si.',
    requiredAction: 'Confirme se o usuário deve mesmo ser Administrador.',
  },
  'bypass-without-administrator-profile': {
    reason: 'O usuário tem a permissão global admin.full sem ter perfil Administrador.',
    impact: 'O acesso efetivo dele é o portal inteiro, e não a lista granular gravada.',
    requiredAction: 'Confirme o perfil funcional antes de migrar esse usuário.',
  },
  'unknown-system-profile': {
    reason: 'O perfil funcional gravado do usuário não é Administrador, Executivo nem Analista.',
    impact: 'Não há como saber se o perfil de acesso dele seria de Executivo ou de Analista.',
    requiredAction: 'Corrija o perfil funcional do usuário antes de migrá-lo.',
  },
}

/**
 * Pendência estruturada. O código é a identidade; os textos descrevem o
 * problema, a consequência e o que precisa ser decidido. A localização vem
 * preenchida quando a pendência é de um usuário ou de um par específico, para a
 * revisão saber exatamente onde olhar.
 */
export type AccessProfileMigrationIssue = {
  code: AccessProfileMigrationIssueCode
  reason: string
  impact: string
  requiredAction: string
  userId?: string
  departmentId?: string
  pageKey?: string
}

function issue(
  code: AccessProfileMigrationIssueCode,
  location: { userId?: string; departmentId?: string; pageKey?: string } = {},
): AccessProfileMigrationIssue {
  return { code, ...issueTexts[code], ...location }
}

/* -------------------------------------------------------------------------- */
/* Resultado                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Grupo provisório: um destino, uma combinação distinta de acessos e os usuários
 * que têm os dois exatamente.
 *
 * `id` e `name` são provisórios e posicionais, derivados da ordem determinística
 * dos grupos. Não são id nem nome de perfil: os ids reais seguem o padrão
 * `acp-NNN` e são gerados pelo repositório no momento da criação, que este bloco
 * não faz. Quem precisar de uma identidade estável da combinação deve usar
 * `signature` junto de `audience`.
 */
export type ProvisionalAccessProfileGroup = {
  id: string
  name: string
  /**
   * Destino do futuro perfil, lido do Perfil do Sistema dos usuários do grupo.
   * Todos eles têm o mesmo: é parte do que define o grupo.
   *
   * `administrator` não aparece aqui: Administrador vai para o perfil do
   * sistema e não forma grupo comum.
   */
  audience: StandardAccessProfileAudience
  /**
   * Identidade da combinação de acessos: pares ordenados e serializados.
   *
   * Continua sendo só dos acessos, e não do grupo inteiro: dois grupos com
   * destinos diferentes e as mesmas páginas compartilham a assinatura de
   * propósito, e é exatamente isso que mostra que a separação veio do destino.
   */
  signature: string
  /** Pares exatamente como estão gravados, sem acréscimo nem remoção. */
  pageAccess: DepartmentPageReference[]
  userIds: string[]
  userCount: number
  accessCount: number
  /**
   * Sempre null: o modelo granular atual não guarda página inicial por usuário,
   * e inventar uma seria conceder acesso ou escolher pelo Administrador.
   */
  homePage: DepartmentPageReference | null
  /** O nome provisório não é nome aprovado de perfil. */
  needsNameReview: boolean
  needsHomePageDefinition: boolean
  issues: AccessProfileMigrationIssue[]
}

/**
 * Usuários que já têm acesso global e por isso não formam grupo: eles vão para o
 * perfil do sistema, que o portal deriva do catálogo.
 */
export type AdministratorMigrationTarget = {
  targetProfileId: string
  targetProfileName: string
  userIds: string[]
  userCount: number
  issues: AccessProfileMigrationIssue[]
}

/**
 * Usuário que não pôde entrar em nenhum grupo, por um de dois motivos: a
 * estrutura de acesso não pôde ser lida por inteiro, ou o Perfil do Sistema
 * gravado não é nenhum dos três oficiais.
 *
 * Não é grupo nem perfil: não recebe id, não recebe nome provisório e não tem
 * destino automático. Existe porque as alternativas seriam piores. Agrupar pela
 * parte legível apresentaria uma leitura parcial como se fosse o acesso inteiro,
 * e quem tem a coleção toda ilegível produziria a mesma combinação vazia de quem
 * de fato não tem acesso nenhum. Escolher um destino para quem não tem perfil
 * reconhecido seria decidir, no analisador, se a pessoa é Executivo ou Analista.
 *
 * A parte que pôde ser lida vem preservada em `readablePageAccess`, porque
 * descartar informação legível só dificultaria a revisão.
 */
export type UnresolvedMigrationUser = {
  userId: string
  /**
   * Pares lidos com segurança, ordenados. Quando a estrutura é ilegível, não é o
   * acesso completo do usuário e não deve ser tratado como tal.
   */
  readablePageAccess: DepartmentPageReference[]
  readableAccessCount: number
  issues: AccessProfileMigrationIssue[]
  /** Sempre true: nada aqui pode ser migrado antes da revisão. */
  migrationBlocked: true
}

export type AccessProfileMigrationAnalysis = {
  analyzedUserCount: number
  administrators: AdministratorMigrationTarget
  groups: ProvisionalAccessProfileGroup[]
  /** Fora de `groups` e sem destino: precisam de revisão antes de migrar. */
  unresolvedUsers: UnresolvedMigrationUser[]
}

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                   */
/* -------------------------------------------------------------------------- */

const departmentById = new Map<string, BiArea>(biAreas.map((area) => [area.id, area]))

/** Departamento pelo id exatamente como gravado, sem aparar espaços. */
function findExactDepartment(departmentId: string): BiArea | null {
  return departmentById.get(departmentId) ?? null
}

/* -------------------------------------------------------------------------- */
/* Leitura dos acessos de um usuário                                          */
/* -------------------------------------------------------------------------- */

/**
 * Comparação por unidade de código, e não `localeCompare`: a ordenação precisa
 * ser a mesma em qualquer máquina e em qualquer idioma do navegador.
 */
function compareText(first: string, second: string): number {
  if (first === second) return 0

  return first < second ? -1 : 1
}

function comparePairs(first: DepartmentPageReference, second: DepartmentPageReference): number {
  const byDepartment = compareText(first.departmentId, second.departmentId)

  return byDepartment !== 0 ? byDepartment : compareText(first.pageKey, second.pageKey)
}

/**
 * Campo de localização ausente vem antes de qualquer texto, inclusive do texto
 * vazio. A pendência que vale para o grupo inteiro, ou para o usuário inteiro,
 * aparece antes das pendências de um par específico dele.
 */
function compareOptionalText(first: string | undefined, second: string | undefined): number {
  if (first === second) return 0
  if (first === undefined) return -1
  if (second === undefined) return 1

  return compareText(first, second)
}

/**
 * Ordem das pendências: usuário, código, departamento e página.
 *
 * As pendências nascem na ordem em que os acessos foram gravados, que é ordem de
 * base e não informação. Sem esta ordenação, duas bases com o mesmo conteúdo
 * gravado em ordens diferentes produziriam resultados diferentes, e a revisão
 * não teria como comparar duas execuções.
 *
 * Duas pendências iguais nos quatro campos são idênticas em todo o resto: o
 * código determina os três textos, e não há mais nada para desempatar.
 */
function compareIssues(
  first: AccessProfileMigrationIssue,
  second: AccessProfileMigrationIssue,
): number {
  const byUser = compareOptionalText(first.userId, second.userId)
  if (byUser !== 0) return byUser

  const byCode = compareText(first.code, second.code)
  if (byCode !== 0) return byCode

  const byDepartment = compareOptionalText(first.departmentId, second.departmentId)
  if (byDepartment !== 0) return byDepartment

  return compareOptionalText(first.pageKey, second.pageKey)
}

/** Cópia ordenada: a coleção recebida não é reordenada no lugar. */
function sortIssues(
  issues: readonly AccessProfileMigrationIssue[],
): AccessProfileMigrationIssue[] {
  return [...issues].sort(compareIssues)
}

/**
 * Estrutura ilegível: alguma parte do acesso não pôde ser lida, e por isso a
 * combinação obtida não pode ser afirmada como o acesso inteiro do usuário.
 */
function hasUnreadableAccess(issues: readonly AccessProfileMigrationIssue[]): boolean {
  return issues.some((item) => item.code === 'invalid-access-structure')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Chave interna de um par, usada para detectar repetição dentro do usuário. */
function pairKey(departmentId: string, pageKey: string): string {
  return JSON.stringify([departmentId, pageKey])
}

/**
 * Pares concedidos a um usuário, sem repetição, e as pendências encontradas no
 * caminho.
 *
 * O conteúdo vem do armazenamento e pode estar malformado, por isso é lido como
 * dado externo, e não pelo tipo. Nada é descartado em silêncio: o que não pode
 * ser lido vira pendência, e o que pode ser lido entra na combinação mesmo
 * quando o catálogo não reconhece mais, porque retirar aqui seria reduzir o
 * acesso do usuário.
 *
 * A repetição é a única coisa que não entra duas vezes: ela é registrada como
 * pendência e o par continua valendo uma vez só, para que dois usuários com o
 * mesmo acesso caiam no mesmo grupo mesmo que um deles tenha a base repetida.
 */
function readUserPageAccess(user: User): {
  pairs: DepartmentPageReference[]
  issues: AccessProfileMigrationIssue[]
} {
  const pairs: DepartmentPageReference[] = []
  const issues: AccessProfileMigrationIssue[] = []
  const seenPairs = new Set<string>()
  const reportedDepartments = new Set<string>()

  const rawAccess: unknown = user.departmentPageAccess

  if (!Array.isArray(rawAccess)) {
    issues.push(issue('invalid-access-structure', { userId: user.id }))

    return { pairs, issues }
  }

  const entries: unknown[] = rawAccess

  for (const entry of entries) {
    if (!isPlainObject(entry)) {
      issues.push(issue('invalid-access-structure', { userId: user.id }))
      continue
    }

    const departmentId = entry.departmentId
    const pageKeys = entry.pageKeys

    if (typeof departmentId !== 'string' || !Array.isArray(pageKeys)) {
      issues.push(issue('invalid-access-structure', { userId: user.id }))
      continue
    }

    // Uma vez por departamento: o mesmo id repetido em duas entradas não repete
    // a mesma pendência.
    const department = findExactDepartment(departmentId)

    if (!reportedDepartments.has(departmentId)) {
      reportedDepartments.add(departmentId)

      if (!departmentId.trim()) {
        issues.push(issue('missing-department-id', { userId: user.id, departmentId }))
      } else if (!department) {
        issues.push(issue('unknown-department', { userId: user.id, departmentId }))
      }
    }

    const catalog = department ? departmentPages[department.id] : null

    for (const rawPageKey of pageKeys as unknown[]) {
      if (typeof rawPageKey !== 'string') {
        issues.push(issue('invalid-access-structure', { userId: user.id, departmentId }))
        continue
      }

      const pageKey = rawPageKey
      const location = { userId: user.id, departmentId, pageKey }
      const key = pairKey(departmentId, pageKey)

      if (seenPairs.has(key)) {
        issues.push(issue('duplicate-page-access', location))
        continue
      }

      seenPairs.add(key)
      pairs.push({ departmentId, pageKey })

      if (!pageKey.trim()) {
        issues.push(issue('missing-page-key', location))
        continue
      }

      // Departamento fora do catálogo já virou pendência própria: inspecionar as
      // páginas dele uma a uma só repetiria a mesma informação.
      if (!catalog) continue

      const page = catalog.find((item) => item.key === pageKey)

      if (!page) {
        issues.push(issue('unknown-page', location))
        continue
      }

      if (page.disabled) issues.push(issue('unavailable-page', location))
    }
  }

  return { pairs, issues }
}

/**
 * Acesso efetivo de Administrador.
 *
 * `admin.full` é o bypass global de `hasDepartmentPageAccess`: quem o possui
 * abre qualquer página, e a lista granular gravada não descreve o acesso dele.
 * Por isso a identificação olha o perfil funcional E a permissão, e as duas
 * divergências possíveis viram pendência em vez de escolha silenciosa. Nos dois
 * casos o usuário é tratado como Administrador, que é a leitura mais segura:
 * agrupá-lo pela lista granular descreveria menos acesso do que ele tem, ou
 * criaria um grupo comum para quem deve ir ao perfil do sistema.
 */
function identifyAdministrator(user: User): {
  isAdministrator: boolean
  issue: AccessProfileMigrationIssue | null
} {
  const hasProfile = user.profile === 'Administrador'
  const permissionKeys: unknown = user.permissionKeys
  const hasBypass = Array.isArray(permissionKeys) && permissionKeys.includes(ADMIN_FULL_PERMISSION)

  if (hasProfile && hasBypass) return { isAdministrator: true, issue: null }

  if (hasProfile) {
    return {
      isAdministrator: true,
      issue: issue('administrator-without-bypass', { userId: user.id }),
    }
  }

  if (hasBypass) {
    return {
      isAdministrator: true,
      issue: issue('bypass-without-administrator-profile', { userId: user.id }),
    }
  }

  return { isAdministrator: false, issue: null }
}

/**
 * Destino do futuro perfil de acesso de um usuário que não é Administrador, ou
 * null quando o Perfil do Sistema gravado não é nenhum dos oficiais.
 *
 * O perfil é lido como dado externo, e não pelo tipo: a coleção vem do
 * armazenamento e pode trazer um valor antigo ou fora do domínio. Nada é
 * convertido aqui, nem os nomes legados: a normalização de perfis antigos
 * pertence à leitura da base de usuários, e repeti-la neste módulo criaria um
 * segundo lugar decidindo o mesmo.
 */
function identifyMigrationAudience(user: User): StandardAccessProfileAudience | null {
  const profile: unknown = user.profile

  if (profile === 'Executivo') return 'executive'
  if (profile === 'Analista') return 'analyst'

  return null
}

/* -------------------------------------------------------------------------- */
/* Análise                                                                    */
/* -------------------------------------------------------------------------- */

/** Combinação em construção, antes de virar grupo provisório numerado. */
type CollectedCombination = {
  audience: StandardAccessProfileAudience
  signature: string
  pageAccess: DepartmentPageReference[]
  userIds: string[]
  issues: AccessProfileMigrationIssue[]
}

/**
 * Chave do grupo: destino e assinatura juntos.
 *
 * São dois campos e não um texto concatenado à mão porque a assinatura já é JSON
 * e pode conter qualquer caractere: um separador escolhido aqui poderia aparecer
 * dentro dela e fundir dois grupos distintos.
 */
function groupKey(audience: StandardAccessProfileAudience, signature: string): string {
  return JSON.stringify([audience, signature])
}

/**
 * Ordem dos grupos: destino primeiro, assinatura depois.
 *
 * Os grupos de um mesmo destino ficam juntos, e a numeração provisória
 * acompanha. Como as duas partes são comparadas por unidade de código, o
 * resultado é o mesmo em qualquer máquina.
 */
function compareCombinations(first: CollectedCombination, second: CollectedCombination): number {
  const byAudience = compareText(first.audience, second.audience)

  return byAudience !== 0 ? byAudience : compareText(first.signature, second.signature)
}

/**
 * Identidade da combinação: os pares ordenados e serializados em JSON.
 *
 * A ordenação elimina a influência da ordem em que os acessos foram gravados, e
 * o JSON separa os campos sem depender de nenhum caractere não aparecer dentro
 * deles. Combinações iguais produzem a mesma assinatura, e combinações
 * diferentes nunca produzem a mesma.
 */
function buildSignature(pairs: readonly DepartmentPageReference[]): string {
  return JSON.stringify(pairs.map((pair) => [pair.departmentId, pair.pageKey]))
}

/**
 * Agrupa os usuários pelo destino e pela combinação exata de acessos, e devolve
 * o material de revisão.
 *
 * Os Administradores saem primeiro, com destino ao perfil do sistema, e não
 * formam grupo comum: o acesso efetivo deles é global, e a lista granular
 * gravada não controla o que eles abrem, mesmo malformada. Depois saem os
 * usuários sem Perfil do Sistema reconhecido e os de estrutura ilegível, que
 * ficam sem grupo e sem destino. Os demais entram no grupo do seu destino com a
 * combinação que possuem, ainda que ela seja vazia: acesso válido e vazio é um
 * acesso conhecido, e não uma leitura que falhou.
 *
 * O resultado é determinístico e independente da ordem da entrada: os usuários
 * são percorridos em ordem de id, os pares de cada combinação saem ordenados, os
 * grupos são numerados por destino e assinatura e toda pendência devolvida é
 * ordenada por usuário, código, departamento e página.
 */
export function analyzeAccessProfileMigration(
  users: readonly User[],
): AccessProfileMigrationAnalysis {
  // Cópia própria: a coleção recebida não é reordenada nem tocada.
  const ordered = [...users].sort((first, second) => compareText(first.id, second.id))

  const administrators: AdministratorMigrationTarget = {
    targetProfileId: SYSTEM_ACCESS_PROFILE_ID,
    targetProfileName: SYSTEM_ACCESS_PROFILE_NAME,
    userIds: [],
    userCount: 0,
    issues: [],
  }

  const combinations = new Map<string, CollectedCombination>()
  const unresolvedUsers: UnresolvedMigrationUser[] = []

  for (const user of ordered) {
    const identification = identifyAdministrator(user)

    if (identification.issue) administrators.issues.push(identification.issue)

    if (identification.isAdministrator) {
      administrators.userIds.push(user.id)
      continue
    }

    const audience = identifyMigrationAudience(user)
    const reading = readUserPageAccess(user)
    const pageAccess = [...reading.pairs].sort(comparePairs)

    // Duas razões para ficar de fora, e nenhuma delas admite um palpite. Leitura
    // parcial não vira combinação: ela não descreve o acesso inteiro, e
    // apresentá-la como se descrevesse é o que colocaria esse usuário no grupo
    // de quem não tem acesso nenhum. Perfil do Sistema desconhecido não vira
    // destino: escolher um colocaria a pessoa em um perfil de Executivo ou de
    // Analista sem que ninguém tenha dito qual dos dois ela é.
    if (audience === null || hasUnreadableAccess(reading.issues)) {
      const issues =
        audience === null
          ? [...reading.issues, issue('unknown-system-profile', { userId: user.id })]
          : reading.issues

      unresolvedUsers.push({
        userId: user.id,
        readablePageAccess: pageAccess,
        readableAccessCount: pageAccess.length,
        issues: sortIssues(issues),
        migrationBlocked: true,
      })
      continue
    }

    const signature = buildSignature(pageAccess)
    const key = groupKey(audience, signature)

    const combination = combinations.get(key) ?? {
      audience,
      signature,
      pageAccess,
      userIds: [],
      issues: [],
    }

    combination.userIds.push(user.id)
    combination.issues.push(...reading.issues)

    combinations.set(key, combination)
  }

  administrators.userCount = administrators.userIds.length
  administrators.issues = sortIssues(administrators.issues)

  // Redundante com a varredura em ordem de id, e mantido assim mesmo: a ordem de
  // `unresolvedUsers` é garantia do resultado, não efeito colateral do laço.
  unresolvedUsers.sort((first, second) => compareText(first.userId, second.userId))

  const groups = [...combinations.values()]
    .sort(compareCombinations)
    .map((combination, index) => {
      const position = index + 1

      return {
        id: `grupo-provisorio-${position}`,
        name: `Grupo provisório ${position}`,
        audience: combination.audience,
        signature: combination.signature,
        pageAccess: combination.pageAccess,
        userIds: combination.userIds,
        userCount: combination.userIds.length,
        accessCount: combination.pageAccess.length,
        homePage: null,
        needsNameReview: true,
        needsHomePageDefinition: true,
        issues: sortIssues([...combination.issues, issue('home-page-undefined')]),
      }
    })

  return { analyzedUserCount: users.length, administrators, groups, unresolvedUsers }
}
