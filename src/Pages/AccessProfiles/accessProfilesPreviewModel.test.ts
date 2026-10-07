import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { EXECUTIVE_ACCESS_PROFILE_NAME } from '../../config/accessProfileCatalog'
import { biAreas, type BiArea, type BiAreaId } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import type { User } from '../../data/dashboardTypes'
import {
  INTELLIGENCE_PAGE_KEY,
  MODEL_PAGE_KEY,
  defaultDepartmentPageKeys,
  deriveUserAccess,
  type UserAccessConfig,
} from '../../lib/userAccessRules'
import type { AccessProfile } from '../../types/access'
import type { CoreProfileMenuTree } from '../../types/coreApi'
import {
  assignableProfiles,
  buildAccessProfilesPreviewModel,
  catalogFromProfileMenuTree,
  defaultSelectionKeysOf,
  describeAccessProfileDeletionImpact,
  describeDepartmentCoverage,
  describeDepartmentSelectionState,
  NON_DEFAULT_SELECTION_PAGE_KEYS,
  pageSelectionKey,
  selectionFromDepartments,
  summarizeCatalogSelection,
  withDepartmentDefaultPages,
  withoutAssignmentsTo,
  withoutDepartmentPages,
  type CatalogDepartment,
} from './accessProfilesPreviewModel'

/**
 * Testes do modelo de apresentação de Perfis de Acesso.
 *
 * Os perfis são entidades reais do domínio, montadas aqui como o repositório as
 * entrega, e os usuários são montados pela mesma regra que grava a base
 * (`deriveUserAccess`): o que está sendo verificado é a leitura do que o portal
 * realmente persiste, e não uma combinação inventada.
 *
 * Departamentos e páginas vêm do catálogo real, localizados em tempo de
 * execução: nenhuma contagem é escrita à mão aqui, do mesmo jeito que o modelo
 * não escreve nenhuma. O componente da página não é testado porque o projeto
 * não tem infraestrutura de teste de componente; toda a lógica que a tela
 * consome vive neste módulo, que é puro.
 */

/* -------------------------------------------------------------------------- */
/* Dados reais do catálogo                                                    */
/* -------------------------------------------------------------------------- */

function availablePageKeys(area: BiArea): string[] {
  return departmentPages[area.id].filter((page) => !page.disabled).map((page) => page.key)
}

/** Páginas que um perfil comum concede em um departamento: publicadas, sem o Modelo. */
function grantedPageKeys(area: BiArea): string[] {
  return availablePageKeys(area).filter((pageKey) => pageKey !== MODEL_PAGE_KEY)
}

function requireArea(description: string, matches: (area: BiArea) => boolean): BiArea {
  const area = biAreas.find(matches)
  if (!area) throw new Error(`Catálogo sem ${description}: o teste precisa de dados reais.`)

  return area
}

function requireKey(keys: readonly string[], index: number, description: string): string {
  const key = keys.at(index)
  if (key === undefined) {
    throw new Error(`Catálogo sem ${description}: o teste precisa de dados reais.`)
  }

  return key
}

const grantArea = requireArea(
  'departamento com página disponível',
  (area) => grantedPageKeys(area).length >= 1,
)
const grantPage = requireKey(grantedPageKeys(grantArea), 0, 'primeira página concedível')

const otherArea = requireArea(
  'segundo departamento com página disponível',
  (area) => area.id !== grantArea.id && grantedPageKeys(area).length >= 1,
)
const otherPage = requireKey(grantedPageKeys(otherArea), 0, 'página do segundo departamento')

/** Departamento com várias páginas disponíveis: permite cobertura parcial. */
const multiPageArea = requireArea(
  'departamento com duas ou mais páginas disponíveis',
  (area) => availablePageKeys(area).length >= 2,
)
const firstMultiPage = requireKey(
  availablePageKeys(multiPageArea),
  0,
  'primeira página do departamento com várias',
)
const secondMultiPage = requireKey(
  availablePageKeys(multiPageArea),
  1,
  'segunda página do departamento com várias',
)

/** Departamento cujo catálogo tem a página Modelo disponível. */
const modelArea = biAreas.find((area) => availablePageKeys(area).includes(MODEL_PAGE_KEY)) ?? null

const UNKNOWN_DEPARTMENT = 'departamento-que-nao-existe'
const UNKNOWN_PAGE = 'pagina-que-nao-existe'

/** Vocabulário recusado na composição aprovada da tela. */
const FORBIDDEN_TEXTS = [
  'Sugestão automática',
  'Aguardando revisão',
  'Migração',
  'migração',
  'Grupo provisório',
  'grupo provisório',
  'Perfil personalizado',
  'Ciclo do Cliente',
]

/**
 * Código dos módulos da tela, para as proibições valerem também sobre o texto
 * que a interface escreve, e não apenas sobre o que o modelo devolve. O próprio
 * teste fica de fora: é aqui que os termos recusados precisam estar escritos.
 */
function readModuleSources(): [string, string][] {
  const directory = dirname(fileURLToPath(import.meta.url))

  return readdirSync(directory)
    .filter((fileName) => /\.tsx?$/.test(fileName) && !fileName.endsWith('.test.ts'))
    .map((fileName) => [fileName, readFileSync(join(directory, fileName), 'utf8')])
}

/** Contagens do catálogo, apuradas aqui de forma independente do modelo. */
const catalogAvailablePageCount = biAreas.reduce(
  (total, area) => total + availablePageKeys(area).length,
  0,
)
const catalogPageCount = biAreas.reduce(
  (total, area) => total + departmentPages[area.id].length,
  0,
)

/* -------------------------------------------------------------------------- */
/* Montagem dos perfis                                                        */
/* -------------------------------------------------------------------------- */

function buildStandardProfile(overrides: Partial<AccessProfile> = {}): AccessProfile {
  return {
    id: 'acp-001',
    name: 'Perfil de Teste',
    lifecycle: 'active',
    departmentPageAccess: [{ departmentId: grantArea.id, pageKeys: [grantPage] }],
    homePage: { departmentId: grantArea.id, pageKey: grantPage },
    hasBeenUsed: false,
    ...overrides,
  }
}

/** Perfil de alcance máximo, com o nome do antigo `Acesso do Sistema`. */
function buildSystemProfile(): AccessProfile {
  return {
    id: 'acp-system',
    name: 'Acesso do Sistema',
    lifecycle: 'active',
    departmentPageAccess: biAreas.map((area) => ({
      departmentId: area.id,
      pageKeys: availablePageKeys(area),
    })),
    homePage: { departmentId: grantArea.id, pageKey: grantPage },
    hasBeenUsed: true,
  }
}

/** Perfil de um único departamento, com as páginas que um perfil comum concede. */
function buildDepartmentProfile(area: BiArea, overrides: Partial<AccessProfile> = {}) {
  return buildStandardProfile({
    id: `acp-${area.id}`,
    name: area.label,
    departmentPageAccess: [{ departmentId: area.id, pageKeys: grantedPageKeys(area) }],
    homePage: { departmentId: area.id, pageKey: requireKey(grantedPageKeys(area), 0, area.label) },
    ...overrides,
  })
}

/** Perfil executivo padrão: páginas concedíveis de todos os departamentos. */
function buildExecutiveProfile(overrides: Partial<AccessProfile> = {}) {
  return buildStandardProfile({
    id: 'acp-executivo',
    name: EXECUTIVE_ACCESS_PROFILE_NAME,
    departmentPageAccess: biAreas.map((area) => ({
      departmentId: area.id,
      pageKeys: grantedPageKeys(area),
    })),
    homePage: { departmentId: grantArea.id, pageKey: grantPage },
    ...overrides,
  })
}

/* -------------------------------------------------------------------------- */
/* Montagem dos usuários                                                      */
/* -------------------------------------------------------------------------- */

function buildUser(access: UserAccessConfig, overrides: Partial<User> = {}): User {
  const derived = deriveUserAccess(access)
  if (!derived) throw new Error('Configuração de acesso inválida no teste')

  return {
    id: 'usr-001',
    name: 'Usuária de Teste',
    email: 'teste@impactotelecom.com',
    ...derived,
    status: 'Ativo',
    lastAccess: 'Nunca acessou',
    initials: 'UT',
    ...overrides,
  }
}

/**
 * Ids dos perfis montados acima, para os usuários apontarem para eles.
 *
 * A associação entre usuário e perfil é o VÍNCULO GRAVADO, então todo teste que
 * espera alguém dentro de um perfil precisa gravar o id dele no usuário. Escrever
 * o id à mão em cada teste faria a asserção depender de uma string repetida.
 */
