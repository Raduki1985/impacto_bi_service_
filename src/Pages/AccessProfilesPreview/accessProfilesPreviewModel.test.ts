import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { EXECUTIVE_ACCESS_PROFILE_NAME } from '../../config/accessProfileCatalog'
import { biAreas, CORPORATE_OVERVIEW_PATH, type BiArea, type BiAreaId } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import type { User } from '../../data/dashboardTypes'
import {
  INTELLIGENCE_PAGE_KEY,
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
  assignableProfilesForUser,
  audienceFromSelectedUsers,
  buildAccessProfilesPreviewModel,
  buildCatalogDepartments,
  CORPORATE_ACCESS_LABEL,
  CORPORATE_ACCESS_PATH,
  defaultSelectionKeysOf,
  describeAccessProfileDeletionImpact,
  describeDepartmentCoverage,
  describeDepartmentSelectionState,
  NON_DEFAULT_SELECTION_PAGE_KEYS,
  pageSelectionKey,
  selectionFromDepartments,
  splitUsersByAudience,
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
/* 2. Vínculo persistente dos usuários                                       */
/* -------------------------------------------------------------------------- */

describe('vínculo persistente dos usuários', () => {
  it('coloca no Acesso do Sistema o Administrador que possui esse vínculo gravado', () => {
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

    expect(preview.systemProfile?.users.map((user) => user.id)).toEqual(['usr-001', 'usr-002'])
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
        buildUser({ profile: 'Administrador' }, { id: 'usr-001', ...linkedTo(SYSTEM_PROFILE_ID) }),
        analystUser([grantArea.id], {
          id: 'usr-002',
          ...linkedTo(departmentProfileId(grantArea)),
        }),
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

  it('leva as iniciais do Administrador correspondente ao perfil do sistema', () => {
    const administrador = buildUser(
      { profile: 'Administrador' },
      { id: 'usr-003', initials: 'AD', accessProfileId: 'acp-system' },
    )

    const preview = build([buildSystemProfile()], [administrador])

    expect(preview.systemProfile?.users[0].initials).toBe('AD')
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
  it('inclui os Administradores do perfil do sistema', () => {
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

    expect(preview.matchedUserCount).toBe(1)
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

describe('usuários compatíveis com o destino', () => {
  const executive = buildUser({ profile: 'Executivo' }, { id: 'usr-exec' })
  const analyst = analystUser([grantArea.id], { id: 'usr-analista' })
  const administrator = buildUser({ profile: 'Administrador' }, { id: 'usr-admin' })

  function assignable(users: readonly User[]) {
    return build([buildSystemProfile(), buildExecutiveProfile()], users).assignableUsers
  }

  it('sem destino ninguém está impedido, e a lista inteira fica disponível', () => {
    const pool = assignable([executive, analyst])
    const { eligible, blocked } = splitUsersByAudience(pool, null)

    expect(eligible.map((user) => user.id)).toEqual(['usr-exec', 'usr-analista'])
    expect(blocked).toEqual([])
  })

  it('destino Executivos libera Executivos e impede Analistas', () => {
    const { eligible, blocked } = splitUsersByAudience(assignable([executive, analyst]), 'executive')

    expect(eligible.map((user) => user.id)).toEqual(['usr-exec'])
    expect(blocked.map((user) => user.id)).toEqual(['usr-analista'])
  })

  it('destino Analistas libera Analistas e impede Executivos', () => {
    const { eligible, blocked } = splitUsersByAudience(assignable([executive, analyst]), 'analyst')

    expect(eligible.map((user) => user.id)).toEqual(['usr-analista'])
    expect(blocked.map((user) => user.id)).toEqual(['usr-exec'])
  })

  it('nunca oferece Administradores, em nenhum destino e em nenhum dos dois grupos', () => {
    const pool = assignable([administrator, executive, analyst])

    expect(pool.map((user) => user.id)).not.toContain('usr-admin')

    for (const audience of ['executive', 'analyst'] as const) {
      const { eligible, blocked } = splitUsersByAudience(pool, audience)

      expect([...eligible, ...blocked].some((user) => user.profile === 'Administrador')).toBe(false)
    }
  })

  it('não altera a coleção recebida', () => {
    const pool = assignable([executive, analyst])
    const snapshot = structuredClone(pool)

    splitUsersByAudience(pool, 'executive')

    expect(pool).toEqual(snapshot)
  })
})

/* -------------------------------------------------------------------------- */
/* 13. Destino definido pela seleção de usuários                              */
/* -------------------------------------------------------------------------- */

describe('destino definido pela seleção de usuários', () => {
  const executive = buildUser({ profile: 'Executivo' }, { id: 'usr-exec' })
  const analyst = analystUser([grantArea.id], { id: 'usr-analista' })

  function assignable(users: readonly User[]) {
    return build([buildSystemProfile(), buildExecutiveProfile()], users).assignableUsers
  }

  it('sem ninguém marcado não existe destino', () => {
    const pool = assignable([executive, analyst])

    expect(audienceFromSelectedUsers(pool, new Set())).toBeNull()
  })

  it('um Executivo marcado faz o perfil ser de Executivos', () => {
    const pool = assignable([executive, analyst])

    expect(audienceFromSelectedUsers(pool, new Set(['usr-exec']))).toBe('executive')
  })

  it('um Analista marcado faz o perfil ser de Analistas', () => {
    const pool = assignable([executive, analyst])

    expect(audienceFromSelectedUsers(pool, new Set(['usr-analista']))).toBe('analyst')
  })

  it('id marcado que não está na coleção não define destino nenhum', () => {
    const pool = assignable([executive, analyst])

    expect(audienceFromSelectedUsers(pool, new Set(['usr-inexistente']))).toBeNull()
  })

  it('o destino é o do primeiro da coleção, e não o da ordem da marcação', () => {
    const pool = assignable([executive, analyst])

    expect(audienceFromSelectedUsers(pool, new Set(['usr-analista', 'usr-exec']))).toBe('executive')
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
/* 15. Perfis oferecidos a um usuário sem Perfil de Acesso                    */
/* -------------------------------------------------------------------------- */

describe('perfis que um usuário sem perfil pode receber', () => {
  const analystProfile = buildDepartmentProfile(grantArea)
  const executiveProfile = buildExecutiveProfile()
  const inactiveAnalystProfile = buildDepartmentProfile(otherArea, {
    id: 'acp-inativo',
    name: 'Perfil desativado',
    lifecycle: 'inactive',
  })

  /** Coleção como a página a entrega: o perfil do sistema e os comuns. */
  function described() {
    return build([
      buildSystemProfile(),
      analystProfile,
      executiveProfile,
      inactiveAnalystProfile,
    ])
  }

  it('oferece ao Analista somente perfis ativos destinados a Analistas', () => {
    const options = assignableProfilesForUser(described().profiles, 'Analista')

    expect(options.map((profile) => profile.id)).toEqual([analystProfile.id])
  })

  it('oferece ao Executivo somente perfis ativos destinados a Executivos', () => {
    const options = assignableProfilesForUser(described().profiles, 'Executivo')

    expect(options.map((profile) => profile.id)).toEqual([executiveProfile.id])
  })

  it('nunca oferece um perfil desativado', () => {
    const preview = described()

    expect(preview.profiles.some((profile) => profile.lifecycle === 'inactive')).toBe(true)
    for (const userProfile of ['Analista', 'Executivo'] as const) {
      expect(
        assignableProfilesForUser(preview.profiles, userProfile).some(
          (profile) => profile.lifecycle !== 'active',
        ),
      ).toBe(false)
    }
  })

  it('nunca oferece o Acesso do Sistema', () => {
    const preview = described()

    // A coleção que a tela entrega ao modal é a dos perfis COMUNS: o perfil do
    // sistema não está nela, e por isso não existe caminho pela interface que o
    // ofereça a ninguém.
    expect(preview.profiles.some((profile) => profile.isSystem)).toBe(false)

    for (const userProfile of ['Analista', 'Executivo', 'Administrador'] as const) {
      const options = assignableProfilesForUser(preview.profiles, userProfile)

      expect(options.some((profile) => profile.isSystem)).toBe(false)
    }
  })

  it('não oferece perfil comum nenhum ao Administrador', () => {
    expect(assignableProfilesForUser(described().profiles, 'Administrador')).toEqual([])
  })

  it('preserva a ordem da coleção e não altera o que recebeu', () => {
    const profiles = described().profiles
    const snapshot = structuredClone(profiles)

    assignableProfilesForUser(profiles, 'Analista')

    expect(profiles).toEqual(snapshot)
  })

  it('devolve lista vazia sem nenhum perfil comum', () => {
    expect(assignableProfilesForUser(build([buildSystemProfile()]).profiles, 'Analista')).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* 16. Seleção padrão de um departamento no formulário                        */
/* -------------------------------------------------------------------------- */

describe('seleção das páginas padrão de um departamento', () => {
  const catalog = buildCatalogDepartments()

  function requireDepartment(
    description: string,
    matches: (department: CatalogDepartment) => boolean,
  ): CatalogDepartment {
    const department = catalog.find(matches)
    if (!department) throw new Error(`Catálogo sem ${description}: o teste precisa de dados reais.`)

    return department
  }

  function hasAvailablePage(department: CatalogDepartment, pageKey: string): boolean {
    return department.pages.some((page) => page.pageKey === pageKey && !page.inDevelopment)
  }

  /** Departamento que tem as duas páginas de concessão intencional disponíveis. */
  const department = requireDepartment(
    'departamento com Inteligência (IA) e Modelo Dimensional disponíveis',
    (candidate) =>
      hasAvailablePage(candidate, INTELLIGENCE_PAGE_KEY) &&
      hasAvailablePage(candidate, MODEL_PAGE_KEY),
  )
  const otherDepartment = requireDepartment(
    'segundo departamento com página disponível',
    (candidate) =>
      candidate.departmentId !== department.departmentId && candidate.pageTotals.available > 0,
  )

  function keyOf(target: CatalogDepartment, pageKey: string): string {
    return pageSelectionKey(target.departmentId, pageKey)
  }

  const intelligenceKey = keyOf(department, INTELLIGENCE_PAGE_KEY)
  const modelKey = keyOf(department, MODEL_PAGE_KEY)

  it('identifica as duas exceções pela chave técnica do catálogo', () => {
    expect([...NON_DEFAULT_SELECTION_PAGE_KEYS]).toEqual([INTELLIGENCE_PAGE_KEY, MODEL_PAGE_KEY])
  })

  it('marca todas as páginas disponíveis do departamento, exceto IA e Modelo', () => {
    const expected = department.pages
      .filter(
        (page) =>
          !page.inDevelopment &&
          page.pageKey !== INTELLIGENCE_PAGE_KEY &&
          page.pageKey !== MODEL_PAGE_KEY,
      )
      .map((page) => keyOf(department, page.pageKey))

    expect(defaultSelectionKeysOf(department)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
  })

  it('não inclui página em desenvolvimento em nenhum departamento', () => {
    for (const candidate of catalog) {
      const inDevelopment = candidate.pages
        .filter((page) => page.inDevelopment)
        .map((page) => keyOf(candidate, page.pageKey))

      for (const key of inDevelopment) {
        expect(defaultSelectionKeysOf(candidate)).not.toContain(key)
      }
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
        otherDepartment.pages.filter((page) => !page.inDevelopment).map((page) => page.pageKey),
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
      fileName.endsWith('AccessProfileFormDrawer.tsx'),
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
