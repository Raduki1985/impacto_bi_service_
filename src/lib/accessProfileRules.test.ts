import { describe, expect, it } from 'vitest'
import { biAreas, type BiArea } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import {
  ACCESS_PROFILE_ID_PATTERN,
  accessProfileCapabilities,
  accessProfileGrantKeys,
  availableDepartmentPageKeys,
  isAccessProfileAssignable,
  normalizeStoredAccessProfileId,
  resolveAccessProfileHomePage,
  evaluateAccessProfile,
  findAccessProfileIssues,
  findAccessProfileNameConflict,
  findDepartmentPage,
  hasAccessProfilePageGrant,
  hasAvailableAccessProfilePage,
  isDepartmentPageAvailable,
  normalizeAccessProfileDescription,
  normalizeAccessProfileGrants,
  normalizeAccessProfileName,
  resolveAccessProfileOperationalStatus,
  resolveEffectiveAccessProfileHomePage,
  validateAccessProfileDraft,
} from './accessProfileRules'
import type {
  AccessProfileDraft,
  AccessProfileDraftErrorCode,
  AccessProfile,
  AccessProfileDraftValidation,
  AccessProfileIssue,
  AccessProfileIssueCode,
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

function buildProfile(overrides: Partial<AccessProfile> = {}): AccessProfile {
  return {
    id: 'acp-001',
    name: 'Perfil de Teste',
    lifecycle: 'active',
    departmentPageAccess: [{ departmentId: multiPageArea.id, pageKeys: [firstMultiPage] }],
    homePage: { departmentId: multiPageArea.id, pageKey: firstMultiPage },
    hasBeenUsed: false,
    ...overrides,
  }
}

/**
 * Perfil com o nome do antigo `Acesso do Sistema`.
 *
 * Era uma FORMA própria de perfil, marcada por `kind: 'system'` e somente
 * leitura. Hoje é só um perfil com esse nome: nada o distingue dos demais.
 */
function buildSystemProfile(overrides: Partial<AccessProfile> = {}): AccessProfile {
  return { ...buildProfile(), name: 'Acesso do Sistema', ...overrides }
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
  it('não reserva mais nenhum tratamento ao perfil de nome Acesso do Sistema', () => {
    // Ele era somente leitura e recusava as quatro operações, reconhecido por
    // `isSystemAccessProfile`. A distinção saiu do domínio junto com `kind`:
    // toda linha de `access` foi criada por alguém e responde às mesmas regras.
    expect(accessProfileCapabilities(buildSystemProfile(), 0)).toEqual({
      canEdit: true,
      canRename: true,
      canDeactivate: true,
      canDelete: true,
    })
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

  it('impede desativar e excluir o perfil comum com usuários vinculados', () => {
    const capabilities = accessProfileCapabilities(buildProfile(), 3)

    expect(capabilities.canDeactivate).toBe(false)
    expect(capabilities.canDelete).toBe(false)
    expect(capabilities.canEdit).toBe(true)
    expect(capabilities.canRename).toBe(true)
  })

  it('impede excluir o perfil comum com um único usuário vinculado', () => {
    expect(accessProfileCapabilities(buildProfile(), 1).canDelete).toBe(false)
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

  it('permite excluir o perfil comum vazio, já utilizado e inativo', () => {
    expect(
      accessProfileCapabilities(buildProfile({ hasBeenUsed: true, lifecycle: 'inactive' }), 0)
        .canDelete,
    ).toBe(true)
  })

  it('impede excluir o perfil comum com vínculos, qualquer que seja o resto do estado', () => {
    expect(
      accessProfileCapabilities(buildProfile({ hasBeenUsed: true, lifecycle: 'inactive' }), 5)
        .canDelete,
    ).toBe(false)
  })

  it('libera a exclusão do perfil de nome Acesso do Sistema, como a de qualquer outro', () => {
    expect(
      accessProfileCapabilities(buildSystemProfile({ hasBeenUsed: false }), 0).canDelete,
    ).toBe(true)
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

/*
 * `destino do perfil de acesso` foi REMOVIDO.
 *
 * `STANDARD_ACCESS_PROFILE_AUDIENCES`, `isStandardAccessProfileAudience` e
 * `accessProfileAudienceForUserProfile` saíram do domínio junto com a coluna de
 * tipo de `access`.
 */

/* -------------------------------------------------------------------------- */
/* Compatibilidade com o perfil do sistema                                    */
/* -------------------------------------------------------------------------- */

/*
 * `compatibilidade entre perfil de acesso e perfil do sistema` foi REMOVIDO.
 *
 * Não existe mais par incompatível: o Perfil de Acesso deixou de declarar a quem
 * serve, e qualquer usuário pode receber qualquer perfil.
 */

/* -------------------------------------------------------------------------- */
/* Validação do rascunho de criação                                           */
/* -------------------------------------------------------------------------- */

/*
 * `validação do rascunho de criação` foi REMOVIDO.
 *
 * Ele exercitava `validateAccessProfileCreationDraft`, que era a validação do
 * conteúdo MAIS a exigência do destino. Sem destino, criar e editar validam
 * exatamente as mesmas coisas, e quem cria chama `validateAccessProfileDraft` —
 * já coberto pelo bloco `validação do rascunho na criação`.
 */

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

  it('exige perfil ativo para uma atribuição', () => {
    // A compatibilidade de destino era a segunda exigência, e saiu.
    expect(isAccessProfileAssignable(buildProfile())).toBe(true)
    expect(isAccessProfileAssignable(buildProfile({ lifecycle: 'inactive' }))).toBe(false)
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

/*
 * `correspondência determinística da migração` foi REMOVIDO junto com
 * `findMigrationAccessProfile`: as três correspondências dependiam do destino do
 * perfil, que não existe mais.
 */

describe('perfil atribuível', () => {
  it('exige apenas que o perfil esteja ativo', () => {
    expect(isAccessProfileAssignable(buildProfile())).toBe(true)
    expect(isAccessProfileAssignable(buildProfile({ lifecycle: 'inactive' }))).toBe(false)
  })

  it('não olha mais para quem vai receber o perfil', () => {
    // A função recebia o Perfil do Sistema de quem receberia, e recusava os
    // pares incompatíveis. Não recebe mais: qualquer pessoa pode receber
    // qualquer perfil, e o mesmo perfil responde a mesma coisa sempre.
    const perfil = buildProfile()

    expect(isAccessProfileAssignable(perfil)).toBe(true)
    expect(isAccessProfileAssignable({ lifecycle: perfil.lifecycle })).toBe(true)
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

/*
 * `correspondência determinística da migração` (segundo bloco) foi REMOVIDO.
 *
 * Ele exercitava `findMigrationAccessProfile`, que escolhia o perfil de um
 * usuário legado a partir do DESTINO. Sem destino, a função não tem base e foi
 * removida do domínio.
 */

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