const SYSTEM_PROFILE_ID = 'acp-system'

function departmentProfileId(area: BiArea): string {
  return `acp-${area.id}`
}

/** Vínculo do usuário com um Perfil de Acesso, como override de `buildUser`. */
function linkedTo(profileId: string | null): Partial<User> {
  return { accessProfileId: profileId }
}

/** Analista com as páginas padrão de cada departamento informado. */
function analystUser(departmentIds: readonly BiAreaId[], overrides: Partial<User> = {}): User {
  return buildUser(
    {
      profile: 'Analista',
      departments: departmentIds.map((departmentId) => ({
        departmentId,
        pageKeys: defaultDepartmentPageKeys(departmentId),
      })),
    },
    overrides,
  )
}

/** Troca as páginas de um departamento já concedido, preservando o restante. */
function withPageKeys(user: User, departmentId: string, pageKeys: string[]): User {
  return {
    ...user,
    departmentPageAccess: user.departmentPageAccess.map((access) =>
      access.departmentId === departmentId ? { ...access, pageKeys } : access,
    ),
  }
}

function build(profiles: readonly AccessProfile[], users: readonly User[] = []) {
  return buildAccessProfilesPreviewModel({ profiles, users })
}

/** Todos os destinos possíveis de um usuário, para provar que não há repetição. */
function destinationsOf(
  preview: ReturnType<typeof build>,
  userId: string,
): string[] {
  const destinations: string[] = []

  if (preview.systemProfile?.users.some((user) => user.id === userId)) {
    destinations.push(preview.systemProfile.name)
  }

  for (const profile of preview.profiles) {
    if (profile.users.some((user) => user.id === userId)) destinations.push(profile.name)
  }

  if (preview.unassignedUsers.some((user) => user.id === userId)) {
    destinations.push('Acessos atuais sem perfil')
  }

  return destinations
}

/* -------------------------------------------------------------------------- */
/* 1. Origem dos perfis                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Catálogo de formulário montado a partir do catálogo do portal.
 *
 * `buildCatalogDepartments` fazia isso na produção e foi removida junto com o
 * crivo que filtrava os menus do serviço. Os auxiliares de seleção
 * (`defaultSelectionKeysOf`, `withDepartmentDefaultPages`, …) não sabem de onde
 * a lista veio, e exercitá-los com os departamentos e as páginas REAIS do portal
 * continua sendo o dado mais honesto disponível — só que agora como um arranjo
 * do teste, e não como uma regra da tela.
 */
function catalogFromPortal(): CatalogDepartment[] {
  return biAreas.map((area) => ({
    departmentId: area.id,
    label: area.label,
    pages: departmentPages[area.id].map((page) => ({ pageKey: page.key, label: page.label })),
  }))
}


describe('origem dos perfis exibidos', () => {
  it('usa a identidade real de cada perfil recebido', () => {
    const profile = buildStandardProfile({
      id: 'acp-042',
      name: 'Operações Técnicas',
      description: 'Descrição gravada.',
    })

    const [described] = build([profile]).profiles

    expect(described.id).toBe('acp-042')
    expect(described.name).toBe('Operações Técnicas')
    expect(described.description).toBe('Descrição gravada.')
  })

  it('não separa mais nenhum perfil do resto da coleção', () => {
    // O perfil do SISTEMA saía para `systemProfile` e não entrava em `profiles`.
    // Não existe mais: toda linha de `access` é um perfil comum.
    const preview = build([buildSystemProfile(), buildDepartmentProfile(grantArea)])

    expect(preview.systemProfile).toBeNull()
    expect(preview.profiles.map((profile) => profile.name)).toEqual([
      'Acesso do Sistema',
      grantArea.label,
    ])
    expect(preview.profileCount).toBe(2)
  })

  it('preserva a ordem em que o repositório entregou os perfis', () => {
    const ordered = [
      buildSystemProfile(),
      buildExecutiveProfile(),
      buildDepartmentProfile(otherArea),
      buildDepartmentProfile(grantArea),
    ]

    expect(build(ordered).profiles.map((profile) => profile.name)).toEqual([
      'Acesso do Sistema',
      'Acesso Executivo',
      otherArea.label,
      grantArea.label,
    ])
  })

  it('não fabrica perfil a partir dos acessos de um usuário', () => {
    const preview = build([], [analystUser([grantArea.id, otherArea.id])])

    expect(preview.profiles).toEqual([])
    expect(preview.systemProfile).toBeNull()
    expect(preview.unassignedUsers).toHaveLength(1)
  })

  it('não usa o prefixo antigo no nome de um perfil departamental', () => {
    const preview = build([buildDepartmentProfile(grantArea)])

    expect(preview.profiles[0].name).toBe(grantArea.label)
    expect(preview.profiles[0].name).not.toBe(`Acesso ${grantArea.label}`)
  })

  it('não apresenta a Visão Geral Executiva como acesso de nenhum perfil', () => {
    // Ela aparecia nos perfis cujo destino não era Analistas. Saiu: quem a abre
    // é decidido pelo Perfil do Sistema da pessoa, e nunca pelo Perfil de Acesso.
    const preview = build([
      buildSystemProfile(),
      buildExecutiveProfile(),
      buildDepartmentProfile(grantArea),
    ])

    const labels = preview.profiles.flatMap((profile) =>
      profile.departments.map((department) => department.label),
    )

    expect(labels).not.toContain('Visão Geral Executiva')
  })
})

/* -------------------------------------------------------------------------- */
/* 2. Vínculo persistente dos usuários                                       */
/* -------------------------------------------------------------------------- */

