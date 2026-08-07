import { describe, expect, it } from 'vitest'
import { EXECUTIVE_ACCESS_PROFILE_NAME } from '../config/accessProfileCatalog'
import { biAreas, type BiArea } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import {
  ACCESS_PROFILE_ID_PATTERN,
  STANDARD_ACCESS_PROFILE_AUDIENCES,
  accessProfileAudienceForUserProfile,
  accessProfileCapabilities,
  accessProfileGrantKeys,
  availableDepartmentPageKeys,
  findMigrationAccessProfile,
  isAccessProfileAssignableToUserProfile,
  normalizeStoredAccessProfileId,
  resolveAccessProfileHomePage,
  evaluateAccessProfile,
  findAccessProfileIssues,
  findAccessProfileNameConflict,
  findDepartmentPage,
  hasAccessProfilePageGrant,
  hasAvailableAccessProfilePage,
  isAccessProfileCompatibleWithUserProfile,
  isDepartmentPageAvailable,
  isStandardAccessProfileAudience,
  isSystemAccessProfile,
  normalizeAccessProfileDescription,
  normalizeAccessProfileGrants,
  normalizeAccessProfileName,
  resolveAccessProfileOperationalStatus,
  resolveEffectiveAccessProfileHomePage,
  validateAccessProfileCreationDraft,
  validateAccessProfileDraft,
} from './accessProfileRules'
import type {
  AccessProfileCreationDraft,
  AccessProfileCreationValidation,
  AccessProfileDraft,
  AccessProfileDraftErrorCode,
  AccessProfileDraftValidation,
  AccessProfileIssue,
  AccessProfileIssueCode,
  StandardAccessProfile,
  SystemAccessProfile,
  UserProfile,
} from '../types/access'

/**
 * Testes do domínio de perfis de acesso.
 *
 * Os departamentos e as páginas usados aqui são localizados no catálogo real
 * (`biAreas` e `departmentPages`) em tempo de execução, e não copiados como
 * literais: um perfil de teste que finge conhecer o catálogo deixa de provar
 * qualquer coisa assim que o catálogo muda. Só os itens que precisam estar FORA
 * do catálogo são inventados, e de propósito.
 *
 * Quando o catálogo não oferece a forma exigida por um teste, a montagem falha
 * com mensagem explícita, em vez de o teste passar sem exercitar nada.
 */

/* -------------------------------------------------------------------------- */
/* Dados reais do catálogo                                                    */
/* -------------------------------------------------------------------------- */

function availablePageKeys(area: BiArea): string[] {
  return departmentPages[area.id].filter((page) => !page.disabled).map((page) => page.key)
}

function requireArea(description: string, matches: (area: BiArea) => boolean): BiArea {
  const area = biAreas.find(matches)
  if (!area) throw new Error(`Catálogo sem ${description}: o teste precisa de dados reais.`)

  return area
}

function requirePageAt(keys: readonly string[], index: number, description: string): string {
  const key = keys.at(index)
  if (key === undefined) throw new Error(`Catálogo sem ${description}: o teste precisa de dados reais.`)

  return key
}

/** Departamento com duas ou mais páginas disponíveis: permite testar ordem e substituição da página inicial. */
const multiPageArea = requireArea(
  'departamento com duas páginas disponíveis',
  (area) => availablePageKeys(area).length >= 2,
)

/**
 * Segundo departamento, para provar que a concessão é sempre pelo par
 * departamento e página, e nunca pela chave sozinha.
 *
 * O catálogo atual não tem nenhuma página em desenvolvimento, então os testes do
 * estado `disabled`, que o domínio continua sabendo tratar, vivem em
 * `departmentPageDevelopmentState.test.ts`, com um catálogo próprio.
 */
const mixedArea = requireArea(
  'segundo departamento com ao menos uma página disponível',
  (area) => area.id !== multiPageArea.id && availablePageKeys(area).length >= 1,
)

const multiPageKeys = availablePageKeys(multiPageArea)
const firstMultiPage = requirePageAt(multiPageKeys, 0, 'primeira página disponível')
const secondMultiPage = requirePageAt(multiPageKeys, 1, 'segunda página disponível')

const mixedAvailablePage = requirePageAt(
  availablePageKeys(mixedArea),
  0,
  'página disponível do segundo departamento',
)

/** Ordem oficial: quem vem antes em `biAreas` deve vir antes em qualquer resultado. */
function catalogPosition(area: BiArea): number {
  return biAreas.findIndex((candidate) => candidate.id === area.id)
}

const [earlierArea, laterArea] =
  catalogPosition(mixedArea) < catalogPosition(multiPageArea)
    ? [mixedArea, multiPageArea]
    : [multiPageArea, mixedArea]

const earlierAreaPage = requirePageAt(
  availablePageKeys(earlierArea),
  0,
  'página disponível do departamento anterior',
)
const laterAreaPage = requirePageAt(
  availablePageKeys(laterArea),
  0,
  'página disponível do departamento posterior',
)

/** Visão Geral do catálogo real, para provar que ela nunca é acrescentada sozinha. */
const overviewPage = requirePageAt(
  departmentPages[multiPageArea.id].filter((page) => page.key === 'overview').map((page) => page.key),
  0,
  'Visão Geral no departamento de teste',
)

/** Página disponível que não é a Visão Geral, usada para conceder acesso sem ela. */
const nonOverviewPage = requirePageAt(
  multiPageKeys.filter((pageKey) => pageKey !== overviewPage),
  0,
  'página disponível diferente da Visão Geral',
)

/** Itens deliberadamente fora do catálogo, para o caso do item removido ou desconhecido. */
const UNKNOWN_DEPARTMENT = 'departamento-que-nao-existe'
const UNKNOWN_PAGE = 'pagina-que-nao-existe'

/* -------------------------------------------------------------------------- */
/* Montagem                                                                   */
/* -------------------------------------------------------------------------- */

function buildProfile(overrides: Partial<StandardAccessProfile> = {}): StandardAccessProfile {
  return {
    id: 'acp-001',
    name: 'Perfil de Teste',
    kind: 'standard',
    audience: 'analyst',
    lifecycle: 'active',
    departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }],
    homePage: { departmentId: multiPageArea.id, pageKey: firstMultiPage },
    hasBeenUsed: false,
    ...overrides,
  }
}

/**
 * Perfil do sistema: o par `system` e `administrator` é o único que ele aceita,
 * e por isso não entra nos overrides.
 */
function buildSystemProfile(
  overrides: Partial<Omit<SystemAccessProfile, 'kind' | 'audience'>> = {},
): SystemAccessProfile {
  return {
    ...buildProfile(),
    kind: 'system',
    audience: 'administrator',
    name: 'Acesso do Sistema',
    ...overrides,
  }
}

function buildDraft(overrides: Partial<AccessProfileDraft> = {}): AccessProfileDraft {
  return {
    id: 'acp-010',
    name: 'Perfil Novo',
    departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }],
    homePage: { departmentId: multiPageArea.id, pageKey: firstMultiPage },
    ...overrides,
  }
}

function buildCreationDraft(
  overrides: Partial<AccessProfileCreationDraft> = {},
): AccessProfileCreationDraft {
  return { ...buildDraft(), audience: 'analyst', ...overrides }
}

