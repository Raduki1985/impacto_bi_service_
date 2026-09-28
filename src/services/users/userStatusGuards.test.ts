import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from '../../data/dashboardTypes'

/**
 * Guardas de situação do portal: o que a tabela de Usuários pode e não pode
 * fazer com uma conta, segundo o status dela.
 *
 * O serviço é quem decide de verdade, e recusa as mesmas coisas com 422 e 400.
 * As guardas daqui existem para que a pessoa leia uma frase do portal em vez de
 * um código HTTP, e para que nenhum chamador contorne a regra que desabilita os
 * botões da linha. Este arquivo prova que elas recusam ANTES de chamar o
 * serviço: se `updateCoreUser` não foi chamado, a decisão foi do portal.
 *
 * O acesso ao serviço é substituído por dublês. `createCoreUserTranslator`
 * devolve a identidade, então a lista já entra no formato do portal: a tradução
 * tem teste próprio em `userApiMapper.test.ts`, e repeti-la aqui só afastaria o
 * teste da regra que ele guarda.
 */

const { fetchAllCoreUsers, updateCoreUser } = vi.hoisted(() => ({
  fetchAllCoreUsers: vi.fn(),
  updateCoreUser: vi.fn(),
}))

vi.mock('./userApi', () => ({
  changeCoreUserPassword: vi.fn(),
  createCoreUser: vi.fn(),
  createCoreUserTranslator: () => async (core: unknown) => core,
  fetchAllCoreUsers,
  resendCoreFirstAccess: vi.fn(),
  updateCoreUser,
}))

const { activateUser, deactivateUser, setUserPassword } = await import('./userRepository')

const ADMIN: User['profile'] = 'Administrador'

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    name: 'Pessoa de Teste',
    email: 'pessoa@impactotelecom.com',
    profile: 'Analista',
    permissions: '',
    permissionKeys: [],
    departments: [],
    departmentPageAccess: [],
    status: 'Pendente',
    lastAccess: 'Nunca acessou',
    firstAccessExpiresAt: null,
    initials: 'PT',
    ...overrides,
  }
}

/** A coleção que o serviço devolveria, mais um Administrador ativo de reserva. */
function baseCom(alvo: User): void {
  fetchAllCoreUsers.mockResolvedValue([
    alvo,
    user({ id: 'adm-1', name: 'Admin', email: 'adm@impactotelecom.com', profile: ADMIN, status: 'Ativo' }),
  ])
}

beforeEach(() => {
  fetchAllCoreUsers.mockReset()
  updateCoreUser.mockReset()
})

describe('usuário Pendente não entra no par ativar/desativar', () => {
  it('não pode ser desativado', async () => {
    baseCom(user())

    expect(await deactivateUser('u-1', { id: 'adm-1', name: 'Admin' })).toEqual({
      ok: false,
      reason: 'pending-first-access',
    })
    expect(updateCoreUser).not.toHaveBeenCalled()
  })

  it('não pode ser ativado: ativar sem senha é recusado, e ele não tem senha', async () => {
    baseCom(user())

    expect(await activateUser('u-1')).toEqual({ ok: false, reason: 'pending-first-access' })
    expect(updateCoreUser).not.toHaveBeenCalled()
  })

  it('a recusa vem antes da proteção do último administrador', async () => {
    // Ordem que importa: um Administrador Pendente não é administrador ATIVO,
    // então a proteção do último não se aplica a ele, e a frase que a pessoa
    // precisa ler é a do primeiro acesso.
    fetchAllCoreUsers.mockResolvedValue([user({ profile: ADMIN })])

    expect(await deactivateUser('u-1', { id: 'adm-1', name: 'Admin' })).toEqual({
      ok: false,
      reason: 'pending-first-access',
    })
  })
})

describe('quem já tem senha continua trocando de situação', () => {
  it('desativa quem está Ativo', async () => {
    const alvo = user({ status: 'Ativo' })
    baseCom(alvo)
    updateCoreUser.mockResolvedValue({ ...alvo, status: 'Inativo' })

    const result = await deactivateUser('u-1', { id: 'adm-1', name: 'Admin' })

    expect(result.ok).toBe(true)
    expect(updateCoreUser).toHaveBeenCalledWith('u-1', { status: 'inactive' })
  })

  it('reativa quem está Inativo', async () => {
    const alvo = user({ status: 'Inativo' })
    baseCom(alvo)
    updateCoreUser.mockResolvedValue({ ...alvo, status: 'Ativo' })

    const result = await activateUser('u-1')

    expect(result.ok).toBe(true)
    expect(updateCoreUser).toHaveBeenCalledWith('u-1', { status: 'active' })
  })
})

describe('cadastro da senha pelo administrador', () => {
  it('atende o Pendente, e ativa a conta na mesma chamada', async () => {
    const alvo = user()
    baseCom(alvo)
    updateCoreUser.mockResolvedValue({ ...alvo, status: 'Ativo' })

    const result = await setUserPassword('u-1', 'SenhaNova1!')

    expect(result.ok).toBe(true)
    expect(updateCoreUser).toHaveBeenCalledWith('u-1', {
      password: 'SenhaNova1!',
      status: 'active',
    })
  })

  it.each([
    ['Ativo' as const],
    ['Inativo' as const],
  ])('recusa quem já definiu a senha, estando %s', async (situacao) => {
    // O Inativo é o caso que mudou. Antes ele passava, e o cadastro da senha o
    // reativava de tabela: a desativação decidida por um Administrador era
    // desfeita pelo diálogo de PRIMEIRO acesso de outro.
    baseCom(user({ status: situacao }))

    expect(await setUserPassword('u-1', 'SenhaNova1!')).toEqual({
      ok: false,
      reason: 'already-active',
    })
    expect(updateCoreUser).not.toHaveBeenCalled()
  })
})
