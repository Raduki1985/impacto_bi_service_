import { describe, expect, it, vi } from 'vitest'

/**
 * Testes da capacidade, preservada, de representar uma página em
 * desenvolvimento.
 *
 * Nenhuma página do catálogo atual está nesse estado: as 106 páginas
 * departamentais estão publicadas. A infraestrutura que trata `disabled`
 * continua no domínio, na autorização, na sidebar, no analisador da migração e
 * na tela de Perfis de Acesso, para quando uma página nova nascer em
 * desenvolvimento, e é essa infraestrutura que este arquivo exercita.
 *
 * Para isso, e somente aqui, o catálogo é substituído por uma cópia do real com
 * UMA página marcada como em desenvolvimento. O restante do catálogo continua
 * igual, e nenhum outro teste do projeto é afetado.
 */

const { DEVELOPMENT_DEPARTMENT_ID, DEVELOPMENT_PAGE_KEY } = vi.hoisted(() => ({
  DEVELOPMENT_DEPARTMENT_ID: 'cobranca',
  DEVELOPMENT_PAGE_KEY: 'service',
}))

vi.mock('../config/departmentPages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/departmentPages')>()

  return {
    ...actual,
    departmentPages: {
      ...actual.departmentPages,
      [DEVELOPMENT_DEPARTMENT_ID]: actual.departmentPages.cobranca.map((page) =>
        page.key === DEVELOPMENT_PAGE_KEY ? { ...page, disabled: true } : page,
      ),
    },
  }
})

const { biAreas } = await import('../config/biAreas')
const { departmentPages } = await import('../config/departmentPages')
const { getDepartmentPageAccessState } = await import('./accessControl')
const {
  availableDepartmentPageKeys,
  findAccessProfileIssues,
  findDepartmentPage,
  isDepartmentPageAvailable,
  resolveEffectiveAccessProfileHomePage,
  validateAccessProfileDraft,
} = await import('./accessProfileRules')
const { getAccessibleDepartmentSidebarItems } = await import('./sidebarAccess')
const { defaultDepartmentPageKeys, deriveUserAccess, OVERVIEW_PAGE_KEY } =
  await import('./userAccessRules')
const { describeDepartmentCoverage } = await import(
  '../Pages/AccessProfiles/accessProfilesPreviewModel'
)

type AccessProfile = import('../types/access').AccessProfile
type User = import('../data/dashboardTypes').User

function requireArea(departmentId: string): (typeof biAreas)[number] {
  const area = biAreas.find((item) => item.id === departmentId)
  if (!area) throw new Error(`Catálogo sem o departamento ${departmentId}: o teste precisa dele.`)

  return area
}

const developmentArea = requireArea(DEVELOPMENT_DEPARTMENT_ID)

const catalogPageKeys = departmentPages[developmentArea.id].map((page) => page.key)

function buildProfile(overrides: Partial<AccessProfile> = {}): AccessProfile {
  return {
    id: 'acp-001',
    name: 'Perfil de Teste',
    lifecycle: 'active',
    departmentPageAccess: [
      { departmentId: developmentArea.id, pageKeys: [OVERVIEW_PAGE_KEY, DEVELOPMENT_PAGE_KEY] },
    ],
    homePage: { departmentId: developmentArea.id, pageKey: OVERVIEW_PAGE_KEY },
    hasBeenUsed: false,
    ...overrides,
  }
}

const analyst: User = (() => {
  const access = deriveUserAccess({
    profile: 'Analista',
    departments: [
      {
        departmentId: developmentArea.id,
        pageKeys: defaultDepartmentPageKeys(developmentArea.id),
      },
    ],
  })
  if (!access) throw new Error('Configuração de acesso inválida no teste.')

  return {
    id: 'usr-001',
    name: 'Usuário de Teste',
    email: 'teste@impactotelecom.com',
    status: 'Ativo',
    lastAccess: '01/01/2026 00:00',
    initials: 'UT',
    ...access,
  }
})()

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                   */
/* -------------------------------------------------------------------------- */

describe('catálogo com uma página em desenvolvimento', () => {
  it('mantém a página no catálogo e a marca como indisponível', () => {
    expect(findDepartmentPage(developmentArea.id, DEVELOPMENT_PAGE_KEY)?.disabled).toBe(true)
    expect(isDepartmentPageAvailable(developmentArea.id, DEVELOPMENT_PAGE_KEY)).toBe(false)
    expect(isDepartmentPageAvailable(developmentArea.id, OVERVIEW_PAGE_KEY)).toBe(true)
  })

  it('deixa a página fora das publicadas, sem tirá-la do catálogo', () => {
    expect(availableDepartmentPageKeys(developmentArea.id)).not.toContain(DEVELOPMENT_PAGE_KEY)
    expect(availableDepartmentPageKeys(developmentArea.id)).toHaveLength(
      catalogPageKeys.length - 1,
    )
    expect(catalogPageKeys).toContain(DEVELOPMENT_PAGE_KEY)
  })

})

/* -------------------------------------------------------------------------- */
/* Domínio dos Perfis de Acesso                                               */
/* -------------------------------------------------------------------------- */

