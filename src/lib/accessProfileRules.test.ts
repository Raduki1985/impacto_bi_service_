import { describe, expect, it } from 'vitest'
import { biAreas, type BiArea } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import {
  ACCESS_PROFILE_ID_PATTERN,
  STANDARD_ACCESS_PROFILE_AUDIENCES,
  accessProfileAudienceForUserProfile,
  accessProfileCapabilities,
  availableDepartmentPageKeys,
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
    name: 'Acesso Total',
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

  it('impede a exclusão do perfil comum que já foi utilizado', () => {
    const capabilities = accessProfileCapabilities(buildProfile({ hasBeenUsed: true }), 0)

    expect(capabilities.canDelete).toBe(false)
    expect(capabilities.canDeactivate).toBe(true)
    expect(capabilities.canEdit).toBe(true)
    expect(capabilities.canRename).toBe(true)
  })

  it('impede desativar e excluir o perfil comum com usuários vinculados', () => {
    const capabilities = accessProfileCapabilities(buildProfile(), 3)

    expect(capabilities.canDeactivate).toBe(false)
    expect(capabilities.canDelete).toBe(false)
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

  it('bloqueia a exclusão do perfil já utilizado mesmo depois de os usuários saírem', () => {
    expect(accessProfileCapabilities(buildProfile({ hasBeenUsed: true }), 0).canDelete).toBe(false)
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
