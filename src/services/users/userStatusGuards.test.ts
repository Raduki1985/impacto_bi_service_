/*
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiService } from '../apiService'
import type { CoreUser, CoreUserStatus } from '../../types/coreApi'
import type { PaginatedResponse } from '../../types/pagination/paginationTypes'
import { usersService } from './usersServices'

/!**
 * Guardas de situação do portal: o que a tabela de Usuários pode e não pode
 * fazer com uma conta, segundo o status dela.
 *
 * O serviço é quem decide de verdade, e recusa as mesmas coisas com 422 e 400.
 * As guardas daqui existem para que a pessoa leia uma frase do portal em vez de
 * um código HTTP, e para que nenhum chamador contorne a regra que desabilita os
 * botões da linha. Este arquivo prova que elas recusam ANTES de chamar o
 * serviço: se o `PUT` não foi disparado, a decisão foi do portal.
 *
 * O acesso ao serviço é substituído por dublês em `apiService`, que é por onde
 * `usersService` fala com ele: o `GET` devolve a coleção paginada, e o `PUT` é a
 * gravação que estes testes contam.
 *!/

/!** Uma página só, que é o que a varredura de `getUserList` precisa para parar. *!/
function singlePage(users: CoreUser[]): PaginatedResponse<CoreUser> {
  return {
    list: users,
    pagination: { total: users.length, size: 100, current: 1, pages: 1, previous: false, next: false },
  }
}

function user(overrides: Partial<CoreUser> = {}): CoreUser {
  return {
    id: 'u-1',
    name: 'Pessoa de Teste',
    email: 'pessoa@impactotelecom.com',
    status: 'pending',
    is_active: false,
    last_access: null,
    profile_system_id: 'tipo-analyst',
    access_profile_id: 'ac-1',
    profile_type: { id: 'tipo-analyst', code: 'analyst', name: 'Analista' },
    access: { id: 'ac-1', name: 'Operação' },
    set_password_expire: null,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    ...overrides,
  }
}

/!** O Administrador de reserva, para a proteção do último não entrar em cena. *!/
function administrator(overrides: Partial<CoreUser> = {}): CoreUser {
  return user({
    id: 'adm-1',
    name: 'Admin',
    email: 'adm@impactotelecom.com',
    status: 'active',
    profile_system_id: 'tipo-adm',
    profile_type: { id: 'tipo-adm', code: 'adm', name: 'Administrador' },
    ...overrides,
  })
}

const get = vi.spyOn(apiService, 'get')
const put = vi.spyOn(apiService, 'put')

/!** A coleção que o serviço devolveria, mais um Administrador ativo de reserva. *!/
function baseCom(...users: CoreUser[]): void {
  get.mockResolvedValue(singlePage(users))
}

beforeEach(() => {
  // `mockClear`, e não `mockReset`: `mockReset` devolveria a implementação real de
  // `apiService`, e os testes seguintes iriam à rede. Cada teste declara o que
  // precisa; o padrão daqui é uma coleção vazia e uma gravação que passa.
  get.mockClear()
  put.mockClear()
  get.mockResolvedValue(singlePage([]))
  put.mockResolvedValue(user())
})

describe('usuário pendente não entra no par ativar/desativar', () => {
  it('não pode ser desativado', async () => {
    baseCom(user(), administrator())

    expect(await usersService.deactivateUser('u-1', { id: 'adm-1', name: 'Admin' })).toEqual({
      ok: false,
      reason: 'pending-first-access',
    })
    expect(put).not.toHaveBeenCalled()
  })

  it('não pode ser ativado: ativar sem senha é recusado, e ele não tem senha', async () => {
    baseCom(user(), administrator())

    expect(await usersService.activateUser('u-1')).toEqual({
      ok: false,
      reason: 'pending-first-access',
    })
    expect(put).not.toHaveBeenCalled()
  })

  it('a recusa vem antes da proteção do último administrador', async () => {
    // Ordem que importa: um Administrador pendente não é administrador ATIVO,
    // então a proteção do último não se aplica a ele, e a frase que a pessoa
    // precisa ler é a do primeiro acesso.
    baseCom(administrator({ id: 'u-1', status: 'pending' }))

    expect(await usersService.deactivateUser('u-1', { id: 'adm-1', name: 'Admin' })).toEqual({
      ok: false,
      reason: 'pending-first-access',
    })
    expect(put).not.toHaveBeenCalled()
  })
})

describe('quem já tem senha continua trocando de situação', () => {
  it('desativa quem está ativo', async () => {
    const alvo = user({ status: 'active' })
    baseCom(alvo, administrator())
    put.mockResolvedValue({ ...alvo, status: 'inactive' })

    const result = await usersService.deactivateUser('u-1', { id: 'adm-1', name: 'Admin' })

    expect(result.ok).toBe(true)
    expect(put).toHaveBeenCalledWith('v1/users/u-1', { status: 'inactive' })
  })

  it('reativa quem está inativo', async () => {
    const alvo = user({ status: 'inactive' })
    baseCom(alvo, administrator())
    put.mockResolvedValue({ ...alvo, status: 'active' })

    const result = await usersService.activateUser('u-1')

    expect(result.ok).toBe(true)
    expect(put).toHaveBeenCalledWith('v1/users/u-1', { status: 'active' })
  })
})

describe('cadastro da senha pelo administrador', () => {
  it('atende o pendente, e ativa a conta na mesma chamada', async () => {
    const alvo = user()
    baseCom(alvo, administrator())
    put.mockResolvedValue({ ...alvo, status: 'active' })

    const result = await usersService.setUserPassword('u-1', 'SenhaNova1!')

    expect(result.ok).toBe(true)
    expect(put).toHaveBeenCalledWith('v1/users/u-1', {
      password: 'SenhaNova1!',
      status: 'active',
    })
  })

  it.each([
    ['active' as CoreUserStatus],
    ['inactive' as CoreUserStatus],
  ])('recusa quem já definiu a senha, estando %s', async (situacao) => {
    // O inativo é o caso que mudou. Antes ele passava, e o cadastro da senha o
    // reativava de tabela: a desativação decidida por um Administrador era
    // desfeita pelo diálogo de PRIMEIRO acesso de outro.
    baseCom(user({ status: situacao }), administrator())

    expect(await usersService.setUserPassword('u-1', 'SenhaNova1!')).toEqual({
      ok: false,
      reason: 'already-active',
    })
    expect(put).not.toHaveBeenCalled()
  })
})

*/
