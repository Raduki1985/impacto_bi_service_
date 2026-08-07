import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { biAreas, type BiArea } from '../../config/biAreas'
import type { User } from '../../data/dashboardTypes'
import { defaultDepartmentPageKeys, deriveUserAccess } from '../../lib/userAccessRules'
import { readStoredUserHistory } from './userHistoryStorage'
import {
  USER_HISTORY_STORAGE_KEY,
  readStoredUsers,
  writeStoredUsers,
  writeStoredUsersWithHistory,
} from './userStorage'

/**
 * Testes da migração de nomenclatura do Perfil do Sistema no armazenamento.
 *
 * O Perfil do Sistema é persistido como texto dentro do usuário, e o mesmo
 * perfil já foi renomeado duas vezes: "Gestor" virou "Usuário Departamental", e
 * "Usuário Departamental" virou "Analista". Os dois nomes antigos continuam
 * podendo aparecer em uma base gravada por uma versão anterior do portal, e é a
 * leitura que precisa reconhecê-los.
 *
 * O armazenamento é substituído por uma implementação em memória instalada em
 * `globalThis.window`, o mesmo lugar que `getStorage` consulta: nenhum
 * localStorage real é tocado e nenhuma dependência de navegador é necessária. A
 * mesma implementação registra cada escrita, que é como os testes comprovam o
 * que foi (e o que não foi) regravado, sem depender das chaves internas do
 * módulo.
 *
 * Os departamentos e as páginas vêm do catálogo real, e os acessos são
 * derivados pela regra oficial: nenhuma lista paralela é escrita à mão aqui.
 */

/* -------------------------------------------------------------------------- */
/* Armazenamento em memória                                                   */
/* -------------------------------------------------------------------------- */

type RecordedWrite = { key: string; value: string }

