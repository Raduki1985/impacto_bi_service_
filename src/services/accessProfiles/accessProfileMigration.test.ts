import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { biAreas, type BiArea } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import { ADMIN_FULL_PERMISSION } from '../../config/permissions'
import type { User } from '../../data/dashboardTypes'
import type { DepartmentPageAccess, DepartmentPageReference } from '../../types/access'
import { readStoredAccessProfiles } from './accessProfileStorage'
import { listAccessProfiles } from './accessProfileRepository'
import {
  analyzeAccessProfileMigration,
  type AccessProfileMigrationAnalysis,
  type AccessProfileMigrationIssue,
  type AccessProfileMigrationIssueCode,
} from './accessProfileMigration'

/**
 * Testes do analisador da migração provisória.
 *
 * Os departamentos e as páginas vêm do catálogo real, localizados em tempo de
 * execução; só o que precisa estar fora do catálogo é inventado. Os usuários são
 * montados aqui com o tipo real `User`, porque a coleção real do portal muda com
 * o mock e um teste preso a ela deixaria de provar a regra.
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

function requireKey(keys: readonly string[], index: number, description: string): string {
  const key = keys.at(index)
  if (key === undefined) throw new Error(`Catálogo sem ${description}: o teste precisa de dados reais.`)

  return key
}

const grantArea = requireArea(
  'departamento com duas páginas disponíveis',
  (area) => availablePageKeys(area).length >= 2,
)
const firstPage = requireKey(availablePageKeys(grantArea), 0, 'primeira página disponível')
const secondPage = requireKey(availablePageKeys(grantArea), 1, 'segunda página disponível')

const otherArea = requireArea(
  'segundo departamento com página disponível',
  (area) => area.id !== grantArea.id && availablePageKeys(area).length >= 1,
)
const otherPage = requireKey(availablePageKeys(otherArea), 0, 'página do segundo departamento')

const UNKNOWN_DEPARTMENT = 'departamento-que-nao-existe'
const UNKNOWN_PAGE = 'pagina-que-nao-existe'

/* -------------------------------------------------------------------------- */
/* Montagem                                                                   */
/* -------------------------------------------------------------------------- */

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'usr-001',
    name: 'Usuário de Teste',
    email: 'teste@impacto.com.br',
    profile: 'Analista',
    permissions: grantArea.label,
    permissionKeys: [],
    departments: [grantArea.label],
    departmentPageAccess: [],
    status: 'Ativo',
    lastAccess: 'Nunca acessou',
    initials: 'UT',
    ...overrides,
  }
}

function buildAdministrator(overrides: Partial<User> = {}): User {
  return buildUser({
    profile: 'Administrador',
    permissions: 'Todos os acessos',
    permissionKeys: [ADMIN_FULL_PERMISSION],
    ...overrides,
  })
}

/** `buildUser` já nasce Analista: este é o outro perfil que forma grupo. */
function buildExecutive(overrides: Partial<User> = {}): User {
  return buildUser({ profile: 'Executivo', ...overrides })
}

function grants(...entries: [string, string[]][]): DepartmentPageAccess[] {
  return entries.map(([departmentId, pageKeys]) => ({ departmentId, pageKeys }))
}

/** As quatro formas de estrutura ilegível que a leitura reconhece. */
function invalidStructures(): User[] {
  return [
    // A coleção inteira não é um array.
    buildUser({ id: 'usr-001', departmentPageAccess: null as unknown as DepartmentPageAccess[] }),
    // Uma entrada não é objeto.
    buildUser({
      id: 'usr-002',
      departmentPageAccess: ['texto'] as unknown as DepartmentPageAccess[],
    }),
    // A entrada é objeto, mas pageKeys não é array.
    buildUser({
      id: 'usr-003',
      departmentPageAccess: [{ departmentId: grantArea.id }] as unknown as DepartmentPageAccess[],
    }),
    // A chave de página não é texto.
    buildUser({
      id: 'usr-004',
      departmentPageAccess: grants([grantArea.id, [1 as unknown as string]]),
    }),
  ]
}

const invalidStructureUsers = invalidStructures()

function issueCodes(
  issues: readonly { code: AccessProfileMigrationIssueCode }[],
): AccessProfileMigrationIssueCode[] {
  return issues.map((item) => item.code)
}

/** Todas as pendências dos grupos, para as buscas que não dependem de um grupo. */
function groupIssueCodes(analysis: AccessProfileMigrationAnalysis) {
  return issueCodes(analysis.groups.flatMap((group) => group.issues))
}

function unresolvedIds(analysis: AccessProfileMigrationAnalysis): string[] {
  return analysis.unresolvedUsers.map((item) => item.userId)
}

function groupedIds(analysis: AccessProfileMigrationAnalysis): string[] {
  return analysis.groups.flatMap((group) => group.userIds)
}

