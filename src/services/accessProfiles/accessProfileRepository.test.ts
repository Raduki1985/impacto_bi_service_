import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { biAreas, type BiArea } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import {
  ACCESS_PROFILE_ID_PATTERN,
  evaluateAccessProfile,
  hasAccessProfilePageGrant,
  isDepartmentPageAvailable,
} from '../../lib/accessProfileRules'
import type {
  AccessProfile,
  AccessProfileDraftErrorCode,
  DepartmentPageAccess,
} from '../../types/access'
import {
  ACCESS_PROFILES_STORAGE_KEY,
  readStoredAccessProfiles,
  writeStoredAccessProfiles,
} from './accessProfileStorage'
import {
  SYSTEM_ACCESS_PROFILE_ID,
  SYSTEM_ACCESS_PROFILE_NAME,
  createAccessProfile,
  findAccessProfileById,
  getSystemAccessProfile,
  listAccessProfiles,
  loadAccessProfiles,
  updateAccessProfile,
  type AccessProfileCreateResult,
  type AccessProfileInput,
  type AccessProfileUpdateResult,
} from './accessProfileRepository'

/**
 * Testes da persistência e do repositório de perfis de acesso.
 *
 * O armazenamento é substituído por uma implementação em memória instalada em
 * `globalThis.window`, o mesmo lugar que `getStorage` consulta: nenhum
 * localStorage real é tocado e nenhuma dependência de navegador é necessária.
 * Como o repositório não guarda coleção em memória, cada teste começa de um
 * armazenamento novo sem precisar reiniciar módulos.
 *
 * Os departamentos e as páginas vêm do catálogo real, localizados em tempo de
 * execução; só o que precisa estar fora do catálogo é inventado.
 */

/* -------------------------------------------------------------------------- */
/* Armazenamento em memória                                                   */
/* -------------------------------------------------------------------------- */

/** localStorage de teste: mesma superfície usada pelo módulo, mais o controle de falha. */
class MemoryStorage {
  private entries = new Map<string, string>()
  private writes = 0
  private failAt: number | 'all' | null = null

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
    this.writes += 1

    if (this.failAt === 'all' || this.failAt === this.writes) {
      throw new Error('Armazenamento cheio (simulado)')
    }

    this.entries.set(key, value)
  }

  /** Toda escrita a partir de agora falha, inclusive as tentativas de rollback. */
  failAllWrites(): void {
    this.writes = 0
    this.failAt = 'all'
  }

  /** Só a escrita de número `position`, contada a partir de agora, falha. */
  failWriteAt(position: number): void {
    this.writes = 0
    this.failAt = position
  }
}

type GlobalWithWindow = { window?: { localStorage: unknown } }

function globalWithWindow(): GlobalWithWindow {
  return globalThis as unknown as GlobalWithWindow
}

function installStorage(memory: MemoryStorage): void {
  globalWithWindow().window = { localStorage: memory }
}

function removeStorage(): void {
  delete globalWithWindow().window
}

let memory: MemoryStorage

beforeEach(() => {
  memory = new MemoryStorage()
  installStorage(memory)
})

afterEach(() => {
  removeStorage()
})

/* -------------------------------------------------------------------------- */
/* Dados reais do catálogo                                                    */
/* -------------------------------------------------------------------------- */

function availablePageKeys(area: BiArea): string[] {
  return departmentPages[area.id].filter((page) => !page.disabled).map((page) => page.key)
}

