import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CoreApiError } from '../../data/api/coreApiClient'
import { CORE_API_TOKEN_STORAGE_KEY, clearCoreApiToken, setCoreApiToken } from './coreApiToken'
import {
  endSession,
  hasStoredSession,
  LEGACY_AUTH_SESSION_STORAGE_KEY,
  loginFailureReasonFor,
  removeLegacySessionKeys,
  restoreSession,
} from './authSession'

/**
 * Testes da sessão contra o serviço.
 *
 * O que está sendo verificado é o contrato que o F5 depende: onde a credencial
 * fica, o que NUNCA fica, o que é apagado da fase mockada e como cada resposta
 * do serviço vira um motivo para a tela. A troca de mensagens com o serviço não
 * é exercitada aqui: sem `VITE_CORE_API_URL` nos testes, toda chamada é recusada
 * antes da rede, e é justamente esse caminho que a restauração precisa tratar
 * sem destruir o token.
 */

class MemoryStorage {
  private entries = new Map<string, string>()

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
  clearCoreApiToken()
  delete globalWithWindow().window
})

/* -------------------------------------------------------------------------- */
/* Onde a credencial fica                                                     */
/* -------------------------------------------------------------------------- */

describe('armazenamento da sessão', () => {
  it('grava o token somente na aba', () => {
    expect(setCoreApiToken('token-1')).toBe(true)

    expect(session.getItem(CORE_API_TOKEN_STORAGE_KEY)).toBe('token-1')
    expect(local.getItem(CORE_API_TOKEN_STORAGE_KEY)).toBeNull()
    expect(hasStoredSession()).toBe(true)
  })

  it('grava apenas o token, em uma única chave', () => {
    setCoreApiToken('token-1')

    expect([...session.snapshot().keys()]).toEqual([CORE_API_TOKEN_STORAGE_KEY])
  })

  it('trata ausência e texto em branco como sessão inexistente', () => {
    expect(hasStoredSession()).toBe(false)

    session.setItem(CORE_API_TOKEN_STORAGE_KEY, '   ')

    expect(hasStoredSession()).toBe(false)
  })

  it('mantém o token em memória quando não há armazenamento', () => {
    delete globalWithWindow().window

    expect(setCoreApiToken('token-1')).toBe(false)
    expect(hasStoredSession()).toBe(true)

    clearCoreApiToken()

    expect(hasStoredSession()).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Fase mockada                                                               */
/* -------------------------------------------------------------------------- */

describe('sessão da fase mockada', () => {
  it('apaga a chave antiga dos dois armazenamentos', () => {
    local.setItem(LEGACY_AUTH_SESSION_STORAGE_KEY, 'usr-001')
    session.setItem(LEGACY_AUTH_SESSION_STORAGE_KEY, 'usr-001')

    removeLegacySessionKeys()

    expect(local.getItem(LEGACY_AUTH_SESSION_STORAGE_KEY)).toBeNull()
    expect(session.getItem(LEGACY_AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('não reconhece o id antigo como sessão', async () => {
    session.setItem(LEGACY_AUTH_SESSION_STORAGE_KEY, 'usr-001')

    expect(hasStoredSession()).toBe(false)
    expect(await restoreSession()).toBeNull()
    expect(session.getItem(LEGACY_AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Restauração e saída                                                        */
/* -------------------------------------------------------------------------- */

describe('restauração da sessão gravada', () => {
  it('devolve null sem nenhum token, sem tocar no armazenamento', async () => {
    expect(await restoreSession()).toBeNull()
    expect(session.length).toBe(0)
  })

  it('preserva o token quando o serviço não pôde ser consultado', async () => {
    // Serviço não configurado neste ambiente: a chamada falha antes da rede,
    // que é o mesmo que um serviço fora do ar. A credencial pode continuar boa.
    setCoreApiToken('token-1')

    expect(await restoreSession()).toBeNull()
    expect(session.getItem(CORE_API_TOKEN_STORAGE_KEY)).toBe('token-1')
  })
})

describe('saída', () => {
  it('apaga o token e a chave antiga', () => {
    setCoreApiToken('token-1')
    local.setItem(LEGACY_AUTH_SESSION_STORAGE_KEY, 'usr-001')

    endSession()

    expect(hasStoredSession()).toBe(false)
    expect(session.getItem(CORE_API_TOKEN_STORAGE_KEY)).toBeNull()
    expect(local.getItem(LEGACY_AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('não lança sem token e sem serviço', () => {
    expect(() => endSession()).not.toThrow()
  })
})

/* -------------------------------------------------------------------------- */
/* Motivos de recusa                                                          */
/* -------------------------------------------------------------------------- */

describe('motivo da recusa pelo que o serviço respondeu', () => {
  it('credencial inválida para 401 e para formulário incompleto', () => {
    expect(loginFailureReasonFor(new CoreApiError('Credenciais inválidas', 401))).toBe(
      'invalid-credentials',
    )
    expect(loginFailureReasonFor(new CoreApiError('Campo obrigatório', 422))).toBe(
      'invalid-credentials',
    )
  })

  it('separa os dois 403 pelo texto: sem perfil de acesso e conta inativa', () => {
    expect(loginFailureReasonFor(new CoreApiError('Usuário sem perfil de acesso', 403))).toBe(
      'access-profile-required',
    )
    expect(loginFailureReasonFor(new CoreApiError('Conta inativa', 403))).toBe(
      'inactive-account',
    )
  })

  it('serviço indisponível para falha de rede, erro do servidor e falha desconhecida', () => {
    expect(loginFailureReasonFor(new CoreApiError('Não foi possível falar com o serviço.'))).toBe(
      'service-unavailable',
    )
    expect(loginFailureReasonFor(new CoreApiError('Falhou', 500))).toBe('service-unavailable')
    expect(loginFailureReasonFor(new Error('qualquer coisa'))).toBe('service-unavailable')
  })
})