/**
 * Ordem documentada das pendências: usuário, código, departamento e página, com
 * o campo ausente antes de qualquer texto.
 *
 * Escrita aqui de propósito, e não importada do analisador: o teste precisa
 * afirmar a regra de forma independente, senão passaria a comparar o analisador
 * consigo mesmo.
 */
function compareIssueOrder(
  first: AccessProfileMigrationIssue,
  second: AccessProfileMigrationIssue,
): number {
  const text = (one: string, other: string) => (one === other ? 0 : one < other ? -1 : 1)
  const optional = (one: string | undefined, other: string | undefined) => {
    if (one === other) return 0
    if (one === undefined) return -1
    if (other === undefined) return 1

    return text(one, other)
  }

  return (
    optional(first.userId, second.userId) ||
    text(first.code, second.code) ||
    optional(first.departmentId, second.departmentId) ||
    optional(first.pageKey, second.pageKey)
  )
}

/** Afirma a ordem documentada comparando cada pendência com a seguinte. */
function expectSortedIssues(issues: readonly AccessProfileMigrationIssue[]): void {
  for (let index = 1; index < issues.length; index += 1) {
    expect(compareIssueOrder(issues[index - 1], issues[index])).toBeLessThanOrEqual(0)
  }
}

/** Sequência legível das pendências, para afirmar a ordem exata esperada. */
function issueOrder(issues: readonly AccessProfileMigrationIssue[]): string[] {
  return issues.map((item) =>
    [item.userId ?? '-', item.code, item.departmentId ?? '-', item.pageKey ?? '-'].join(' '),
  )
}

/**
 * Afirma a ordem dos pares sem depender da ordem do catálogo real: os ids e as
 * chaves vêm de lá, e nada garante que já estejam em ordem alfabética.
 */
function expectSortedPairs(pairs: readonly DepartmentPageReference[]): void {
  const text = (one: string, other: string) => (one === other ? 0 : one < other ? -1 : 1)

  for (let index = 1; index < pairs.length; index += 1) {
    const previous = pairs[index - 1]
    const current = pairs[index]
    const order =
      text(previous.departmentId, current.departmentId) || text(previous.pageKey, current.pageKey)

    expect(order).toBeLessThanOrEqual(0)
  }
}

/* -------------------------------------------------------------------------- */
/* Armazenamento em memória                                                   */
/* -------------------------------------------------------------------------- */

/** Só existe para provar que o analisador não escreve nada. */
class MemoryStorage {
  readonly entries = new Map<string, string>()

  get length(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value)
  }
}

type GlobalWithWindow = { window?: { localStorage: unknown } }

function globalWithWindow(): GlobalWithWindow {
  return globalThis as unknown as GlobalWithWindow
}

let memory: MemoryStorage

beforeEach(() => {
  memory = new MemoryStorage()
  globalWithWindow().window = { localStorage: memory }
})

afterEach(() => {
  delete globalWithWindow().window
})

/* -------------------------------------------------------------------------- */
/* Agrupamento                                                                */
/* -------------------------------------------------------------------------- */

