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
