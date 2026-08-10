import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { biAreas, type BiArea } from '../../config/biAreas'
import type { User } from '../../data/dashboardTypes'
import { defaultDepartmentPageKeys, deriveUserAccess } from '../../lib/userAccessRules'
import type { StandardAccessProfile, UserProfile } from '../../types/access'
import { ensureAccessProfileLinks } from '../accessProfiles/accessProfileAssignment'
import { writeStoredAccessProfiles } from '../accessProfiles/accessProfileStorage'
import { writeStoredUsers } from '../users/userStorage'
import {
  authorizeUserByEmail,
  AUTH_SESSION_STORAGE_KEY,
  clearStoredAuthUserId,
  readStoredAuthUserId,
  restoreAuthenticatedUser,
  writeStoredAuthUserId,
} from './authSession'

/**
 * Testes da sessão mockada.
 *
 * O que está sendo verificado é o contrato que o F5 depende: onde o identificador
 * fica, o que NUNCA é gravado e quais sessões deixam de valer. A restauração é
 * exercitada contra os repositórios reais, com usuários e Perfis de Acesso
 * gravados no armazenamento simulado, porque é justamente a releitura desses dois
 * que decide se a sessão continua válida.
 */

class MemoryStorage {
  private entries = new Map<string, string>()
  private failWrites = false

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
    if (this.failWrites) throw new Error('Falha simulada')
    this.entries.set(key, value)
  }

  refuseWrites(): void {
    this.failWrites = true
  }

  snapshot(): ReadonlyMap<string, string> {
    return new Map(this.entries)
  }
}

type GlobalWithWindow = {
  window?: { localStorage: unknown; sessionStorage: unknown }
}

function globalWithWindow(): GlobalWithWindow {
  return globalThis as unknown as GlobalWithWindow
}

let local: MemoryStorage
let session: MemoryStorage

beforeEach(() => {
  local = new MemoryStorage()
  session = new MemoryStorage()
  globalWithWindow().window = { localStorage: local, sessionStorage: session }
})

afterEach(() => {
  delete globalWithWindow().window
})

/* -------------------------------------------------------------------------- */
/* Base de teste                                                              */
/* -------------------------------------------------------------------------- */

function availableArea(): BiArea {
  const area = biAreas.find((candidate) => defaultDepartmentPageKeys(candidate.id).length > 0)
  if (!area) throw new Error('Catálogo sem departamento disponível para o teste.')

  return area
}

const area = availableArea()

function analystProfile(overrides: Partial<StandardAccessProfile> = {}): StandardAccessProfile {
  const pageKeys = defaultDepartmentPageKeys(area.id)
  const pageKey = pageKeys[0]
  if (!pageKey) throw new Error(`Departamento ${area.id} sem página concedível.`)

  return {
    id: 'acp-900',
    name: 'Perfil de teste',
    kind: 'standard',
    audience: 'analyst',
    lifecycle: 'active',
    departmentPageAccess: [{ departmentId: area.id, pageKeys }],
    homePage: { departmentId: area.id, pageKey },
    hasBeenUsed: true,
    ...overrides,
  }
}

function user(systemProfile: UserProfile, overrides: Partial<User> = {}): User {
  const derived =
    systemProfile === 'Analista'
      ? deriveUserAccess({
          profile: 'Analista',
          departments: [{ departmentId: area.id, pageKeys: defaultDepartmentPageKeys(area.id) }],
        })
      : deriveUserAccess({ profile: systemProfile })

  if (!derived) throw new Error('Acesso de teste inválido.')

  return {
    id: 'usr-100',
    name: 'Pessoa de Teste',
    email: 'pessoa@impactotelecom.com',
    ...derived,
    accessProfileId: 'acp-900',
    status: 'Ativo',
    lastAccess: 'Nunca acessou',
    initials: 'PT',
    ...overrides,
  }
}

/** Base com um Analista ativo, vinculado a um perfil compatível e ativo. */
function seedValidSession(userOverrides: Partial<User> = {}, profile = analystProfile()): User {
  const analyst = user('Analista', userOverrides)

  expect(writeStoredAccessProfiles([profile])).toBe(true)
  expect(writeStoredUsers([analyst])).toBe(true)

  return analyst
}

/**
 * Declara a base como já percorrida pela evolução dos vínculos legados.
 *
 * Precisa acontecer ANTES de a base receber um vínculo vazio de propósito. Em uma
 * base que nunca passou por essa etapa, `accessProfileId: null` é lacuna a
 * preencher, e a leitura seguinte encontra um perfil correspondente e liga o
 * usuário a ele: o cenário "sem Perfil de Acesso" simplesmente não existiria. Toda
 * base real de portal já passou por ela.
 */
function markBaseAsAnalyzed(): void {
  expect(ensureAccessProfileLinks().writeFailed).toBe(false)
}