describe('agrupamento por combinação de acessos', () => {
  it('reúne no mesmo grupo usuários com a mesma combinação em ordem diferente', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ id: 'usr-001', departmentPageAccess: grants([grantArea.id, [firstPage, secondPage]]) }),
      buildUser({ id: 'usr-002', departmentPageAccess: grants([grantArea.id, [secondPage, firstPage]]) }),
    ])

    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].userIds).toEqual(['usr-001', 'usr-002'])
    expect(analysis.groups[0].userCount).toBe(2)
    expect(analysis.groups[0].accessCount).toBe(2)
  })

  it('reúne no mesmo grupo quem tem os mesmos pares divididos em entradas diferentes', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ id: 'usr-001', departmentPageAccess: grants([grantArea.id, [firstPage, secondPage]]) }),
      buildUser({
        id: 'usr-002',
        departmentPageAccess: grants([grantArea.id, [secondPage]], [grantArea.id, [firstPage]]),
      }),
    ])

    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].userIds).toEqual(['usr-001', 'usr-002'])
  })

  it('separa combinações diferentes', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ id: 'usr-001', departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
      buildUser({
        id: 'usr-002',
        departmentPageAccess: grants([grantArea.id, [firstPage, secondPage]]),
      }),
    ])

    expect(analysis.groups).toHaveLength(2)
    expect(analysis.groups.map((group) => group.userCount)).toEqual([1, 1])
    expect(analysis.groups[0].signature).not.toBe(analysis.groups[1].signature)
  })

  it('separa usuários com a mesma quantidade de acessos, mas pares diferentes', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants([grantArea.id, [firstPage, secondPage]]),
      }),
      buildUser({
        id: 'usr-002',
        departmentPageAccess: grants([grantArea.id, [firstPage]], [otherArea.id, [otherPage]]),
      }),
    ])

    expect(analysis.groups).toHaveLength(2)
    expect(analysis.groups.every((group) => group.accessCount === 2)).toBe(true)
  })

  it('separa a mesma chave de página concedida em departamentos diferentes', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ id: 'usr-001', departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
      buildUser({ id: 'usr-002', departmentPageAccess: grants([otherArea.id, [firstPage]]) }),
    ])

    expect(analysis.groups).toHaveLength(2)
  })

  it('forma grupo também para quem não tem nenhum acesso', () => {
    const analysis = analyzeAccessProfileMigration([buildUser({ departmentPageAccess: [] })])

    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].accessCount).toBe(0)
    expect(analysis.groups[0].pageAccess).toEqual([])
    expect(analysis.unresolvedUsers).toEqual([])
  })

  it('reúne no mesmo grupo vazio quem tem acesso válido e vazio', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ id: 'usr-001', departmentPageAccess: [] }),
      buildUser({ id: 'usr-002', departmentPageAccess: [] }),
    ])

    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].userIds).toEqual(['usr-001', 'usr-002'])
    expect(analysis.unresolvedUsers).toEqual([])
  })

  it('não coloca no grupo de acesso vazio quem tem estrutura ilegível', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ id: 'usr-001', departmentPageAccess: [] }),
      buildUser({ id: 'usr-002', departmentPageAccess: null as unknown as DepartmentPageAccess[] }),
    ])

    expect(groupedIds(analysis)).toEqual(['usr-001'])
    expect(unresolvedIds(analysis)).toEqual(['usr-002'])
    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].accessCount).toBe(0)
  })

  it('conta todos os usuários analisados, inclusive os Administradores', () => {
    const analysis = analyzeAccessProfileMigration([
      buildAdministrator({ id: 'usr-001' }),
      buildUser({ id: 'usr-002', departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
    ])

    expect(analysis.analyzedUserCount).toBe(2)
  })
})

/* -------------------------------------------------------------------------- */
/* Separação por destino                                                      */
/* -------------------------------------------------------------------------- */

describe('separação entre Executivos e Analistas', () => {
  const sameAccess = grants([grantArea.id, [firstPage]])

  it('não reúne Executivo e Analista com acessos idênticos', () => {
    const analysis = analyzeAccessProfileMigration([
      buildExecutive({ id: 'usr-001', departmentPageAccess: sameAccess }),
      buildUser({ id: 'usr-002', departmentPageAccess: sameAccess }),
    ])

    expect(analysis.groups).toHaveLength(2)
    expect(groupedIds(analysis)).toEqual(['usr-002', 'usr-001'])
    expect(analysis.unresolvedUsers).toEqual([])
  })

  it('mantém a mesma assinatura de acesso nos dois grupos, que se separam pelo destino', () => {
    const analysis = analyzeAccessProfileMigration([
      buildExecutive({ id: 'usr-001', departmentPageAccess: sameAccess }),
      buildUser({ id: 'usr-002', departmentPageAccess: sameAccess }),
    ])

    expect(analysis.groups[0].signature).toBe(analysis.groups[1].signature)
    expect(analysis.groups.map((group) => group.audience)).toEqual(['analyst', 'executive'])
  })

  it('informa o destino de cada grupo', () => {
    const analysis = analyzeAccessProfileMigration([
      buildExecutive({ id: 'usr-001', departmentPageAccess: sameAccess }),
      buildUser({ id: 'usr-002', departmentPageAccess: grants([otherArea.id, [otherPage]]) }),
    ])

    const byAudience = new Map(analysis.groups.map((group) => [group.audience, group.userIds]))

    expect(byAudience.get('executive')).toEqual(['usr-001'])
    expect(byAudience.get('analyst')).toEqual(['usr-002'])
  })

  it('reúne Executivos com a mesma combinação em um grupo só', () => {
    const analysis = analyzeAccessProfileMigration([
      buildExecutive({ id: 'usr-001', departmentPageAccess: sameAccess }),
      buildExecutive({ id: 'usr-002', departmentPageAccess: sameAccess }),
    ])

    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].audience).toBe('executive')
    expect(analysis.groups[0].userIds).toEqual(['usr-001', 'usr-002'])
  })

  it('separa também os grupos de acesso vazio pelo destino', () => {
    const analysis = analyzeAccessProfileMigration([
      buildExecutive({ id: 'usr-001', departmentPageAccess: [] }),
      buildUser({ id: 'usr-002', departmentPageAccess: [] }),
    ])

    expect(analysis.groups).toHaveLength(2)
    expect(analysis.groups.every((group) => group.accessCount === 0)).toBe(true)
  })

  it('não dá destino a quem tem perfil funcional desconhecido', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        profile: 'Usuário Departamental' as User['profile'],
        departmentPageAccess: sameAccess,
      }),
    ])

    expect(analysis.groups).toEqual([])
    expect(unresolvedIds(analysis)).toEqual(['usr-001'])
    expect(analysis.unresolvedUsers[0].migrationBlocked).toBe(true)
    expect(issueCodes(analysis.unresolvedUsers[0].issues)).toContain('unknown-system-profile')
  })

  it('preserva o acesso legível de quem ficou sem destino', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        profile: 'Gestor' as User['profile'],
        departmentPageAccess: sameAccess,
      }),
    ])

    expect(analysis.unresolvedUsers[0].readablePageAccess).toEqual([
      { departmentId: grantArea.id, pageKey: firstPage },
    ])
    expect(analysis.unresolvedUsers[0].readableAccessCount).toBe(1)
  })

  it('acumula as duas pendências de quem não tem destino nem estrutura legível', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        profile: 'Gestor' as User['profile'],
        departmentPageAccess: null as unknown as DepartmentPageAccess[],
      }),
    ])

    expect(issueCodes(analysis.unresolvedUsers[0].issues)).toEqual([
      'invalid-access-structure',
      'unknown-system-profile',
    ])
  })

  it('continua mandando o Administrador para o perfil do sistema, e não para um grupo', () => {
    const analysis = analyzeAccessProfileMigration([
      buildAdministrator({ id: 'usr-001', departmentPageAccess: sameAccess }),
      buildExecutive({ id: 'usr-002', departmentPageAccess: sameAccess }),
    ])

    expect(analysis.administrators.userIds).toEqual(['usr-001'])
    expect(analysis.administrators.targetProfileId).toBe('acp-system')
    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].audience).toBe('executive')
  })
})