describe('domínio dos Perfis de Acesso', () => {
  it('recusa a seleção da página em desenvolvimento, sem retirá-la do rascunho', () => {
    const result = validateAccessProfileDraft(
      {
        id: 'acp-010',
        name: 'Perfil Novo',
        departmentPageAccess: [
          { departmentId: developmentArea.id, pageKeys: [OVERVIEW_PAGE_KEY, DEVELOPMENT_PAGE_KEY] },
        ],
        homePage: { departmentId: developmentArea.id, pageKey: OVERVIEW_PAGE_KEY },
      },
      [],
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors.map((error) => error.code)).toEqual(['disabled-page'])
    expect(result.errors[0].pageKey).toBe(DEVELOPMENT_PAGE_KEY)
  })

  it('recusa a página em desenvolvimento como página inicial', () => {
    const result = validateAccessProfileDraft(
      {
        id: 'acp-010',
        name: 'Perfil Novo',
        departmentPageAccess: [
          { departmentId: developmentArea.id, pageKeys: [DEVELOPMENT_PAGE_KEY] },
        ],
        homePage: { departmentId: developmentArea.id, pageKey: DEVELOPMENT_PAGE_KEY },
      },
      [],
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors.map((error) => error.code)).toContain('home-page-unavailable')
  })

  it('aponta a concessão em desenvolvimento como pendência, sem removê-la', () => {
    const profile = buildProfile()
    const codes = findAccessProfileIssues(profile).map((issue) => issue.code)

    expect(codes).toContain('granted-page-disabled')
    expect(profile.departmentPageAccess[0].pageKeys).toContain(DEVELOPMENT_PAGE_KEY)
  })

  it('aponta a página inicial em desenvolvimento', () => {
    const codes = findAccessProfileIssues(
      buildProfile({ homePage: { departmentId: developmentArea.id, pageKey: DEVELOPMENT_PAGE_KEY } }),
    ).map((issue) => issue.code)

    expect(codes).toContain('home-page-disabled')
  })

  it('aponta o perfil que só concede páginas em desenvolvimento', () => {
    const profile = buildProfile({
      departmentPageAccess: [{ departmentId: developmentArea.id, pageKeys: [DEVELOPMENT_PAGE_KEY] }],
      homePage: { departmentId: developmentArea.id, pageKey: DEVELOPMENT_PAGE_KEY },
    })

    expect(findAccessProfileIssues(profile).map((issue) => issue.code)).toContain(
      'no-available-page',
    )
    expect(resolveEffectiveAccessProfileHomePage(profile)).toBeNull()
  })

  it('nunca escolhe a página em desenvolvimento como página inicial efetiva', () => {
    const profile = buildProfile({
      homePage: { departmentId: developmentArea.id, pageKey: DEVELOPMENT_PAGE_KEY },
    })

    expect(resolveEffectiveAccessProfileHomePage(profile)).toEqual({
      departmentId: developmentArea.id,
      pageKey: OVERVIEW_PAGE_KEY,
    })
  })
})

/* -------------------------------------------------------------------------- */
/* Autorização e navegação                                                    */
/* -------------------------------------------------------------------------- */

describe('autorização e navegação', () => {
  it('mantém a página concedida visível e bloqueada, e não escondida', () => {
    expect(getDepartmentPageAccessState(analyst, developmentArea.id, DEVELOPMENT_PAGE_KEY)).toBe(
      'disabled',
    )
    expect(getDepartmentPageAccessState(analyst, developmentArea.id, OVERVIEW_PAGE_KEY)).toBe(
      'enabled',
    )
  })

  it('exibe o item da sidebar bloqueado, sem removê-lo da lista', () => {
    const items = getAccessibleDepartmentSidebarItems(
      analyst,
      developmentArea.id,
      departmentPages[developmentArea.id].map((page) => ({ key: page.key, label: page.label })),
    )

    const item = items.find((entry) => entry.key === DEVELOPMENT_PAGE_KEY)

    expect(item?.disabled).toBe(true)
    expect(items.find((entry) => entry.key === OVERVIEW_PAGE_KEY)?.disabled).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Migração e apresentação                                                    */
/* -------------------------------------------------------------------------- */

describe('apresentação', () => {
  /*
   * O teste do catálogo dos FORMULÁRIOS saiu daqui.
   *
   * Ele afirmava que a aba Acessos exibia a página em desenvolvimento com o selo
   * e a caixa desabilitada. A aba deixou de percorrer o catálogo do portal: ela
   * lista os itens de `profile_menu` do serviço, e `disabled` é estado de uma
   * página do portal, que a maioria desses itens não tem — não há mais onde
   * perguntar isso, e nenhum item da lista é bloqueado.
   *
   * O estado continua vivo em tudo o que de fato depende dele, e é o que os
   * outros blocos deste arquivo exercitam: a autorização, a sidebar, a página
   * inicial efetiva, as pendências do perfil e a cobertura logo abaixo.
   */

  it('mantém a página em desenvolvimento fora dos dois lados da cobertura', () => {
    const coverage = describeDepartmentCoverage(developmentArea, new Set(catalogPageKeys))

    expect(coverage.total).toBe(catalogPageKeys.length - 1)
    expect(coverage.granted).toBe(coverage.total)
    expect(coverage.percent).toBe(100)
  })
})
