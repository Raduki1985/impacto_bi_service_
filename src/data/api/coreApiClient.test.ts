import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Testes da deduplicação de leituras do cliente do serviço.
 *
 * O que está sendo verificado é o contrato que o F5 e a tela de Usuários
 * dependem: a mesma leitura pedida duas vezes na MESMA batida vai à rede uma
 * vez só, e nada além disso é compartilhado. Em particular, isto NÃO é cache:
 * uma leitura pedida depois que a anterior respondeu volta a consultar o
 * serviço.
 *
 * A suíte roda com `VITE_CORE_API_URL` vazia (ver `vite.config.ts`), então cada
 * teste reimporta o módulo com o endereço preenchido, como faz
 * `services/auth/authSession.test.ts`.
 */

const BASE_URL = 'http://servico.test/api/bi/v1'

async function importarComServicoConfigurado() {
  vi.stubEnv('VITE_CORE_API_URL', BASE_URL)
  vi.resetModules()

  return {
    client: await import('./coreApiClient'),
    token: await import('../../services/auth/coreApiToken'),
  }
}

/** Resposta de sucesso do `fetch`, no mínimo que o cliente lê. */
function respostaJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

/** Promessa que só resolve quando o teste mandar. */
function adiavel<T>() {
  let liberar!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    liberar = resolve
  })

  return { promise, liberar }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('leituras repetidas na mesma batida', () => {
  it('duas leituras iguais e simultâneas viram uma única ida à rede', async () => {
    const { client } = await importarComServicoConfigurado()
    const pendente = adiavel<unknown>()
    const fetchMock = vi.fn().mockReturnValue(pendente.promise)
    vi.stubGlobal('fetch', fetchMock)

    const primeira = client.requestCoreApi('/users/me')
    const segunda = client.requestCoreApi('/users/me')

    expect(fetchMock).toHaveBeenCalledTimes(1)

    pendente.liberar(respostaJson({ id: 'u-1' }))

    // As duas recebem a MESMA resposta: compartilhar a ida não pode significar
    // uma das chamadas ficar sem resposta.
    expect(await primeira).toEqual({ id: 'u-1' })
    expect(await segunda).toEqual({ id: 'u-1' })
  })

  it('não é cache: a leitura seguinte consulta o serviço de novo', async () => {
    const { client } = await importarComServicoConfigurado()
    const fetchMock = vi.fn().mockResolvedValue(respostaJson({ id: 'u-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await client.requestCoreApi('/users/me')
    await client.requestCoreApi('/users/me')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('leituras de rotas diferentes não são confundidas', async () => {
    const { client } = await importarComServicoConfigurado()
    const pendente = adiavel<unknown>()
    const fetchMock = vi.fn().mockReturnValue(pendente.promise)
    vi.stubGlobal('fetch', fetchMock)

    const usuarios = client.requestCoreApi('/users')
    const perfis = client.requestCoreApi('/access')

    expect(fetchMock).toHaveBeenCalledTimes(2)

    pendente.liberar(respostaJson({ list: [] }))
    await Promise.all([usuarios, perfis])
  })

  it('a mesma rota com páginas diferentes não é compartilhada', async () => {
    const { client } = await importarComServicoConfigurado()
    const pendente = adiavel<unknown>()
    const fetchMock = vi.fn().mockReturnValue(pendente.promise)
    vi.stubGlobal('fetch', fetchMock)

    const p1 = client.requestCoreApi('/users', { params: { page: 1 } })
    const p2 = client.requestCoreApi('/users', { params: { page: 2 } })

    expect(fetchMock).toHaveBeenCalledTimes(2)

    pendente.liberar(respostaJson({ list: [] }))
    await Promise.all([p1, p2])
  })

  it('a leitura de quem já entrou não é entregue a quem ainda não entrou', async () => {
    const { client, token } = await importarComServicoConfigurado()
    const pendente = adiavel<unknown>()
    const fetchMock = vi.fn().mockReturnValue(pendente.promise)
    vi.stubGlobal('fetch', fetchMock)

    const semToken = client.requestCoreApi('/users/me')
    token.setCoreApiToken('token-1')
    const comToken = client.requestCoreApi('/users/me')

    expect(fetchMock).toHaveBeenCalledTimes(2)

    pendente.liberar(respostaJson({ id: 'u-1' }))
    await Promise.all([semToken, comToken])
    token.clearCoreApiToken()
  })
})

describe('escrita', () => {
  it('nunca é compartilhada e descarta as leituras em voo', async () => {
    const { client } = await importarComServicoConfigurado()
    const leitura = adiavel<unknown>()
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(leitura.promise)
      .mockResolvedValueOnce(respostaJson({ id: 'u-1' }))
      .mockReturnValueOnce(leitura.promise)
    vi.stubGlobal('fetch', fetchMock)

    const antes = client.requestCoreApi('/users')
    await client.requestCoreApi('/users', { method: 'POST', body: { name: 'Ana' } })
    const depois = client.requestCoreApi('/users')

    // A terceira chamada existe: a leitura iniciada ANTES da gravação não pode
    // ser devolvida a quem pediu DEPOIS dela, ou a tela mostraria o estado
    // anterior como se fosse o atual.
    expect(fetchMock).toHaveBeenCalledTimes(3)

    leitura.liberar(respostaJson({ list: [] }))
    await Promise.all([antes, depois])
  })

  it('duas gravações iguais e simultâneas vão as duas ao serviço', async () => {
    const { client } = await importarComServicoConfigurado()
    const fetchMock = vi.fn().mockResolvedValue(respostaJson({ id: 'u-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([
      client.requestCoreApi('/users', { method: 'POST', body: { name: 'Ana' } }),
      client.requestCoreApi('/users', { method: 'POST', body: { name: 'Ana' } }),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