/* -------------------------------------------------------------------------- */
/* Identificadores provisórios                                                */
/* -------------------------------------------------------------------------- */

describe('grupos provisórios', () => {
  it('usa identificador e nome provisórios, nunca um id real de perfil', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ id: 'usr-001', departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
      buildUser({ id: 'usr-002', departmentPageAccess: grants([otherArea.id, [otherPage]]) }),
    ])

    expect(analysis.groups.map((group) => group.id)).toEqual([
      'grupo-provisorio-1',
      'grupo-provisorio-2',
    ])
    expect(analysis.groups.map((group) => group.name)).toEqual([
      'Grupo provisório 1',
      'Grupo provisório 2',
    ])
    expect(analysis.groups.every((group) => !/^acp-\d+$/.test(group.id))).toBe(true)
  })

  it('marca que o nome provisório ainda precisa de revisão', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
    ])

    expect(analysis.groups[0].needsNameReview).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Administradores                                                            */
/* -------------------------------------------------------------------------- */

describe('Administradores', () => {
  it('destina os Administradores ao perfil do sistema', () => {
    const analysis = analyzeAccessProfileMigration([
      buildAdministrator({ id: 'usr-001' }),
      buildAdministrator({ id: 'usr-002' }),
    ])

    expect(analysis.administrators.targetProfileId).toBe('acp-system')
    expect(analysis.administrators.targetProfileName).toBe('Acesso do Sistema')
    expect(analysis.administrators.userIds).toEqual(['usr-001', 'usr-002'])
    expect(analysis.administrators.userCount).toBe(2)
    expect(analysis.administrators.issues).toEqual([])
  })

  it('não inclui Administradores em nenhum grupo comum', () => {
    const analysis = analyzeAccessProfileMigration([
      buildAdministrator({
        id: 'usr-001',
        departmentPageAccess: grants([grantArea.id, [firstPage]]),
      }),
      buildUser({ id: 'usr-002', departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
    ])

    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].userIds).toEqual(['usr-002'])
    expect(analysis.administrators.userIds).toEqual(['usr-001'])
  })

  it('trata como Administrador quem tem admin.full sem o perfil, e registra a pendência', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        permissionKeys: [ADMIN_FULL_PERMISSION],
        departmentPageAccess: grants([grantArea.id, [firstPage]]),
      }),
    ])

    expect(analysis.administrators.userIds).toEqual(['usr-001'])
    expect(analysis.groups).toEqual([])
    expect(issueCodes(analysis.administrators.issues)).toEqual([
      'bypass-without-administrator-profile',
    ])
    expect(analysis.administrators.issues[0].userId).toBe('usr-001')
  })

  it('registra pendência quando o perfil Administrador está sem admin.full', () => {
    const analysis = analyzeAccessProfileMigration([
      buildAdministrator({ id: 'usr-001', permissionKeys: [] }),
    ])

    expect(analysis.administrators.userIds).toEqual(['usr-001'])
    expect(issueCodes(analysis.administrators.issues)).toEqual(['administrator-without-bypass'])
  })
})