/** localStorage de teste: mesma superfície do módulo, mais o registro das escritas. */
class MemoryStorage {
  private entries = new Map<string, string>()
  /** Toda escrita desde o último `resetWrites`, na ordem em que aconteceu. */
  writes: RecordedWrite[] = []

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
    this.writes.push({ key, value })
    this.entries.set(key, value)
  }

  resetWrites(): void {
    this.writes = []
  }

  /** Coleções de usuários gravadas desde o último `resetWrites`. */
  writtenUserCollections(): unknown[][] {
    return this.writes.flatMap((write) => {
      if (write.key === USER_HISTORY_STORAGE_KEY) return []

      let parsed: unknown
      try {
        parsed = JSON.parse(write.value)
      } catch {
        return []
      }

      return Array.isArray(parsed) ? [parsed] : []
    })
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
/* Dados reais do catálogo                                                    */
/* -------------------------------------------------------------------------- */

function requireArea(index: number): BiArea {
  const area = biAreas.at(index)
  if (!area) throw new Error('Catálogo sem departamentos: o teste precisa de dados reais.')

  return area
}

const firstArea = requireArea(0)
const secondArea = requireArea(1)

/** Auditoria completa, para comprovar que a migração não encosta em nenhum campo. */
const audit = {
  createdAt: '2026-01-05T12:00:00.000Z',
  createdByUserId: 'usr-001',
  createdByName: 'Mário Luiz Ramos',
  updatedAt: '2026-02-10T09:30:00.000Z',
  updatedByUserId: 'usr-002',
  updatedByName: 'Vagner Santos',
}

/**
 * Usuário completo de um perfil, com os acessos derivados pela regra oficial.
 * O Analista recebe os dois primeiros departamentos do catálogo, na ordem em que
 * são informados, para as asserções de ordem terem o que comparar.
 */
function buildUser(profile: User['profile'], overrides: Partial<User> = {}): User {
  const access = deriveUserAccess(
    profile === 'Administrador' || profile === 'Executivo'
      ? { profile }
      : {
          profile,
          departments: [firstArea, secondArea].map((area) => ({
            departmentId: area.id,
            pageKeys: defaultDepartmentPageKeys(area.id),
          })),
        },
  )

  if (!access) throw new Error('Configuração de acesso inválida no teste')

  return {
    id: 'usr-100',
    name: 'Usuária de Teste',
    email: 'teste@impactotelecom.com',
    ...access,
    // Ausência EXPLÍCITA de vínculo: é a forma que a leitura garante, e é o que
    // as asserções campo a campo esperam encontrar de volta. O vínculo real com
    // um Perfil de Acesso é assunto de `accessProfileAssignment`, e não deste
    // módulo, que só normaliza a forma do campo.
    accessProfileId: null,
    status: 'Ativo',
    audit,
    lastAccess: '20/07/2026 15:40',
    initials: 'UT',
    ...overrides,
  }
}

/**
 * Grava a coleção como uma versão anterior do portal gravaria, trocando apenas o
 * texto do Perfil do Sistema pelo nome legado. Usa o próprio mecanismo de
 * gravação do módulo, então a marca de versão dos acessos também fica alinhada:
 * na leitura seguinte, a única migração com algo a fazer é a do nome do perfil.
 */
function seedStoredUsers(users: readonly User[], legacyProfileById: Record<string, string> = {}) {
  const stored = users.map((user) => {
    const legacy = legacyProfileById[user.id]

    return legacy ? ({ ...user, profile: legacy } as unknown as User) : user
  })

  expect(writeStoredUsers(stored)).toBe(true)
  memory.resetWrites()
}

/** O mesmo usuário como ele deve sair da leitura: só o perfil muda. */
function expectOnlyProfileChanged(read: User, original: User, profile: User['profile']): void {
  expect(read).toEqual({ ...original, profile })
}

/* -------------------------------------------------------------------------- */
/* 1. Conversão dos nomes legados                                             */
/* -------------------------------------------------------------------------- */

describe('migração do Perfil do Sistema para Analista', () => {
  it('converte o "Gestor" legado em Analista', () => {
    const analyst = buildUser('Analista')
    seedStoredUsers([analyst], { [analyst.id]: 'Gestor' })

    const read = readStoredUsers()

    expect(read).not.toBeNull()
    expect(read?.[0].profile).toBe('Analista')
  })

  it('converte o "Usuário Departamental" legado em Analista', () => {
    const analyst = buildUser('Analista')
    seedStoredUsers([analyst], { [analyst.id]: 'Usuário Departamental' })

    const read = readStoredUsers()

    expect(read).not.toBeNull()
    expect(read?.[0].profile).toBe('Analista')
  })

  it('mantém quem já está gravado como Analista', () => {
    const analyst = buildUser('Analista')
    seedStoredUsers([analyst])

    expect(readStoredUsers()?.[0]).toEqual(analyst)
  })

  it('não altera Administrador nem Executivo', () => {
    const administrator = buildUser('Administrador', { id: 'usr-001', initials: 'AD' })
    const executive = buildUser('Executivo', { id: 'usr-004', initials: 'EX' })
    seedStoredUsers([administrator, executive])

    expect(readStoredUsers()).toEqual([administrator, executive])
  })

  it('converte só os usuários legados de uma coleção mista, na ordem gravada', () => {
    const administrator = buildUser('Administrador', { id: 'usr-001', initials: 'AD' })
    const executive = buildUser('Executivo', { id: 'usr-004', initials: 'EX' })
    const manager = buildUser('Analista', { id: 'usr-008', initials: 'AV' })
    const departmental = buildUser('Analista', { id: 'usr-009', initials: 'JF' })
    const analyst = buildUser('Analista', { id: 'usr-010', initials: 'CA' })

    seedStoredUsers([administrator, executive, manager, departmental, analyst], {
      [manager.id]: 'Gestor',
      [departmental.id]: 'Usuário Departamental',
    })

    expect(readStoredUsers()).toEqual([administrator, executive, manager, departmental, analyst])
  })
})

/* -------------------------------------------------------------------------- */
/* 2. Preservação dos acessos e da auditoria                                  */
/* -------------------------------------------------------------------------- */

describe('preservação dos campos na migração', () => {
  it('preserva acessos, auditoria e identidade campo a campo', () => {
    const analyst = buildUser('Analista')
    seedStoredUsers([analyst], { [analyst.id]: 'Usuário Departamental' })

    const read = readStoredUsers()?.[0]
    if (!read) throw new Error('Leitura não devolveu o usuário migrado')

    expectOnlyProfileChanged(read, analyst, 'Analista')
    expect(read.id).toBe(analyst.id)
    expect(read.name).toBe(analyst.name)
    expect(read.email).toBe(analyst.email)
    expect(read.status).toBe(analyst.status)
    expect(read.lastAccess).toBe(analyst.lastAccess)
    expect(read.initials).toBe(analyst.initials)
    expect(read.permissions).toBe(analyst.permissions)
    expect(read.audit).toEqual(audit)
  })

  it('mantém conteúdo e ordem de todos os arrays de acesso', () => {
    const analyst = buildUser('Analista')
    seedStoredUsers([analyst], { [analyst.id]: 'Gestor' })

    const read = readStoredUsers()?.[0]
    if (!read) throw new Error('Leitura não devolveu o usuário migrado')

    expect(read.departments).toEqual(analyst.departments)
    expect(read.permissionKeys).toEqual(analyst.permissionKeys)
    expect(read.departmentPageAccess).toEqual(analyst.departmentPageAccess)
    expect(read.departmentPageAccess.map((access) => access.departmentId)).toEqual([
      firstArea.id,
      secondArea.id,
    ])
    // Nenhuma página acrescentada nem retirada em nenhum departamento.
    for (const [index, access] of read.departmentPageAccess.entries()) {
      expect(access.pageKeys).toEqual(analyst.departmentPageAccess[index].pageKeys)
    }
  })

  it('não altera a coleção recebida pela gravação', () => {
    const analyst = buildUser('Analista')
    const stored = [{ ...analyst, profile: 'Gestor' } as unknown as User]
    const snapshot = JSON.parse(JSON.stringify(stored)) as unknown

    expect(writeStoredUsers(stored)).toBe(true)
    readStoredUsers()

    expect(stored).toEqual(snapshot)
    expect(stored[0].profile as string).toBe('Gestor')
  })
})

/* -------------------------------------------------------------------------- */
/* 3. Gravação: uma vez só, e sem tocar no Histórico                          */
/* -------------------------------------------------------------------------- */

describe('gravação da coleção migrada', () => {
  it('persiste a coleção convertida e é idempotente na leitura seguinte', () => {
    const analyst = buildUser('Analista')
    seedStoredUsers([analyst], { [analyst.id]: 'Usuário Departamental' })

    const first = readStoredUsers()
    const written = memory.writtenUserCollections()

    expect(first?.[0].profile).toBe('Analista')
    expect(written).toHaveLength(1)
    expect(written[0]).toEqual([{ ...analyst, profile: 'Analista' }])

    // Segunda leitura: a base já está normalizada e nada mais é regravado.
    memory.resetWrites()
    const second = readStoredUsers()

    expect(second).toEqual(first)
    expect(memory.writes).toEqual([])
  })

  it('não regrava uma coleção já normalizada como Analista', () => {
    seedStoredUsers([
      buildUser('Administrador', { id: 'usr-001', initials: 'AD' }),
      buildUser('Executivo', { id: 'usr-004', initials: 'EX' }),
      buildUser('Analista', { id: 'usr-008', initials: 'AV' }),
    ])

    readStoredUsers()

    expect(memory.writes).toEqual([])
  })

  it('não cria nem altera evento de Histórico ao migrar', () => {
    const analyst = buildUser('Analista')
    const event = {
      id: 'evt-001',
      action: 'created' as const,
      occurredAt: '2026-01-05T12:00:00.000Z',
      targetUserId: analyst.id,
      targetUserName: analyst.name,
      actorUserId: 'usr-001',
      actorName: 'Mário Luiz Ramos',
      details: ['Usuário criado'],
    }

    expect(
      writeStoredUsersWithHistory(
        [{ ...analyst, profile: 'Gestor' } as unknown as User],
        [event],
      ),
    ).toBe(true)
    memory.resetWrites()

    expect(readStoredUsers()?.[0].profile).toBe('Analista')
    // A chave do Histórico não é tocada, e o único evento continua o mesmo.
    expect(memory.writes.some((write) => write.key === USER_HISTORY_STORAGE_KEY)).toBe(false)
    expect(readStoredUserHistory()).toEqual([event])
  })
})

/* -------------------------------------------------------------------------- */
/* 4. Normalização do vínculo com o Perfil de Acesso                          */
/* -------------------------------------------------------------------------- */

/**
 * `accessProfileId` é o vínculo persistente com o Perfil de Acesso, e a leitura
 * garante que ele exista em UMA forma só: um id em texto, ou `null`.
 *
 * O que este módulo NÃO faz, de propósito: não confere se o id existe, se o
 * perfil está ativo nem se ele serve ao Perfil do Sistema do usuário. Isso
 * depende da coleção de perfis, que este módulo não conhece, e é respondido por
 * `accessProfileAssignment`. Aqui um id desconhecido é preservado como está, em
 * vez de apagado por um módulo sem como verificá-lo.
 *
 * A gravação usa `writeStoredUsers` com a coleção já fora de forma, então o
 * conteúdo persistido é exatamente o que uma versão anterior do portal teria
 * deixado no navegador.
 */
function seedRawUsers(users: readonly unknown[]): void {
  expect(writeStoredUsers(users as User[])).toBe(true)
  memory.resetWrites()
}

describe('vínculo com o Perfil de Acesso na leitura', () => {
  it('normaliza para null a propriedade ausente de uma base anterior', () => {
    const analyst = buildUser('Analista')
    const { accessProfileId: _omitted, ...withoutLink } = analyst
    void _omitted

    seedRawUsers([withoutLink])

    const read = readStoredUsers()

    expect(read).not.toBeNull()
    expect(read?.[0]).toHaveProperty('accessProfileId', null)
    // Nada além do vínculo muda: os acessos gravados seguem intactos.
    expect(read?.[0]).toEqual(analyst)
  })

  it('normaliza para null undefined, texto vazio, espaços e valor que não é texto', () => {
    seedRawUsers([
      buildUser('Analista', { id: 'usr-001', accessProfileId: undefined }),
      buildUser('Analista', { id: 'usr-002', accessProfileId: '' }),
      buildUser('Analista', { id: 'usr-003', accessProfileId: '   ' }),
      { ...buildUser('Analista', { id: 'usr-004' }), accessProfileId: 42 },
      { ...buildUser('Analista', { id: 'usr-005' }), accessProfileId: { id: 'acp-001' } },
    ])

    const read = readStoredUsers()

    expect(read?.map((user) => user.accessProfileId)).toEqual([null, null, null, null, null])
  })

  it('preserva um id gravado, sem os espaços das pontas', () => {
    seedRawUsers([
      buildUser('Analista', { id: 'usr-001', accessProfileId: 'acp-003' }),
      buildUser('Analista', { id: 'usr-002', accessProfileId: '  acp-004  ' }),
      // Id que não corresponde a nenhum perfil: continua gravado, porque quem
      // decide isso é a coleção de perfis, e não este módulo.
      buildUser('Analista', { id: 'usr-003', accessProfileId: 'acp-999' }),
    ])

    const read = readStoredUsers()

    expect(read?.map((user) => user.accessProfileId)).toEqual(['acp-003', 'acp-004', 'acp-999'])
  })

  it('regrava a coleção uma única vez e é idempotente na leitura seguinte', () => {
    const analyst = buildUser('Analista')
    const { accessProfileId: _omitted, ...withoutLink } = analyst
    void _omitted

    seedRawUsers([withoutLink])

    const first = readStoredUsers()

    expect(memory.writtenUserCollections()).toHaveLength(1)

    memory.resetWrites()
    const second = readStoredUsers()

    expect(second).toEqual(first)
    expect(memory.writes).toEqual([])
  })

  it('não regrava uma coleção que já tem o vínculo na forma esperada', () => {
    seedStoredUsers([
      buildUser('Administrador', { id: 'usr-001', accessProfileId: 'acp-system' }),
      buildUser('Analista', { id: 'usr-008', accessProfileId: 'acp-002' }),
    ])

    readStoredUsers()

    expect(memory.writes).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* 5. Histórico unificado: eventos de usuário e de Perfil de Acesso           */
/* -------------------------------------------------------------------------- */

/**
 * O Histórico passou a registrar também as alterações dos Perfis de Acesso, na
 * MESMA chave e na mesma coleção. Os eventos gravados antes disso não têm o
 * campo `targetType`, e a ausência dele continua significando "evento de
 * usuário": nenhum registro antigo precisa ser convertido para continuar válido.
 *
 * A validação continua sendo da coleção inteira: um único evento fora de forma
 * invalida a leitura, em vez de sumir da lista sem ninguém notar.
 */
const legacyUserEvent = {
  id: 'evt-001',
  action: 'updated' as const,
  occurredAt: '2026-01-05T12:00:00.000Z',
  targetUserId: 'usr-008',
  targetUserName: 'Usuária de Teste',
  actorUserId: 'usr-001',
  actorName: 'Mário Luiz Ramos',
  details: ['Acessos atualizados.'],
}

const accessProfileEvent = {
  id: 'evt-002',
  targetType: 'access-profile' as const,
  action: 'access-profile-created' as const,
  occurredAt: '2026-02-10T09:30:00.000Z',
  targetAccessProfileId: 'acp-002',
  targetAccessProfileName: 'Operações Técnicas',
  actorUserId: 'usr-001',
  actorName: 'Mário Luiz Ramos',
  details: ['Destino: Analistas', 'Cobertura inicial: COP (3 páginas)'],
}

/** Grava a coleção de eventos exatamente como recebida, sem validação prévia. */
function seedRawHistory(events: readonly unknown[]): void {
  memory.setItem(USER_HISTORY_STORAGE_KEY, JSON.stringify(events))
  memory.resetWrites()
}

describe('Histórico unificado', () => {
  it('lê um evento antigo de usuário, sem targetType, sem alterá-lo', () => {
    seedRawHistory([legacyUserEvent])

    expect(readStoredUserHistory()).toEqual([legacyUserEvent])
  })

  it('lê os dois domínios na mesma coleção, na ordem gravada', () => {
    seedRawHistory([legacyUserEvent, accessProfileEvent])

    expect(readStoredUserHistory()).toEqual([legacyUserEvent, accessProfileEvent])
  })

  it('aceita o evento de usuário com targetType explícito', () => {
    const explicit = { ...legacyUserEvent, targetType: 'user' as const }
    seedRawHistory([explicit])

    expect(readStoredUserHistory()).toEqual([explicit])
  })

  it('devolve cópias: alterar o resultado não altera o que está gravado', () => {
    seedRawHistory([accessProfileEvent])

    const read = readStoredUserHistory()
    if (!read) throw new Error('Leitura do Histórico falhou no teste.')

    read[0].details.push('Detalhe inventado')
    read[0].id = 'evt-alterado'

    expect(readStoredUserHistory()).toEqual([accessProfileEvent])
  })

  it('invalida a coleção inteira quando um evento de Perfil de Acesso está incompleto', () => {
    const { targetAccessProfileName: _omitted, ...incomplete } = accessProfileEvent
    void _omitted

    seedRawHistory([legacyUserEvent, incomplete])

    expect(readStoredUserHistory()).toBeNull()
    // Nada é corrigido nem apagado: o conteúdo gravado permanece como está.
    expect(memory.getItem(USER_HISTORY_STORAGE_KEY)).toBe(
      JSON.stringify([legacyUserEvent, incomplete]),
    )
  })

  it('recusa uma ação que não pertence a nenhum dos dois domínios', () => {
    seedRawHistory([{ ...accessProfileEvent, action: 'access-profile-renamed' }])

    expect(readStoredUserHistory()).toBeNull()
  })

  it('grava os dois domínios na mesma operação da coleção de usuários', () => {
    const analyst = buildUser('Analista')

    expect(
      writeStoredUsersWithHistory([analyst], [legacyUserEvent, accessProfileEvent]),
    ).toBe(true)
    expect(readStoredUserHistory()).toEqual([legacyUserEvent, accessProfileEvent])
    expect(readStoredUsers()).toEqual([analyst])
  })
})