function disabledPageKeys(area: BiArea): string[] {
  return departmentPages[area.id].filter((page) => page.disabled).map((page) => page.key)
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

/** Departamento com duas páginas disponíveis: permite editar a seleção sem sair dele. */
const grantArea = requireArea(
  'departamento com duas páginas disponíveis',
  (area) => availablePageKeys(area).length >= 2,
)
const grantPage = requireKey(availablePageKeys(grantArea), 0, 'primeira página disponível')
const otherGrantPage = requireKey(availablePageKeys(grantArea), 1, 'segunda página disponível')

/** Departamento com página em desenvolvimento, para o caso de página indisponível. */
const disabledArea = requireArea(
  'departamento com página em desenvolvimento',
  (area) => disabledPageKeys(area).length >= 1,
)
const disabledPage = requireKey(disabledPageKeys(disabledArea), 0, 'página em desenvolvimento')

const UNKNOWN_DEPARTMENT = 'departamento-que-nao-existe'

/* -------------------------------------------------------------------------- */
/* Montagem                                                                   */
/* -------------------------------------------------------------------------- */

function grants(departmentId: string, pageKeys: string[]): DepartmentPageAccess[] {
  return [{ departmentId, pageKeys }]
}

function validInput(overrides: Partial<AccessProfileInput> = {}): AccessProfileInput {
  return {
    name: 'Perfil Comercial',
    departmentPageAccess: grants(grantArea.id, [grantPage]),
    homePage: { departmentId: grantArea.id, pageKey: grantPage },
    ...overrides,
  }
}

function storedProfile(overrides: Partial<AccessProfile> = {}): AccessProfile {
  return {
    id: 'acp-001',
    name: 'Perfil Gravado',
    kind: 'standard',
    lifecycle: 'active',
    departmentPageAccess: grants(grantArea.id, [grantPage]),
    homePage: { departmentId: grantArea.id, pageKey: grantPage },
    hasBeenUsed: false,
    ...overrides,
  }
}

/** Semeia a coleção persistida pelo caminho oficial de escrita. */
function seed(profiles: AccessProfile[]): void {
  expect(writeStoredAccessProfiles(profiles)).toBe(true)
}

/** Os testes conferem os códigos técnicos do domínio, não as mensagens. */
function draftErrorCodes(
  result: AccessProfileCreateResult | AccessProfileUpdateResult,
): AccessProfileDraftErrorCode[] {
  return result.ok ? [] : (result.errors ?? []).map((error) => error.code)
}

/* -------------------------------------------------------------------------- */
/* Perfil automático do Administrador                                         */
/* -------------------------------------------------------------------------- */

describe('perfil automático do Administrador', () => {
  it('tem id técnico estável, nome aprovado e tipo do sistema', () => {
    const system = getSystemAccessProfile()

    expect(system.id).toBe(SYSTEM_ACCESS_PROFILE_ID)
    expect(system.id).toBe('acp-system')
    expect(system.name).toBe(SYSTEM_ACCESS_PROFILE_NAME)
    expect(system.name).toBe('Acesso total')
    expect(system.kind).toBe('system')
    expect(system.lifecycle).toBe('active')
    expect(system.hasBeenUsed).toBe(true)
  })

  it('não tem descrição', () => {
    expect(getSystemAccessProfile().description).toBeUndefined()
    expect(Object.hasOwn(getSystemAccessProfile(), 'description')).toBe(false)
  })

  it('concede todos os departamentos do catálogo com as páginas disponíveis de hoje', () => {
    expect(getSystemAccessProfile().departmentPageAccess).toEqual(
      biAreas.map((area) => ({ departmentId: area.id, pageKeys: availablePageKeys(area) })),
    )
  })

  it('não concede nenhuma página em desenvolvimento', () => {
    const system = getSystemAccessProfile()

    for (const access of system.departmentPageAccess) {
      for (const pageKey of access.pageKeys) {
        expect(isDepartmentPageAvailable(access.departmentId, pageKey)).toBe(true)
      }
    }

    expect(hasAccessProfilePageGrant(system, disabledArea.id, disabledPage)).toBe(false)
  })

  it('usa como página inicial a primeira página disponível do catálogo', () => {
    const system = getSystemAccessProfile()
    const firstArea = requireArea(
      'departamento com página disponível',
      (area) => availablePageKeys(area).length > 0,
    )

    expect(system.homePage).toEqual({
      departmentId: firstArea.id,
      pageKey: requireKey(availablePageKeys(firstArea), 0, 'primeira página disponível'),
    })
    expect(
      hasAccessProfilePageGrant(system, system.homePage.departmentId, system.homePage.pageKey),
    ).toBe(true)
    expect(isDepartmentPageAvailable(system.homePage.departmentId, system.homePage.pageKey)).toBe(
      true,
    )
  })

  it('nasce sem nenhuma pendência e com status Ativo', () => {
    const evaluation = evaluateAccessProfile(getSystemAccessProfile())

    expect(evaluation.issues).toEqual([])
    expect(evaluation.operationalStatus).toBe('active')
  })

  it('é montado a cada chamada, sem referência compartilhada', () => {
    const first = getSystemAccessProfile()
    first.departmentPageAccess[0].pageKeys.push('pagina-invadida')
    first.name = 'Alterado'

    const second = getSystemAccessProfile()

    expect(second.name).toBe(SYSTEM_ACCESS_PROFILE_NAME)
    expect(second.departmentPageAccess[0].pageKeys).not.toContain('pagina-invadida')
  })

  it('não é persistido como perfil comum quando um perfil comum é criado', () => {
    expect(createAccessProfile(validInput()).ok).toBe(true)

    const stored = readStoredAccessProfiles()

    expect(stored).toHaveLength(1)
    expect(stored?.every((profile) => profile.kind === 'standard')).toBe(true)
    expect(stored?.some((profile) => profile.id === SYSTEM_ACCESS_PROFILE_ID)).toBe(false)
    expect(stored?.some((profile) => profile.name === SYSTEM_ACCESS_PROFILE_NAME)).toBe(false)
  })

  it('é recusado pelo armazenamento se alguém tentar gravá-lo', () => {
    expect(writeStoredAccessProfiles([getSystemAccessProfile()])).toBe(false)
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Carregamento e listagem                                                    */
/* -------------------------------------------------------------------------- */

describe('carregamento e listagem', () => {
  it('carrega somente o perfil do sistema quando o armazenamento está vazio', () => {
    const result = loadAccessProfiles()

    expect(result.ok).toBe(true)
    expect(result.profiles).toHaveLength(1)
    expect(result.profiles[0].id).toBe(SYSTEM_ACCESS_PROFILE_ID)
  })

  it('lista o perfil do sistema primeiro e os perfis comuns na ordem de criação', () => {
    expect(createAccessProfile(validInput({ name: 'Perfil Um' })).ok).toBe(true)
    expect(createAccessProfile(validInput({ name: 'Perfil Dois' })).ok).toBe(true)

    const result = listAccessProfiles()

    expect(result.ok).toBe(true)
    expect(result.profiles.map((profile) => profile.id)).toEqual([
      SYSTEM_ACCESS_PROFILE_ID,
      'acp-001',
      'acp-002',
    ])
  })

  it('devolve a mesma coleção em carregar e listar', () => {
    seed([storedProfile()])

    expect(listAccessProfiles()).toEqual(loadAccessProfiles())
  })

  it('informa a falha de leitura sem esconder o perfil do sistema', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, '{ isto não é json')

    const result = listAccessProfiles()

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('storage-failure')
    expect(result.profiles.map((profile) => profile.id)).toEqual([SYSTEM_ACCESS_PROFILE_ID])
  })

  it('informa a falha quando o armazenamento está indisponível', () => {
    removeStorage()

    const result = loadAccessProfiles()

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('storage-failure')
    expect(result.profiles.map((profile) => profile.id)).toEqual([SYSTEM_ACCESS_PROFILE_ID])
  })

  it('informa a falha quando a coleção gravada está inválida', () => {
    memory.setItem(
      ACCESS_PROFILES_STORAGE_KEY,
      JSON.stringify([storedProfile({ id: 'acp-001' }), storedProfile({ id: 'acp-001' })]),
    )

    const result = listAccessProfiles()

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('storage-failure')
    expect(result.profiles).toHaveLength(1)
  })

  it('devolve cópias defensivas: alterar o resultado não muda o estado gravado', () => {
    seed([storedProfile({ name: 'Perfil Gravado' })])

    const first = listAccessProfiles()
    first.profiles[1].name = 'Alterado por fora'
    first.profiles[1].departmentPageAccess[0].pageKeys.push('pagina-invadida')
    first.profiles.push(storedProfile({ id: 'acp-999', name: 'Intruso' }))

    const second = listAccessProfiles()

    expect(second.profiles).toHaveLength(2)
    expect(second.profiles[1].name).toBe('Perfil Gravado')
    expect(second.profiles[1].departmentPageAccess[0].pageKeys).not.toContain('pagina-invadida')
  })
})

/* -------------------------------------------------------------------------- */
/* Busca por id                                                               */
/* -------------------------------------------------------------------------- */

describe('busca por id', () => {
  it('encontra o perfil do sistema', () => {
    const result = findAccessProfileById(SYSTEM_ACCESS_PROFILE_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.profile.name).toBe(SYSTEM_ACCESS_PROFILE_NAME)
    expect(result.profile.kind).toBe('system')
  })

  it('encontra o perfil do sistema mesmo com o armazenamento inválido ou ausente', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, '{ isto não é json')
    const withInvalidStorage = findAccessProfileById(SYSTEM_ACCESS_PROFILE_ID)

    removeStorage()
    const withoutStorage = findAccessProfileById(SYSTEM_ACCESS_PROFILE_ID)

    expect(withInvalidStorage.ok).toBe(true)
    expect(withoutStorage.ok).toBe(true)
  })

  it('encontra um perfil comum persistido', () => {
    seed([storedProfile({ id: 'acp-004', name: 'Perfil Quatro' })])

    const result = findAccessProfileById('acp-004')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.profile.name).toBe('Perfil Quatro')
  })

  it('ignora espaços em volta do id', () => {
    seed([storedProfile({ id: 'acp-004' })])

    const result = findAccessProfileById('  acp-004  ')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.profile.id).toBe('acp-004')
  })

  it('devolve not-found para id inexistente em leitura válida', () => {
    seed([storedProfile()])

    const missing = findAccessProfileById('acp-404')
    const empty = findAccessProfileById('   ')

    expect(missing.ok).toBe(false)
    expect(empty.ok).toBe(false)
    if (missing.ok || empty.ok) return

    expect(missing.reason).toBe('not-found')
    expect(empty.reason).toBe('not-found')
  })

  it('separa perfil inexistente de falha de armazenamento', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, '{ isto não é json')

    const result = findAccessProfileById('acp-004')

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('storage-failure')
  })
})