/* -------------------------------------------------------------------------- */
/* Duplicidades                                                               */
/* -------------------------------------------------------------------------- */

describe('duplicidades', () => {
  it('não deixa a repetição alterar a assinatura do grupo', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants([grantArea.id, [firstPage, firstPage, secondPage]]),
      }),
      buildUser({
        id: 'usr-002',
        departmentPageAccess: grants([grantArea.id, [firstPage, secondPage]]),
      }),
    ])

    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].userIds).toEqual(['usr-001', 'usr-002'])
    expect(analysis.groups[0].accessCount).toBe(2)
  })

  it('não deixa a repetição em entradas diferentes alterar a assinatura', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants([grantArea.id, [firstPage]], [grantArea.id, [firstPage]]),
      }),
      buildUser({ id: 'usr-002', departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
    ])

    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].accessCount).toBe(1)
  })

  it('registra a repetição como pendência identificando usuário e par', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-007',
        departmentPageAccess: grants([grantArea.id, [firstPage, firstPage]]),
      }),
    ])

    const duplicate = analysis.groups[0].issues.find(
      (item) => item.code === 'duplicate-page-access',
    )

    expect(duplicate).toBeDefined()
    expect(duplicate?.userId).toBe('usr-007')
    expect(duplicate?.departmentId).toBe(grantArea.id)
    expect(duplicate?.pageKey).toBe(firstPage)
    expect(duplicate?.requiredAction.length).toBeGreaterThan(0)
  })
})

/* -------------------------------------------------------------------------- */
/* Dados inválidos                                                            */
/* -------------------------------------------------------------------------- */