describe('vínculo persistente dos usuários', () => {
  it('coloca no perfil apontado os Administradores que têm esse vínculo gravado', () => {
    const preview = build(
      [buildSystemProfile(), buildDepartmentProfile(grantArea)],
      [
        buildUser(
          { profile: 'Administrador' },
          { id: 'usr-001', accessProfileId: 'acp-system' },
        ),
        withPageKeys(
          buildUser(
            { profile: 'Administrador' },
            { id: 'usr-002', accessProfileId: 'acp-system' },
          ),
          grantArea.id,
          [grantPage],
        ),
      ],
    )

    // O perfil de nome `Acesso do Sistema` é o primeiro da coleção recebida, e
    // deixou de ser separado em `systemProfile`.
    expect(preview.profiles[0].users.map((user) => user.id)).toEqual(['usr-001', 'usr-002'])
    expect(preview.unassignedUsers).toEqual([])
  })

  it('coloca um Analista no perfil apontado pelo id gravado', () => {
    const preview = build(
      [buildDepartmentProfile(grantArea)],
      [analystUser([grantArea.id], { id: 'usr-001', accessProfileId: `acp-${grantArea.id}` })],
    )

    expect(preview.profiles[0].users.map((user) => user.id)).toEqual(['usr-001'])
    expect(preview.matchedUserCount).toBe(1)
    expect(preview.unassignedUsers).toEqual([])
  })

  it('coloca um Executivo no perfil executivo apontado pelo id gravado', () => {
    const preview = build(
      [buildExecutiveProfile()],
      [
        buildUser(
          { profile: 'Executivo' },
          { id: 'usr-001', accessProfileId: 'acp-executivo' },
        ),
      ],
    )

    expect(preview.profiles[0].users.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('corresponde a qualquer perfil apontado pelo vínculo, seja qual for o usuário', () => {
    // Este caso não correspondia: o perfil era destinado a Executivos e o
    // usuário era Analista. O destino acabou, e o vínculo gravado basta.
    const twin = buildDepartmentProfile(grantArea, {
      id: 'acp-900',
      name: 'Perfil de mesmo alcance',
    })

    const preview = build(
      [twin],
      [analystUser([grantArea.id], { id: 'usr-001', accessProfileId: 'acp-900' })],
    )

    expect(preview.profiles[0].users.map((user) => user.id)).toEqual(['usr-001'])
    expect(preview.unassignedUsers).toEqual([])
  })

  it('não adivinha um vínculo quando dois perfis compatíveis descrevem o mesmo acesso', () => {
    const preview = build(
      [
        buildDepartmentProfile(grantArea),
        buildDepartmentProfile(grantArea, { id: 'acp-002', name: 'Cópia do mesmo alcance' }),
      ],
      [analystUser([grantArea.id], { id: 'usr-001' })],
    )

    for (const profile of preview.profiles) expect(profile.users).toEqual([])
    expect(preview.unassignedUsers.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('não fabrica um vínculo quando o id não foi gravado', () => {
    const preview = build(
      [buildDepartmentProfile(grantArea)],
      [analystUser([grantArea.id, otherArea.id], { id: 'usr-001' })],
    )

    expect(preview.profiles[0].users).toEqual([])
    expect(preview.unassignedUsers.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('faz o Analista corresponder ao perfil do próprio departamento', () => {
    // O usuário recebe as páginas padrão do departamento, que são o catálogo
    // inteiro menos o Modelo, e é exatamente o que o perfil real concede.
    const user = analystUser([multiPageArea.id], {
      id: 'usr-001',
      accessProfileId: `acp-${multiPageArea.id}`,
    })

    expect(user.departmentPageAccess[0].pageKeys).toEqual(
      defaultDepartmentPageKeys(multiPageArea.id),
    )

    const preview = build([buildDepartmentProfile(multiPageArea)], [user])

    expect(preview.profiles[0].users.map((item) => item.id)).toEqual(['usr-001'])
  })

  it('respeita a página Modelo: quem a tem não corresponde a um perfil sem ela', () => {
    if (!modelArea) return

    const user = withPageKeys(analystUser([modelArea.id], { id: 'usr-001' }), modelArea.id, [
      ...defaultDepartmentPageKeys(modelArea.id),
      MODEL_PAGE_KEY,
    ])

    const preview = build([buildDepartmentProfile(modelArea)], [user])

    expect(preview.profiles[0].users).toEqual([])
    expect(preview.unassignedUsers.map((item) => item.id)).toEqual(['usr-001'])
  })

  it('não corresponde por nome nem por rótulo', () => {
    // Nome idêntico ao do departamento, alcance diferente: nada corresponde.
    const wrongScope = buildStandardProfile({
      name: grantArea.label,
      departmentPageAccess: [{ departmentId: otherArea.id, pageKeys: [otherPage] }],
      homePage: { departmentId: otherArea.id, pageKey: otherPage },
    })

    const preview = build([wrongScope], [analystUser([grantArea.id], { id: 'usr-001' })])

    expect(preview.profiles[0].users).toEqual([])
    expect(preview.unassignedUsers.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('coloca cada usuário em um único destino', () => {
    const users = [
      buildUser(
        { profile: 'Administrador' },
        { id: 'usr-001', accessProfileId: 'acp-system' },
      ),
      buildUser(
        { profile: 'Executivo' },
        { id: 'usr-002', accessProfileId: 'acp-executivo' },
      ),
      analystUser([grantArea.id], {
        id: 'usr-003',
        accessProfileId: `acp-${grantArea.id}`,
      }),
      analystUser([grantArea.id, otherArea.id], { id: 'usr-004' }),
    ]

    const preview = build(
      [buildSystemProfile(), buildExecutiveProfile(), buildDepartmentProfile(grantArea)],
      users,
    )

    for (const user of users) {
      expect(destinationsOf(preview, user.id)).toHaveLength(1)
    }

    expect(
      (preview.systemProfile?.userCount ?? 0) +
        preview.matchedUserCount +
        preview.unassignedUserCount,
    ).toBe(users.length)
  })

  it('não oferece Administradores para vínculo a um perfil comum', () => {
    const preview = build(
      [buildSystemProfile(), buildDepartmentProfile(grantArea)],
      [
        buildUser(
          { profile: 'Administrador' },
          { id: 'usr-001', accessProfileId: 'acp-system' },
        ),
        analystUser([grantArea.id], {
          id: 'usr-002',
          accessProfileId: `acp-${grantArea.id}`,
        }),
      ],
    )

    expect(preview.assignableUsers.map((user) => user.id)).toEqual(['usr-002'])
  })

  it('não altera as coleções recebidas', () => {
    const profiles = [buildSystemProfile(), buildDepartmentProfile(grantArea)]
    const users = [
      buildUser({ profile: 'Administrador' }, { id: 'usr-001' }),
      analystUser([grantArea.id], { id: 'usr-002' }),
    ]

    const profilesSnapshot = structuredClone(profiles)
    const usersSnapshot = structuredClone(users)

    build(profiles, users)

    expect(profiles).toEqual(profilesSnapshot)
    expect(users).toEqual(usersSnapshot)
  })

  it('devolve cópias dos usuários, e não as entradas gravadas', () => {
    const user = analystUser([grantArea.id], {
      id: 'usr-001',
      accessProfileId: `acp-${grantArea.id}`,
    })
    const preview = build([buildDepartmentProfile(grantArea)], [user])

    expect(preview.profiles[0].users[0]).not.toBe(user)
    expect(preview.profiles[0].users[0]).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      initials: user.initials,
      profile: user.profile,
      status: user.status,
    })
  })

  it('não quebra com acesso fora de forma', () => {
    const preview = build(
      [buildDepartmentProfile(grantArea)],
      [
        analystUser([grantArea.id], {
          id: 'usr-001',
          departmentPageAccess: null as unknown as User['departmentPageAccess'],
        }),
      ],
    )

    expect(preview.unassignedUsers.map((user) => user.id)).toEqual(['usr-001'])
  })
})

/* -------------------------------------------------------------------------- */
/* 3. Cobertura dos chips                                                     */
/* -------------------------------------------------------------------------- */

describe('cobertura de cada departamento', () => {
  it('conta as páginas disponíveis concedidas sobre o total disponível', () => {
    const total = availablePageKeys(multiPageArea).length
    const granted = availablePageKeys(multiPageArea).slice(0, 1)

    const coverage = describeDepartmentCoverage(multiPageArea, new Set(granted))

    expect(coverage.granted).toBe(1)
    expect(coverage.total).toBe(total)
    expect(coverage.fraction).toBe(`1/${total}`)
    expect(coverage.percent).toBeCloseTo((1 / total) * 100)
  })

  it('preenche 100% quando o perfil libera todas as disponíveis', () => {
    const coverage = describeDepartmentCoverage(
      multiPageArea,
      new Set(availablePageKeys(multiPageArea)),
    )

    expect(coverage.granted).toBe(coverage.total)
    expect(coverage.percent).toBe(100)
  })

  it('preenche 0% quando o perfil não libera nenhuma disponível', () => {
    const coverage = describeDepartmentCoverage(multiPageArea, new Set([UNKNOWN_PAGE]))

    expect(coverage.granted).toBe(0)
    expect(coverage.percent).toBe(0)
    expect(coverage.fraction).toBe(`0/${availablePageKeys(multiPageArea).length}`)
  })

  it('usa o catálogo completo do departamento como denominador', () => {
    const coverage = describeDepartmentCoverage(
      multiPageArea,
      new Set(availablePageKeys(multiPageArea)),
    )

    expect(coverage.total).toBe(departmentPages[multiPageArea.id].length)
    expect(coverage.granted).toBe(coverage.total)
    expect(coverage.percent).toBe(100)
  })

  it('desconta apenas a página que o perfil não concede, como o Modelo', () => {
    const coverage = describeDepartmentCoverage(
      multiPageArea,
      new Set(grantedPageKeys(multiPageArea)),
    )
    const total = departmentPages[multiPageArea.id].length
    const hasModel = departmentPages[multiPageArea.id].some((page) => page.key === MODEL_PAGE_KEY)

    expect(coverage.total).toBe(total)
    expect(coverage.fraction).toBe(`${hasModel ? total - 1 : total}/${total}`)
  })

  it('ignora chave de página que o catálogo não reconhece', () => {
    const coverage = describeDepartmentCoverage(grantArea, new Set([grantPage, UNKNOWN_PAGE]))

    expect(coverage.granted).toBe(1)
  })

  it('mostra 0/0 sem gerar NaN quando o departamento não tem página publicada', () => {
    const emptyArea: BiArea = {
      id: 'departamento-sem-pagina' as BiAreaId,
      label: 'Departamento sem página',
      overviewPath: '/',
      requiredPermission: null,
      matchesPath: () => false,
    }

    const coverage = describeDepartmentCoverage(emptyArea, new Set([grantPage]))

    expect(coverage.fraction).toBe('0/0')
    expect(coverage.percent).toBe(0)
    expect(Number.isFinite(coverage.percent)).toBe(true)
    expect(coverage.accessibleLabel).toBe(
      'Departamento sem página: nenhuma página disponível no departamento',
    )
  })

  it('escreve o nome acessível com o departamento e a fração', () => {
    const total = availablePageKeys(multiPageArea).length
    const coverage = describeDepartmentCoverage(
      multiPageArea,
      new Set(availablePageKeys(multiPageArea)),
    )

    expect(coverage.accessibleLabel).toBe(
      `${multiPageArea.label}: ${total} de ${total} páginas disponíveis liberadas`,
    )
  })

  it('nunca ultrapassa 100% nem fica abaixo de 0%', () => {
    const preview = build([
      buildSystemProfile(),
      buildExecutiveProfile(),
      buildDepartmentProfile(grantArea),
    ])

    const coverages = [preview.systemProfile, ...preview.profiles].flatMap(
      (profile) => profile?.departments.map((department) => department.coverage) ?? [],
    )

    expect(coverages.length).toBeGreaterThan(0)

    for (const coverage of coverages) {
      expect(coverage.percent).toBeGreaterThanOrEqual(0)
      expect(coverage.percent).toBeLessThanOrEqual(100)
      expect(Number.isFinite(coverage.percent)).toBe(true)
      expect(coverage.granted).toBeLessThanOrEqual(coverage.total)
    }
  })

  it('acompanha cada departamento concedido, na ordem do catálogo', () => {
    const preview = build([buildExecutiveProfile()])

    expect(preview.profiles[0].departments.map((department) => department.departmentId)).toEqual(
      biAreas.map((area) => area.id),
    )
  })

  it('não conta duas vezes a mesma página gravada em duplicata', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [{ departmentId: grantArea.id, pageKeys: [grantPage, grantPage] }],
    })

    expect(build([profile]).profiles[0].departments[0].coverage.granted).toBe(1)
  })

  it('descreve o departamento fora do catálogo, depois dos conhecidos', () => {
    // Ele era DESCARTADO. A concessão sumia do card e, pior, da seleção com que
    // o formulário reabria: reeditar o perfil apagava em silêncio o acesso a um
    // item de menu que o portal não tem como página.
    const profile = buildStandardProfile({
      departmentPageAccess: [
        { departmentId: UNKNOWN_DEPARTMENT, pageKeys: ['overview'] },
        { departmentId: grantArea.id, pageKeys: [grantPage] },
      ],
    })

    const [described] = build([profile]).profiles

    expect(described.departments.map((item) => item.departmentId)).toEqual([
      grantArea.id,
      UNKNOWN_DEPARTMENT,
    ])

    const unknown = described.departments[1]

    // Rótulo é a própria chave: não há texto do portal a exibir.
    expect(unknown.label).toBe(UNKNOWN_DEPARTMENT)
    expect(unknown.pages.map((page) => page.pageKey)).toEqual(['overview'])
    expect(unknown.coverage.fraction).toBe('1/1')
  })

  it('preserva a página concedida que o catálogo do departamento não nomeia', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [
        { departmentId: grantArea.id, pageKeys: [grantPage, 'pagina-que-o-front-nao-tem'] },
      ],
    })

    const [department] = build([profile]).profiles[0].departments

    expect(department.pages.map((page) => page.pageKey)).toEqual([
      grantPage,
      'pagina-que-o-front-nao-tem',
    ])
    // A cobertura continua sendo só sobre o catálogo: uma chave que não abre
    // página nenhuma não entra nem no numerador nem no denominador.
    expect(department.coverage.granted).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/* 4. Páginas do drawer                                                       */
/* -------------------------------------------------------------------------- */

describe('páginas de cada departamento', () => {
  it('conta como disponíveis as páginas concedidas, sem nenhuma em desenvolvimento', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [
        { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, secondMultiPage] },
      ],
    })

    const department = build([profile]).profiles[0].departments[0]

    expect(department.pageTotals).toEqual({ available: 2, inDevelopment: 0 })
    expect(department.pages.every((page) => !page.inDevelopment)).toBe(true)
  })

  it('usa o rótulo do catálogo e a ordem do catálogo', () => {
    const reversed = [...availablePageKeys(multiPageArea)].reverse()
    const profile = buildStandardProfile({
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: reversed }],
    })

    const department = build([profile]).profiles[0].departments[0]

    expect(department.pages.map((page) => page.pageKey)).toEqual(availablePageKeys(multiPageArea))
    expect(department.pages[0].label).toBe(
      departmentPages[multiPageArea.id].find((page) => page.key === department.pages[0].pageKey)
        ?.label,
    )
  })

  it('um perfil de alcance máximo cobre o catálogo inteiro, apurado do próprio catálogo', () => {
    const [described] = build([buildSystemProfile()]).profiles

    expect(described.departmentCount).toBe(biAreas.length)
    expect(described.pageTotals.available).toBe(catalogAvailablePageCount)
    expect(described.pageTotals.inDevelopment).toBe(0)
  })

  it('cobre o catálogo inteiro do portal, um departamento por área', () => {
    const catalog = catalogFromPortal()

    const pages = catalog.reduce((total, item) => total + item.pages.length, 0)

    expect(pages).toBe(catalogAvailablePageCount)
    expect(pages).toBe(catalogPageCount)
    expect(catalog).toHaveLength(biAreas.length)
    expect(catalog.map((department) => department.label)).not.toContain('Visão Geral Executiva')
  })

  it('oferece todas as páginas de cada departamento do catálogo', () => {
    const catalog = catalogFromPortal()

    for (const area of biAreas) {
      const department = catalog.find((item) => item.departmentId === area.id)

      expect(department?.pages.map((page) => page.pageKey)).toEqual(
        departmentPages[area.id].map((page) => page.key),
      )
    }
  })

  it('leva a seleção inicial do formulário do que o perfil concede hoje', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [
        { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, secondMultiPage] },
      ],
    })

    const selection = selectionFromDepartments(build([profile]).profiles[0].departments)

    expect(selection.has(pageSelectionKey(multiPageArea.id, firstMultiPage))).toBe(true)
    expect(selection.has(pageSelectionKey(multiPageArea.id, secondMultiPage))).toBe(true)

    const summary = summarizeCatalogSelection(catalogFromPortal(), selection)

    expect(summary.pageCount).toBe(2)
    expect(summary.departmentCount).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/* 5. Visão Geral Executiva                                                   */
/* -------------------------------------------------------------------------- */

/*
 * `Visão Geral Executiva` foi REMOVIDO desta tela.
 *
 * `CORPORATE_ACCESS_PATH` e `CORPORATE_ACCESS_LABEL` existiam aqui para
 * apresentá-la como um acesso que o perfil concedia por ser destinado a
 * Executivos. Ela nunca foi concedida por um Perfil de Acesso: quem a abre é
 * decidido pelo Perfil do Sistema da pessoa, em `lib/homeNavigation`, e é lá
 * que isso é testado.
 */

/* -------------------------------------------------------------------------- */
/* 6. Sem escrita                                                             */
/* -------------------------------------------------------------------------- */

describe('efeitos colaterais', () => {
  it('monta a tela sem nenhum armazenamento disponível', () => {
    // Sem `window` no ambiente do teste, qualquer leitura ou escrita em
    // localStorage lançaria: a montagem passar prova que o modelo não toca no
    // armazenamento nem no repositório.
    expect('window' in globalThis).toBe(false)

    const preview = build(
      [buildSystemProfile(), buildDepartmentProfile(grantArea)],
      [
        buildUser({ profile: 'Administrador' }, { id: 'usr-001', ...linkedTo(SYSTEM_PROFILE_ID) }),
        analystUser([grantArea.id], {
          id: 'usr-002',
          ...linkedTo(departmentProfileId(grantArea)),
        }),
      ],
    )

    expect(preview.profiles[0].userCount).toBe(1)
    expect(preview.profiles[1].userCount).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/* 7. Composição aprovada                                                     */
/* -------------------------------------------------------------------------- */

describe('composição da tela', () => {
  it('não modela a página de entrada em nenhuma estrutura que a tela consome', () => {
    const preview = build(
      [buildSystemProfile(), buildDepartmentProfile(grantArea)],
      [analystUser([grantArea.id], { id: 'usr-001' })],
    )

    const serialized = JSON.stringify({ preview, catalog: catalogFromPortal() })

    expect(serialized).not.toContain('homePage')
    expect(serialized).not.toContain('agina inicial')
  })

  it('não expõe textos proibidos pela composição aprovada', () => {
    const preview = build(
      [buildSystemProfile(), buildExecutiveProfile(), buildDepartmentProfile(grantArea)],
      [
        buildUser({ profile: 'Administrador' }, { id: 'usr-001' }),
        buildUser({ profile: 'Executivo' }, { id: 'usr-002' }),
        analystUser([grantArea.id], { id: 'usr-003' }),
        analystUser([grantArea.id, otherArea.id], { id: 'usr-004' }),
      ],
    )

    const serialized = JSON.stringify(preview)

    for (const forbidden of FORBIDDEN_TEXTS) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it('nenhum componente cita a página de entrada nem os textos proibidos', () => {
    for (const [fileName, source] of readModuleSources()) {
      expect(source, `${fileName} cita a página de entrada`).not.toContain('homePage')
      expect(source, `${fileName} cita a página de entrada`).not.toContain('agina inicial')

      for (const forbidden of FORBIDDEN_TEXTS) {
        expect(source, `${fileName} usa "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('nenhum componente compõe nome de perfil com o prefixo antigo', () => {
    for (const [fileName, source] of readModuleSources()) {
      expect(source, `${fileName} compõe nome de perfil`).not.toContain('`Acesso ${')
    }
  })
})

/* -------------------------------------------------------------------------- */
/* 8. Coleção única exibida pela página                                       */
/* -------------------------------------------------------------------------- */

describe('coleção única exibida pela página', () => {
  it('não promove nenhum perfil à primeira posição', () => {
    // O perfil do sistema abria a coleção, onde quer que o repositório o
    // entregasse. Não abre mais: a ordem é só a do serviço.
    const preview = build([
      buildDepartmentProfile(grantArea),
      buildExecutiveProfile(),
      buildSystemProfile(),
    ])

    expect(preview.orderedProfiles.map((profile) => profile.name)).toEqual([
      grantArea.label,
      'Acesso Executivo',
      'Acesso do Sistema',
    ])
  })

  it('mantém os perfis na ordem em que o repositório os entregou', () => {
    const preview = build([
      buildSystemProfile(),
      buildExecutiveProfile(),
      buildDepartmentProfile(grantArea),
      buildDepartmentProfile(otherArea),
    ])

    expect(preview.orderedProfiles.map((profile) => profile.name)).toEqual([
      'Acesso do Sistema',
      'Acesso Executivo',
      grantArea.label,
      otherArea.label,
    ])
  })

  it('nunca separa um perfil do sistema, porque ele não existe mais', () => {
    const preview = build([buildDepartmentProfile(grantArea)])

    expect(preview.orderedProfiles).toHaveLength(1)
    expect(preview.systemProfile).toBeNull()
  })

  it('conta todos os perfis no mesmo total', () => {
    // `profileCount` contava os comuns e `totalProfileCount` somava o do
    // sistema. Os dois passaram a ser o mesmo número: não há o que separar.
    const preview = build([
      buildSystemProfile(),
      buildExecutiveProfile(),
      buildDepartmentProfile(grantArea),
    ])

    expect(preview.profileCount).toBe(3)
    expect(preview.totalProfileCount).toBe(3)
    expect(preview.totalProfileCount).toBe(preview.orderedProfiles.length)
  })

  it('mantém total e coleção coerentes sem o perfil do sistema', () => {
    const preview = build([buildDepartmentProfile(grantArea)])

    expect(preview.totalProfileCount).toBe(1)
    expect(preview.profileCount).toBe(1)
  })

  it('devolve coleção vazia sem nenhum perfil', () => {
    const preview = build([])

    expect(preview.orderedProfiles).toEqual([])
    expect(preview.totalProfileCount).toBe(0)
  })

  it('não duplica um perfil entre a coleção ordenada e os comuns', () => {
    const preview = build([buildSystemProfile(), buildDepartmentProfile(grantArea)])

    const ids = preview.orderedProfiles.map((profile) => profile.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

/* -------------------------------------------------------------------------- */
/* 9. Perfil do Sistema de destino                                            */
/* -------------------------------------------------------------------------- */

/*
 * `Perfil do Sistema de destino` foi REMOVIDO: `audienceLabel` e
 * `audienceProfile` saíram de `PreviewProfile` junto com o destino do perfil.
 */

/* -------------------------------------------------------------------------- */
/* 10. Páginas do catálogo por departamento                                   */
/* -------------------------------------------------------------------------- */

describe('páginas do catálogo em cada departamento concedido', () => {
  it('traz todas as páginas do departamento, e não apenas as concedidas', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }],
    })

    const [department] = build([profile]).profiles[0].departments

    expect(department.catalogPages).toHaveLength(departmentPages[multiPageArea.id].length)
  })

  it('mantém a ordem oficial do catálogo', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [secondMultiPage] }],
    })

    const [department] = build([profile]).profiles[0].departments

    expect(department.catalogPages.map((page) => page.pageKey)).toEqual(
      departmentPages[multiPageArea.id].map((page) => page.key),
    )
  })

  it('marca como concedida somente a página que o perfil libera', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }],
    })

    const [department] = build([profile]).profiles[0].departments

    const granted = department.catalogPages.filter((page) => page.granted)

    expect(granted.map((page) => page.pageKey)).toEqual([firstMultiPage])
  })

  it('marca o estado de desenvolvimento com o mesmo valor do catálogo', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }],
    })

    const [department] = build([profile]).profiles[0].departments

    for (const page of department.catalogPages) {
      const catalogPage = departmentPages[multiPageArea.id].find(
        (item) => item.key === page.pageKey,
      )

      expect(page.inDevelopment).toBe(catalogPage?.disabled)
    }
  })

  it('concorda com a lista de páginas concedidas', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [
        { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, secondMultiPage] },
      ],
    })

    const [department] = build([profile]).profiles[0].departments

    expect(department.catalogPages.filter((page) => page.granted).map((page) => page.pageKey)).toEqual(
      department.pages.map((page) => page.pageKey),
    )
  })

  it('usa os rótulos oficiais do catálogo', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }],
    })

    const [department] = build([profile]).profiles[0].departments

    for (const page of department.catalogPages) {
      const catalogPage = departmentPages[multiPageArea.id].find(
        (item) => item.key === page.pageKey,
      )

      expect(page.label).toBe(catalogPage?.label)
    }
  })

  it('uma página não concedida e disponível é o que o detalhamento chama de não liberada', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }],
    })

    const [department] = build([profile]).profiles[0].departments

    const denied = department.catalogPages.filter((page) => !page.granted && !page.inDevelopment)

    expect(denied.some((page) => page.pageKey === secondMultiPage)).toBe(true)
    expect(denied.every((page) => page.granted === false)).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* 11. Iniciais dos usuários                                                  */