/** Os testes conferem os códigos técnicos; a mensagem em português é só a tradução deles. */
function errorCodes(result: AccessProfileDraftValidation): AccessProfileDraftErrorCode[] {
  return result.ok ? [] : result.errors.map((error) => error.code)
}

function issueCodes(issues: readonly AccessProfileIssue[]): AccessProfileIssueCode[] {
  return issues.map((issue) => issue.code)
}

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                   */
/* -------------------------------------------------------------------------- */

describe('consulta ao catálogo', () => {
  it('resolve a página de um departamento existente', () => {
    const page = findDepartmentPage(multiPageArea.id, firstMultiPage)

    expect(page?.key).toBe(firstMultiPage)
  })

  it('devolve null para departamento fora do catálogo', () => {
    expect(findDepartmentPage(UNKNOWN_DEPARTMENT, firstMultiPage)).toBeNull()
  })

  it('devolve null para página fora do catálogo do departamento', () => {
    expect(findDepartmentPage(multiPageArea.id, UNKNOWN_PAGE)).toBeNull()
  })

  it('não tem nenhuma página em desenvolvimento no catálogo atual', () => {
    for (const area of biAreas) {
      expect(departmentPages[area.id].filter((page) => page.disabled)).toEqual([])
    }
  })

  it('considera disponível toda página existente e indisponível a que não existe', () => {
    expect(isDepartmentPageAvailable(mixedArea.id, mixedAvailablePage)).toBe(true)
    expect(isDepartmentPageAvailable(mixedArea.id, UNKNOWN_PAGE)).toBe(false)
  })

  it('lista as páginas publicadas do departamento, na ordem do catálogo', () => {
    expect(availableDepartmentPageKeys(mixedArea.id)).toEqual(availablePageKeys(mixedArea))
    expect(availableDepartmentPageKeys(mixedArea.id)).toEqual(
      departmentPages[mixedArea.id].map((page) => page.key),
    )
  })

  it('devolve lista vazia para departamento fora do catálogo, sem lançar', () => {
    expect(availableDepartmentPageKeys(UNKNOWN_DEPARTMENT)).toEqual([])
  })

  it('conta as páginas publicadas de todo departamento do catálogo', () => {
    for (const area of biAreas) {
      expect(availableDepartmentPageKeys(area.id)).toEqual(availablePageKeys(area))
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Normalização                                                               */
/* -------------------------------------------------------------------------- */

describe('normalização do nome e da descrição', () => {
  it('remove os espaços das pontas do nome', () => {
    expect(normalizeAccessProfileName('   Suporte Técnico   ').displayName).toBe('Suporte Técnico')
  })

  it('reduz sequências internas de espaços a um só', () => {
    expect(normalizeAccessProfileName('Suporte    Técnico').displayName).toBe('Suporte Técnico')
  })

  it('compara nomes sem diferenciar maiúsculas de minúsculas nem espaços excedentes', () => {
    const first = normalizeAccessProfileName('  SUPORTE   Técnico ').comparisonKey
    const second = normalizeAccessProfileName('suporte técnico').comparisonKey

    expect(first).toBe(second)
  })

  it('preserva a grafia exibida ao gerar a chave de comparação', () => {
    const normalized = normalizeAccessProfileName('Cobrança Executiva')

    expect(normalized.displayName).toBe('Cobrança Executiva')
    expect(normalized.comparisonKey).toBe('cobrança executiva')
  })

  it('converte descrição vazia ou só com espaços em ausência de descrição', () => {
    expect(normalizeAccessProfileDescription('   ')).toBeUndefined()
    expect(normalizeAccessProfileDescription('')).toBeUndefined()
    expect(normalizeAccessProfileDescription(undefined)).toBeUndefined()
    expect(normalizeAccessProfileDescription('  Acesso de leitura  ')).toBe('Acesso de leitura')
  })
})

describe('normalização das concessões', () => {
  it('agrupa departamentos repetidos em uma única entrada', () => {
    const result = normalizeAccessProfileGrants([
      { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
      { departmentId: multiPageArea.id, pageKeys: [secondMultiPage] },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].pageKeys).toEqual([firstMultiPage, secondMultiPage])
  })

  it('remove páginas repetidas dentro do mesmo departamento', () => {
    const result = normalizeAccessProfileGrants([
      { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, firstMultiPage] },
      { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
    ])

    expect(result[0].pageKeys).toEqual([firstMultiPage])
  })

  it('ordena os departamentos pela ordem do catálogo, e não pela ordem informada', () => {
    const result = normalizeAccessProfileGrants([
      { departmentId: laterArea.id, pageKeys: [laterAreaPage] },
      { departmentId: earlierArea.id, pageKeys: [earlierAreaPage] },
    ])

    expect(result.map((access) => access.departmentId)).toEqual([earlierArea.id, laterArea.id])
  })

  it('ordena as páginas pela ordem do catálogo do departamento', () => {
    const result = normalizeAccessProfileGrants([
      { departmentId: multiPageArea.id, pageKeys: [secondMultiPage, firstMultiPage] },
    ])

    expect(result[0].pageKeys).toEqual([firstMultiPage, secondMultiPage])
  })

  it('preserva departamento e página fora do catálogo, jogando os desconhecidos para o fim', () => {
    const result = normalizeAccessProfileGrants([
      { departmentId: UNKNOWN_DEPARTMENT, pageKeys: [UNKNOWN_PAGE] },
      { departmentId: multiPageArea.id, pageKeys: [UNKNOWN_PAGE, firstMultiPage] },
    ])

    expect(result.map((access) => access.departmentId)).toEqual([
      multiPageArea.id,
      UNKNOWN_DEPARTMENT,
    ])
    expect(result[0].pageKeys).toEqual([firstMultiPage, UNKNOWN_PAGE])
    expect(result[1].pageKeys).toEqual([UNKNOWN_PAGE])
  })

  it('não acrescenta nenhuma página que não foi informada, inclusive a Visão Geral', () => {
    const result = normalizeAccessProfileGrants([
      { departmentId: multiPageArea.id, pageKeys: [nonOverviewPage] },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].pageKeys).toEqual([nonOverviewPage])
    expect(result[0].pageKeys).not.toContain(overviewPage)
  })
})

/* -------------------------------------------------------------------------- */
/* Criação                                                                    */
/* -------------------------------------------------------------------------- */

describe('validação do rascunho na criação', () => {
  it('aceita acp- com três dígitos ou mais e recusa qualquer outro formato', () => {
    expect(ACCESS_PROFILE_ID_PATTERN.test('acp-001')).toBe(true)
    expect(ACCESS_PROFILE_ID_PATTERN.test('acp-010')).toBe(true)
    expect(ACCESS_PROFILE_ID_PATTERN.test('acp-999')).toBe(true)
    expect(ACCESS_PROFILE_ID_PATTERN.test('acp-1000')).toBe(true)

    expect(ACCESS_PROFILE_ID_PATTERN.test('acp-1')).toBe(false)
    expect(ACCESS_PROFILE_ID_PATTERN.test('acp-12')).toBe(false)
    expect(ACCESS_PROFILE_ID_PATTERN.test('acp-')).toBe(false)
    expect(ACCESS_PROFILE_ID_PATTERN.test('acp-abc')).toBe(false)
    expect(ACCESS_PROFILE_ID_PATTERN.test('usr-001')).toBe(false)
    expect(ACCESS_PROFILE_ID_PATTERN.test('acp-system')).toBe(false)
  })

  it('recusa id com menos de três dígitos na criação', () => {
    expect(errorCodes(validateAccessProfileDraft(buildDraft({ id: 'acp-1' }), []))).toEqual([
      'invalid-id',
    ])
    expect(errorCodes(validateAccessProfileDraft(buildDraft({ id: 'acp-12' }), []))).toEqual([
      'invalid-id',
    ])
  })

  it('aceita id com quatro dígitos ou mais na criação', () => {
    expect(validateAccessProfileDraft(buildDraft({ id: 'acp-1000' }), []).ok).toBe(true)
  })

  it('aprova um rascunho válido e devolve o conteúdo normalizado', () => {
    const result = validateAccessProfileDraft(
      buildDraft({ name: '  Perfil   Novo  ', description: '   ' }),
      [buildProfile()],
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.draft.id).toBe('acp-010')
    expect(result.draft.name).toBe('Perfil Novo')
    expect(result.draft.description).toBeUndefined()
    expect(result.draft.homePage).toEqual({
      departmentId: multiPageArea.id,
      pageKey: firstMultiPage,
    })
  })

  it('recusa id fora do formato', () => {
    const result = validateAccessProfileDraft(buildDraft({ id: 'perfil-1' }), [])

    expect(errorCodes(result)).toEqual(['invalid-id'])
  })

  it('recusa id que já existe na coleção', () => {
    const result = validateAccessProfileDraft(buildDraft({ id: 'acp-001' }), [
      buildProfile({ id: 'acp-001' }),
    ])

    expect(errorCodes(result)).toContain('duplicate-id')
  })

  it('não ignora nenhum perfil na checagem de nome quando é criação', () => {
    const existing = buildProfile({ id: 'acp-001', name: 'Suporte Técnico' })

    const result = validateAccessProfileDraft(
      buildDraft({ id: 'acp-001', name: 'Suporte Técnico' }),
      [existing],
    )

    expect(errorCodes(result)).toContain('duplicate-id')
    expect(errorCodes(result)).toContain('duplicate-name')
  })

  it('recusa nome vazio', () => {
    const result = validateAccessProfileDraft(buildDraft({ name: '   ' }), [])

    expect(errorCodes(result)).toEqual(['invalid-name'])
  })

  it('recusa nome duplicado ignorando caixa e espaços excedentes', () => {
    const result = validateAccessProfileDraft(
      buildDraft({ name: '  suporte    TÉCNICO ' }),
      [buildProfile({ id: 'acp-001', name: 'Suporte Técnico' })],
    )

    expect(errorCodes(result)).toEqual(['duplicate-name'])
  })

  it('recusa perfil sem nenhuma página selecionada', () => {
    const result = validateAccessProfileDraft(
      buildDraft({ departmentPageAccess: [], homePage: null }),
      [],
    )

    expect(errorCodes(result)).toContain('no-pages-selected')
  })

  it('recusa rascunho sem página inicial', () => {
    const result = validateAccessProfileDraft(buildDraft({ homePage: null }), [])

    expect(errorCodes(result)).toEqual(['missing-home-page'])
  })

  it('recusa página inicial fora das páginas selecionadas, sem concedê-la junto', () => {
    const result = validateAccessProfileDraft(
      buildDraft({
        departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }],
        homePage: { departmentId: multiPageArea.id, pageKey: secondMultiPage },
      }),
      [],
    )

    expect(errorCodes(result)).toEqual(['home-page-not-selected'])
  })

  it('recusa departamento fora do catálogo', () => {
    const result = validateAccessProfileDraft(
      buildDraft({
        departmentPageAccess: [
          { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
          { departmentId: UNKNOWN_DEPARTMENT, pageKeys: [UNKNOWN_PAGE] },
        ],
      }),
      [],
    )

    expect(errorCodes(result)).toEqual(['unknown-department'])
  })

  it('recusa página fora do catálogo do departamento', () => {
    const result = validateAccessProfileDraft(
      buildDraft({
        departmentPageAccess: [
          { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, UNKNOWN_PAGE] },
        ],
      }),
      [],
    )

    expect(errorCodes(result)).toEqual(['unknown-page'])
  })

  it('recusa página inicial indisponível', () => {
    const result = validateAccessProfileDraft(
      buildDraft({
        departmentPageAccess: [{ departmentId: mixedArea.id, pageKeys: [UNKNOWN_PAGE] }],
        homePage: { departmentId: mixedArea.id, pageKey: UNKNOWN_PAGE },
      }),
      [],
    )

    expect(errorCodes(result)).toContain('home-page-unavailable')
  })

  it('reúne todas as recusas em uma passagem só', () => {
    const result = validateAccessProfileDraft(
      buildDraft({ id: 'perfil-1', name: '  ', departmentPageAccess: [], homePage: null }),
      [],
    )

    expect(errorCodes(result)).toEqual([
      'invalid-id',
      'invalid-name',
      'no-pages-selected',
      'missing-home-page',
    ])
  })
})

/* -------------------------------------------------------------------------- */
/* Edição                                                                     */
/* -------------------------------------------------------------------------- */

describe('validação do rascunho na edição', () => {
  const current = buildProfile({ id: 'acp-001', name: 'Suporte Técnico' })
  const other = buildProfile({ id: 'acp-002', name: 'Cobrança' })

  it('aprova a edição mantendo o id original', () => {
    const result = validateAccessProfileDraft(
      buildDraft({
        id: 'acp-001',
        name: 'Suporte Técnico Revisado',
        departmentPageAccess: [
          { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, secondMultiPage] },
        ],
      }),
      [current, other],
      'acp-001',
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.draft.id).toBe('acp-001')
  })

  it('não acusa duplicidade quando o perfil mantém o próprio nome', () => {
    const result = validateAccessProfileDraft(
      buildDraft({ id: 'acp-001', name: 'Suporte  Técnico' }),
      [current, other],
      'acp-001',
    )

    expect(errorCodes(result)).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('não acusa id duplicado por o próprio perfil já estar na coleção', () => {
    const result = validateAccessProfileDraft(
      buildDraft({ id: 'acp-001', name: 'Suporte Técnico' }),
      [current, other],
      'acp-001',
    )

    expect(errorCodes(result)).not.toContain('duplicate-id')
  })

  it('recusa a tentativa de alterar o id do perfil', () => {
    const result = validateAccessProfileDraft(
      buildDraft({ id: 'acp-999', name: 'Suporte Técnico' }),
      [current, other],
      'acp-001',
    )

    expect(errorCodes(result)).toEqual(['immutable-id'])
  })

  it('recusa a edição de um perfil que não está na coleção', () => {
    const result = validateAccessProfileDraft(
      buildDraft({ id: 'acp-404', name: 'Perfil Removido' }),
      [current, other],
      'acp-404',
    )

    expect(errorCodes(result)).toEqual(['unknown-profile'])
  })

  it('acusa conflito de nome com outro perfil da coleção', () => {
    const result = validateAccessProfileDraft(
      buildDraft({ id: 'acp-001', name: '  cobrança ' }),
      [current, other],
      'acp-001',
    )

    expect(errorCodes(result)).toEqual(['duplicate-name'])
  })

  it('ignora apenas o perfil informado na busca por nome duplicado', () => {
    expect(findAccessProfileNameConflict('Suporte Técnico', [current, other], 'acp-001')).toBeNull()
    expect(findAccessProfileNameConflict('Suporte Técnico', [current, other])?.id).toBe('acp-001')
    expect(findAccessProfileNameConflict('Cobrança', [current, other], 'acp-001')?.id).toBe(
      'acp-002',
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Pendências                                                                 */
/* -------------------------------------------------------------------------- */

describe('pendências do perfil', () => {
  it('não aponta pendência em um perfil íntegro', () => {
    expect(findAccessProfileIssues(buildProfile())).toEqual([])
  })

  it('devolve a pendência estruturada com código e orientação', () => {
    const [issue] = findAccessProfileIssues(
      buildProfile({ homePage: { departmentId: multiPageArea.id, pageKey: UNKNOWN_PAGE } }),
    )

    expect(issue.code).toBe('home-page-missing-from-catalog')
    expect(issue.reason.length).toBeGreaterThan(0)
    expect(issue.impact.length).toBeGreaterThan(0)
    expect(issue.requiredAction.length).toBeGreaterThan(0)
    expect(issue.departmentId).toBe(multiPageArea.id)
    expect(issue.pageKey).toBe(UNKNOWN_PAGE)
  })

  it('aponta perfil sem nenhuma página concedida sem repetir a falta de página disponível', () => {
    const codes = issueCodes(findAccessProfileIssues(buildProfile({ departmentPageAccess: [] })))

    expect(codes).toContain('no-pages-granted')
    expect(codes).not.toContain('no-available-page')
  })

  it('aponta perfil sem nenhuma página disponível entre as concedidas', () => {
    const codes = issueCodes(
      findAccessProfileIssues(
        buildProfile({
          departmentPageAccess: [{ departmentId: mixedArea.id, pageKeys: [UNKNOWN_PAGE] }],
          homePage: { departmentId: mixedArea.id, pageKey: UNKNOWN_PAGE },
        }),
      ),
    )

    expect(codes).toContain('no-available-page')
    expect(codes).toContain('granted-page-missing-from-catalog')
  })

  it('aponta página inicial fora das páginas concedidas', () => {
    const codes = issueCodes(
      findAccessProfileIssues(
        buildProfile({ homePage: { departmentId: mixedArea.id, pageKey: mixedAvailablePage } }),
      ),
    )

    expect(codes).toContain('home-page-not-granted')
  })

  it('aponta página inicial que saiu do catálogo', () => {
    const codes = issueCodes(
      findAccessProfileIssues(
        buildProfile({ homePage: { departmentId: multiPageArea.id, pageKey: UNKNOWN_PAGE } }),
      ),
    )

    expect(codes).toContain('home-page-missing-from-catalog')
  })

  it('aponta departamento que saiu do catálogo sem inspecionar as páginas dele', () => {
    const codes = issueCodes(
      findAccessProfileIssues(
        buildProfile({
          departmentPageAccess: [
            { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
            { departmentId: UNKNOWN_DEPARTMENT, pageKeys: [UNKNOWN_PAGE] },
          ],
        }),
      ),
    )

    expect(codes).toContain('department-missing-from-catalog')
    expect(codes).not.toContain('granted-page-missing-from-catalog')
  })

  it('aponta página concedida que saiu do catálogo', () => {
    const codes = issueCodes(
      findAccessProfileIssues(
        buildProfile({
          departmentPageAccess: [
            { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, UNKNOWN_PAGE] },
          ],
        }),
      ),
    )

    expect(codes).toContain('granted-page-missing-from-catalog')
  })

  it('aponta página concedida fora do catálogo sem remover a concessão', () => {
    const profile = buildProfile({
      departmentPageAccess: [
        { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
        { departmentId: mixedArea.id, pageKeys: [UNKNOWN_PAGE] },
      ],
    })

    expect(issueCodes(findAccessProfileIssues(profile))).toContain(
      'granted-page-missing-from-catalog',
    )
    expect(profile.departmentPageAccess[1].pageKeys).toEqual([UNKNOWN_PAGE])
  })
})

/* -------------------------------------------------------------------------- */
/* Status operacional                                                         */
/* -------------------------------------------------------------------------- */

describe('status operacional', () => {
  it('mantém Ativo o perfil ativo e sem pendência', () => {
    const evaluation = evaluateAccessProfile(buildProfile())

    expect(evaluation.issues).toEqual([])
    expect(evaluation.operationalStatus).toBe('active')
  })

  it('mantém Inativo o perfil desativado, mesmo sem pendência', () => {
    const evaluation = evaluateAccessProfile(buildProfile({ lifecycle: 'inactive' }))

    expect(evaluation.operationalStatus).toBe('inactive')
  })

  it('mantém Inativo o perfil desativado que tem pendência', () => {
    const evaluation = evaluateAccessProfile(
      buildProfile({ lifecycle: 'inactive', departmentPageAccess: [] }),
    )

    expect(evaluation.issues.length).toBeGreaterThan(0)
    expect(evaluation.operationalStatus).toBe('inactive')
  })

  it('marca Revisão necessária no perfil ativo com pendência', () => {
    const evaluation = evaluateAccessProfile(
      buildProfile({ homePage: { departmentId: multiPageArea.id, pageKey: UNKNOWN_PAGE } }),
    )

    expect(evaluation.operationalStatus).toBe('needs-review')
    expect(resolveAccessProfileOperationalStatus('active', evaluation.issues)).toBe('needs-review')
    expect(resolveAccessProfileOperationalStatus('active', [])).toBe('active')
    expect(resolveAccessProfileOperationalStatus('inactive', evaluation.issues)).toBe('inactive')
  })
})

/* -------------------------------------------------------------------------- */
/* Página inicial efetiva                                                     */
/* -------------------------------------------------------------------------- */

describe('página inicial efetiva', () => {
  it('usa a página inicial configurada quando ela está concedida e disponível', () => {
    expect(resolveEffectiveAccessProfileHomePage(buildProfile())).toEqual({
      departmentId: multiPageArea.id,
      pageKey: firstMultiPage,
    })
  })

  it('substitui temporariamente por outra página já concedida quando a inicial está indisponível', () => {
    const profile = buildProfile({
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [secondMultiPage] }],
      homePage: { departmentId: multiPageArea.id, pageKey: UNKNOWN_PAGE },
    })

    expect(resolveEffectiveAccessProfileHomePage(profile)).toEqual({
      departmentId: multiPageArea.id,
      pageKey: secondMultiPage,
    })
  })

  it('respeita a ordem oficial dos catálogos ao escolher a substituta', () => {
    const profile = buildProfile({
      departmentPageAccess: [
        { departmentId: laterArea.id, pageKeys: [laterAreaPage] },
        { departmentId: earlierArea.id, pageKeys: [earlierAreaPage] },
      ],
      homePage: { departmentId: multiPageArea.id, pageKey: UNKNOWN_PAGE },
    })

    expect(resolveEffectiveAccessProfileHomePage(profile)).toEqual({
      departmentId: earlierArea.id,
      pageKey: earlierAreaPage,
    })
  })

  it('devolve null quando nenhuma página concedida está disponível', () => {
    const profile = buildProfile({
      departmentPageAccess: [{ departmentId: mixedArea.id, pageKeys: [UNKNOWN_PAGE] }],
      homePage: { departmentId: mixedArea.id, pageKey: UNKNOWN_PAGE },
    })

    expect(resolveEffectiveAccessProfileHomePage(profile)).toBeNull()
    expect(hasAvailableAccessProfilePage(profile)).toBe(false)
  })

  it('nunca usa como substituta uma página que o perfil não concede', () => {
    const profile = buildProfile({
      departmentPageAccess: [{ departmentId: mixedArea.id, pageKeys: [UNKNOWN_PAGE] }],
      homePage: { departmentId: multiPageArea.id, pageKey: firstMultiPage },
    })

    expect(resolveEffectiveAccessProfileHomePage(profile)).toBeNull()
  })

  it('não recorre à Visão Geral de nenhum departamento', () => {
    const profile = buildProfile({
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [nonOverviewPage] }],
      homePage: { departmentId: multiPageArea.id, pageKey: UNKNOWN_PAGE },
    })

    const effective = resolveEffectiveAccessProfileHomePage(profile)

    expect(effective).toEqual({ departmentId: multiPageArea.id, pageKey: nonOverviewPage })
    expect(effective?.pageKey).not.toBe(overviewPage)
  })
})

/* -------------------------------------------------------------------------- */
/* Capacidades                                                                */
/* -------------------------------------------------------------------------- */

describe('capacidades do perfil', () => {
  it('reconhece o perfil do sistema pelo tipo', () => {
    expect(isSystemAccessProfile(buildSystemProfile())).toBe(true)
    expect(isSystemAccessProfile(buildProfile())).toBe(false)
  })

  it('recusa as quatro operações no perfil do sistema', () => {
    expect(accessProfileCapabilities(buildSystemProfile(), 0)).toEqual({
      canEdit: false,
      canRename: false,
      canDeactivate: false,
      canDelete: false,
    })
  })

  it('mantém o perfil do sistema bloqueado mesmo sem uso e sem vínculos', () => {
    const capabilities = accessProfileCapabilities(
      buildSystemProfile({ lifecycle: 'inactive', hasBeenUsed: false }),
      0,
    )

    expect(capabilities.canDelete).toBe(false)
    expect(capabilities.canEdit).toBe(false)
  })

  it('libera as quatro operações no perfil comum ativo, nunca utilizado e sem vínculos', () => {
    expect(accessProfileCapabilities(buildProfile(), 0)).toEqual({
      canEdit: true,
      canRename: true,
      canDeactivate: true,
      canDelete: true,
    })
  })

  it('permite excluir o perfil comum que já foi utilizado', () => {
    const capabilities = accessProfileCapabilities(buildProfile({ hasBeenUsed: true }), 0)

    expect(capabilities.canDelete).toBe(true)
    expect(capabilities.canDeactivate).toBe(true)
    expect(capabilities.canEdit).toBe(true)
    expect(capabilities.canRename).toBe(true)
  })

  it('impede desativar, mas permite excluir, o perfil comum com usuários vinculados', () => {
    const capabilities = accessProfileCapabilities(buildProfile(), 3)

    expect(capabilities.canDeactivate).toBe(false)
    expect(capabilities.canDelete).toBe(true)
    expect(capabilities.canEdit).toBe(true)
    expect(capabilities.canRename).toBe(true)
  })

  it('impede desativar de novo o perfil comum já inativo', () => {
    expect(accessProfileCapabilities(buildProfile({ lifecycle: 'inactive' }), 0).canDeactivate).toBe(
      false,
    )
  })

  it('permite excluir o perfil comum inativo que nunca foi utilizado', () => {
    expect(accessProfileCapabilities(buildProfile({ lifecycle: 'inactive' }), 0).canDelete).toBe(
      true,
    )
  })

  it('permite excluir o perfil comum em qualquer combinação de uso e vínculo', () => {
    expect(
      accessProfileCapabilities(buildProfile({ hasBeenUsed: true, lifecycle: 'inactive' }), 5)
        .canDelete,
    ).toBe(true)
  })

  it('mantém o perfil do sistema inexcluível mesmo sem uso e sem vínculos', () => {
    expect(
      accessProfileCapabilities(buildSystemProfile({ hasBeenUsed: false }), 0).canDelete,
    ).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Concessão                                                                  */
/* -------------------------------------------------------------------------- */

describe('consulta de concessão', () => {
  const profile = buildProfile({
    departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [secondMultiPage] }],
  })

  it('confirma somente o par exato de departamento e página', () => {
    expect(hasAccessProfilePageGrant(profile, multiPageArea.id, secondMultiPage)).toBe(true)
  })

  it('não libera a mesma chave de página em outro departamento', () => {
    expect(hasAccessProfilePageGrant(profile, mixedArea.id, secondMultiPage)).toBe(false)
  })

  it('não libera página do mesmo departamento que não foi concedida', () => {
    expect(hasAccessProfilePageGrant(profile, multiPageArea.id, firstMultiPage)).toBe(false)
    expect(hasAccessProfilePageGrant(profile, multiPageArea.id, UNKNOWN_PAGE)).toBe(false)
  })

  it('não tem atalho administrativo: o perfil do sistema também só concede o que guarda', () => {
    const systemProfile = buildSystemProfile({ departmentPageAccess: [] })

    expect(hasAccessProfilePageGrant(systemProfile, multiPageArea.id, firstMultiPage)).toBe(false)
    expect(hasAccessProfilePageGrant(systemProfile, mixedArea.id, mixedAvailablePage)).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Destino do perfil                                                          */
/* -------------------------------------------------------------------------- */

describe('destino do perfil de acesso', () => {
  it('aceita como destino de perfil comum somente Executivo e Analista', () => {
    expect([...STANDARD_ACCESS_PROFILE_AUDIENCES]).toEqual(['executive', 'analyst'])

    expect(isStandardAccessProfileAudience('executive')).toBe(true)
    expect(isStandardAccessProfileAudience('analyst')).toBe(true)
  })

  it('recusa o destino do perfil do sistema e qualquer valor estranho', () => {
    expect(isStandardAccessProfileAudience('administrator')).toBe(false)
    expect(isStandardAccessProfileAudience('Executivo')).toBe(false)
    expect(isStandardAccessProfileAudience('')).toBe(false)
    expect(isStandardAccessProfileAudience(undefined)).toBe(false)
    expect(isStandardAccessProfileAudience(null)).toBe(false)
    expect(isStandardAccessProfileAudience(1)).toBe(false)
  })

  it('associa cada perfil do sistema ao destino correspondente', () => {
    expect(accessProfileAudienceForUserProfile('Administrador')).toBe('administrator')
    expect(accessProfileAudienceForUserProfile('Executivo')).toBe('executive')
    expect(accessProfileAudienceForUserProfile('Analista')).toBe('analyst')
  })
})

/* -------------------------------------------------------------------------- */
/* Compatibilidade com o perfil do sistema                                    */
/* -------------------------------------------------------------------------- */

describe('compatibilidade entre perfil de acesso e perfil do sistema', () => {
  const systemProfile = buildSystemProfile()
  const executiveProfile = buildProfile({ audience: 'executive' })
  const analystProfile = buildProfile({ audience: 'analyst' })

  it('dá ao Administrador somente o perfil do sistema', () => {
    expect(isAccessProfileCompatibleWithUserProfile(systemProfile, 'Administrador')).toBe(true)
    expect(isAccessProfileCompatibleWithUserProfile(executiveProfile, 'Administrador')).toBe(false)
    expect(isAccessProfileCompatibleWithUserProfile(analystProfile, 'Administrador')).toBe(false)
  })

  it('dá ao Executivo somente perfil comum destinado a Executivos', () => {
    expect(isAccessProfileCompatibleWithUserProfile(executiveProfile, 'Executivo')).toBe(true)
    expect(isAccessProfileCompatibleWithUserProfile(analystProfile, 'Executivo')).toBe(false)
    expect(isAccessProfileCompatibleWithUserProfile(systemProfile, 'Executivo')).toBe(false)
  })

  it('dá ao Analista somente perfil comum destinado a Analistas', () => {
    expect(isAccessProfileCompatibleWithUserProfile(analystProfile, 'Analista')).toBe(true)
    expect(isAccessProfileCompatibleWithUserProfile(executiveProfile, 'Analista')).toBe(false)
    expect(isAccessProfileCompatibleWithUserProfile(systemProfile, 'Analista')).toBe(false)
  })

  it('não olha nome, departamentos, páginas nem ciclo de vida', () => {
    const inactive = buildProfile({
      audience: 'executive',
      name: 'Acesso Analistas',
      lifecycle: 'inactive',
      departmentPageAccess: [],
    })

    expect(isAccessProfileCompatibleWithUserProfile(inactive, 'Executivo')).toBe(true)
    expect(isAccessProfileCompatibleWithUserProfile(inactive, 'Analista')).toBe(false)
  })

  it('recusa por todos os perfis do sistema um par de tipo e destino impossível', () => {
    // Combinação que a união discriminada não permite montar, exercitada aqui
    // porque o dado pode chegar de fora do TypeScript.
    const impossible = { kind: 'standard', audience: 'administrator' } as const
    const profiles: UserProfile[] = ['Administrador', 'Executivo', 'Analista']

    for (const userProfile of profiles) {
      expect(isAccessProfileCompatibleWithUserProfile(impossible, userProfile)).toBe(false)
    }
  })

  it('não altera o perfil recebido nem devolve vínculo nenhum', () => {
    const original = buildProfile({ audience: 'executive' })
    const snapshot = JSON.stringify(original)

    expect(isAccessProfileCompatibleWithUserProfile(original, 'Executivo')).toBe(true)
    expect(JSON.stringify(original)).toBe(snapshot)
  })
})

/* -------------------------------------------------------------------------- */
/* Validação do rascunho de criação                                           */
/* -------------------------------------------------------------------------- */

describe('validação do rascunho de criação', () => {
  function creationErrorCodes(result: AccessProfileCreationValidation): AccessProfileDraftErrorCode[] {
    return result.ok ? [] : result.errors.map((error) => error.code)
  }

  it('aprova o rascunho com destino de Executivo e devolve o destino escolhido', () => {
    const result = validateAccessProfileCreationDraft(
      buildCreationDraft({ audience: 'executive' }),
      [],
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.draft.audience).toBe('executive')
    expect(result.draft.id).toBe('acp-010')
  })

  it('aprova o rascunho com destino de Analista', () => {
    const result = validateAccessProfileCreationDraft(buildCreationDraft({ audience: 'analyst' }), [])

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.draft.audience).toBe('analyst')
  })

  it('recusa a criação sem destino', () => {
    const draft = buildCreationDraft()
    delete (draft as { audience?: unknown }).audience

    expect(creationErrorCodes(validateAccessProfileCreationDraft(draft, []))).toEqual([
      'invalid-audience',
    ])
  })

  it('recusa o destino de Administrador em perfil comum', () => {
    const draft = buildCreationDraft()
    ;(draft as { audience: unknown }).audience = 'administrator'

    expect(creationErrorCodes(validateAccessProfileCreationDraft(draft, []))).toEqual([
      'invalid-audience',
    ])
  })

  it('recusa o rótulo em português como destino gravado', () => {
    const draft = buildCreationDraft()
    ;(draft as { audience: unknown }).audience = 'Executivo'

    expect(creationErrorCodes(validateAccessProfileCreationDraft(draft, []))).toEqual([
      'invalid-audience',
    ])
  })

  it('soma a recusa do destino às recusas do conteúdo, em vez de substituí-las', () => {
    const draft = buildCreationDraft({ name: '   ', departmentPageAccess: [], homePage: null })
    ;(draft as { audience: unknown }).audience = 'administrator'

    expect(creationErrorCodes(validateAccessProfileCreationDraft(draft, []))).toEqual([
      'invalid-name',
      'no-pages-selected',
      'missing-home-page',
      'invalid-audience',
    ])
  })

  it('não deduz o destino do nome nem das páginas escolhidas', () => {
    const draft = buildCreationDraft({ name: 'Acesso Executivo', audience: 'analyst' })

    const result = validateAccessProfileCreationDraft(draft, [])

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.draft.audience).toBe('analyst')
  })
})

/* -------------------------------------------------------------------------- */
/* Vínculo entre usuário e Perfil de Acesso                                   */
/* -------------------------------------------------------------------------- */

describe('normalização do vínculo gravado', () => {
  it('devolve o id sem os espaços das pontas', () => {
    expect(normalizeStoredAccessProfileId('acp-001')).toBe('acp-001')
    expect(normalizeStoredAccessProfileId('  acp-001  ')).toBe('acp-001')
    // `acp-system` não segue o padrão numérico e continua válido: o formato do
    // id não é decidido aqui.
    expect(normalizeStoredAccessProfileId('acp-system')).toBe('acp-system')
  })

  it('trata ausência, texto vazio e valor que não é texto como ausência de vínculo', () => {
    for (const value of [undefined, null, '', '   ', 0, 42, {}, [], true]) {
      expect(normalizeStoredAccessProfileId(value)).toBeNull()
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Vínculo persistente e migração                                             */
/* -------------------------------------------------------------------------- */

describe('regras do vínculo persistente', () => {
  it('normaliza somente ids textuais não vazios', () => {
    expect(normalizeStoredAccessProfileId('  acp-001  ')).toBe('acp-001')
    expect(normalizeStoredAccessProfileId('   ')).toBeNull()
    expect(normalizeStoredAccessProfileId(undefined)).toBeNull()
    expect(normalizeStoredAccessProfileId(42)).toBeNull()
  })

  it('exige perfil ativo além do destino compatível para uma atribuição', () => {
    const analyst = buildProfile()
    const inactive = buildProfile({ lifecycle: 'inactive' })

    expect(isAccessProfileAssignableToUserProfile(analyst, 'Analista')).toBe(true)
    expect(isAccessProfileAssignableToUserProfile(analyst, 'Executivo')).toBe(false)
    expect(isAccessProfileAssignableToUserProfile(inactive, 'Analista')).toBe(false)
  })

  it('compara concessões pelo par departamento e página, ignorando ordem e duplicidade', () => {
    const first = accessProfileGrantKeys([
      { departmentId: mixedArea.id, pageKeys: [mixedAvailablePage] },
      { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, firstMultiPage] },
    ])
    const second = accessProfileGrantKeys([
      { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
      { departmentId: mixedArea.id, pageKeys: [mixedAvailablePage] },
    ])

    expect(first).toEqual(second)
    expect(first.size).toBe(2)
  })

  it('preserva a página inicial válida e escolhe a primeira disponível quando ela sai', () => {
    const grants = [
      { departmentId: laterArea.id, pageKeys: [laterAreaPage] },
      { departmentId: earlierArea.id, pageKeys: [earlierAreaPage] },
    ]

    expect(
      resolveAccessProfileHomePage(grants, {
        departmentId: laterArea.id,
        pageKey: laterAreaPage,
      }),
    ).toEqual({ departmentId: laterArea.id, pageKey: laterAreaPage })
    expect(
      resolveAccessProfileHomePage(grants, {
        departmentId: multiPageArea.id,
        pageKey: secondMultiPage,
      }),
    ).toEqual({ departmentId: earlierArea.id, pageKey: earlierAreaPage })
  })
})

describe('correspondência determinística da migração', () => {
  it('atribui o perfil do sistema ao Administrador', () => {
    const system = buildSystemProfile()

    expect(
      findMigrationAccessProfile(
        { profile: 'Administrador', departmentPageAccess: [] },
        [buildProfile(), system],
      ),
    ).toBe(system)
  })

  it('atribui ao Executivo somente o único perfil ativo com o nome oficial', () => {
    const executive = buildProfile({
      id: 'acp-020',
      name: EXECUTIVE_ACCESS_PROFILE_NAME,
      audience: 'executive',
    })
    const another = buildProfile({
      id: 'acp-021',
      name: 'Executivo Comercial',
      audience: 'executive',
    })

    expect(
      findMigrationAccessProfile(
        { profile: 'Executivo', departmentPageAccess: [] },
        [another, executive],
      ),
    ).toBe(executive)
    expect(
      findMigrationAccessProfile(
        { profile: 'Executivo', departmentPageAccess: [] },
        [executive, { ...executive, id: 'acp-022' }],
      ),
    ).toBeNull()
  })

  it('atribui ao Analista somente uma correspondência exata e sem ambiguidade', () => {
    const analyst = buildProfile({
      departmentPageAccess: [
        { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
      ],
    })
    const legacyUser = {
      profile: 'Analista' as const,
      departmentPageAccess: [
        { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
      ],
    }

    expect(findMigrationAccessProfile(legacyUser, [analyst])).toBe(analyst)
    expect(
      findMigrationAccessProfile(legacyUser, [analyst, { ...analyst, id: 'acp-002' }]),
    ).toBeNull()
    expect(
      findMigrationAccessProfile(
        { ...legacyUser, departmentPageAccess: [] },
        [analyst],
      ),
    ).toBeNull()
  })
})

describe('perfil atribuível a um Perfil do Sistema', () => {
  it('exige perfil ativo, mesmo quando o destino corresponde', () => {
    const active = buildProfile({ audience: 'analyst' })
    const inactive = buildProfile({ audience: 'analyst', lifecycle: 'inactive' })

    expect(isAccessProfileAssignableToUserProfile(active, 'Analista')).toBe(true)
    expect(isAccessProfileAssignableToUserProfile(inactive, 'Analista')).toBe(false)
    // Compatibilidade e atribuibilidade são perguntas diferentes: o perfil
    // desativado continua descrevendo um acesso coerente para aquele destino.
    expect(isAccessProfileCompatibleWithUserProfile(inactive, 'Analista')).toBe(true)
  })

  it('mantém a correspondência um a um entre destino e Perfil do Sistema', () => {
    const system = buildSystemProfile()
    const executive = buildProfile({ audience: 'executive' })
    const analyst = buildProfile({ audience: 'analyst' })

    expect(isAccessProfileAssignableToUserProfile(system, 'Administrador')).toBe(true)
    expect(isAccessProfileAssignableToUserProfile(system, 'Executivo')).toBe(false)
    expect(isAccessProfileAssignableToUserProfile(system, 'Analista')).toBe(false)

    expect(isAccessProfileAssignableToUserProfile(executive, 'Executivo')).toBe(true)
    expect(isAccessProfileAssignableToUserProfile(executive, 'Administrador')).toBe(false)

    expect(isAccessProfileAssignableToUserProfile(analyst, 'Analista')).toBe(true)
    expect(isAccessProfileAssignableToUserProfile(analyst, 'Administrador')).toBe(false)
  })
})

describe('forma efetiva das concessões', () => {
  it('descreve cada página disponível como departamento mais chave', () => {
    const keys = accessProfileGrantKeys([
      { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, secondMultiPage] },
    ])

    expect([...keys].sort()).toEqual(
      [
        `${multiPageArea.id}::${firstMultiPage}`,
        `${multiPageArea.id}::${secondMultiPage}`,
      ].sort(),
    )
  })

  it('não depende da ordem em que as concessões foram gravadas', () => {
    const first = accessProfileGrantKeys([
      { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, secondMultiPage] },
    ])
    const second = accessProfileGrantKeys([
      { departmentId: multiPageArea.id, pageKeys: [secondMultiPage, firstMultiPage] },
    ])

    expect([...first].sort()).toEqual([...second].sort())
  })

  it('descarta departamento e página fora do catálogo', () => {
    const keys = accessProfileGrantKeys([
      { departmentId: UNKNOWN_DEPARTMENT, pageKeys: [firstMultiPage] },
      { departmentId: multiPageArea.id, pageKeys: [UNKNOWN_PAGE] },
    ])

    expect(keys.size).toBe(0)
  })

  it('devolve conjunto vazio para estrutura ausente ou fora de forma', () => {
    expect(accessProfileGrantKeys(undefined).size).toBe(0)
    expect(accessProfileGrantKeys(null as unknown as undefined).size).toBe(0)
  })
})

/* -------------------------------------------------------------------------- */
/* Correspondência da migração                                                */
/* -------------------------------------------------------------------------- */

/** Usuário reduzido ao que a correspondência de migração realmente consulta. */
function migrationUser(
  profile: UserProfile,
  departmentPageAccess: { departmentId: string; pageKeys: string[] }[] = [],
) {
  return { profile, departmentPageAccess }
}

const executiveProfile = buildProfile({
  id: 'acp-002',
  name: EXECUTIVE_ACCESS_PROFILE_NAME,
  audience: 'executive',
})

describe('correspondência determinística da migração', () => {
  it('leva o Administrador ao perfil do sistema', () => {
    const system = buildSystemProfile()
    const matched = findMigrationAccessProfile(migrationUser('Administrador'), [
      system,
      executiveProfile,
      buildProfile(),
    ])

    expect(matched).toBe(system)
  })

  it('deixa o Administrador sem perfil quando o perfil do sistema não está na coleção', () => {
    expect(findMigrationAccessProfile(migrationUser('Administrador'), [buildProfile()])).toBeNull()
  })

  it('leva o Executivo ao perfil executivo oficial, pelo nome aprovado', () => {
    const matched = findMigrationAccessProfile(migrationUser('Executivo'), [
      buildSystemProfile(),
      executiveProfile,
    ])

    expect(matched).toBe(executiveProfile)
  })

  it('reconhece o nome oficial gravado com caixa e espaços diferentes', () => {
    const gravado = buildProfile({
      id: 'acp-002',
      name: '  acesso   executivo ',
      audience: 'executive',
    })

    expect(findMigrationAccessProfile(migrationUser('Executivo'), [gravado])).toBe(gravado)
  })

  it('não escolhe um perfil executivo de outro nome, mesmo sendo o único', () => {
    const outro = buildProfile({
      id: 'acp-003',
      name: 'Acesso Executivo Comercial',
      audience: 'executive',
    })

    expect(findMigrationAccessProfile(migrationUser('Executivo'), [outro])).toBeNull()
  })

  it('não escolhe nenhum quando dois perfis usam o nome oficial', () => {
    const segundo = buildProfile({
      id: 'acp-004',
      name: EXECUTIVE_ACCESS_PROFILE_NAME,
      audience: 'executive',
    })

    expect(
      findMigrationAccessProfile(migrationUser('Executivo'), [executiveProfile, segundo]),
    ).toBeNull()
  })

  it('recusa o perfil executivo inativo', () => {
    const inativo = buildProfile({
      id: 'acp-002',
      name: EXECUTIVE_ACCESS_PROFILE_NAME,
      audience: 'executive',
      lifecycle: 'inactive',
    })

    expect(findMigrationAccessProfile(migrationUser('Executivo'), [inativo])).toBeNull()
  })

  it('leva o Analista ao único perfil com a mesma combinação efetiva', () => {
    const alvo = buildProfile({
      id: 'acp-010',
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }],
    })
    const outro = buildProfile({
      id: 'acp-011',
      name: 'Outro alcance',
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [secondMultiPage] }],
    })

    const matched = findMigrationAccessProfile(
      migrationUser('Analista', [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }]),
      [alvo, outro],
    )

    expect(matched).toBe(alvo)
  })

  it('compara por conjunto, sem depender da ordem gravada', () => {
    const alvo = buildProfile({
      id: 'acp-010',
      departmentPageAccess: [
        { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, secondMultiPage] },
      ],
    })

    const matched = findMigrationAccessProfile(
      migrationUser('Analista', [
        { departmentId: multiPageArea.id, pageKeys: [secondMultiPage, firstMultiPage] },
      ]),
      [alvo],
    )

    expect(matched).toBe(alvo)
  })

  it('não escolhe nenhum quando dois perfis compatíveis descrevem a mesma combinação', () => {
    const primeiro = buildProfile({ id: 'acp-010' })
    const segundo = buildProfile({ id: 'acp-011', name: 'Cópia do mesmo alcance' })

    expect(
      findMigrationAccessProfile(
        migrationUser('Analista', [
          { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
        ]),
        [primeiro, segundo],
      ),
    ).toBeNull()
  })

  it('não escolhe nenhum quando a combinação não corresponde a perfil algum', () => {
    expect(
      findMigrationAccessProfile(
        migrationUser('Analista', [
          { departmentId: multiPageArea.id, pageKeys: [firstMultiPage, secondMultiPage] },
        ]),
        [buildProfile()],
      ),
    ).toBeNull()
  })

  it('não escolhe um perfil de destino incompatível, mesmo com a combinação idêntica', () => {
    const gemeoExecutivo = buildProfile({ id: 'acp-012', audience: 'executive' })

    expect(
      findMigrationAccessProfile(
        migrationUser('Analista', [
          { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
        ]),
        [gemeoExecutivo],
      ),
    ).toBeNull()
  })

  it('deixa sem perfil o Analista que não tem nenhuma página disponível gravada', () => {
    expect(findMigrationAccessProfile(migrationUser('Analista', []), [buildProfile()])).toBeNull()
    expect(
      findMigrationAccessProfile(
        migrationUser('Analista', [{ departmentId: UNKNOWN_DEPARTMENT, pageKeys: [UNKNOWN_PAGE] }]),
        [buildProfile()],
      ),
    ).toBeNull()
  })

  it('não decide pela ordem da coleção', () => {
    const alvo = buildProfile({ id: 'acp-010' })
    const outro = buildProfile({
      id: 'acp-011',
      name: 'Outro alcance',
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [secondMultiPage] }],
    })
    const user = migrationUser('Analista', [
      { departmentId: multiPageArea.id, pageKeys: [firstMultiPage] },
    ])

    expect(findMigrationAccessProfile(user, [alvo, outro])).toBe(alvo)
    expect(findMigrationAccessProfile(user, [outro, alvo])).toBe(alvo)
  })
})

/* -------------------------------------------------------------------------- */
/* Página inicial a partir das concessões                                     */
/* -------------------------------------------------------------------------- */

describe('página inicial calculada a partir das concessões', () => {
  it('preserva a página atual quando ela continua concedida e disponível', () => {
    const grants = [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage, secondMultiPage] }]

    expect(
      resolveAccessProfileHomePage(grants, {
        departmentId: multiPageArea.id,
        pageKey: secondMultiPage,
      }),
    ).toEqual({ departmentId: multiPageArea.id, pageKey: secondMultiPage })
  })

  it('substitui a página atual que deixou de ser concedida', () => {
    const grants = [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }]

    expect(
      resolveAccessProfileHomePage(grants, {
        departmentId: multiPageArea.id,
        pageKey: secondMultiPage,
      }),
    ).toEqual({ departmentId: multiPageArea.id, pageKey: firstMultiPage })
  })

  it('escolhe a primeira página concedida na ordem oficial, e não na ordem gravada', () => {
    // As concessões entram na ordem inversa à do catálogo de propósito.
    const grants = [
      { departmentId: laterArea.id, pageKeys: [laterAreaPage] },
      { departmentId: earlierArea.id, pageKeys: [earlierAreaPage] },
    ]

    expect(resolveAccessProfileHomePage(grants, null)).toEqual({
      departmentId: earlierArea.id,
      pageKey: earlierAreaPage,
    })
  })

  it('devolve null quando nada foi concedido', () => {
    expect(resolveAccessProfileHomePage([], null)).toBeNull()
  })

  it('nunca escolhe uma página que não está no catálogo dos departamentos', () => {
    const grants = [{ departmentId: multiPageArea.id, pageKeys: [UNKNOWN_PAGE] }]

    // A Visão Geral Executiva é um contexto global do portal e não tem par
    // departamento e página: ela não é candidata em nenhuma hipótese, e uma
    // concessão que só tem chave desconhecida não produz página inicial.
    expect(resolveAccessProfileHomePage(grants, null)).toBeNull()
  })

  it('é a mesma decisão que a página inicial efetiva de um perfil', () => {
    const profile = buildProfile({
      departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [secondMultiPage] }],
      homePage: { departmentId: multiPageArea.id, pageKey: firstMultiPage },
    })

    expect(resolveEffectiveAccessProfileHomePage(profile)).toEqual(
      resolveAccessProfileHomePage(profile.departmentPageAccess, profile.homePage),
    )
  })
})