describe('dados inválidos', () => {
  it('registra departamento fora do catálogo sem inspecionar as páginas dele', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants([UNKNOWN_DEPARTMENT, [UNKNOWN_PAGE, firstPage]]),
      }),
    ])

    const codes = groupIssueCodes(analysis)

    expect(codes).toContain('unknown-department')
    expect(codes).not.toContain('unknown-page')
  })

  it('registra página fora do catálogo do departamento', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants([grantArea.id, [firstPage, UNKNOWN_PAGE]]),
      }),
    ])

    const unknownPage = analysis.groups[0].issues.find((item) => item.code === 'unknown-page')

    expect(unknownPage?.departmentId).toBe(grantArea.id)
    expect(unknownPage?.pageKey).toBe(UNKNOWN_PAGE)
  })

  it('registra departamento e página sem identificador', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ id: 'usr-001', departmentPageAccess: grants(['   ', ['x']]) }),
      buildUser({ id: 'usr-002', departmentPageAccess: grants([grantArea.id, ['']]) }),
    ])

    const codes = groupIssueCodes(analysis)

    expect(codes).toContain('missing-department-id')
    expect(codes).toContain('missing-page-key')
  })

  it('registra estrutura de acesso inválida sem descartar o usuário', () => {
    const analysis = analyzeAccessProfileMigration(invalidStructureUsers)

    const codes = issueCodes(analysis.unresolvedUsers.flatMap((item) => item.issues))

    // Nenhum deles é descartado da análise: todos saem identificados, com a
    // pendência que explica por que a leitura não pôde ser concluída.
    expect(unresolvedIds(analysis)).toEqual(['usr-001', 'usr-002', 'usr-003', 'usr-004'])
    expect(codes.filter((code) => code === 'invalid-access-structure')).toHaveLength(4)
    expect(groupIssueCodes(analysis)).not.toContain('invalid-access-structure')
  })

  it('mantém a pendência do departamento inválido sem repeti-la por entrada repetida', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants(
          [UNKNOWN_DEPARTMENT, [UNKNOWN_PAGE]],
          [UNKNOWN_DEPARTMENT, ['outra']],
        ),
      }),
    ])

    expect(groupIssueCodes(analysis).filter((code) => code === 'unknown-department')).toHaveLength(
      1,
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Usuários não resolvidos                                                    */
/* -------------------------------------------------------------------------- */

describe('usuários não resolvidos', () => {
  it('tira dos grupos o usuário cuja coleção de acessos não é um array', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ id: 'usr-001', departmentPageAccess: null as unknown as DepartmentPageAccess[] }),
    ])

    expect(unresolvedIds(analysis)).toEqual(['usr-001'])
    expect(analysis.groups).toEqual([])
    expect(analysis.unresolvedUsers[0].readablePageAccess).toEqual([])
    expect(analysis.unresolvedUsers[0].readableAccessCount).toBe(0)
  })

  it('tira dos grupos o usuário com entrada que não é objeto', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: ['texto'] as unknown as DepartmentPageAccess[],
      }),
    ])

    expect(unresolvedIds(analysis)).toEqual(['usr-001'])
    expect(analysis.groups).toEqual([])
  })

  it('tira dos grupos o usuário cuja lista de páginas não é um array', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: [
          { departmentId: grantArea.id, pageKeys: firstPage },
        ] as unknown as DepartmentPageAccess[],
      }),
    ])

    expect(unresolvedIds(analysis)).toEqual(['usr-001'])
    expect(analysis.groups).toEqual([])
  })

  it('tira dos grupos o usuário com chave de página que não é texto', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants([grantArea.id, [1 as unknown as string]]),
      }),
    ])

    expect(unresolvedIds(analysis)).toEqual(['usr-001'])
    expect(analysis.groups).toEqual([])
  })

  it('preserva os pares legíveis de quem tem parte válida e parte inválida', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants(
          [otherArea.id, [otherPage]],
          [grantArea.id, [firstPage, 1 as unknown as string, secondPage]],
        ),
      }),
    ])

    const unresolved = analysis.unresolvedUsers[0]

    // Nada legível é descartado em silêncio: o que veio antes e o que veio
    // depois da entrada inválida continuam ali, e em ordem.
    expect(unresolved.readablePageAccess).toHaveLength(3)
    expect(unresolved.readablePageAccess).toContainEqual({
      departmentId: otherArea.id,
      pageKey: otherPage,
    })
    expect(unresolved.readablePageAccess).toContainEqual({
      departmentId: grantArea.id,
      pageKey: firstPage,
    })
    expect(unresolved.readablePageAccess).toContainEqual({
      departmentId: grantArea.id,
      pageKey: secondPage,
    })
    expect(unresolved.readableAccessCount).toBe(3)
    expectSortedPairs(unresolved.readablePageAccess)
  })

  it('não deixa a parte legível formar grupo', () => {
    const analysis = analyzeAccessProfileMigration([
      // A parte legível dele é exatamente a combinação do usuário seguinte, e
      // ainda assim os dois não podem cair no mesmo grupo: só um dos dois teve
      // o acesso lido por inteiro.
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants([grantArea.id, [firstPage, 1 as unknown as string]]),
      }),
      buildUser({ id: 'usr-002', departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
    ])

    expect(groupedIds(analysis)).toEqual(['usr-002'])
    expect(unresolvedIds(analysis)).toEqual(['usr-001'])
    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0].userCount).toBe(1)
  })

  it('marca a migração como bloqueada e não dá id nem nome provisório', () => {
    const analysis = analyzeAccessProfileMigration(invalidStructureUsers)

    for (const unresolved of analysis.unresolvedUsers) {
      expect(unresolved.migrationBlocked).toBe(true)
      expect(Object.keys(unresolved).sort()).toEqual([
        'issues',
        'migrationBlocked',
        'readableAccessCount',
        'readablePageAccess',
        'userId',
      ])
    }
  })

  it('continua contando os não resolvidos entre os usuários analisados', () => {
    const analysis = analyzeAccessProfileMigration([
      ...invalidStructureUsers,
      buildUser({ id: 'usr-005', departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
      buildAdministrator({ id: 'usr-006' }),
    ])

    expect(analysis.analyzedUserCount).toBe(6)
    expect(analysis.unresolvedUsers).toHaveLength(4)
    expect(groupedIds(analysis)).toEqual(['usr-005'])
    expect(analysis.administrators.userIds).toEqual(['usr-006'])
  })

  it('ordena os usuários não resolvidos por identificador', () => {
    const analysis = analyzeAccessProfileMigration([...invalidStructureUsers].reverse())

    expect(unresolvedIds(analysis)).toEqual(['usr-001', 'usr-002', 'usr-003', 'usr-004'])
  })

  it('mantém o Administrador com lista granular inválida no perfil do sistema', () => {
    const analysis = analyzeAccessProfileMigration([
      buildAdministrator({
        id: 'usr-001',
        departmentPageAccess: null as unknown as DepartmentPageAccess[],
      }),
      buildAdministrator({
        id: 'usr-002',
        departmentPageAccess: grants([grantArea.id, [1 as unknown as string]]),
      }),
    ])

    // O acesso efetivo do Administrador é global: a lista granular não controla
    // o que ele abre, e por isso estar malformada não bloqueia a migração dele.
    expect(analysis.administrators.userIds).toEqual(['usr-001', 'usr-002'])
    expect(analysis.administrators.targetProfileId).toBe('acp-system')
    expect(analysis.unresolvedUsers).toEqual([])
    expect(analysis.groups).toEqual([])
    expect(analysis.administrators.issues).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* Preservação exata dos acessos                                              */
/* -------------------------------------------------------------------------- */

describe('preservação dos acessos', () => {
  it('não acrescenta nenhum acesso, nem a Visão Geral do departamento', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ departmentPageAccess: grants([grantArea.id, [secondPage]]) }),
    ])

    expect(analysis.groups[0].pageAccess).toEqual([
      { departmentId: grantArea.id, pageKey: secondPage },
    ])
    expect(analysis.groups[0].accessCount).toBe(1)
  })

  it('não remove acesso fora do catálogo', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        departmentPageAccess: grants(
          [grantArea.id, [firstPage, UNKNOWN_PAGE]],
          [otherArea.id, [otherPage]],
          [UNKNOWN_DEPARTMENT, ['qualquer']],
        ),
      }),
    ])

    expect(analysis.groups[0].pageAccess).toHaveLength(4)
    expect(analysis.groups[0].pageAccess).toContainEqual({
      departmentId: UNKNOWN_DEPARTMENT,
      pageKey: 'qualquer',
    })
    expect(analysis.groups[0].pageAccess).toContainEqual({
      departmentId: otherArea.id,
      pageKey: otherPage,
    })
    expect(analysis.groups[0].pageAccess).toContainEqual({
      departmentId: grantArea.id,
      pageKey: UNKNOWN_PAGE,
    })
  })

  it('não inventa página inicial e registra que ela ainda precisa ser definida', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({ departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
      buildUser({ id: 'usr-002', departmentPageAccess: grants([otherArea.id, [otherPage]]) }),
    ])

    for (const group of analysis.groups) {
      expect(group.homePage).toBeNull()
      expect(group.needsHomePageDefinition).toBe(true)
      expect(issueCodes(group.issues)).toContain('home-page-undefined')
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Pureza e determinismo                                                      */
/* -------------------------------------------------------------------------- */

describe('pureza e determinismo', () => {
  // Um de cada destino: Administrador, dois grupos comuns e um não resolvido.
  const collection = [
    buildAdministrator({ id: 'usr-003' }),
    buildUser({ id: 'usr-001', departmentPageAccess: grants([grantArea.id, [firstPage]]) }),
    buildUser({
      id: 'usr-002',
      departmentPageAccess: grants([otherArea.id, [otherPage]], [grantArea.id, [firstPage]]),
    }),
    buildUser({
      id: 'usr-004',
      departmentPageAccess: grants([grantArea.id, [secondPage, 1 as unknown as string]]),
    }),
  ]

  it('não modifica a coleção recebida nem os objetos dos usuários', () => {
    const users = structuredClone(collection)
    const before = structuredClone(users)

    const analysis = analyzeAccessProfileMigration(users)
    analysis.groups[0].pageAccess[0].departmentId = 'alterado por fora'
    analysis.groups[0].userIds.push('usr-999')
    analysis.groups[0].issues.push(analysis.groups[0].issues[0])
    analysis.unresolvedUsers[0].readablePageAccess[0].departmentId = 'alterado por fora'
    analysis.unresolvedUsers[0].issues.push(analysis.unresolvedUsers[0].issues[0])
    analysis.administrators.userIds.push('usr-999')

    expect(users).toEqual(before)
  })

  it('não depende da ordem dos usuários', () => {
    const direct = analyzeAccessProfileMigration(structuredClone(collection))
    const reversed = analyzeAccessProfileMigration(structuredClone(collection).reverse())

    expect(reversed).toEqual(direct)
  })

  it('não depende da ordem dos acessos dentro do usuário', () => {
    const first = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants([grantArea.id, [firstPage, secondPage]], [otherArea.id, [otherPage]]),
      }),
    ])
    const second = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants([otherArea.id, [otherPage]], [grantArea.id, [secondPage, firstPage]]),
      }),
    ])

    expect(second).toEqual(first)
  })

  it('devolve o mesmo resultado em execuções repetidas', () => {
    expect(analyzeAccessProfileMigration(collection)).toEqual(
      analyzeAccessProfileMigration(collection),
    )
  })

  it('não escreve nada no armazenamento', () => {
    analyzeAccessProfileMigration(collection)

    expect(memory.length).toBe(0)
    expect(readStoredAccessProfiles()).toEqual({ ok: true, profiles: [] })
  })

  it('não cria nenhum perfil real no repositório', () => {
    analyzeAccessProfileMigration(collection)

    const stored = listAccessProfiles()

    expect(stored.ok).toBe(true)
    expect(stored.profiles.map((profile) => profile.id)).toEqual(['acp-system'])
    expect(readStoredAccessProfiles()).toEqual({ ok: true, profiles: [] })
  })

  it('não persiste os usuários não resolvidos', () => {
    const analysis = analyzeAccessProfileMigration(collection)

    expect(analysis.unresolvedUsers).toHaveLength(1)
    expect(memory.length).toBe(0)
    expect(readStoredAccessProfiles()).toEqual({ ok: true, profiles: [] })
  })
})

