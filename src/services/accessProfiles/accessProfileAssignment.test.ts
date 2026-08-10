import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { biAreas, type BiArea } from '../../config/biAreas'
import { EXECUTIVE_ACCESS_PROFILE_NAME } from '../../config/accessProfileCatalog'
import { departmentPages } from '../../config/departmentPages'
import type { User } from '../../data/dashboardTypes'
import { defaultDepartmentPageKeys, deriveUserAccess } from '../../lib/userAccessRules'
import type { StandardAccessProfile, UserProfile } from '../../types/access'
import type { AccessProfileHistoryEvent, HistoryEvent } from '../../types/userHistory'
import { readStoredAccessProfiles, writeStoredAccessProfiles } from './accessProfileStorage'
import {
  assignAccessProfileToUser,
  checkAccessProfileAssignment,
  createAccessProfileWithUsers,
  deleteAccessProfileWithUsers,
  ensureAccessProfileLinks,
  updateAccessProfileWithUsers,
} from './accessProfileAssignment'
import { readStoredUserHistory } from '../users/userHistoryStorage'
import {
  readAccessProfileLinkMigrationDone,
  readStoredUsers,
  writeStoredUsers,
  writeStoredUsersWithHistory,
  USERS_ACCESS_PROFILE_LINK_MIGRATION_KEY,
  USER_HISTORY_STORAGE_KEY,
} from '../users/userStorage'