/* -------------------------------------------------------------------------- */
/* Geração de id                                                              */
/* -------------------------------------------------------------------------- */

describe('geração de id', () => {
  it('cria o primeiro perfil como acp-001', () => {
    const result = createAccessProfile(validInput())

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.profile.id).toBe('acp-001')
  })

  it('gera o próximo id a partir do maior número já usado', () => {
    seed([storedProfile({ id: 'acp-001' }), storedProfile({ id: 'acp-007', name: 'Perfil Sete' })])

    const result = createAccessProfile(validInput({ name: 'Perfil Novo' }))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.profile.id).toBe('acp-008')
  })

  it('não reutiliza id existente e mantém todos os ids distintos', () => {
    seed([storedProfile({ id: 'acp-003' })])

    expect(createAccessProfile(validInput({ name: 'Perfil A' })).ok).toBe(true)
    expect(createAccessProfile(validInput({ name: 'Perfil B' })).ok).toBe(true)

    const ids = listAccessProfiles().profiles.map((profile) => profile.id)

    expect(ids).toEqual([SYSTEM_ACCESS_PROFILE_ID, 'acp-003', 'acp-004', 'acp-005'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gera id no padrão do domínio e nunca o id reservado do perfil do sistema', () => {
    seed([storedProfile({ id: 'acp-002' })])

    const result = createAccessProfile(validInput({ name: 'Perfil Novo' }))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(ACCESS_PROFILE_ID_PATTERN.test(result.profile.id)).toBe(true)
    expect(result.profile.id).not.toBe(SYSTEM_ACCESS_PROFILE_ID)
    expect(result.profile.id).toBe('acp-003')
  })
})