/* -------------------------------------------------------------------------- */

describe('iniciais dos usuários', () => {
  it('usa as iniciais gravadas no usuário, e não um cálculo pelo nome', () => {
    const user = analystUser([grantArea.id], {
      id: 'usr-001',
      name: 'Joelma Maria da Cruz',
      initials: 'ZZ',
      accessProfileId: `acp-${grantArea.id}`,
    })

    const preview = build([buildDepartmentProfile(grantArea)], [user])

    expect(preview.profiles[0].users[0].initials).toBe('ZZ')
  })

  it('leva as iniciais também para o usuário sem perfil correspondente', () => {
    const semPerfil = analystUser([grantArea.id, otherArea.id], {
      id: 'usr-002',
      name: 'Maria Angélica de Souza',
      initials: 'MS',
    })

    const preview = build([buildDepartmentProfile(grantArea)], [semPerfil])

    expect(preview.unassignedUsers).toHaveLength(1)
    expect(preview.unassignedUsers[0].initials).toBe('MS')
  })

  it('leva as iniciais do Administrador vinculado a um perfil', () => {
    const administrador = buildUser(
      { profile: 'Administrador' },
      { id: 'usr-003', initials: 'AD', accessProfileId: 'acp-system' },
    )

    const preview = build([buildSystemProfile()], [administrador])

    expect(preview.profiles[0].users[0].initials).toBe('AD')
  })

  it('preserva iniciais vazias em vez de inventar letras', () => {
    const user = analystUser([grantArea.id], {
      id: 'usr-004',
      initials: '',
      accessProfileId: `acp-${grantArea.id}`,
    })

    const preview = build([buildDepartmentProfile(grantArea)], [user])

    expect(preview.profiles[0].users[0].initials).toBe('')
  })
})

