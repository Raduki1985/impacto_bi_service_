/*
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

/!**
 * Testes da sessão contra o serviço.
 *
 * O que está sendo verificado é o contrato que o F5 depende: onde a credencial
 * fica, o que NUNCA fica, o que é apagado da fase mockada e como cada resposta
 * do serviço vira um motivo para a tela. A troca de mensagens com o serviço não
 * é exercitada aqui: sem `VITE_CORE_API_URL` nos testes, toda chamada é recusada
 * antes da rede, e é justamente esse caminho que a restauração precisa tratar
 * sem destruir o token.
 *!/

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

/!* -------------------------------------------------------------------------- *!/
/!* Onde a credencial fica                                                     *!/
/!* -------------------------------------------------------------------------- *!/

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

/!* -------------------------------------------------------------------------- *!/
/!* Fase mockada                                                               *!/
/!* -------------------------------------------------------------------------- *!/

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

/!* -------------------------------------------------------------------------- *!/
/!* Restauração e saída                                                        *!/
/!* -------------------------------------------------------------------------- *!/

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

/!* -------------------------------------------------------------------------- *!/
/!* Aviso ao serviço na saída                                                  *!/
/!* -------------------------------------------------------------------------- *!/

/!**
 * O único teste da suíte que deixa uma chamada ao serviço acontecer.
 *
 * `endSession` avisa o serviço e SÓ DEPOIS apaga o token, e o cabeçalho
 * `Authorization` só sai preenchido porque `requestCoreApi` lê o token antes do
 * primeiro `await`. É um acordo entre dois arquivos, e nada além deste teste o
 * sustenta: um `await` colocado antes dessa leitura faria o `fetch` partir
 * depois da limpeza, sem credencial, e o serviço recusaria o encerramento com
 * `401` — em silêncio, porque a saída não espera resposta. A sessão seguiria
 * aberta no serviço pelo resto da validade do token.
 *
 * Os módulos são importados de novo aqui, com `VITE_CORE_API_URL` definida: o
 * endereço é resolvido uma única vez, na carga do `coreApiClient`, e a suíte
 * inteira roda com ele vazio de propósito (ver `vite.config.ts`).
 *!/
describe('aviso ao serviço na saída', () => {
  const BASE_URL = 'http://servico.test/api/bi/v1'

  async function importarComServicoConfigurado() {
    vi.stubEnv('VITE_CORE_API_URL', BASE_URL)
    vi.resetModules()

    return {
      authSession: await import('./authSession'),
      coreApiToken: await import('./coreApiToken'),
    }
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('manda o token no cabeçalho antes de apagá-lo da aba', async () => {
    const { authSession, coreApiToken } = await importarComServicoConfigurado()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Sessão encerrada.' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    coreApiToken.setCoreApiToken('token-1')
    authSession.endSession()

    // A chamada partiu DENTRO do `endSession`, e não em um microtask depois
    // dele: é o que prova que o token ainda existia quando o cabeçalho foi
    // montado, mesmo com a aba já limpa na volta.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(session.getItem(CORE_API_TOKEN_STORAGE_KEY)).toBeNull()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE_URL}/auth/logout`)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-1')
  })

  it('não chama o serviço quando não há sessão para encerrar', async () => {
    const { authSession } = await importarComServicoConfigurado()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    authSession.endSession()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

/!* -------------------------------------------------------------------------- *!/
/!* Restauração dobrada                                                        *!/
/!* -------------------------------------------------------------------------- *!/

/!**
 * O caso que o F5 produzia: a restauração da sessão saindo DUAS vezes.
 *
 * O StrictMode monta o efeito do `AuthProvider` duas vezes em desenvolvimento,
 * então `restoreSession()` era chamada duas vezes na mesma batida e o serviço
 * recebia `GET /users/me` e `GET /access/{id}` em dobro. Cada uma dessas
 * chamadas extras custava uma conexão nova no serviço, que é o que fazia a
 * página demorar a voltar.
 *
 * A trava `cancelled` do provedor não resolvia isto: ela descarta o RESULTADO
 * da primeira, e a requisição já tinha saído. Quem deduplica é o cliente do
 * serviço, em `data/api/coreApiClient`.
 *!/
describe('duas restaurações na mesma batida', () => {
  const BASE_URL = 'http://servico.test/api/bi/v1'

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('pergunta ao serviço uma vez só, e as duas recebem o mesmo usuário', async () => {
    vi.stubEnv('VITE_CORE_API_URL', BASE_URL)
    vi.resetModules()

    const authSession = await import('./authSession')
    const coreApiToken = await import('./coreApiToken')

    const usuario = {
      id: 'u-1',
      name: 'Ana',
      email: 'ana@impactotelecom.com',
      status: 'active',
      is_active: true,
      last_access: null,
      profile_system_id: 'pt-1',
      access_profile_id: 'ap-1',
      profile_type: { id: 'pt-1', code: 'adm', name: 'Administrador' },
      access: { id: 'ap-1', name: 'Administração' },
      set_password_expire: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }

    const porRota = new Map<string, unknown>([
      [`${BASE_URL}/users/me`, usuario],
      [`${BASE_URL}/access/ap-1`, { id: 'ap-1', name: 'Administração', menus: [] }],
      [`${BASE_URL}/profile-menus/tree`, []],
    ])

    const fetchMock = vi.fn(async (url: string) => {
      const corpo = porRota.get(url)
      if (corpo === undefined) throw new Error(`rota não prevista no teste: ${url}`)

      return { ok: true, status: 200, json: async () => corpo }
    })
    vi.stubGlobal('fetch', fetchMock)

    coreApiToken.setCoreApiToken('token-1')

    const [primeira, segunda] = await Promise.all([
      authSession.restoreSession(),
      authSession.restoreSession(),
    ])

    const rotas = fetchMock.mock.calls.map(([url]) => url as string)

    // Uma ida por rota, e não duas. A árvore de menus já era poupada antes, pelo
    // cache de processo de `accessProfileApi`; `/users/me` e `/access/{id}` são
    // as duas que apareciam repetidas no F5.
    expect(rotas.filter((url) => url.endsWith('/users/me'))).toHaveLength(1)
    expect(rotas.filter((url) => url.endsWith('/access/ap-1'))).toHaveLength(1)

    // Compartilhar a ida não pode deixar uma das duas sem resposta.
    expect(primeira?.id).toBe('u-1')
    expect(segunda?.id).toBe('u-1')

    coreApiToken.clearCoreApiToken()
  })
})

/!* -------------------------------------------------------------------------- *!/
/!* Motivos de recusa                                                          *!/
/!* -------------------------------------------------------------------------- *!/

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
*/