/* -------------------------------------------------------------------------- */
/* Criação                                                                    */
/* -------------------------------------------------------------------------- */

describe('criação de perfil comum', () => {
  it('cria o perfil com os campos protegidos definidos pelo repositório', () => {
    const result = createAccessProfile(
      validInput({ name: '  Perfil   Comercial  ', description: '   ' }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.profile).toEqual({
      id: 'acp-001',
      name: 'Perfil Comercial',
      description: undefined,
      kind: 'standard',
      lifecycle: 'active',
      departmentPageAccess: grants(grantArea.id, [grantPage]),
      homePage: { departmentId: grantArea.id, pageKey: grantPage },
      hasBeenUsed: false,
    })
  })

  it('persiste o perfil criado', () => {
    expect(createAccessProfile(validInput({ description: 'Somente leitura' })).ok).toBe(true)

    const stored = readStoredAccessProfiles()

    expect(stored).toHaveLength(1)
    expect(stored?.[0].id).toBe('acp-001')
    expect(stored?.[0].description).toBe('Somente leitura')
  })

  it('recusa nome duplicado de outro perfil comum, sem diferenciar caixa', () => {
    seed([storedProfile({ name: 'Suporte Técnico' })])

    const result = createAccessProfile(validInput({ name: '  suporte   TÉCNICO ' }))

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('invalid-draft')
    expect(draftErrorCodes(result)).toEqual(['duplicate-name'])
  })

  it('recusa nome duplicado do perfil do sistema', () => {
    const result = createAccessProfile(validInput({ name: 'acesso total' }))

    expect(draftErrorCodes(result)).toEqual(['duplicate-name'])
  })

  it('recusa perfil sem página e sem página inicial', () => {
    const result = createAccessProfile(validInput({ departmentPageAccess: [], homePage: null }))

    expect(draftErrorCodes(result)).toContain('no-pages-selected')
    expect(draftErrorCodes(result)).toContain('missing-home-page')
  })

  it('recusa página em desenvolvimento e departamento fora do catálogo', () => {
    const disabled = createAccessProfile(
      validInput({
        departmentPageAccess: [
          ...grants(grantArea.id, [grantPage]),
          ...grants(disabledArea.id, [disabledPage]),
        ],
      }),
    )
    const unknown = createAccessProfile(
      validInput({ departmentPageAccess: grants(UNKNOWN_DEPARTMENT, ['pagina-x']) }),
    )

    expect(draftErrorCodes(disabled)).toEqual(['disabled-page'])
    expect(draftErrorCodes(unknown)).toContain('unknown-department')
  })

  it('recusa página inicial fora das páginas selecionadas', () => {
    const result = createAccessProfile(
      validInput({ homePage: { departmentId: grantArea.id, pageKey: otherGrantPage } }),
    )

    expect(draftErrorCodes(result)).toEqual(['home-page-not-selected'])
  })

  it('não grava nada quando o rascunho é recusado', () => {
    expect(createAccessProfile(validInput({ name: '   ' })).ok).toBe(false)

    expect(readStoredAccessProfiles()).toEqual([])
    expect(listAccessProfiles().profiles).toHaveLength(1)
  })

  it('devolve storage-failure e preserva a coleção anterior quando a escrita falha', () => {
    seed([storedProfile()])
    const before = memory.getItem(ACCESS_PROFILES_STORAGE_KEY)
    memory.failAllWrites()

    const result = createAccessProfile(validInput({ name: 'Perfil Novo' }))

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('storage-failure')
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(before)
    expect(readStoredAccessProfiles()).toHaveLength(1)
    expect(listAccessProfiles().profiles.map((profile) => profile.id)).toEqual([
      SYSTEM_ACCESS_PROFILE_ID,
      'acp-001',
    ])
  })

  it('devolve storage-failure quando o armazenamento está indisponível', () => {
    removeStorage()

    const result = createAccessProfile(validInput())

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('storage-failure')
  })
})

/* -------------------------------------------------------------------------- */
/* Edição                                                                     */
/* -------------------------------------------------------------------------- */

describe('edição de perfil comum', () => {
  it('atualiza nome, descrição e páginas do perfil', () => {
    seed([storedProfile({ id: 'acp-002' })])

    const result = updateAccessProfile(
      'acp-002',
      validInput({
        name: 'Perfil Revisado',
        description: 'Acesso ampliado',
        departmentPageAccess: grants(grantArea.id, [otherGrantPage, grantPage]),
        homePage: { departmentId: grantArea.id, pageKey: otherGrantPage },
      }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.profile.name).toBe('Perfil Revisado')
    expect(result.profile.description).toBe('Acesso ampliado')
    expect(result.profile.departmentPageAccess).toEqual(
      grants(grantArea.id, [grantPage, otherGrantPage]),
    )
    expect(result.profile.homePage).toEqual({
      departmentId: grantArea.id,
      pageKey: otherGrantPage,
    })
    expect(readStoredAccessProfiles()?.[0].name).toBe('Perfil Revisado')
  })

  it('preserva id, tipo, ciclo de vida e indicador de utilização', () => {
    seed([storedProfile({ id: 'acp-002', lifecycle: 'inactive', hasBeenUsed: true })])

    const result = updateAccessProfile('acp-002', validInput({ name: 'Perfil Revisado' }))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.profile.id).toBe('acp-002')
    expect(result.profile.kind).toBe('standard')
    expect(result.profile.lifecycle).toBe('inactive')
    expect(result.profile.hasBeenUsed).toBe(true)

    const stored = readStoredAccessProfiles()?.[0]

    expect(stored?.id).toBe('acp-002')
    expect(stored?.lifecycle).toBe('inactive')
    expect(stored?.hasBeenUsed).toBe(true)
  })

  it('mantém o próprio nome sem acusar duplicidade', () => {
    seed([storedProfile({ name: 'Perfil Gravado' })])

    const result = updateAccessProfile('acp-001', validInput({ name: 'Perfil Gravado' }))

    expect(draftErrorCodes(result)).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('recusa nome já usado por outro perfil', () => {
    seed([
      storedProfile({ id: 'acp-001', name: 'Perfil Um' }),
      storedProfile({ id: 'acp-002', name: 'Perfil Dois' }),
    ])

    const result = updateAccessProfile('acp-001', validInput({ name: 'Perfil Dois' }))

    expect(draftErrorCodes(result)).toEqual(['duplicate-name'])
  })

  it('recusa a edição do perfil do sistema sem tocar no armazenamento', () => {
    const result = updateAccessProfile(SYSTEM_ACCESS_PROFILE_ID, validInput({ name: 'Outro nome' }))

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('system-profile')
    expect(readStoredAccessProfiles()).toEqual([])
    expect(getSystemAccessProfile().name).toBe(SYSTEM_ACCESS_PROFILE_NAME)
  })

  it('recusa o perfil do sistema com system-profile mesmo com o JSON inválido', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, '{ isto não é json')

    const result = updateAccessProfile(SYSTEM_ACCESS_PROFILE_ID, validInput())

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('system-profile')
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe('{ isto não é json')
  })

  it('recusa o perfil do sistema com system-profile mesmo sem armazenamento', () => {
    removeStorage()

    const result = updateAccessProfile(SYSTEM_ACCESS_PROFILE_ID, validInput())

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('system-profile')
  })

  it('recusa o perfil do sistema com system-profile mesmo com a coleção inválida', () => {
    memory.setItem(
      ACCESS_PROFILES_STORAGE_KEY,
      JSON.stringify([storedProfile({ id: 'acp-001' }), storedProfile({ id: 'acp-001' })]),
    )

    const result = updateAccessProfile(SYSTEM_ACCESS_PROFILE_ID, validInput())

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('system-profile')
  })

  it('devolve storage-failure ao editar perfil comum com o armazenamento ilegível', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, '{ isto não é json')

    const invalidJson = updateAccessProfile('acp-001', validInput())

    removeStorage()
    const withoutStorage = updateAccessProfile('acp-001', validInput())

    expect(invalidJson.ok).toBe(false)
    expect(withoutStorage.ok).toBe(false)
    if (invalidJson.ok || withoutStorage.ok) return

    expect(invalidJson.reason).toBe('storage-failure')
    expect(withoutStorage.reason).toBe('storage-failure')
  })

  it('recusa a edição de perfil inexistente ou de id vazio', () => {
    seed([storedProfile()])

    const missing = updateAccessProfile('acp-404', validInput())
    const empty = updateAccessProfile('   ', validInput())

    expect(missing.ok).toBe(false)
    expect(empty.ok).toBe(false)
    if (missing.ok || empty.ok) return

    expect(missing.reason).toBe('not-found')
    expect(empty.reason).toBe('not-found')
  })

  it('recusa dados inválidos preservando os códigos do domínio', () => {
    seed([storedProfile()])

    const result = updateAccessProfile(
      'acp-001',
      validInput({ departmentPageAccess: [], homePage: null }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('invalid-draft')
    expect(draftErrorCodes(result)).toContain('no-pages-selected')
    expect(draftErrorCodes(result)).toContain('missing-home-page')
    expect(readStoredAccessProfiles()?.[0].name).toBe('Perfil Gravado')
  })

  it('devolve storage-failure e preserva a coleção anterior quando a escrita falha', () => {
    seed([storedProfile({ name: 'Perfil Gravado' })])
    const before = memory.getItem(ACCESS_PROFILES_STORAGE_KEY)
    memory.failAllWrites()

    const result = updateAccessProfile('acp-001', validInput({ name: 'Perfil Revisado' }))

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('storage-failure')
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(before)
    expect(readStoredAccessProfiles()?.[0].name).toBe('Perfil Gravado')
  })
})

/* -------------------------------------------------------------------------- */
/* Armazenamento                                                              */
/* -------------------------------------------------------------------------- */

describe('armazenamento dos perfis comuns', () => {
  it('usa uma chave própria, no padrão de nomenclatura do projeto', () => {
    expect(ACCESS_PROFILES_STORAGE_KEY).toBe('impacto-bi.accessProfiles')

    expect(createAccessProfile(validInput()).ok).toBe(true)
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).not.toBeNull()
  })

  it('trata armazenamento vazio como coleção vazia, e não como falha', () => {
    const result = loadAccessProfiles()

    expect(readStoredAccessProfiles()).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.profiles).toHaveLength(1)
  })

  it('trata JSON inválido como falha de leitura, sem apagar o conteúdo', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, '{ isto não é json')

    expect(readStoredAccessProfiles()).toBeNull()
    expect(loadAccessProfiles().profiles.map((profile) => profile.id)).toEqual([
      SYSTEM_ACCESS_PROFILE_ID,
    ])
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe('{ isto não é json')
  })

  it('recusa a criação quando a coleção atual não pode ser lida', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, '{ isto não é json')

    const result = createAccessProfile(validInput())

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.reason).toBe('storage-failure')
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe('{ isto não é json')
  })

  it('recusa conteúdo que não é um array', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, JSON.stringify({ perfis: [] }))

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('recusa a coleção inteira quando um perfil está fora do formato', () => {
    memory.setItem(
      ACCESS_PROFILES_STORAGE_KEY,
      JSON.stringify([storedProfile(), { id: 'acp-002', name: 'Incompleto' }]),
    )

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('recusa a coleção quando um perfil do sistema aparece no armazenamento', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, JSON.stringify([getSystemAccessProfile()]))

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('devolve cópias defensivas na leitura', () => {
    seed([storedProfile()])

    const first = readStoredAccessProfiles()
    first?.[0].departmentPageAccess[0].pageKeys.push('pagina-invadida')

    expect(readStoredAccessProfiles()?.[0].departmentPageAccess[0].pageKeys).not.toContain(
      'pagina-invadida',
    )
  })

  it('desfaz a gravação da coleção quando a marca de versão falha', () => {
    seed([storedProfile({ name: 'Perfil Gravado' })])
    const before = memory.getItem(ACCESS_PROFILES_STORAGE_KEY)

    // A coleção é gravada primeiro e a versão em seguida: a segunda escrita falha.
    memory.failWriteAt(2)

    expect(writeStoredAccessProfiles([storedProfile({ name: 'Perfil Substituto' })])).toBe(false)
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(before)
    expect(readStoredAccessProfiles()?.[0].name).toBe('Perfil Gravado')
  })

  it('devolve falha de leitura e de escrita quando o armazenamento está indisponível', () => {
    removeStorage()

    expect(readStoredAccessProfiles()).toBeNull()
    expect(writeStoredAccessProfiles([storedProfile()])).toBe(false)
    expect(loadAccessProfiles().profiles.map((profile) => profile.id)).toEqual([
      SYSTEM_ACCESS_PROFILE_ID,
    ])
  })
})