/* -------------------------------------------------------------------------- */
/* 12. Total de usuários correspondentes                                      */
/* -------------------------------------------------------------------------- */

describe('total de usuários correspondentes', () => {
  it('inclui os Administradores vinculados a um perfil', () => {
    const preview = build(
      [buildSystemProfile(), buildDepartmentProfile(grantArea)],
      [
        buildUser(
          { profile: 'Administrador' },
          { id: 'usr-001', accessProfileId: 'acp-system' },
        ),
        analystUser([grantArea.id], {
          id: 'usr-002',
          accessProfileId: `acp-${grantArea.id}`,
        }),
      ],
    )

    // `matchedUserCount` deixava de fora quem estava no perfil do sistema, e
    // `totalMatchedUserCount` somava os dois. Hoje são o mesmo número.
    expect(preview.matchedUserCount).toBe(2)
    expect(preview.totalMatchedUserCount).toBe(2)
  })

  it('conta usuários distintos, sem somar por perfil', () => {
    const preview = build(
      [buildSystemProfile(), buildDepartmentProfile(grantArea), buildDepartmentProfile(otherArea)],
      [
        buildUser(
          { profile: 'Administrador' },
          { id: 'usr-001', accessProfileId: 'acp-system' },
        ),
        buildUser(
          { profile: 'Administrador' },
          { id: 'usr-002', accessProfileId: 'acp-system' },
        ),
        analystUser([grantArea.id], {
          id: 'usr-003',
          accessProfileId: `acp-${grantArea.id}`,
        }),
        analystUser([otherArea.id], {
          id: 'usr-004',
          accessProfileId: `acp-${otherArea.id}`,
        }),
      ],
    )

    const somaPorPerfil = preview.orderedProfiles.reduce(
      (total, profile) => total + profile.userCount,
      0,
    )

    expect(preview.totalMatchedUserCount).toBe(4)
    expect(preview.totalMatchedUserCount).toBe(somaPorPerfil)
    expect(new Set(preview.orderedProfiles.flatMap((p) => p.users.map((u) => u.id))).size).toBe(4)
  })

  it('não conta quem ficou sem perfil correspondente', () => {
    const preview = build(
      [buildDepartmentProfile(grantArea)],
      [
        analystUser([grantArea.id], {
          id: 'usr-001',
          accessProfileId: `acp-${grantArea.id}`,
        }),
        analystUser([grantArea.id, otherArea.id], { id: 'usr-002' }),
      ],
    )

    expect(preview.totalMatchedUserCount).toBe(1)
    expect(preview.unassignedUserCount).toBe(1)
  })

  it('cada usuário entra em exatamente um dos dois totais', () => {
    const users = [
      buildUser({ profile: 'Administrador' }, { id: 'usr-001' }),
      analystUser([grantArea.id], { id: 'usr-002' }),
      analystUser([grantArea.id, otherArea.id], { id: 'usr-003' }),
    ]

    const preview = build([buildSystemProfile(), buildDepartmentProfile(grantArea)], users)

    expect(preview.totalMatchedUserCount + preview.unassignedUserCount).toBe(users.length)
  })

  it('devolve zero sem usuário nenhum', () => {
    const preview = build([buildSystemProfile(), buildDepartmentProfile(grantArea)], [])

    expect(preview.totalMatchedUserCount).toBe(0)
  })
})

