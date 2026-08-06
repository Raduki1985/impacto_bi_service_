import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { EXECUTIVE_ACCESS_PROFILE_NAME } from '../../config/accessProfileCatalog'
import { biAreas, CORPORATE_OVERVIEW_PATH, type BiArea, type BiAreaId } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import type { User } from '../../data/dashboardTypes'
import {
  MODEL_PAGE_KEY,
  defaultDepartmentPageKeys,
  deriveUserAccess,
  type UserAccessConfig,
} from '../../lib/userAccessRules'
import type {
  AccessProfile,
  StandardAccessProfile,
  SystemAccessProfile,
} from '../../types/access'
import {
  assignableUsersForAudience,
  buildAccessProfilesPreviewModel,
  buildCatalogDepartments,
  CORPORATE_ACCESS_LABEL,
  CORPORATE_ACCESS_PATH,
  describeDepartmentCoverage,
  pageSelectionKey,
  selectionFromDepartments,
  summarizeCatalogSelection,
  withoutAssignmentsTo,
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

function buildStandardProfile(overrides: Partial<StandardAccessProfile> = {}): StandardAccessProfile {
  return {
    id: 'acp-001',
    name: 'Perfil de Teste',
    kind: 'standard',
    audience: 'analyst',
    lifecycle: 'active',
    departmentPageAccess: [{ departmentId: grantArea.id, pageKeys: [grantPage] }],
    homePage: { departmentId: grantArea.id, pageKey: grantPage },
    hasBeenUsed: false,
    ...overrides,
  }
}

/** Acesso do Sistema como o repositório o deriva: catálogo inteiro, páginas publicadas. */
function buildSystemProfile(): SystemAccessProfile {
  return {
    id: 'acp-system',
    name: 'Acesso do Sistema',
    kind: 'system',
    audience: 'administrator',
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
function buildDepartmentProfile(area: BiArea, overrides: Partial<StandardAccessProfile> = {}) {
  return buildStandardProfile({
    id: `acp-${area.id}`,
    name: area.label,
    departmentPageAccess: [{ departmentId: area.id, pageKeys: grantedPageKeys(area) }],
    homePage: { departmentId: area.id, pageKey: requireKey(grantedPageKeys(area), 0, area.label) },
    ...overrides,
  })
}

/** Perfil executivo padrão: páginas concedíveis de todos os departamentos. */
function buildExecutiveProfile(overrides: Partial<StandardAccessProfile> = {}) {
  return buildStandardProfile({
    id: 'acp-executivo',
    name: EXECUTIVE_ACCESS_PROFILE_NAME,
    audience: 'executive',
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

describe('origem dos perfis exibidos', () => {
  it('usa a identidade real de cada perfil recebido', () => {
    const profile = buildStandardProfile({
      id: 'acp-042',
      name: 'Operações Técnicas',
      description: 'Descrição gravada.',
      audience: 'analyst',
    })

    const [described] = build([profile]).profiles

    expect(described.id).toBe('acp-042')
    expect(described.name).toBe('Operações Técnicas')
    expect(described.description).toBe('Descrição gravada.')
    expect(described.kind).toBe('standard')
    expect(described.audience).toBe('analyst')
    expect(described.audienceLabel).toBe('Analistas')
  })

  it('separa o perfil do sistema dos perfis comuns', () => {
    const preview = build([buildSystemProfile(), buildDepartmentProfile(grantArea)])

    expect(preview.systemProfile?.name).toBe('Acesso do Sistema')
    expect(preview.systemProfile?.isSystem).toBe(true)
    expect(preview.systemProfile?.audienceLabel).toBe('Administradores')
    expect(preview.profiles.map((profile) => profile.name)).toEqual([grantArea.label])
    expect(preview.profileCount).toBe(1)
  })

  it('preserva a ordem em que o repositório entregou os perfis comuns', () => {
    const ordered = [
      buildSystemProfile(),
      buildExecutiveProfile(),
      buildDepartmentProfile(otherArea),
      buildDepartmentProfile(grantArea),
    ]

    expect(build(ordered).profiles.map((profile) => profile.name)).toEqual([
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

  it('trata o acesso corporativo como regra do destino, e não como departamento', () => {
    const preview = build([
      buildSystemProfile(),
      buildExecutiveProfile(),
      buildDepartmentProfile(grantArea),
    ])

    const withCorporate = [preview.systemProfile, ...preview.profiles]
      .filter((profile) => profile?.hasCorporateAccess)
      .map((profile) => profile?.name)

    expect(withCorporate).toEqual(['Acesso do Sistema', 'Acesso Executivo'])

    const labels = [preview.systemProfile, ...preview.profiles].flatMap(
      (profile) => profile?.departments.map((department) => department.label) ?? [],
    )

    expect(labels).not.toContain(CORPORATE_ACCESS_LABEL)
  })
})

/* -------------------------------------------------------------------------- */
/* 2. Correspondência provisória                                              */
/* -------------------------------------------------------------------------- */

describe('correspondência provisória dos usuários', () => {
  it('coloca todo Administrador em Acesso do Sistema, qualquer que seja a combinação gravada', () => {
    const preview = build(
      [buildSystemProfile(), buildDepartmentProfile(grantArea)],
      [
        buildUser({ profile: 'Administrador' }, { id: 'usr-001' }),
        withPageKeys(
          buildUser({ profile: 'Administrador' }, { id: 'usr-002' }),
          grantArea.id,
          [grantPage],
        ),
      ],
    )

    expect(preview.systemProfile?.users.map((user) => user.id)).toEqual(['usr-001', 'usr-002'])
    expect(preview.unassignedUsers).toEqual([])
  })

  it('corresponde um Analista ao perfil de mesmo acesso efetivo', () => {
    const preview = build(
      [buildDepartmentProfile(grantArea)],
      [analystUser([grantArea.id], { id: 'usr-001' })],
    )

    expect(preview.profiles[0].users.map((user) => user.id)).toEqual(['usr-001'])
    expect(preview.matchedUserCount).toBe(1)
    expect(preview.unassignedUsers).toEqual([])
  })

  it('corresponde um Executivo ao perfil executivo padrão', () => {
    const preview = build(
      [buildExecutiveProfile()],
      [buildUser({ profile: 'Executivo' }, { id: 'usr-001' })],
    )

    expect(preview.profiles[0].users.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('não corresponde a perfil de destino incompatível, mesmo com o acesso idêntico', () => {
    // O mesmo conteúdo, destinado a Executivos: um Analista não pode recebê-lo.
    const executiveTwin = buildDepartmentProfile(grantArea, {
      id: 'acp-900',
      name: 'Perfil executivo de mesmo alcance',
      audience: 'executive',
    })

    const preview = build([executiveTwin], [analystUser([grantArea.id], { id: 'usr-001' })])

    expect(preview.profiles[0].users).toEqual([])
    expect(preview.unassignedUsers.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('não corresponde quando dois perfis compatíveis descrevem o mesmo acesso', () => {
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

  it('não corresponde quando nenhum perfil descreve aquele acesso', () => {
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
    const user = analystUser([multiPageArea.id], { id: 'usr-001' })

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
      buildUser({ profile: 'Administrador' }, { id: 'usr-001' }),
      buildUser({ profile: 'Executivo' }, { id: 'usr-002' }),
      analystUser([grantArea.id], { id: 'usr-003' }),
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
        buildUser({ profile: 'Administrador' }, { id: 'usr-001' }),
        analystUser([grantArea.id], { id: 'usr-002' }),
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
    const user = analystUser([grantArea.id], { id: 'usr-001' })
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

  it('não descreve departamento fora do catálogo', () => {
    const profile = buildStandardProfile({
      departmentPageAccess: [
        { departmentId: grantArea.id, pageKeys: [grantPage] },
        { departmentId: UNKNOWN_DEPARTMENT, pageKeys: ['overview'] },
      ],
    })

    expect(build([profile]).profiles[0].departments.map((item) => item.departmentId)).toEqual([
      grantArea.id,
    ])
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

  it('Acesso do Sistema cobre o catálogo inteiro, apurado do próprio catálogo', () => {
    const preview = build([buildSystemProfile()])

    expect(preview.systemProfile?.departmentCount).toBe(biAreas.length)
    expect(preview.systemProfile?.pageTotals.available).toBe(catalogAvailablePageCount)
    expect(preview.systemProfile?.pageTotals.inDevelopment).toBe(0)
  })

  it('entrega o catálogo dos formulários com as contagens do próprio catálogo', () => {
    const catalog = buildCatalogDepartments()

    const available = catalog.reduce((total, item) => total + item.pageTotals.available, 0)
    const inDevelopment = catalog.reduce((total, item) => total + item.pageTotals.inDevelopment, 0)

    expect(available).toBe(catalogAvailablePageCount)
    expect(available).toBe(catalogPageCount)
    expect(inDevelopment).toBe(0)
    expect(catalog).toHaveLength(biAreas.length)
    expect(catalog.map((department) => department.label)).not.toContain(CORPORATE_ACCESS_LABEL)
  })

  it('oferece no formulário todas as páginas do catálogo, sem nenhuma bloqueada', () => {
    for (const department of buildCatalogDepartments()) {
      expect(department.pages.map((page) => page.pageKey)).toEqual(
        departmentPages[department.departmentId].map((page) => page.key),
      )
      expect(department.pages.every((page) => !page.inDevelopment)).toBe(true)
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

    const summary = summarizeCatalogSelection(buildCatalogDepartments(), selection)

    expect(summary.availablePageCount).toBe(2)
    expect(summary.inDevelopmentPageCount).toBe(0)
    expect(summary.departmentCount).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/* 5. Visão Geral Executiva                                                   */
/* -------------------------------------------------------------------------- */

describe('Visão Geral Executiva', () => {
  it('vem do catálogo oficial de navegação, e não de um texto próprio da tela', () => {
    expect(CORPORATE_ACCESS_PATH).toBe(CORPORATE_OVERVIEW_PATH)
    expect(CORPORATE_ACCESS_LABEL).toBe('Visão Geral Executiva')
  })
})

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
        buildUser({ profile: 'Administrador' }, { id: 'usr-001' }),
        analystUser([grantArea.id], { id: 'usr-002' }),
      ],
    )

    expect(preview.systemProfile?.userCount).toBe(1)
    expect(preview.profiles[0].userCount).toBe(1)
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

    const serialized = JSON.stringify({ preview, catalog: buildCatalogDepartments() })

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
  it('coloca o perfil do sistema na primeira posição', () => {
    const preview = build([
      buildDepartmentProfile(grantArea),
      buildExecutiveProfile(),
      buildSystemProfile(),
    ])

    expect(preview.orderedProfiles[0].isSystem).toBe(true)
    expect(preview.orderedProfiles[0].name).toBe('Acesso do Sistema')
  })

  it('mantém os perfis comuns na ordem em que o repositório os entregou', () => {
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

  it('devolve somente os comuns quando a coleção não traz o perfil do sistema', () => {
    const preview = build([buildDepartmentProfile(grantArea)])

    expect(preview.orderedProfiles).toHaveLength(1)
    expect(preview.orderedProfiles[0].isSystem).toBe(false)
    expect(preview.systemProfile).toBeNull()
  })

  it('conta o perfil do sistema no total exibido', () => {
    const preview = build([
      buildSystemProfile(),
      buildExecutiveProfile(),
      buildDepartmentProfile(grantArea),
    ])

    expect(preview.profileCount).toBe(2)
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

describe('Perfil do Sistema de destino', () => {
  it('traduz o destino para o Perfil do Sistema correspondente', () => {
    const preview = build([
      buildSystemProfile(),
      buildExecutiveProfile(),
      buildDepartmentProfile(grantArea),
    ])

    const byName = new Map(
      preview.orderedProfiles.map((profile) => [profile.name, profile.audienceProfile]),
    )

    expect(byName.get('Acesso do Sistema')).toBe('Administrador')
    expect(byName.get('Acesso Executivo')).toBe('Executivo')
    expect(byName.get(grantArea.label)).toBe('Analista')
  })

  it('mantém o rótulo exibido no plural, ao lado do perfil no singular', () => {
    const [described] = build([buildDepartmentProfile(grantArea)]).profiles

    expect(described.audienceLabel).toBe('Analistas')
    expect(described.audienceProfile).toBe('Analista')
  })
})

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

  it('leva as iniciais do Administrador correspondente ao perfil do sistema', () => {
    const administrador = buildUser(
      { profile: 'Administrador' },
      { id: 'usr-003', initials: 'AD' },
    )

    const preview = build([buildSystemProfile()], [administrador])

    expect(preview.systemProfile?.users[0].initials).toBe('AD')
  })

  it('preserva iniciais vazias em vez de inventar letras', () => {
    const user = analystUser([grantArea.id], { id: 'usr-004', initials: '' })

    const preview = build([buildDepartmentProfile(grantArea)], [user])

    expect(preview.profiles[0].users[0].initials).toBe('')
  })
})

/* -------------------------------------------------------------------------- */
/* 12. Total de usuários correspondentes                                      */
/* -------------------------------------------------------------------------- */

describe('total de usuários correspondentes', () => {
  it('inclui os Administradores do perfil do sistema', () => {
    const preview = build(
      [buildSystemProfile(), buildDepartmentProfile(grantArea)],
      [
        buildUser({ profile: 'Administrador' }, { id: 'usr-001' }),
        analystUser([grantArea.id], { id: 'usr-002' }),
      ],
    )

    expect(preview.matchedUserCount).toBe(1)
    expect(preview.totalMatchedUserCount).toBe(2)
  })

  it('conta usuários distintos, sem somar por perfil', () => {
    const preview = build(
      [buildSystemProfile(), buildDepartmentProfile(grantArea), buildDepartmentProfile(otherArea)],
      [
        buildUser({ profile: 'Administrador' }, { id: 'usr-001' }),
        buildUser({ profile: 'Administrador' }, { id: 'usr-002' }),
        analystUser([grantArea.id], { id: 'usr-003' }),
        analystUser([otherArea.id], { id: 'usr-004' }),
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
        analystUser([grantArea.id], { id: 'usr-001' }),
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

describe('usuários compatíveis com o destino', () => {
  const executive = buildUser({ profile: 'Executivo' }, { id: 'usr-exec' })
  const analyst = analystUser([grantArea.id], { id: 'usr-analista' })
  const administrator = buildUser({ profile: 'Administrador' }, { id: 'usr-admin' })

  function assignable(users: readonly User[]) {
    return build([buildSystemProfile(), buildExecutiveProfile()], users).assignableUsers
  }

  it('não oferece ninguém enquanto o destino não é escolhido', () => {
    expect(assignableUsersForAudience(assignable([executive, analyst]), null)).toEqual([])
  })

  it('destino Executivos mostra apenas Executivos', () => {
    const users = assignableUsersForAudience(assignable([executive, analyst]), 'executive')

    expect(users.map((user) => user.id)).toEqual(['usr-exec'])
  })

  it('destino Analistas mostra apenas Analistas', () => {
    const users = assignableUsersForAudience(assignable([executive, analyst]), 'analyst')

    expect(users.map((user) => user.id)).toEqual(['usr-analista'])
  })

  it('nunca oferece Administradores, em nenhum destino', () => {
    const pool = assignable([administrator, executive, analyst])

    expect(pool.map((user) => user.id)).not.toContain('usr-admin')

    for (const audience of ['executive', 'analyst'] as const) {
      const users = assignableUsersForAudience(pool, audience)

      expect(users.some((user) => user.profile === 'Administrador')).toBe(false)
    }
  })

  it('não altera a coleção recebida', () => {
    const pool = assignable([executive, analyst])
    const snapshot = structuredClone(pool)

    assignableUsersForAudience(pool, 'executive')

    expect(pool).toEqual(snapshot)
  })
})

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
    const { DRAFT_PROFILE_ID } = await import('./AccessProfileFormDrawer')

    expect(DRAFT).toBe(DRAFT_PROFILE_ID)
  })
})

/* -------------------------------------------------------------------------- */
/* 15. Correspondência automática do Executivo                                */
/* -------------------------------------------------------------------------- */

describe('correspondência automática do Executivo', () => {
  function executiveUser(id: string, overrides: Partial<User> = {}): User {
    return buildUser({ profile: 'Executivo' }, { id, ...overrides })
  }

  /** Perfil pelo nome, para a asserção não depender da posição na coleção. */
  function profileNamed(preview: ReturnType<typeof build>, name: string) {
    return preview.profiles.find((profile) => profile.name === name) ?? null
  }

  it('coloca todo Executivo no Acesso Executivo, qualquer que seja a combinação gravada', () => {
    const preview = build(
      [buildSystemProfile(), buildExecutiveProfile(), buildDepartmentProfile(grantArea)],
      [
        executiveUser('usr-001'),
        // Um acesso menor do que o perfil concede, e outro sem nenhum acesso
        // gravado: nenhum dos dois pode impedir a correspondência, porque o
        // alcance do Executivo vem do Perfil do Sistema.
        withPageKeys(executiveUser('usr-002'), grantArea.id, [grantPage]),
        executiveUser('usr-003', { departmentPageAccess: [] }),
      ],
    )

    expect(profileNamed(preview, EXECUTIVE_ACCESS_PROFILE_NAME)?.users.map((user) => user.id)).toEqual([
      'usr-001',
      'usr-002',
      'usr-003',
    ])
    expect(preview.unassignedUsers).toEqual([])
  })

  it('leva todos os Executivos para o mesmo perfil padrão', () => {
    const executives = ['usr-001', 'usr-002', 'usr-003', 'usr-004'].map((id) => executiveUser(id))

    const preview = build(
      [buildSystemProfile(), buildExecutiveProfile(), buildDepartmentProfile(grantArea)],
      executives,
    )

    const executiveProfile = profileNamed(preview, EXECUTIVE_ACCESS_PROFILE_NAME)

    expect(executiveProfile?.userCount).toBe(executives.length)
    expect(executiveProfile?.audienceLabel).toBe('Executivos')
    expect(profileNamed(preview, grantArea.label)?.users).toEqual([])
  })

  it('reconhece o nome oficial gravado com caixa e espaços diferentes', () => {
    const preview = build(
      [buildExecutiveProfile({ name: '  acesso   executivo ' })],
      [executiveUser('usr-001')],
    )

    expect(preview.profiles[0].users.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('não escolhe um perfil executivo com outro nome', () => {
    // Mesmo alcance do perfil padrão, nome diferente: nada é atribuído por conta
    // própria, mesmo sendo o único perfil executivo da coleção.
    const preview = build(
      [buildExecutiveProfile({ id: 'acp-900', name: 'Acesso Executivo Comercial' })],
      [executiveUser('usr-001')],
    )

    expect(preview.profiles[0].users).toEqual([])
    expect(preview.unassignedUsers.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('deixa o Executivo sem perfil quando o Acesso Executivo não está na coleção', () => {
    const preview = build(
      [buildSystemProfile(), buildDepartmentProfile(grantArea)],
      [executiveUser('usr-001')],
    )

    expect(preview.unassignedUsers.map((user) => user.id)).toEqual(['usr-001'])
    expect(preview.totalMatchedUserCount).toBe(0)
  })

  it('não aceita o nome oficial em um perfil de destino incompatível', () => {
    const preview = build(
      [buildExecutiveProfile({ id: 'acp-901', audience: 'analyst' })],
      [executiveUser('usr-001')],
    )

    expect(preview.profiles[0].users).toEqual([])
    expect(preview.unassignedUsers.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('não decide pela ordem da coleção', () => {
    const preview = build(
      [
        buildExecutiveProfile({ id: 'acp-900', name: 'Acesso Executivo Comercial' }),
        buildExecutiveProfile(),
      ],
      [executiveUser('usr-001')],
    )

    expect(preview.profiles[0].users).toEqual([])
    expect(preview.profiles[1].name).toBe(EXECUTIVE_ACCESS_PROFILE_NAME)
    expect(preview.profiles[1].users.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('não escolhe nenhum quando dois perfis usam o nome oficial', () => {
    const preview = build(
      [buildExecutiveProfile(), buildExecutiveProfile({ id: 'acp-902' })],
      [executiveUser('usr-001')],
    )

    for (const profile of preview.profiles) expect(profile.users).toEqual([])
    expect(preview.unassignedUsers.map((user) => user.id)).toEqual(['usr-001'])
  })

  it('não afeta os Analistas, que continuam seguindo a combinação de acessos', () => {
    const preview = build(
      [buildExecutiveProfile(), buildDepartmentProfile(grantArea)],
      [
        analystUser([grantArea.id], { id: 'usr-001' }),
        analystUser([grantArea.id, otherArea.id], { id: 'usr-002' }),
      ],
    )

    expect(profileNamed(preview, EXECUTIVE_ACCESS_PROFILE_NAME)?.users).toEqual([])
    expect(profileNamed(preview, grantArea.label)?.users.map((user) => user.id)).toEqual(['usr-001'])
    expect(preview.unassignedUsers.map((user) => user.id)).toEqual(['usr-002'])
  })

  it('não afeta os Administradores, que continuam no Acesso do Sistema', () => {
    const preview = build(
      [buildSystemProfile(), buildExecutiveProfile()],
      [buildUser({ profile: 'Administrador' }, { id: 'usr-001' })],
    )

    expect(preview.systemProfile?.users.map((user) => user.id)).toEqual(['usr-001'])
    expect(profileNamed(preview, EXECUTIVE_ACCESS_PROFILE_NAME)?.users).toEqual([])
  })

  it('mantém cada usuário em um único destino', () => {
    const users = [
      buildUser({ profile: 'Administrador' }, { id: 'usr-001' }),
      executiveUser('usr-002'),
      executiveUser('usr-003'),
      analystUser([grantArea.id], { id: 'usr-004' }),
      analystUser([grantArea.id, otherArea.id], { id: 'usr-005' }),
    ]

    const preview = build(
      [buildSystemProfile(), buildExecutiveProfile(), buildDepartmentProfile(grantArea)],
      users,
    )

    for (const user of users) {
      expect(destinationsOf(preview, user.id)).toHaveLength(1)
    }

    expect(preview.totalMatchedUserCount + preview.unassignedUserCount).toBe(users.length)
  })

  it('move os Executivos de sem perfil para o Acesso Executivo, na mesma quantidade', () => {
    const executives = ['usr-001', 'usr-002', 'usr-003', 'usr-004'].map((id) => executiveUser(id))
    const base = [buildSystemProfile(), buildDepartmentProfile(grantArea)]

    const semPerfilExecutivo = build(base, executives)
    const comPerfilExecutivo = build(
      [buildSystemProfile(), buildExecutiveProfile(), buildDepartmentProfile(grantArea)],
      executives,
    )

    expect(semPerfilExecutivo.totalMatchedUserCount).toBe(0)
    expect(semPerfilExecutivo.unassignedUserCount).toBe(executives.length)

    expect(comPerfilExecutivo.totalMatchedUserCount).toBe(executives.length)
    expect(comPerfilExecutivo.unassignedUserCount).toBe(0)
    expect(profileNamed(comPerfilExecutivo, EXECUTIVE_ACCESS_PROFILE_NAME)?.userCount).toBe(
      executives.length,
    )
  })

  it('não grava nada nas coleções recebidas ao corresponder um Executivo', () => {
    const profiles = [buildSystemProfile(), buildExecutiveProfile()]
    const users = [executiveUser('usr-001')]

    const profilesSnapshot = structuredClone(profiles)
    const usersSnapshot = structuredClone(users)

    build(profiles, users)

    expect(profiles).toEqual(profilesSnapshot)
    expect(users).toEqual(usersSnapshot)
  })
})