/* -------------------------------------------------------------------------- */
/* Integridade da coleção inteira                                             */
/* -------------------------------------------------------------------------- */

describe('integridade da coleção armazenada', () => {
  /** Grava direto na chave: o caminho oficial de escrita recusa estas coleções. */
  function store(profiles: AccessProfile[]): void {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, JSON.stringify(profiles))
  }

  it('recusa a coleção com id repetido', () => {
    store([
      storedProfile({ id: 'acp-001', name: 'Perfil Um' }),
      storedProfile({ id: 'acp-001', name: 'Perfil Dois' }),
    ])

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('recusa a coleção com nome repetido', () => {
    store([
      storedProfile({ id: 'acp-001', name: 'Perfil Um' }),
      storedProfile({ id: 'acp-002', name: 'Perfil Um' }),
    ])

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('recusa nome repetido ignorando caixa e espaços excedentes', () => {
    store([
      storedProfile({ id: 'acp-001', name: 'Suporte Técnico' }),
      storedProfile({ id: 'acp-002', name: '  suporte   TÉCNICO ' }),
    ])

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('recusa id de perfil comum fora do padrão acp-NNN', () => {
    store([storedProfile({ id: 'perfil-antigo' })])

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('recusa id de perfil comum com menos de três dígitos', () => {
    store([storedProfile({ id: 'acp-1' })])
    expect(readStoredAccessProfiles()).toBeNull()

    store([storedProfile({ id: 'acp-12' })])
    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('aceita id de perfil comum com quatro dígitos ou mais', () => {
    store([storedProfile({ id: 'acp-1000' })])

    expect(readStoredAccessProfiles()).toHaveLength(1)
  })

  it('recusa o id reservado do perfil do sistema em um perfil comum', () => {
    store([storedProfile({ id: SYSTEM_ACCESS_PROFILE_ID, name: 'Perfil Comum' })])

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('recusa o nome reservado do perfil do sistema em um perfil comum', () => {
    store([storedProfile({ name: SYSTEM_ACCESS_PROFILE_NAME })])

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('recusa o nome reservado escrito com outra caixa ou com espaços excedentes', () => {
    store([storedProfile({ name: '  acesso   TOTAL ' })])

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('recusa descrição vazia', () => {
    store([storedProfile({ description: '' })])

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('recusa descrição só com espaços', () => {
    store([storedProfile({ description: '   ' })])

    expect(readStoredAccessProfiles()).toBeNull()
  })

  it('aceita a coleção íntegra, com e sem descrição', () => {
    store([
      storedProfile({ id: 'acp-001', name: 'Perfil Um' }),
      storedProfile({ id: 'acp-002', name: 'Perfil Dois', description: 'Somente leitura' }),
    ])

    expect(readStoredAccessProfiles()).toHaveLength(2)
  })

  it('não grava nenhuma coleção que a leitura recusaria', () => {
    const before = memory.getItem(ACCESS_PROFILES_STORAGE_KEY)

    expect(writeStoredAccessProfiles([storedProfile({ id: 'acp-001' }), storedProfile()])).toBe(
      false,
    )
    expect(writeStoredAccessProfiles([storedProfile({ id: 'perfil-antigo' })])).toBe(false)
    expect(writeStoredAccessProfiles([storedProfile({ id: SYSTEM_ACCESS_PROFILE_ID })])).toBe(false)
    expect(writeStoredAccessProfiles([storedProfile({ name: SYSTEM_ACCESS_PROFILE_NAME })])).toBe(
      false,
    )
    expect(writeStoredAccessProfiles([storedProfile({ description: '  ' })])).toBe(false)
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(before)
  })

  it('não deixa a criação produzir uma coleção ilegível', () => {
    seed([storedProfile({ id: 'acp-001', name: 'Perfil Um' })])

    expect(createAccessProfile(validInput({ name: 'Perfil Dois', description: '   ' })).ok).toBe(
      true,
    )

    const stored = readStoredAccessProfiles()

    expect(stored).toHaveLength(2)
    expect(stored?.[1].description).toBeUndefined()
  })
})