/* -------------------------------------------------------------------------- */
/* 12. Usuários sem perfil de acesso definido                                 */
/* -------------------------------------------------------------------------- */

describe('usuários sem perfil de acesso definido', () => {
  it('carrega o e-mail gravado na coleção', () => {
    const preview = build(
      [buildDepartmentProfile(grantArea)],
      [
        analystUser([grantArea.id, otherArea.id], {
          id: 'usr-001',
          email: 'sem.perfil@impactotelecom.com',
        }),
      ],
    )

    expect(preview.unassignedUsers).toHaveLength(1)
    expect(preview.unassignedUsers[0].email).toBe('sem.perfil@impactotelecom.com')
  })

  it('mantém avatar, nome e Perfil do Sistema ao lado do e-mail', () => {
    const preview = build(
      [buildDepartmentProfile(grantArea)],
      [
        analystUser([grantArea.id, otherArea.id], {
          id: 'usr-001',
          name: 'Pessoa Sem Perfil',
          email: 'pessoa@impactotelecom.com',
          initials: 'PS',
        }),
      ],
    )

    expect(preview.unassignedUsers[0]).toEqual({
      id: 'usr-001',
      name: 'Pessoa Sem Perfil',
      email: 'pessoa@impactotelecom.com',
      initials: 'PS',
      profile: 'Analista',
    })
  })

  it('não descreve mais os departamentos acessados', () => {
    const preview = build(
      [buildDepartmentProfile(grantArea)],
      [analystUser([grantArea.id, otherArea.id], { id: 'usr-001' })],
    )

    expect(preview.unassignedUsers[0]).not.toHaveProperty('departmentLabels')
  })

  it('nenhum módulo da tela consome o contrato removido', () => {
    for (const [fileName, source] of readModuleSources()) {
      expect(`${fileName}: ${source.includes('departmentLabels')}`).toBe(`${fileName}: false`)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* 13. Compatibilidade entre destino e usuários                               */
/* -------------------------------------------------------------------------- */

/*
 * `usuários compatíveis com o destino` foi REMOVIDO junto com
 * `splitUsersByAudience`: ninguém é impedido de receber um perfil por causa do
 * Perfil do Sistema, então não há dois grupos a separar.
 */

/* -------------------------------------------------------------------------- */
/* 13. Destino definido pela seleção de usuários                              */
/* -------------------------------------------------------------------------- */

/*
 * `destino definido pela seleção de usuários` foi REMOVIDO junto com
 * `audienceFromSelectedUsers` e com a aba Usuários do formulário: a primeira
 * pessoa marcada decidia o destino do perfil, e não existe mais destino nem aba.
 */

/* -------------------------------------------------------------------------- */
/* 14. Limpeza das seleções do formulário                                     */
/* -------------------------------------------------------------------------- */

describe('limpeza das seleções incompatíveis', () => {
  const DRAFT = 'perfil-rascunho'

  it('devolve à situação original quem deixou de ser compatível', () => {
    const assignments = new Map<string, string | null>([
      ['usr-exec', DRAFT],
      ['usr-analista', DRAFT],
    ])

    const next = withoutAssignmentsTo(assignments, DRAFT, new Set(['usr-exec']))

    expect(next.get('usr-exec')).toBe(DRAFT)
    // Chave ausente, e não `null`: `null` transformaria a escolha desfeita em
    // "usuário sem perfil", que é uma decisão que ninguém tomou.
    expect(next.has('usr-analista')).toBe(false)
  })

  it('esvazia o rascunho quando nenhum usuário deve ficar', () => {
    const assignments = new Map<string, string | null>([
      ['usr-001', DRAFT],
      ['usr-002', DRAFT],
    ])

    expect([...withoutAssignmentsTo(assignments, DRAFT, new Set()).keys()]).toEqual([])
  })

  it('não toca em seleções de outros perfis', () => {
    const assignments = new Map<string, string | null>([
      ['usr-001', DRAFT],
      ['usr-002', 'acp-002'],
      ['usr-003', null],
    ])

    const next = withoutAssignmentsTo(assignments, DRAFT, new Set())

    expect(next.get('usr-002')).toBe('acp-002')
    expect(next.get('usr-003')).toBeNull()
    expect(next.has('usr-001')).toBe(false)
  })

  it('não altera o mapa recebido', () => {
    const assignments = new Map<string, string | null>([['usr-001', DRAFT]])

    withoutAssignmentsTo(assignments, DRAFT, new Set())

    expect(assignments.get('usr-001')).toBe(DRAFT)
  })

  it('o id do rascunho usado aqui é o mesmo do formulário', async () => {
    const { DRAFT_PROFILE_ID } = await import('./AccessProfileFormDialog')

    expect(DRAFT).toBe(DRAFT_PROFILE_ID)
  })
})

/* -------------------------------------------------------------------------- */
/* 15. Perfis oferecidos a um usuário sem Perfil de Acesso                    */
/* -------------------------------------------------------------------------- */

describe('perfis que um usuário sem perfil pode receber', () => {
  const analystProfile = buildDepartmentProfile(grantArea)
  const executiveProfile = buildExecutiveProfile()
  const inactiveProfile = buildDepartmentProfile(otherArea, {
    id: 'acp-inativo',
    name: 'Perfil desativado',
    lifecycle: 'inactive',
  })

  function described() {
    return build([buildSystemProfile(), analystProfile, executiveProfile, inactiveProfile])
  }

  it('oferece a coleção inteira, menos os perfis desativados', () => {
    // O recorte por Perfil do Sistema acabou: nenhum perfil declara mais a quem
    // serve, e a mesma lista vale para qualquer pessoa.
    const options = assignableProfiles(described().profiles)

    expect(options.map((profile) => profile.id)).toEqual([
      'acp-system',
      analystProfile.id,
      executiveProfile.id,
    ])
  })

  it('nunca oferece um perfil desativado', () => {
    const preview = described()

    expect(preview.profiles.some((profile) => profile.lifecycle === 'inactive')).toBe(true)
    expect(
      assignableProfiles(preview.profiles).some((profile) => profile.lifecycle !== 'active'),
    ).toBe(false)
  })

  it('preserva a ordem da coleção e não altera o que recebeu', () => {
    const profiles = described().profiles
    const snapshot = structuredClone(profiles)

    assignableProfiles(profiles)

    expect(profiles).toEqual(snapshot)
  })

  it('devolve lista vazia sem nenhum perfil', () => {
    expect(assignableProfiles(build([]).profiles)).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* 16. Seleção padrão de um departamento no formulário                        */
/* -------------------------------------------------------------------------- */

describe('seleção das páginas padrão de um departamento', () => {
  const catalog = catalogFromPortal()

  function requireDepartment(
    description: string,
    matches: (department: CatalogDepartment) => boolean,
  ): CatalogDepartment {
    const department = catalog.find(matches)
    if (!department) throw new Error(`Catálogo sem ${description}: o teste precisa de dados reais.`)

    return department
  }

  function hasPage(department: CatalogDepartment, pageKey: string): boolean {
    return department.pages.some((page) => page.pageKey === pageKey)
  }

  /** Departamento que tem as duas páginas de concessão intencional. */
  const department = requireDepartment(
    'departamento com Inteligência (IA) e Modelo Dimensional',
    (candidate) =>
      hasPage(candidate, INTELLIGENCE_PAGE_KEY) && hasPage(candidate, MODEL_PAGE_KEY),
  )
  const otherDepartment = requireDepartment(
    'segundo departamento com página',
    (candidate) =>
      candidate.departmentId !== department.departmentId && candidate.pages.length > 0,
  )

  function keyOf(target: CatalogDepartment, pageKey: string): string {
    return pageSelectionKey(target.departmentId, pageKey)
  }

  const intelligenceKey = keyOf(department, INTELLIGENCE_PAGE_KEY)
  const modelKey = keyOf(department, MODEL_PAGE_KEY)

  it('identifica as duas exceções pela chave técnica do catálogo', () => {
    expect([...NON_DEFAULT_SELECTION_PAGE_KEYS]).toEqual([INTELLIGENCE_PAGE_KEY, MODEL_PAGE_KEY])
  })

  it('marca todos os itens do departamento, exceto IA e Modelo', () => {
    const expected = department.pages
      .filter(
        (page) => page.pageKey !== INTELLIGENCE_PAGE_KEY && page.pageKey !== MODEL_PAGE_KEY,
      )
      .map((page) => keyOf(department, page.pageKey))

    expect(defaultSelectionKeysOf(department)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
  })

  it('deixa de fora apenas as duas exceções, em qualquer departamento', () => {
    // O filtro de página em desenvolvimento saiu daqui junto com o crivo do
    // catálogo: a aba Acessos lista itens de `profile_menu`, e `disabled` é
    // estado de uma página do portal, que a maioria desses itens não tem.
    for (const candidate of catalog) {
      expect(defaultSelectionKeysOf(candidate)).toEqual(
        candidate.pages
          .filter((page) => !NON_DEFAULT_SELECTION_PAGE_KEYS.includes(page.pageKey))
          .map((page) => keyOf(candidate, page.pageKey)),
      )
    }
  })

  it('a seleção padrão de todo departamento deixa IA e Modelo de fora', () => {
    for (const candidate of catalog) {
      const selection = withDepartmentDefaultPages(new Set<string>(), candidate)

      expect(selection.has(keyOf(candidate, INTELLIGENCE_PAGE_KEY))).toBe(false)
      expect(selection.has(keyOf(candidate, MODEL_PAGE_KEY))).toBe(false)
    }
  })

  it('acionar a seleção padrão entrega exatamente as páginas padrão', () => {
    const selection = withDepartmentDefaultPages(new Set<string>(), department)

    expect([...selection].sort()).toEqual([...defaultSelectionKeysOf(department)].sort())
  })

  it('preserva uma escolha manual de IA ou de Modelo', () => {
    const manual = new Set([intelligenceKey, modelKey])

    const selection = withDepartmentDefaultPages(manual, department)

    expect(selection.has(intelligenceKey)).toBe(true)
    expect(selection.has(modelKey)).toBe(true)
    for (const key of defaultSelectionKeysOf(department)) expect(selection.has(key)).toBe(true)
  })

  it('não toca nas páginas de outro departamento', () => {
    const otherKey = keyOf(
      otherDepartment,
      requireKey(
        otherDepartment.pages.map((page) => page.pageKey),
        0,
        'página do segundo departamento do catálogo',
      ),
    )

    const applied = withDepartmentDefaultPages(new Set([otherKey]), department)
    expect(applied.has(otherKey)).toBe(true)

    const cleared = withoutDepartmentPages(applied, department)
    expect(cleared.has(otherKey)).toBe(true)
    expect([...cleared]).toEqual([otherKey])
  })

  it('limpar o departamento retira também IA e Modelo escolhidos à mão', () => {
    const selection = withDepartmentDefaultPages(new Set([intelligenceKey, modelKey]), department)

    expect([...withoutDepartmentPages(selection, department)]).toEqual([])
  })

  it('não altera a seleção recebida', () => {
    const original = new Set([intelligenceKey])

    withDepartmentDefaultPages(original, department)
    withoutDepartmentPages(original, department)

    expect([...original]).toEqual([intelligenceKey])
  })

  it('descreve seleção vazia, parcial e completa', () => {
    const empty = new Set<string>()
    const complete = withDepartmentDefaultPages(empty, department)
    const defaults = defaultSelectionKeysOf(department)
    const partial = new Set([requireKey(defaults, 0, 'primeira página padrão')])

    expect(describeDepartmentSelectionState(department, empty)).toBe('empty')
    expect(describeDepartmentSelectionState(department, complete)).toBe('complete')
    expect(describeDepartmentSelectionState(department, partial)).toBe(
      defaults.length === 1 ? 'complete' : 'partial',
    )
  })

  it('trata IA marcada sozinha como seleção parcial, e não como vazia', () => {
    expect(describeDepartmentSelectionState(department, new Set([intelligenceKey]))).toBe('partial')
  })

  it('continua completa com IA e Modelo marcados junto com as padrão', () => {
    const selection = withDepartmentDefaultPages(new Set([intelligenceKey, modelKey]), department)

    expect(describeDepartmentSelectionState(department, selection)).toBe('complete')
  })

  it('ignora o estado de outro departamento', () => {
    const selection = withDepartmentDefaultPages(new Set<string>(), department)

    expect(describeDepartmentSelectionState(otherDepartment, selection)).toBe('empty')
  })

  /**
   * O atalho existe NOS DOIS MODOS, criação e edição, desde 21/09/2026.
   *
   * Ele já esteve restrito à criação, por receio de que um clique substituísse a
   * composição gravada de um perfil em uso. A restrição caiu: ajustar página por
   * página era lento demais, e nada do formulário é gravado antes do Salvar.
   *
   * A verificação é sobre o código do formulário porque o projeto não tem
   * infraestrutura de teste de componente, e é a mesma técnica que as demais
   * regras de composição desta tela já usam. Ela falha se alguém reintroduzir uma
   * condição de modo em volta do controle, que é a regressão a impedir.
   */
  it('o formulário oferece o atalho sem depender do modo', () => {
    const source = readModuleSources().find(([fileName]) =>
      fileName.endsWith('AccessProfileFormDialog.tsx'),
    )?.[1]

    if (source === undefined) throw new Error('Formulário de Perfil de Acesso não encontrado.')

    // Um único ponto de renderização, e nenhuma condição de modo em volta dele.
    expect(source.split('<DepartmentDefaultSelection')).toHaveLength(2)
    expect(source).not.toContain('canSelectDefaultPages')
    expect(source).not.toContain('isEditing ? null : (')
  })

  /**
   * O auxílio de seleção é do formulário, e só dele: a seleção inicial da edição
   * continua vindo do que o perfil concede hoje, IA e Modelo incluídos quando
   * estão gravados.
   */
  it('não interfere na seleção persistida que a edição carrega', () => {
    if (!modelArea) return

    const persisted = buildStandardProfile({
      departmentPageAccess: [
        { departmentId: modelArea.id, pageKeys: availablePageKeys(modelArea) },
      ],
    })
    const preview = build([persisted])
    const initial = selectionFromDepartments(preview.profiles[0].departments)

    expect(initial.has(pageSelectionKey(modelArea.id, MODEL_PAGE_KEY))).toBe(true)
    expect([...initial].sort()).toEqual(
      availablePageKeys(modelArea)
        .map((pageKey) => pageSelectionKey(modelArea.id, pageKey))
        .sort(),
    )
  })
})

describe('impacto da exclusão de um Perfil de Acesso', () => {
  it('usa a frase simples quando não há usuários vinculados', () => {
    expect(describeAccessProfileDeletionImpact(0)).toBe(
      'Este perfil não possui usuários vinculados.',
    )
  })

  it('usa a frase no singular para exatamente um usuário', () => {
    expect(describeAccessProfileDeletionImpact(1)).toBe(
      'Este perfil possui 1 usuário. Abra o Perfil de Acesso de destino e marque essa pessoa na aba Usuários: a transferência troca o vínculo sem deixar ninguém sem acesso. Com o perfil vazio, a exclusão é liberada.',
    )
  })

  it('usa a frase no plural a partir de dois usuários', () => {
    expect(describeAccessProfileDeletionImpact(2)).toBe(
      'Este perfil possui 2 usuários. Abra o Perfil de Acesso de destino e marque essas pessoas na aba Usuários: a transferência troca os vínculos de uma vez, sem deixar ninguém sem acesso. Com o perfil vazio, a exclusão é liberada.',
    )
    expect(describeAccessProfileDeletionImpact(7)).toBe(
      'Este perfil possui 7 usuários. Abra o Perfil de Acesso de destino e marque essas pessoas na aba Usuários: a transferência troca os vínculos de uma vez, sem deixar ninguém sem acesso. Com o perfil vazio, a exclusão é liberada.',
    )
  })

  it('só orienta a transferência quando existe alguém no perfil', () => {
    expect(describeAccessProfileDeletionImpact(0)).not.toContain('transferência')
    expect(describeAccessProfileDeletionImpact(1)).toContain('transferência')
  })
})

/**
 * Catálogo montado a partir dos menus do `impacto-bi-service`.
 *
 * O que está sendo protegido aqui é a fronteira: o serviço decide QUAIS itens
 * existem, em que ordem e com que nome, e o portal não filtra nem renomeia nada.
 *
 * O crivo do catálogo local foi REMOVIDO, e vários testes deste bloco afirmavam
 * exatamente ele — que um menu de chave desconhecida era descartado, e que um
 * menu pai sem filho reconhecido sumia junto. Eles continuam aqui, invertidos:
 * o comportamento que era garantido é agora o que não pode voltar.
 */
describe('catálogo vindo dos menus do serviço', () => {
  /** Menu no formato exato de `GET /profile-menus/tree`. */
  function menu(
    id: string,
    menuId: string,
    position: number,
    children: CoreProfileMenuTree[] = [],
  ): CoreProfileMenuTree {
    return {
      id,
      name: `nome gravado de ${menuId}`,
      position,
      menu_id: menuId,
      icon: null,
      profile_menu_id: null,
      created_at: '2026-09-23T00:00:00Z',
      updated_at: '2026-09-23T00:00:00Z',
      children,
    }
  }

  it('usa o nome gravado no serviço como rótulo, e não o do catálogo do portal', () => {
    // O rótulo vinha do portal, e a consequência era um item renomeado na aba
    // Menu Itens continuar aparecendo aqui com o nome antigo.
    const [departamento] = catalogFromProfileMenuTree([
      menu('uuid-os', 'os', 1, [menu('uuid-os-overview', 'overview', 1)]),
    ])

    expect(departamento.label).toBe('nome gravado de os')
    expect(departamento.pages[0].label).toBe('nome gravado de overview')
  })

  it('cai na própria chave quando o serviço gravou o nome em branco', () => {
    // Um nome vazio não é uma escolha de produto: é um registro incompleto, e
    // exibir uma linha sem texto esconderia o item em vez de nomeá-lo. O rótulo
    // de reserva é a chave, e não o do catálogo do portal: a chave pode não
    // corresponder a página nenhuma, e nesse caso não há rótulo local a usar.
    const semNome = (id: string, menuId: string, children: CoreProfileMenuTree[] = []) => ({
      ...menu(id, menuId, 1, children),
      name: '   ',
    })

    const [departamento] = catalogFromProfileMenuTree([
      semNome('uuid-os', 'os', [semNome('uuid-os-overview', 'os.overview')]),
    ])

    expect(departamento.label).toBe('os')
    expect(departamento.pages[0].label).toBe('os.overview')
  })

  it('respeita a ordem de position do serviço, e não a do catálogo local', () => {
    const catalogo = catalogFromProfileMenuTree([
      menu('uuid-comercial', 'comercial', 2, [menu('uuid-comercial-overview', 'overview', 1)]),
      menu('uuid-os', 'os', 1, [menu('uuid-os-overview', 'overview', 1)]),
    ])

    expect(catalogo.map((department) => department.departmentId)).toEqual(['os', 'comercial'])
  })

  it('lista o item cuja chave o portal não conhece, em vez de descartá-lo', () => {
    // Era o crivo: o menu pai de chave desconhecida e o submenu sem página
    // correspondente sumiam da aba Acessos, e o item cadastrado no serviço não
    // podia ser concedido a ninguém.
    const catalogo = catalogFromProfileMenuTree([
      menu('uuid-os', 'os', 1, [
        menu('uuid-os-overview', 'overview', 1),
        menu('uuid-os-novo', 'pagina-que-o-front-nao-tem', 2),
      ]),
      menu('uuid-outro', 'departamento-que-o-front-nao-tem', 2, [menu('uuid-x', 'overview', 1)]),
    ])

    expect(catalogo.map((department) => department.departmentId)).toEqual([
      'os',
      'departamento-que-o-front-nao-tem',
    ])
    expect(catalogo[0].pages.map((page) => page.pageKey)).toEqual([
      'overview',
      'pagina-que-o-front-nao-tem',
    ])
  })

  it('lista o menu pai mesmo sem nenhum submenu', () => {
    // Ele existe no serviço. Escondê-lo faria procurar na aba Acessos um item
    // recém-cadastrado em Menu Itens.
    const catalogo = catalogFromProfileMenuTree([menu('uuid-os', 'os', 1)])

    expect(catalogo).toHaveLength(1)
    expect(catalogo[0].pages).toEqual([])
  })

  it('devolve lista vazia quando o serviço ainda não publicou nenhum menu', () => {
    // É a única forma de a aba Acessos ficar sem nada a listar.
    expect(catalogFromProfileMenuTree([])).toEqual([])
  })

  it('tira o prefixo do pai da chave do submenu', () => {
    // É a forma que o serviço REALMENTE publica (`os.overview`), porque
    // `menu_id` é único na tabela inteira, e é a que `resolveMenuIds` espera
    // reencontrar na gravação.
    const catalogo = catalogFromProfileMenuTree([
      menu('uuid-os', 'os', 1, [
        menu('uuid-os-overview', 'os.overview', 1),
        menu('uuid-os-model', 'os.model', 2),
      ]),
    ])

    expect(catalogo).toHaveLength(1)
    expect(catalogo[0].departmentId).toBe('os')
    expect(catalogo[0].pages.map((page) => page.pageKey)).toEqual(['overview', 'model'])
  })

  it('só tira o prefixo do próprio pai, e preserva a chave quando ele é outro', () => {
    // `comercial.overview` pendurado em `os` não vira a Visão Geral de Ordens de
    // Serviço: a chave fica inteira, e é ela que a gravação usa para reencontrar
    // este mesmo menu.
    const catalogo = catalogFromProfileMenuTree([
      menu('uuid-os', 'os', 1, [menu('uuid-x', 'comercial.overview', 1)]),
    ])

    expect(catalogo[0].pages.map((page) => page.pageKey)).toEqual(['comercial.overview'])
  })
})