/* -------------------------------------------------------------------------- */
/* Ordem das pendências                                                       */
/* -------------------------------------------------------------------------- */

describe('ordem das pendências', () => {
  it('não deixa a ordem das entradas inválidas alterar o resultado', () => {
    const valid: [string, string[]] = [otherArea.id, [otherPage]]
    const broken = 'texto' as unknown as DepartmentPageAccess
    const alsoBroken = { departmentId: grantArea.id } as unknown as DepartmentPageAccess

    const first = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: [broken, ...grants(valid), alsoBroken],
      }),
    ])
    const second = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: [alsoBroken, broken, ...grants(valid)],
      }),
    ])

    expect(second).toEqual(first)
    expect(first.unresolvedUsers).toHaveLength(1)
    expectSortedIssues(first.unresolvedUsers[0].issues)
  })

  it('não deixa a ordem das páginas que geram pendências alterar o resultado', () => {
    const first = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants(
          [grantArea.id, [UNKNOWN_PAGE, '', firstPage, firstPage]],
          [otherArea.id, [otherPage]],
        ),
      }),
    ])
    const second = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants(
          [otherArea.id, [otherPage]],
          [grantArea.id, [firstPage, firstPage, '', UNKNOWN_PAGE]],
        ),
      }),
    ])

    expect(second).toEqual(first)
    expectSortedIssues(first.groups[0].issues)
  })

  it('ordena as pendências dos grupos por usuário, código, departamento e página', () => {
    const users = [
      buildUser({
        id: 'usr-002',
        departmentPageAccess: grants([grantArea.id, [UNKNOWN_PAGE, UNKNOWN_PAGE]]),
      }),
      buildUser({ id: 'usr-001', departmentPageAccess: grants([grantArea.id, [UNKNOWN_PAGE]]) }),
    ]

    const direct = analyzeAccessProfileMigration(users)
    const reversed = analyzeAccessProfileMigration([...users].reverse())

    // Um grupo só: os dois têm a mesma combinação, e a repetição não muda a
    // assinatura. A pendência do grupo inteiro, sem usuário, vem antes das
    // pendências de cada usuário.
    expect(direct.groups).toHaveLength(1)
    expect(issueOrder(direct.groups[0].issues)).toEqual([
      `- home-page-undefined - -`,
      `usr-001 unknown-page ${grantArea.id} ${UNKNOWN_PAGE}`,
      `usr-002 duplicate-page-access ${grantArea.id} ${UNKNOWN_PAGE}`,
      `usr-002 unknown-page ${grantArea.id} ${UNKNOWN_PAGE}`,
    ])
    expect(reversed).toEqual(direct)
    expectSortedIssues(direct.groups[0].issues)
  })

  it('ordena as pendências dos Administradores por usuário e código', () => {
    const users = [
      buildAdministrator({ id: 'usr-003', permissionKeys: [] }),
      buildUser({ id: 'usr-001', permissionKeys: [ADMIN_FULL_PERMISSION] }),
      buildAdministrator({ id: 'usr-002', permissionKeys: [] }),
    ]

    const direct = analyzeAccessProfileMigration(users)
    const reversed = analyzeAccessProfileMigration([...users].reverse())

    expect(issueOrder(direct.administrators.issues)).toEqual([
      'usr-001 bypass-without-administrator-profile - -',
      'usr-002 administrator-without-bypass - -',
      'usr-003 administrator-without-bypass - -',
    ])
    expect(reversed).toEqual(direct)
    expectSortedIssues(direct.administrators.issues)
  })

  it('ordena as pendências dos usuários não resolvidos pela mesma regra', () => {
    const analysis = analyzeAccessProfileMigration([
      buildUser({
        id: 'usr-001',
        departmentPageAccess: grants(
          [grantArea.id, [UNKNOWN_PAGE]],
          [UNKNOWN_DEPARTMENT, [1 as unknown as string]],
          [otherArea.id, [otherPage]],
        ),
      }),
    ])

    expect(issueOrder(analysis.unresolvedUsers[0].issues)).toEqual([
      `usr-001 invalid-access-structure ${UNKNOWN_DEPARTMENT} -`,
      `usr-001 unknown-department ${UNKNOWN_DEPARTMENT} -`,
      `usr-001 unknown-page ${grantArea.id} ${UNKNOWN_PAGE}`,
    ])
    expectSortedIssues(analysis.unresolvedUsers[0].issues)
  })

  it('ordena as pendências de cada usuário não resolvido, e não só a coleção', () => {
    const analysis = analyzeAccessProfileMigration(
      [...invalidStructureUsers].reverse().map((user) => structuredClone(user)),
    )

    expect(unresolvedIds(analysis)).toEqual(['usr-001', 'usr-002', 'usr-003', 'usr-004'])

    for (const unresolved of analysis.unresolvedUsers) {
      expectSortedIssues(unresolved.issues)
      expectSortedPairs(unresolved.readablePageAccess)
    }
  })
})