class MemoryStorage {
  private entries = new Map<string, string>()
  private writes = 0
  private failAt: number | null = null

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
    if (this.failAt === this.writes) throw new Error('Falha simulada')
    this.entries.set(key, value)
  }

  failWriteAt(position: number): void {
    this.writes = 0
    this.failAt = position
  }

  snapshot(): ReadonlyMap<string, string> {
    return new Map(this.entries)
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

function availableArea(excludedId?: string): BiArea {
  const area = biAreas.find(
    (candidate) =>
      candidate.id !== excludedId && defaultDepartmentPageKeys(candidate.id).length > 0,
  )
  if (!area) throw new Error('Catálogo sem departamento disponível para o teste.')
  return area
}

const firstArea = availableArea()
const secondArea = availableArea(firstArea.id)

function grantsFor(area: BiArea) {
  return [{ departmentId: area.id, pageKeys: defaultDepartmentPageKeys(area.id) }]
}

function profile(
  id: string,
  area: BiArea = firstArea,
  overrides: Partial<StandardAccessProfile> = {},
): StandardAccessProfile {
  const pageKey = grantsFor(area)[0]?.pageKeys[0]
  if (!pageKey) throw new Error(`Departamento ${area.id} sem página concedível.`)

  return {
    id,
    name: `Perfil ${id}`,
    kind: 'standard',
    audience: 'analyst',
    lifecycle: 'active',
    departmentPageAccess: grantsFor(area),
    homePage: { departmentId: area.id, pageKey },
    hasBeenUsed: false,
    ...overrides,
  }
}

function user(
  id: string,
  systemProfile: UserProfile,
  area: BiArea = firstArea,
  overrides: Partial<User> = {},
): User {
  const derived =
    systemProfile === 'Analista'
      ? deriveUserAccess({
          profile: 'Analista',
          departments: grantsFor(area),
        })
      : deriveUserAccess({ profile: systemProfile })

  if (!derived) throw new Error('Acesso de teste inválido.')

  return {
    id,
    name: `Usuário ${id}`,
    email: `${id}@impactotelecom.com`,
    ...derived,
    accessProfileId: null,
    status: 'Ativo',
    lastAccess: 'Nunca acessou',
    initials: 'UT',
    ...overrides,
  }
}

function seed(profiles: StandardAccessProfile[], users: User[]): void {
  expect(writeStoredAccessProfiles(profiles)).toBe(true)
  expect(writeStoredUsers(users)).toBe(true)
}

/** Responsável de teste: id e nome, exatamente o que o evento copia. */
const actor = { id: 'usr-001', name: 'Mário Luiz Ramos' }

/** Eventos de Perfil de Acesso gravados até agora, na ordem de gravação. */
function accessProfileEvents(): AccessProfileHistoryEvent[] {
  const history = readStoredUserHistory() ?? []

  return history.filter(
    (event): event is AccessProfileHistoryEvent => event.targetType === 'access-profile',
  )
}

/** Todo o Histórico gravado, incluindo os eventos de usuário. */
function storedHistory(): HistoryEvent[] {
  return readStoredUserHistory() ?? []
}

describe('validação da atribuição', () => {
  it('distingue ausência, id desconhecido, perfil inativo, incompatibilidade e sucesso', () => {
    const analyst = profile('acp-900')
    const inactive = profile('acp-901', firstArea, { lifecycle: 'inactive' })

    expect(checkAccessProfileAssignment(null, 'Analista', [analyst])).toEqual({
      ok: false,
      reason: 'access-profile-required',
    })
    expect(checkAccessProfileAssignment('acp-999', 'Analista', [analyst])).toEqual({
      ok: false,
      reason: 'unknown-access-profile',
    })
    expect(checkAccessProfileAssignment(inactive.id, 'Analista', [inactive])).toEqual({
      ok: false,
      reason: 'inactive-access-profile',
    })
    expect(checkAccessProfileAssignment(analyst.id, 'Executivo', [analyst])).toEqual({
      ok: false,
      reason: 'incompatible-access-profile',
    })
    expect(checkAccessProfileAssignment(analyst.id, 'Analista', [analyst])).toEqual({
      ok: true,
      profile: analyst,
    })
  })
})

describe('migração determinística dos vínculos', () => {
  it('vincula Administrador, Executivo e Analista somente às correspondências seguras', () => {
    const analyst = profile('acp-900')
    const executive = profile('acp-901', firstArea, {
      name: EXECUTIVE_ACCESS_PROFILE_NAME,
      audience: 'executive',
    })
    seed(
      [executive, analyst],
      [
        user('usr-001', 'Administrador'),
        user('usr-002', 'Executivo'),
        user('usr-003', 'Analista'),
      ],
    )

    const result = ensureAccessProfileLinks()
    const stored = readStoredUsers()

    expect(result.writeFailed).toBe(false)
    expect(result.linkedUserIds).toEqual(['usr-001', 'usr-002', 'usr-003'])
    expect(stored?.map((entry) => entry.accessProfileId)).toEqual([
      'acp-system',
      executive.id,
      analyst.id,
    ])
    expect(readStoredAccessProfiles()).toEqual(
      expect.objectContaining({
        ok: true,
        profiles: expect.arrayContaining([
          expect.objectContaining({ id: executive.id, hasBeenUsed: true }),
          expect.objectContaining({ id: analyst.id, hasBeenUsed: true }),
        ]),
      }),
    )
  })

  it('mantém null quando dois perfis de Analista possuem exatamente o mesmo alcance', () => {
    seed(
      [profile('acp-900'), profile('acp-901', firstArea, { name: 'Perfil duplicado' })],
      [user('usr-001', 'Analista')],
    )

    const result = ensureAccessProfileLinks()

    expect(result.linkedUserIds).toEqual([])
    expect(readStoredUsers()?.[0]?.accessProfileId).toBeNull()
  })

  it('realinha os acessos expandidos de um vínculo válido sem trocar o perfil', () => {
    const analyst = profile('acp-900')
    const stale = user('usr-001', 'Analista', secondArea, { accessProfileId: analyst.id })
    seed([analyst], [stale])

    const result = ensureAccessProfileLinks()
    const stored = readStoredUsers()?.[0]

    expect(result.synchronizedUserIds).toEqual([stale.id])
    expect(stored?.accessProfileId).toBe(analyst.id)
    expect(stored?.departmentPageAccess).toEqual(analyst.departmentPageAccess)
  })
})

describe('gravação conjunta do perfil e dos usuários', () => {
  it('cria o perfil, transfere o usuário e marca o perfil como utilizado', () => {
    const previous = profile('acp-900', firstArea, { hasBeenUsed: true })
    const analyst = user('usr-001', 'Analista', firstArea, { accessProfileId: previous.id })
    seed([previous], [analyst])

    const result = createAccessProfileWithUsers({
      actor,
      name: 'Novo perfil',
      audience: 'analyst',
      departmentPageAccess: grantsFor(secondArea),
      userIds: [analyst.id],
    })

    expect(result).toEqual(
      expect.objectContaining({ ok: true, assignedUserIds: [analyst.id] }),
    )
    if (!result.ok) throw new Error('Criação deveria ter sido aceita.')

    expect(readStoredUsers()?.[0]).toEqual(
      expect.objectContaining({
        accessProfileId: result.profile.id,
        departmentPageAccess: result.profile.departmentPageAccess,
      }),
    )
    expect(readStoredAccessProfiles()).toEqual(
      expect.objectContaining({
        ok: true,
        profiles: expect.arrayContaining([
          expect.objectContaining({ id: result.profile.id, hasBeenUsed: true }),
        ]),
      }),
    )
  })

  it('recusa retirar um usuário já vinculado sem informar um perfil de destino', () => {
    const analystProfile = profile('acp-900', firstArea, { hasBeenUsed: true })
    const analyst = user('usr-001', 'Analista', firstArea, {
      accessProfileId: analystProfile.id,
    })
    seed([analystProfile], [analyst])
    // Primeira leitura da aplicação: a migração roda e grava a marca. O
    // instantâneo é tirado depois dela, para a asserção falar da edição
    // recusada, e não da migração.
    ensureAccessProfileLinks()
    const before = memory.snapshot()

    const result = updateAccessProfileWithUsers(analystProfile.id, {
      actor,
      name: analystProfile.name,
      departmentPageAccess: analystProfile.departmentPageAccess,
      userIds: [],
    })

    expect(result).toEqual({ ok: false, reason: 'unassignment-not-allowed' })
    expect(memory.snapshot()).toEqual(before)
  })

  it('sincroniza os usuários vinculados quando as páginas do perfil mudam', () => {
    const analystProfile = profile('acp-900', firstArea, { hasBeenUsed: true })
    const analyst = user('usr-001', 'Analista', firstArea, {
      accessProfileId: analystProfile.id,
    })
    seed([analystProfile], [analyst])

    const result = updateAccessProfileWithUsers(analystProfile.id, {
      actor,
      name: analystProfile.name,
      departmentPageAccess: grantsFor(secondArea),
      userIds: [analyst.id],
    })

    expect(result.ok).toBe(true)
    expect(readStoredUsers()?.[0]?.departmentPageAccess).toEqual(grantsFor(secondArea))
  })

  it('restaura usuários, perfis, Histórico e marca quando uma escrita falha', () => {
    const previous = profile('acp-900')
    const analyst = user('usr-001', 'Analista')
    seed([previous], [analyst])
    ensureAccessProfileLinks()
    const before = memory.snapshot()
    memory.failWriteAt(3)

    const result = createAccessProfileWithUsers({
      actor,
      name: 'Novo perfil',
      audience: 'analyst',
      departmentPageAccess: grantsFor(secondArea),
      userIds: [analyst.id],
    })

    expect(result).toEqual({ ok: false, reason: 'storage-failure' })
    // Todas as chaves da operação voltam exatamente ao estado anterior: nenhum
    // perfil gravado, nenhum vínculo trocado e nenhum evento no Histórico.
    expect(memory.snapshot()).toEqual(before)
    expect(accessProfileEvents()).toEqual([])
  })
})

describe('exclusão de Perfil de Acesso', () => {
  it('exclui um perfil comum sem usuários vinculados', () => {
    const target = profile('acp-900')
    const other = profile('acp-901', secondArea, { name: 'Outro perfil' })
    seed([target, other], [user('usr-001', 'Analista', secondArea)])

    const result = deleteAccessProfileWithUsers(target.id, actor)

    expect(result).toEqual(
      expect.objectContaining({ ok: true, unlinkedUserIds: [] }),
    )
    const stored = readStoredAccessProfiles()
    expect(stored.ok && stored.profiles.map((entry) => entry.id)).toEqual([other.id])
  })

  it('exclui um perfil já utilizado com um usuário vinculado e o desvincula', () => {
    const target = profile('acp-900', firstArea, { hasBeenUsed: true })
    const analyst = user('usr-001', 'Analista', firstArea, { accessProfileId: target.id })
    seed([target], [analyst])

    const result = deleteAccessProfileWithUsers(target.id, actor)

    expect(result).toEqual(expect.objectContaining({ ok: true, unlinkedUserIds: ['usr-001'] }))

    const stored = readStoredUsers()?.[0]
    expect(stored?.accessProfileId).toBeNull()
    // Dados pessoais e Perfil do Sistema permanecem intactos.
    expect(stored?.name).toBe(analyst.name)
    expect(stored?.email).toBe(analyst.email)
    expect(stored?.profile).toBe('Analista')
    expect(stored?.status).toBe('Ativo')
  })

  it('exclui um perfil com vários usuários vinculados de uma vez', () => {
    const target = profile('acp-900', firstArea, { hasBeenUsed: true })
    seed(
      [target],
      [
        user('usr-001', 'Analista', firstArea, { accessProfileId: target.id }),
        user('usr-002', 'Analista', firstArea, { accessProfileId: target.id }),
        user('usr-003', 'Analista', firstArea, { accessProfileId: target.id }),
      ],
    )

    const result = deleteAccessProfileWithUsers(target.id, actor)

    expect(result).toEqual(
      expect.objectContaining({ ok: true, unlinkedUserIds: ['usr-001', 'usr-002', 'usr-003'] }),
    )
    expect(readStoredUsers()?.map((entry) => entry.accessProfileId)).toEqual([null, null, null])
  })

  it('recusa excluir o Acesso do Sistema, inclusive por chamada direta ao serviço', () => {
    seed([profile('acp-900')], [user('usr-001', 'Administrador')])
    const before = memory.snapshot()

    expect(deleteAccessProfileWithUsers('acp-system', actor)).toEqual({
      ok: false,
      reason: 'system-profile',
    })
    expect(memory.snapshot()).toEqual(before)
  })

  it('recusa um id que não existe na coleção', () => {
    seed([profile('acp-900')], [user('usr-001', 'Analista')])

    expect(deleteAccessProfileWithUsers('acp-999', actor)).toEqual({ ok: false, reason: 'not-found' })
  })

  it('não grava nada quando uma escrita da exclusão falha', () => {
    const target = profile('acp-900', firstArea, { hasBeenUsed: true })
    const analyst = user('usr-001', 'Analista', firstArea, { accessProfileId: target.id })
    seed([target], [analyst])
    ensureAccessProfileLinks()
    const before = memory.snapshot()
    memory.failWriteAt(3)

    expect(deleteAccessProfileWithUsers(target.id, actor)).toEqual({
      ok: false,
      reason: 'storage-failure',
    })
    expect(memory.snapshot()).toEqual(before)
  })

  it('não religa o usuário desvinculado na leitura seguinte', () => {
    // Dois perfis com o MESMO alcance: sem a marca da migração, o usuário
    // desvinculado voltaria a corresponder ao perfil restante.
    const target = profile('acp-900', firstArea, { hasBeenUsed: true })
    const twin = profile('acp-901', firstArea, { name: 'Perfil gêmeo' })
    const analyst = user('usr-001', 'Analista', firstArea, { accessProfileId: target.id })
    seed([target, twin], [analyst])

    // Primeira leitura da aplicação: a migração roda e grava a marca.
    ensureAccessProfileLinks()

    expect(deleteAccessProfileWithUsers(target.id, actor).ok).toBe(true)

    // Recarga da aplicação.
    const migration = ensureAccessProfileLinks()

    expect(migration.linkedUserIds).toEqual([])
    expect(readStoredUsers()?.[0]?.accessProfileId).toBeNull()
  })

  it('não religa o Executivo desvinculado ao perfil executivo padrão', () => {
    const executive = profile('acp-900', firstArea, {
      name: EXECUTIVE_ACCESS_PROFILE_NAME,
      audience: 'executive',
    })
    const specific = profile('acp-901', secondArea, {
      name: 'Executivo específico',
      audience: 'executive',
    })
    seed([executive, specific], [user('usr-001', 'Executivo', firstArea)])

    ensureAccessProfileLinks()
    expect(readStoredUsers()?.[0]?.accessProfileId).toBe(executive.id)

    expect(deleteAccessProfileWithUsers(executive.id, actor).ok).toBe(true)

    ensureAccessProfileLinks()

    expect(readStoredUsers()?.[0]?.accessProfileId).toBeNull()
  })

  it('permite atribuir o usuário desvinculado a outro perfil depois da exclusão', () => {
    const target = profile('acp-900', firstArea, { hasBeenUsed: true })
    const other = profile('acp-901', secondArea, { name: 'Outro perfil' })
    const analyst = user('usr-001', 'Analista', firstArea, { accessProfileId: target.id })
    seed([target, other], [analyst])
    ensureAccessProfileLinks()

    expect(deleteAccessProfileWithUsers(target.id, actor).ok).toBe(true)

    const result = updateAccessProfileWithUsers(other.id, {
      actor,
      name: other.name,
      departmentPageAccess: other.departmentPageAccess,
      userIds: [analyst.id],
    })

    expect(result.ok).toBe(true)
    expect(readStoredUsers()?.[0]?.accessProfileId).toBe(other.id)
  })

  it('mantém a migração legada funcionando em uma base que nunca passou por ela', () => {
    const analyst = profile('acp-900')
    seed([analyst], [user('usr-001', 'Analista')])

    const migration = ensureAccessProfileLinks()

    expect(migration.linkedUserIds).toEqual(['usr-001'])
    expect(readStoredUsers()?.[0]?.accessProfileId).toBe(analyst.id)
  })
})

/* -------------------------------------------------------------------------- */
/* Marca da migração diante das operações comuns                              */
/* -------------------------------------------------------------------------- */

/**
 * A marca `USERS_ACCESS_PROFILE_LINK_MIGRATION_KEY` declara que TODA a base
 * legada já foi analisada. Antes, qualquer gravação deste módulo a escrevia,
 * inclusive uma criação, uma edição ou uma exclusão de perfil, que alcançam
 * apenas os usuários daquele perfil. Em uma base ainda não migrada, isso
 * encerrava a migração cedo demais e deixava os vínculos legados dos demais
 * usuários definitivamente ignorados.
 *
 * Agora a operação comum não escreve a marca: ela CONCLUI a migração antes de
 * começar, e é a própria migração que a grava, depois de percorrer todo mundo.
 */
describe('marca da migração diante das operações comuns', () => {
  it('não deixa vínculo legado para trás ao criar um perfil antes da migração', () => {
    const legacy = profile('acp-900', firstArea, { name: 'Perfil legado' })
    seed([legacy], [user('usr-001', 'Analista', firstArea), user('usr-002', 'Executivo')])

    // Base legada: nenhuma migração rodou ainda.
    expect(readAccessProfileLinkMigrationDone()).toBe(false)

    const result = createAccessProfileWithUsers({
      actor,
      name: 'Perfil novo',
      audience: 'analyst',
      departmentPageAccess: grantsFor(secondArea),
      userIds: [],
    })

    expect(result.ok).toBe(true)
    // O Analista legado foi reconhecido e vinculado: a criação não encerrou a
    // migração antes de ele ser analisado.
    expect(readStoredUsers()?.[0]?.accessProfileId).toBe(legacy.id)
    expect(readAccessProfileLinkMigrationDone()).toBe(true)
  })

  it('não deixa vínculo legado para trás ao editar um perfil antes da migração', () => {
    const legacy = profile('acp-900', firstArea, { name: 'Perfil legado' })
    const other = profile('acp-901', secondArea, { name: 'Outro perfil' })
    seed([legacy, other], [user('usr-001', 'Analista', firstArea)])

    const result = updateAccessProfileWithUsers(other.id, {
      actor,
      name: 'Outro perfil renomeado',
      departmentPageAccess: other.departmentPageAccess,
      userIds: [],
    })

    expect(result.ok).toBe(true)
    expect(readStoredUsers()?.[0]?.accessProfileId).toBe(legacy.id)
  })

  it('não deixa vínculo legado para trás ao excluir um perfil antes da migração', () => {
    const legacy = profile('acp-900', firstArea, { name: 'Perfil legado' })
    const doomed = profile('acp-901', secondArea, { name: 'Perfil a excluir' })
    seed([legacy, doomed], [user('usr-001', 'Analista', firstArea)])

    expect(deleteAccessProfileWithUsers(doomed.id, actor).ok).toBe(true)

    // O Analista continua com o vínculo que a migração encontrou para ele, e a
    // exclusão de OUTRO perfil não o deixou sem perfil nenhum.
    expect(readStoredUsers()?.[0]?.accessProfileId).toBe(legacy.id)
  })

  it('preserva o null deliberado de quem perdeu o perfil na exclusão', () => {
    // Dois perfis com o MESMO alcance: sem a marca, o usuário desvinculado
    // voltaria a corresponder ao perfil restante na leitura seguinte.
    const target = profile('acp-900', firstArea, { hasBeenUsed: true })
    const twin = profile('acp-901', firstArea, { name: 'Perfil gêmeo' })
    seed(
      [target, twin],
      [user('usr-001', 'Analista', firstArea, { accessProfileId: target.id })],
    )

    // Nenhuma migração explícita antes: a exclusão precisa concluí-la sozinha.
    expect(deleteAccessProfileWithUsers(target.id, actor).ok).toBe(true)
    expect(readStoredUsers()?.[0]?.accessProfileId).toBeNull()

    // Recarga da aplicação.
    ensureAccessProfileLinks()

    expect(readStoredUsers()?.[0]?.accessProfileId).toBeNull()
  })

  it('não grava a marca quando a operação inteira falha', () => {
    const analyst = profile('acp-900')
    seed([analyst], [user('usr-001', 'Analista')])
    const before = memory.snapshot()
    // Falha já na primeira escrita: nem a migração se completa.
    memory.failWriteAt(1)

    expect(
      createAccessProfileWithUsers({
        actor,
        name: 'Perfil novo',
        audience: 'analyst',
        departmentPageAccess: grantsFor(secondArea),
        userIds: [],
      }),
    ).toEqual({ ok: false, reason: 'storage-failure' })

    expect(memory.snapshot()).toEqual(before)
    expect(memory.getItem(USERS_ACCESS_PROFILE_LINK_MIGRATION_KEY)).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Histórico dos Perfis de Acesso                                             */
/* -------------------------------------------------------------------------- */

describe('eventos de Histórico dos Perfis de Acesso', () => {
  it('registra a criação com destino, cobertura e usuários vinculados', () => {
    const previous = profile('acp-900', firstArea, { hasBeenUsed: true })
    const analyst = user('usr-002', 'Analista', firstArea, { accessProfileId: previous.id })
    seed([previous], [analyst])
    ensureAccessProfileLinks()

    const result = createAccessProfileWithUsers({
      actor,
      name: 'Perfil novo',
      audience: 'analyst',
      departmentPageAccess: grantsFor(secondArea),
      userIds: [analyst.id],
    })

    if (!result.ok) throw new Error('Criação deveria ter sido aceita.')

    const events = accessProfileEvents()

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(
      expect.objectContaining({
        targetType: 'access-profile',
        action: 'access-profile-created',
        targetAccessProfileId: result.profile.id,
        targetAccessProfileName: 'Perfil novo',
        actorUserId: actor.id,
        actorName: actor.name,
      }),
    )
    expect(events[0].id).toBeTruthy()
    expect(events[0].occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(events[0].details).toContain('Destino: Analistas')
    expect(events[0].details.some((detail) => detail.startsWith('Cobertura inicial: '))).toBe(true)
    // Transferência no formato de transição: origem, seta e destino na mesma
    // linha, com o nome do usuário dentro dela.
    expect(events[0].details).toContain(
      `Perfil de Acesso de ${analyst.name}: ${previous.name} → Perfil novo`,
    )
  })

  it('registra na edição somente as diferenças efetivas', () => {
    const target = profile('acp-900', firstArea, { name: 'Perfil original' })
    seed([target], [user('usr-002', 'Analista', secondArea)])
    ensureAccessProfileLinks()

    const result = updateAccessProfileWithUsers(target.id, {
      actor,
      name: 'Perfil renomeado',
      departmentPageAccess: grantsFor(secondArea),
      userIds: [],
    })

    expect(result.ok).toBe(true)

    const events = accessProfileEvents()

    expect(events).toHaveLength(1)
    expect(events[0].action).toBe('access-profile-updated')
    expect(events[0].details).toContain('Nome alterado: Perfil original → Perfil renomeado')
    expect(events[0].details).toContain(`Departamento adicionado: ${secondArea.label}`)
    expect(events[0].details).toContain(`Departamento removido: ${firstArea.label}`)
  })

  it('não gera evento quando o salvamento não muda nada', () => {
    const target = profile('acp-900', firstArea, { hasBeenUsed: true })
    const analyst = user('usr-002', 'Analista', firstArea, { accessProfileId: target.id })
    seed([target], [analyst])
    ensureAccessProfileLinks()

    const result = updateAccessProfileWithUsers(target.id, {
      actor,
      name: target.name,
      departmentPageAccess: target.departmentPageAccess,
      userIds: [analyst.id],
    })

    expect(result.ok).toBe(true)
    expect(accessProfileEvents()).toEqual([])
  })

  it('registra a exclusão sem usuários vinculados', () => {
    const target = profile('acp-900')
    const other = profile('acp-901', secondArea, { name: 'Outro perfil' })
    seed([target, other], [user('usr-002', 'Analista', secondArea)])
    ensureAccessProfileLinks()

    expect(deleteAccessProfileWithUsers(target.id, actor).ok).toBe(true)

    const events = accessProfileEvents()

    expect(events).toHaveLength(1)
    expect(events[0].action).toBe('access-profile-deleted')
    expect(events[0].targetAccessProfileName).toBe(target.name)
    expect(events[0].details).toContain('Nenhum usuário estava vinculado a este perfil')
  })

  it('registra a exclusão com um usuário e com vários', () => {
    const single = profile('acp-900', firstArea, { hasBeenUsed: true })
    const many = profile('acp-901', secondArea, { name: 'Perfil coletivo', hasBeenUsed: true })
    const alone = user('usr-002', 'Analista', firstArea, { accessProfileId: single.id })
    const first = user('usr-003', 'Analista', secondArea, { accessProfileId: many.id })
    const second = user('usr-004', 'Analista', secondArea, { accessProfileId: many.id })
    seed([single, many], [alone, first, second])
    ensureAccessProfileLinks()

    expect(deleteAccessProfileWithUsers(single.id, actor).ok).toBe(true)
    expect(deleteAccessProfileWithUsers(many.id, actor).ok).toBe(true)

    const events = accessProfileEvents()

    expect(events).toHaveLength(2)
    expect(events[0].details).toContain('Usuários desvinculados: 1')
    expect(events[0].details).toContain(
      `Perfil de Acesso de ${alone.name}: ${single.name} → Sem perfil definido`,
    )
    expect(events[1].details).toContain('Usuários desvinculados: 2')
    // Uma linha independente por usuário afetado, e não uma enumeração única.
    expect(events[1].details).toContain(
      `Perfil de Acesso de ${first.name}: ${many.name} → Sem perfil definido`,
    )
    expect(events[1].details).toContain(
      `Perfil de Acesso de ${second.name}: ${many.name} → Sem perfil definido`,
    )
  })

  it('preserva os eventos de usuário já gravados e acrescenta o novo no fim', () => {
    const target = profile('acp-900')
    seed([target], [user('usr-002', 'Analista')])
    ensureAccessProfileLinks()

    // Evento antigo, no formato anterior ao Histórico unificado: sem targetType.
    const legacyEvent = {
      id: 'evt-001',
      action: 'updated' as const,
      occurredAt: '2026-01-05T12:00:00.000Z',
      targetUserId: 'usr-002',
      targetUserName: 'Usuário usr-002',
      actorUserId: actor.id,
      actorName: actor.name,
      details: ['Acessos atualizados.'],
    }
    const users = readStoredUsers()
    if (!users) throw new Error('Base de usuários indisponível no teste.')
    expect(writeStoredUsersWithHistory(users, [legacyEvent])).toBe(true)

    expect(deleteAccessProfileWithUsers(target.id, actor).ok).toBe(true)

    const history = storedHistory()

    expect(history).toHaveLength(2)
    expect(history[0]).toEqual(legacyEvent)
    expect(history[1]).toEqual(
      expect.objectContaining({ targetType: 'access-profile', action: 'access-profile-deleted' }),
    )
  })

  it('recusa a alteração quando o Histórico gravado não pode ser lido', () => {
    const target = profile('acp-900')
    seed([target], [user('usr-002', 'Analista')])
    ensureAccessProfileLinks()
    memory.setItem(USER_HISTORY_STORAGE_KEY, '{ isto não é um array }')
    const before = memory.snapshot()

    expect(deleteAccessProfileWithUsers(target.id, actor)).toEqual({
      ok: false,
      reason: 'history-unavailable',
    })
    expect(
      createAccessProfileWithUsers({
        actor,
        name: 'Perfil novo',
        audience: 'analyst',
        departmentPageAccess: grantsFor(secondArea),
        userIds: [],
      }),
    ).toEqual({ ok: false, reason: 'history-unavailable' })

    // O Histórico ilegível permanece intocado, e nada mais foi gravado.
    expect(memory.snapshot()).toEqual(before)
  })

  it('recusa a operação sem responsável identificado', () => {
    const target = profile('acp-900')
    seed([target], [user('usr-002', 'Analista')])
    const before = memory.snapshot()

    expect(deleteAccessProfileWithUsers(target.id, { id: '', name: '' })).toEqual({
      ok: false,
      reason: 'actor-required',
    })
    expect(
      createAccessProfileWithUsers({
        actor: { id: 'usr-001', name: '   ' },
        name: 'Perfil novo',
        audience: 'analyst',
        departmentPageAccess: grantsFor(secondArea),
        userIds: [],
      }),
    ).toEqual({ ok: false, reason: 'actor-required' })

    expect(memory.snapshot()).toEqual(before)
    expect(accessProfileEvents()).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* Formato de transição do Histórico                                          */
/* -------------------------------------------------------------------------- */

/**
 * As três situações usam a MESMA frase, `origem → destino`, com o nome do usuário
 * na própria linha. Antes elas tinham três redações diferentes, e os usuários
 * apareciam agrupados em uma enumeração só.
 */
describe('transições de Perfil de Acesso no Histórico', () => {
  /** Todas as linhas de transição gravadas até agora, em qualquer evento. */
  function transitionDetails(): string[] {
    return accessProfileEvents().flatMap((event) =>
      event.details.filter((detail) => detail.startsWith('Perfil de Acesso de ')),
    )
  }

  it('usa Sem perfil definido como origem na primeira atribuição', () => {
    const orphan = user('usr-002', 'Analista', firstArea)
    seed([profile('acp-900', secondArea, { name: 'Outro perfil' })], [orphan])
    ensureAccessProfileLinks()
    // A base já foi percorrida: o Analista continua sem perfil de propósito.
    expect(readStoredUsers()?.[0]?.accessProfileId).toBeNull()

    const result = createAccessProfileWithUsers({
      actor,
      name: 'Comercial',
      audience: 'analyst',
      departmentPageAccess: grantsFor(firstArea),
      userIds: [orphan.id],
    })

    expect(result.ok).toBe(true)
    expect(transitionDetails()).toEqual([
      `Perfil de Acesso de ${orphan.name}: Sem perfil definido → Comercial`,
    ])
  })

  it('usa os dois nomes na transferência entre perfis', () => {
    const origin = profile('acp-900', firstArea, { name: 'Retenção', hasBeenUsed: true })
    const destination = profile('acp-901', secondArea, { name: 'Comercial' })
    const analyst = user('usr-002', 'Analista', firstArea, { accessProfileId: origin.id })
    seed([origin, destination], [analyst])
    ensureAccessProfileLinks()

    const result = updateAccessProfileWithUsers(destination.id, {
      actor,
      name: destination.name,
      departmentPageAccess: destination.departmentPageAccess,
      userIds: [analyst.id],
    })

    expect(result.ok).toBe(true)
    expect(transitionDetails()).toEqual([
      `Perfil de Acesso de ${analyst.name}: Retenção → Comercial`,
    ])
  })

  it('usa o nome novo do perfil quando a mesma edição o renomeia', () => {
    const origin = profile('acp-900', firstArea, { name: 'Retenção', hasBeenUsed: true })
    const destination = profile('acp-901', secondArea, { name: 'Nome antigo' })
    const analyst = user('usr-002', 'Analista', firstArea, { accessProfileId: origin.id })
    seed([origin, destination], [analyst])
    ensureAccessProfileLinks()

    expect(
      updateAccessProfileWithUsers(destination.id, {
        actor,
        name: 'Comercial',
        departmentPageAccess: destination.departmentPageAccess,
        userIds: [analyst.id],
      }).ok,
    ).toBe(true)

    expect(transitionDetails()).toEqual([
      `Perfil de Acesso de ${analyst.name}: Retenção → Comercial`,
    ])
  })

  it('usa Sem perfil definido como destino na desvinculação pela exclusão', () => {
    const target = profile('acp-900', firstArea, { name: 'Comercial', hasBeenUsed: true })
    const analyst = user('usr-002', 'Analista', firstArea, { accessProfileId: target.id })
    seed([target], [analyst])
    ensureAccessProfileLinks()

    expect(deleteAccessProfileWithUsers(target.id, actor).ok).toBe(true)
    expect(transitionDetails()).toEqual([
      `Perfil de Acesso de ${analyst.name}: Comercial → Sem perfil definido`,
    ])
  })

  it('produz uma linha por usuário afetado, e não uma enumeração', () => {
    const target = profile('acp-900', firstArea, { name: 'Comercial', hasBeenUsed: true })
    const first = user('usr-002', 'Analista', firstArea, { accessProfileId: target.id })
    const second = user('usr-003', 'Analista', firstArea, { accessProfileId: target.id })
    seed([target], [first, second])
    ensureAccessProfileLinks()

    expect(deleteAccessProfileWithUsers(target.id, actor).ok).toBe(true)

    const transitions = transitionDetails()

    expect(transitions).toHaveLength(2)
    expect(transitions.every((detail) => !detail.includes(' e '))).toBe(true)
  })

  it('não usa mais as redações anteriores em nenhum evento', () => {
    const origin = profile('acp-900', firstArea, { name: 'Retenção', hasBeenUsed: true })
    const analyst = user('usr-002', 'Analista', firstArea, { accessProfileId: origin.id })
    seed([origin], [analyst])
    ensureAccessProfileLinks()

    expect(
      createAccessProfileWithUsers({
        actor,
        name: 'Comercial',
        audience: 'analyst',
        departmentPageAccess: grantsFor(secondArea),
        userIds: [analyst.id],
      }).ok,
    ).toBe(true)
    expect(deleteAccessProfileWithUsers(origin.id, actor).ok).toBe(true)

    const details = accessProfileEvents().flatMap((event) => event.details)

    for (const removed of [
      'Usuário vinculado:',
      'Usuários vinculados:',
      'Usuário transferido de outro Perfil de Acesso',
      'Usuários transferidos de outro Perfil de Acesso',
      'Ficaram sem Perfil de Acesso:',
      'vindo de',
    ]) {
      expect(details.some((detail) => detail.includes(removed))).toBe(false)
    }
  })

  it('não gera transição quando a gravação não muda vínculo nenhum', () => {
    const target = profile('acp-900', firstArea, { hasBeenUsed: true })
    const analyst = user('usr-002', 'Analista', firstArea, { accessProfileId: target.id })
    seed([target], [analyst])
    ensureAccessProfileLinks()

    expect(
      updateAccessProfileWithUsers(target.id, {
        actor,
        name: 'Perfil renomeado',
        departmentPageAccess: target.departmentPageAccess,
        userIds: [analyst.id],
      }).ok,
    ).toBe(true)

    expect(transitionDetails()).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* Atribuição direta a um usuário sem Perfil de Acesso                        */
/* -------------------------------------------------------------------------- */

describe('atribuição direta de um Perfil de Acesso', () => {
  /** Base já percorrida com um Analista deliberadamente sem perfil. */
  function seedUnassignedAnalyst(profiles: StandardAccessProfile[]): User {
    const orphan = user('usr-002', 'Analista', firstArea)
    seed(profiles, [orphan])
    ensureAccessProfileLinks()

    return orphan
  }

  it('grava o vínculo, os acessos derivados, o uso do perfil e o Histórico', () => {
    const target = profile('acp-900', secondArea, { name: 'Comercial' })
    const orphan = seedUnassignedAnalyst([target])
    expect(readStoredUsers()?.[0]?.accessProfileId).toBeNull()

    const result = assignAccessProfileToUser({
      accessProfileId: target.id,
      actor,
      userId: orphan.id,
    })

    expect(result).toEqual(
      expect.objectContaining({ ok: true, userId: orphan.id, userName: orphan.name }),
    )

    const stored = readStoredUsers()?.[0]
    expect(stored?.accessProfileId).toBe(target.id)
    // Acessos derivados do perfil, e não os que o usuário tinha antes.
    expect(stored?.departmentPageAccess).toEqual(target.departmentPageAccess)
    // Dados pessoais e Perfil do Sistema intactos.
    expect(stored?.name).toBe(orphan.name)
    expect(stored?.email).toBe(orphan.email)
    expect(stored?.profile).toBe('Analista')
    expect(stored?.status).toBe('Ativo')

    const profiles = readStoredAccessProfiles()
    expect(profiles.ok && profiles.profiles[0]?.hasBeenUsed).toBe(true)

    const events = accessProfileEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(
      expect.objectContaining({
        action: 'access-profile-updated',
        targetAccessProfileId: target.id,
        targetAccessProfileName: 'Comercial',
        actorUserId: actor.id,
        actorName: actor.name,
      }),
    )
    expect(events[0].details).toEqual([
      `Perfil de Acesso de ${orphan.name}: Sem perfil definido → Comercial`,
    ])
  })

  it('atribui um perfil executivo a um Executivo sem perfil', () => {
    const executiveProfile = profile('acp-900', firstArea, {
      name: 'Acesso executivo específico',
      audience: 'executive',
    })
    const orphan = user('usr-002', 'Executivo', firstArea)
    seed([executiveProfile], [orphan])
    // A migração religaria o Executivo somente ao perfil executivo PADRÃO, que
    // esta coleção não tem: ele continua sem perfil até a atribuição.
    ensureAccessProfileLinks()
    expect(readStoredUsers()?.[0]?.accessProfileId).toBeNull()

    expect(
      assignAccessProfileToUser({
        accessProfileId: executiveProfile.id,
        actor,
        userId: orphan.id,
      }).ok,
    ).toBe(true)
    expect(readStoredUsers()?.[0]?.accessProfileId).toBe(executiveProfile.id)
  })

  it('recusa um destino incompatível com o Perfil do Sistema do usuário', () => {
    const executiveProfile = profile('acp-900', secondArea, {
      name: 'Perfil executivo',
      audience: 'executive',
    })
    const orphan = seedUnassignedAnalyst([executiveProfile])
    const before = memory.snapshot()

    expect(
      assignAccessProfileToUser({
        accessProfileId: executiveProfile.id,
        actor,
        userId: orphan.id,
      }),
    ).toEqual({ ok: false, reason: 'incompatible-access-profile' })
    expect(memory.snapshot()).toEqual(before)
  })

  it('recusa um Perfil de Acesso inativo', () => {
    const inactive = profile('acp-900', secondArea, { lifecycle: 'inactive' })
    const orphan = seedUnassignedAnalyst([inactive])
    const before = memory.snapshot()

    expect(
      assignAccessProfileToUser({ accessProfileId: inactive.id, actor, userId: orphan.id }),
    ).toEqual({ ok: false, reason: 'inactive-access-profile' })
    expect(memory.snapshot()).toEqual(before)
  })

  it('recusa o Acesso do Sistema, inclusive por chamada direta ao serviço', () => {
    const orphan = seedUnassignedAnalyst([profile('acp-900', secondArea)])
    const before = memory.snapshot()

    expect(
      assignAccessProfileToUser({ accessProfileId: 'acp-system', actor, userId: orphan.id }),
    ).toEqual({ ok: false, reason: 'system-profile' })
    expect(memory.snapshot()).toEqual(before)
  })

  it('recusa um perfil que não existe mais e um usuário que não existe', () => {
    const orphan = seedUnassignedAnalyst([profile('acp-900', secondArea)])

    expect(
      assignAccessProfileToUser({ accessProfileId: 'acp-999', actor, userId: orphan.id }),
    ).toEqual({ ok: false, reason: 'unknown-access-profile' })
    expect(
      assignAccessProfileToUser({ accessProfileId: 'acp-900', actor, userId: 'usr-999' }),
    ).toEqual({ ok: false, reason: 'user-not-found' })
  })

  it('exige a escolha de um perfil', () => {
    const orphan = seedUnassignedAnalyst([profile('acp-900', secondArea)])

    expect(assignAccessProfileToUser({ accessProfileId: '  ', actor, userId: orphan.id })).toEqual({
      ok: false,
      reason: 'access-profile-required',
    })
  })

  it('exige um responsável identificado', () => {
    const orphan = seedUnassignedAnalyst([profile('acp-900', secondArea)])
    const before = memory.snapshot()

    expect(
      assignAccessProfileToUser({
        accessProfileId: 'acp-900',
        actor: { id: 'usr-001', name: '  ' },
        userId: orphan.id,
      }),
    ).toEqual({ ok: false, reason: 'actor-required' })
    expect(memory.snapshot()).toEqual(before)
    expect(accessProfileEvents()).toEqual([])
  })

  /**
   * O estado é revalidado na gravação: quem já recebeu um perfil não é
   * transferido por este caminho. Uma transferência silenciosa aqui trocaria um
   * vínculo que ninguém pediu para trocar.
   */
  it('recusa quando o usuário já recebeu um Perfil de Acesso', () => {
    const current = profile('acp-900', firstArea, { name: 'Atual', hasBeenUsed: true })
    const other = profile('acp-901', secondArea, { name: 'Outro' })
    const analyst = user('usr-002', 'Analista', firstArea, { accessProfileId: current.id })
    seed([current, other], [analyst])
    ensureAccessProfileLinks()
    const before = memory.snapshot()

    expect(
      assignAccessProfileToUser({ accessProfileId: other.id, actor, userId: analyst.id }),
    ).toEqual({ ok: false, reason: 'user-already-assigned' })
    expect(memory.snapshot()).toEqual(before)
    expect(readStoredUsers()?.[0]?.accessProfileId).toBe(current.id)
  })

  it('não grava nada quando uma escrita falha', () => {
    const target = profile('acp-900', secondArea)
    const orphan = seedUnassignedAnalyst([target])
    const before = memory.snapshot()
    memory.failWriteAt(3)

    expect(
      assignAccessProfileToUser({ accessProfileId: target.id, actor, userId: orphan.id }),
    ).toEqual({ ok: false, reason: 'storage-failure' })
    expect(memory.snapshot()).toEqual(before)
    expect(accessProfileEvents()).toEqual([])
    expect(readStoredUsers()?.[0]?.accessProfileId).toBeNull()
  })

  it('não grava nada quando o Histórico não pode ser lido', () => {
    const target = profile('acp-900', secondArea)
    const orphan = seedUnassignedAnalyst([target])
    memory.setItem(USER_HISTORY_STORAGE_KEY, '{ isto não é um array }')
    const before = memory.snapshot()

    expect(
      assignAccessProfileToUser({ accessProfileId: target.id, actor, userId: orphan.id }),
    ).toEqual({ ok: false, reason: 'history-unavailable' })
    expect(memory.snapshot()).toEqual(before)
  })

  it('deixa o usuário atribuído fora da seção de sem perfil na leitura seguinte', () => {
    const target = profile('acp-900', secondArea)
    const orphan = seedUnassignedAnalyst([target])

    expect(
      assignAccessProfileToUser({ accessProfileId: target.id, actor, userId: orphan.id }).ok,
    ).toBe(true)

    // Recarga da aplicação: o vínculo gravado é preservado e realinhado, e não
    // desfeito nem trocado.
    ensureAccessProfileLinks()

    expect(readStoredUsers()?.[0]?.accessProfileId).toBe(target.id)
  })
})

describe('catálogo usado pelos testes', () => {
  it('usa somente páginas publicadas', () => {
    for (const access of grantsFor(firstArea)) {
      const available = departmentPages[firstArea.id]
        .filter((page) => !page.disabled)
        .map((page) => page.key)

      expect(access.pageKeys.every((pageKey) => available.includes(pageKey))).toBe(true)
    }
  })
})