/** Rewrite direto da coleção, para simular o que mudou entre dois acessos. */
function replaceStoredUser(next: User): void {
  expect(writeStoredUsers([next])).toBe(true)
}

/* -------------------------------------------------------------------------- */
/* Onde o identificador fica                                                  */
/* -------------------------------------------------------------------------- */

describe('escolha do armazenamento da sessão', () => {
  it('sem Lembrar-me grava somente na aba', () => {
    expect(writeStoredAuthUserId('usr-100', false)).toBe(true)

    expect(session.getItem(AUTH_SESSION_STORAGE_KEY)).toBe('usr-100')
    expect(local.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('com Lembrar-me grava somente no dispositivo', () => {
    expect(writeStoredAuthUserId('usr-100', true)).toBe(true)

    expect(local.getItem(AUTH_SESSION_STORAGE_KEY)).toBe('usr-100')
    expect(session.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('trocar de escolha não deixa a sessão anterior no outro armazenamento', () => {
    writeStoredAuthUserId('usr-100', true)
    writeStoredAuthUserId('usr-200', false)

    expect(session.getItem(AUTH_SESSION_STORAGE_KEY)).toBe('usr-200')
    expect(local.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()

    writeStoredAuthUserId('usr-300', true)

    expect(local.getItem(AUTH_SESSION_STORAGE_KEY)).toBe('usr-300')
    expect(session.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('grava apenas o identificador, em uma única chave', () => {
    writeStoredAuthUserId('usr-100', true)

    expect([...local.snapshot().keys()]).toEqual([AUTH_SESSION_STORAGE_KEY])
    expect([...local.snapshot().values()]).toEqual(['usr-100'])
  })

  it('a aba tem precedência na leitura', () => {
    local.setItem(AUTH_SESSION_STORAGE_KEY, 'usr-antigo')
    session.setItem(AUTH_SESSION_STORAGE_KEY, 'usr-atual')

    expect(readStoredAuthUserId()).toBe('usr-atual')
  })

  it('lê a lembrança do dispositivo quando a aba está vazia', () => {
    local.setItem(AUTH_SESSION_STORAGE_KEY, 'usr-100')

    expect(readStoredAuthUserId()).toBe('usr-100')
  })

  it('trata ausência e texto em branco como sessão inexistente', () => {
    expect(readStoredAuthUserId()).toBeNull()

    session.setItem(AUTH_SESSION_STORAGE_KEY, '   ')

    expect(readStoredAuthUserId()).toBeNull()
  })

  it('limpa os dois armazenamentos', () => {
    local.setItem(AUTH_SESSION_STORAGE_KEY, 'usr-100')
    session.setItem(AUTH_SESSION_STORAGE_KEY, 'usr-100')

    clearStoredAuthUserId()

    expect(local.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
    expect(session.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('não lança quando o armazenamento recusa a gravação', () => {
    session.refuseWrites()

    expect(writeStoredAuthUserId('usr-100', false)).toBe(false)
  })

  it('não lança sem window disponível', () => {
    delete globalWithWindow().window

    expect(readStoredAuthUserId()).toBeNull()
    expect(writeStoredAuthUserId('usr-100', true)).toBe(false)
    expect(() => clearStoredAuthUserId()).not.toThrow()
    expect(restoreAuthenticatedUser()).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Restauração                                                                */
/* -------------------------------------------------------------------------- */

describe('restauração da sessão gravada', () => {
  it('devolve o usuário quando ele existe, está ativo e tem perfil válido', () => {
    const analyst = seedValidSession()
    writeStoredAuthUserId(analyst.id, true)

    const restored = restoreAuthenticatedUser()

    expect(restored?.id).toBe(analyst.id)
    expect(restored?.email).toBe(analyst.email)
    // A sessão continua gravada: restaurar não consome a lembrança.
    expect(local.getItem(AUTH_SESSION_STORAGE_KEY)).toBe(analyst.id)
  })

  it('restaura a sessão gravada só na aba', () => {
    const analyst = seedValidSession()
    writeStoredAuthUserId(analyst.id, false)

    expect(restoreAuthenticatedUser()?.id).toBe(analyst.id)
  })

  it('devolve null sem nenhuma sessão gravada, sem tocar no armazenamento', () => {
    seedValidSession()
    const before = local.snapshot()

    expect(restoreAuthenticatedUser()).toBeNull()
    expect(local.snapshot()).toEqual(before)
  })

  it('relê o cadastro atual, e não um retrato antigo', () => {
    const analyst = seedValidSession({ name: 'Nome Antigo' })
    writeStoredAuthUserId(analyst.id, true)
    expect(writeStoredUsers([{ ...analyst, name: 'Nome Novo' }])).toBe(true)

    expect(restoreAuthenticatedUser()?.name).toBe('Nome Novo')
  })

  it('recusa e limpa quando o usuário não existe mais', () => {
    seedValidSession()
    writeStoredAuthUserId('usr-999', true)

    expect(restoreAuthenticatedUser()).toBeNull()
    expect(readStoredAuthUserId()).toBeNull()
  })

  it('recusa e limpa quando o usuário foi desativado', () => {
    const analyst = seedValidSession({ status: 'Inativo' })
    writeStoredAuthUserId(analyst.id, true)

    expect(restoreAuthenticatedUser()).toBeNull()
    expect(readStoredAuthUserId()).toBeNull()
  })

  it('recusa e limpa quando o usuário ficou sem Perfil de Acesso', () => {
    const analyst = seedValidSession()
    markBaseAsAnalyzed()
    // Perfil retirado depois, como acontece quando o Perfil de Acesso dele é
    // excluído entre um acesso e outro.
    replaceStoredUser({ ...analyst, accessProfileId: null })
    writeStoredAuthUserId(analyst.id, false)

    expect(restoreAuthenticatedUser()).toBeNull()
    expect(readStoredAuthUserId()).toBeNull()
  })

  it('recusa e limpa quando o Perfil de Acesso vinculado foi desativado', () => {
    const analyst = seedValidSession({}, analystProfile({ lifecycle: 'inactive' }))
    writeStoredAuthUserId(analyst.id, true)

    expect(restoreAuthenticatedUser()).toBeNull()
    expect(readStoredAuthUserId()).toBeNull()
  })

  it('recusa e limpa quando o destino do perfil deixou de servir ao usuário', () => {
    const analyst = seedValidSession({}, analystProfile({ audience: 'executive' }))
    writeStoredAuthUserId(analyst.id, true)

    expect(restoreAuthenticatedUser()).toBeNull()
    expect(readStoredAuthUserId()).toBeNull()
  })

  it('recusa e limpa o Administrador que não está no Acesso do Sistema', () => {
    const administrator = user('Administrador', {
      id: 'usr-200',
      email: 'admin@impactotelecom.com',
      accessProfileId: 'acp-system',
    })
    expect(writeStoredAccessProfiles([analystProfile()])).toBe(true)
    expect(writeStoredUsers([administrator])).toBe(true)
    markBaseAsAnalyzed()
    // Vínculo trocado para um perfil comum: destino incompatível com o Perfil do
    // Sistema Administrador.
    replaceStoredUser({ ...administrator, accessProfileId: 'acp-900' })
    writeStoredAuthUserId(administrator.id, true)

    expect(restoreAuthenticatedUser()).toBeNull()
    expect(readStoredAuthUserId()).toBeNull()
  })

  it('restaura o Administrador vinculado ao Acesso do Sistema', () => {
    const administrator = user('Administrador', {
      id: 'usr-200',
      email: 'admin@impactotelecom.com',
      accessProfileId: 'acp-system',
    })
    expect(writeStoredAccessProfiles([analystProfile()])).toBe(true)
    expect(writeStoredUsers([administrator])).toBe(true)
    writeStoredAuthUserId(administrator.id, false)

    expect(restoreAuthenticatedUser()?.id).toBe(administrator.id)
  })
})

/* -------------------------------------------------------------------------- */
/* Entrada pelo formulário                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A entrada e a restauração respondem pela MESMA regra. Estes casos existem para
 * provar que as duas não podem divergir: quem é recusado no formulário também é
 * recusado ao voltar, e vice-versa.
 */
describe('autorização pelo e-mail', () => {
  it('autoriza o usuário ativo com Perfil de Acesso válido', () => {
    const analyst = seedValidSession()

    expect(authorizeUserByEmail(analyst.email)).toEqual(
      expect.objectContaining({ ok: true, user: expect.objectContaining({ id: analyst.id }) }),
    )
  })

  it('recusa e-mail inexistente e usuário inativo pelo mesmo motivo de cadastro', () => {
    seedValidSession({ status: 'Inativo' })

    expect(authorizeUserByEmail('ninguem@impactotelecom.com')).toEqual({
      ok: false,
      reason: 'invalid-credentials',
    })
    expect(authorizeUserByEmail('pessoa@impactotelecom.com')).toEqual({
      ok: false,
      reason: 'invalid-credentials',
    })
  })

  it('recusa quem está sem Perfil de Acesso válido', () => {
    const analyst = seedValidSession()
    markBaseAsAnalyzed()
    replaceStoredUser({ ...analyst, accessProfileId: null })

    expect(authorizeUserByEmail(analyst.email)).toEqual({
      ok: false,
      reason: 'access-profile-required',
    })
  })

  it('não grava sessão nenhuma: quem persiste é o contexto', () => {
    const analyst = seedValidSession()

    authorizeUserByEmail(analyst.email)

    expect(readStoredAuthUserId()).toBeNull()
  })
})
