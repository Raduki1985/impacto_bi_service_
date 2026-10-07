/**
 * Acesso HTTP às rotas de cadastro do `impacto-bi-service`.
 *
 * Mesma ideia do `biApiClient.ts`, e deliberadamente um módulo separado dele: as
 * rotas de BI são leitura pública do SGI, sem token e sem escrita, enquanto
 * estas exigem JWT, enviam corpo e alteram dados. Um cliente só teria que
 * carregar as duas naturezas ao mesmo tempo.
 *
 * ENDEREÇO DO SERVIÇO, em três situações:
 *
 * - `VITE_BI_API_URL` definida: é ela, em qualquer ambiente — mesma variável do
 *   `biApiClient.ts`, porque hoje as duas rotas vivem atrás do mesmo endereço;
 * - ausente em DESENVOLVIMENTO (`vite`): o endereço padrão do serviço local,
 *   que é onde `make run` do `impacto-bi-service` sobe. Login e usuários não
 *   têm mais caminho mockado, então o portal precisa funcionar sem ninguém
 *   criar `.env.local` à mão;
 * - ausente em PRODUÇÃO, ou definida VAZIA: nada é chamado. Um build de
 *   produção apontando para `localhost` em silêncio seria pior do que a
 *   recusa explícita, e a string vazia é o que a suíte de testes usa para
 *   garantir que nenhum teste toca a rede.
 */

import { authService } from '../../services/auth/authService'
import type { CoreErrorEnvelope } from '../../types/coreApi'

/** Onde `make run` do serviço sobe. Só vale em desenvolvimento, sem a variável. */
const DEV_DEFAULT_BASE_URL = 'http://localhost:8787/api/core/v1'

function normalizeBaseUrl(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  // Barra final duplicaria a barra do caminho e quebraria rotas em servidores
  // que não normalizam o caminho.
  return trimmed.replace(/\/+$/, '')
}

function resolveBaseUrl(): string | null {
  const raw = import.meta.env.VITE_BI_API_URL as string | undefined

  // Ausente e vazia são coisas diferentes, de propósito: ausente é "ninguém
  // configurou", vazia é "configurado para não chamar".
  if (raw === undefined) return import.meta.env.DEV ? DEV_DEFAULT_BASE_URL : null

  return normalizeBaseUrl(raw)
}

export const CORE_API_BASE_URL = resolveBaseUrl()

/** true somente quando o portal foi configurado para falar com o serviço. */
export const isCoreApiConfigured = CORE_API_BASE_URL !== null

/**
 * Tempo limite de uma chamada.
 *
 * Menor que o das rotas de BI: aqui são operações de cadastro sobre tabelas
 * pequenas, e uma espera longa significa que o serviço não está respondendo.
 */
const REQUEST_TIMEOUT_MS = 15_000

/** Erro já traduzido para o português da interface. */
export class CoreApiError extends Error {
  /** Código HTTP quando houve resposta; null quando a chamada nem completou. */
  readonly status: number | null

  /**
   * Código do envelope de erro do serviço (`HTTP_ERROR`, `VALIDATION_ERROR`,
   * `INTERNAL_ERROR`), quando o corpo veio no formato esperado.
   */
  readonly code: string | null

  /**
   * Identificador da requisição no serviço. É o que permite achar a linha exata
   * no log do back-end quando alguém relata a falha.
   */
  readonly requestId: string | null

  constructor(
    message: string,
    status: number | null = null,
    code: string | null = null,
    requestId: string | null = null,
  ) {
    super(message)
    this.name = 'CoreApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

/**
 * Mensagem de cada código HTTP, na linguagem de quem usa o portal.
 *
 * O texto do serviço vem em `detail` e costuma ser útil (`Perfil de acesso em
 * uso por 3 usuário(s)`), então ele é preferido quando existe. Estas frases são
 * o que sobra quando o corpo não veio no formato esperado.
 */
function describeStatus(status: number): string {
  if (status === 401) {
    return 'O serviço recusou a credencial. Entre novamente no portal e tente de novo.'
  }
  if (status === 403) {
    return 'Seu usuário não tem permissão para esta operação no serviço.'
  }
  if (status === 404) {
    return 'O registro não existe mais no serviço.'
  }
  if (status === 409) {
    return 'O serviço recusou a operação por conflito com o estado atual do registro.'
  }
  if (status === 422) {
    return 'O serviço recusou os dados enviados.'
  }
  if (status === 429) {
    return 'O serviço recebeu chamadas demais em pouco tempo. Aguarde e tente de novo.'
  }
  if (status >= 500) {
    return 'O serviço falhou ao processar a operação. Nada foi alterado por ele.'
  }
  return `O serviço respondeu com o código ${status}.`
}

/** Extrai `error.message` do envelope padrão, ou null quando o corpo não é ele. */
function readErrorEnvelope(body: unknown): CoreErrorEnvelope['error'] | null {
  if (typeof body !== 'object' || body === null) return null

  const { error } = body as { error?: unknown }
  if (typeof error !== 'object' || error === null) return null

  const { code, message, request_id: requestId } = error as Record<string, unknown>
  if (typeof message !== 'string' || message.trim() === '') return null

  return {
    code: typeof code === 'string' ? code : '',
    message,
    request_id: typeof requestId === 'string' ? requestId : '',
  }
}

type QueryParams = Readonly<Record<string, string | number | boolean | null | undefined>>

function buildUrl(path: string, params?: QueryParams): string {
  const url = `${CORE_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  if (params === undefined) return url

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    // Parâmetro vazio é o mesmo que ausente para o serviço, então nem é enviado.
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }

  const query = search.toString()
  return query === '' ? url : `${url}?${query}`
}

export type CoreApiRequest = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /**
   * Convertido para JSON. Ausente não envia corpo nem `Content-Type`.
   *
   * Um `URLSearchParams` é a exceção: vai como formulário
   * (`application/x-www-form-urlencoded`), que é o que `POST /auth/login` exige.
   */
  body?: unknown
  params?: QueryParams
}

/** Corpo e cabeçalho de conteúdo já no formato que o serviço espera. */
function encodeBody(body: unknown): { payload: string; contentType: string } | null {
  if (body === undefined) return null

  if (body instanceof URLSearchParams) {
    return { payload: body.toString(), contentType: 'application/x-www-form-urlencoded' }
  }

  return { payload: JSON.stringify(body), contentType: 'application/json' }
}

/**
 * A chamada em si: monta, envia e traduz a resposta. Sempre vai à rede.
 *
 * `204 No Content`, que é o que `DELETE` responde, devolve `undefined`: quem
 * chama deve tipar o retorno como `void` nesses casos.
 *
 * Sem tentativa automática e sem valor de reserva. Numa operação de escrita,
 * repetir sozinho pode gravar duas vezes, e cair calado na base local mostraria
 * como salvo o que o serviço recusou.
 *
 * Quem o portal chama é `requestCoreApi`, logo abaixo, e não esta função.
 */
async function performCoreRequest<T>(
  path: string,
  { method = 'GET', body, params }: CoreApiRequest = {},
): Promise<T> {
  if (CORE_API_BASE_URL === null) {
    throw new CoreApiError('O endereço da API do portal não está configurado neste ambiente.')
  }

  const token = authService.getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token !== null) headers.Authorization = `Bearer ${token}`

  const encoded = encodeBody(body)
  if (encoded !== null) headers['Content-Type'] = encoded.contentType

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: encoded?.payload,
      signal: controller.signal,
    })
  } catch (cause) {
    const aborted = cause instanceof DOMException && cause.name === 'AbortError'
    throw new CoreApiError(
      aborted
        ? 'A chamada ao serviço demorou demais e foi interrompida. Confira se ela foi concluída antes de repetir.'
        : 'Não foi possível falar com o serviço do portal.',
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    // O corpo de erro é lido em modo tolerante: um 502 de proxy costuma devolver
    // HTML, e uma falha ao ler o corpo não pode esconder o código HTTP real.
    let envelope: CoreErrorEnvelope['error'] | null = null
    try {
      envelope = readErrorEnvelope(await response.json())
    } catch {
      envelope = null
    }

    throw new CoreApiError(
      envelope?.message ?? describeStatus(response.status),
      response.status,
      envelope?.code ?? null,
      envelope?.request_id ?? null,
    )
  }

  if (response.status === 204) return undefined as T

  try {
    return (await response.json()) as T
  } catch {
    throw new CoreApiError('O serviço respondeu em um formato que o portal não reconhece.')
  }
}

/* -------------------------------------------------------------------------- */
/* Leituras repetidas na mesma batida                                         */
/* -------------------------------------------------------------------------- */

/**
 * Leituras `GET` ainda sem resposta, pela URL e pelo token que as identificam.
 *
 * Existe porque a mesma leitura é pedida duas vezes na MESMA batida em
 * situações normais do portal: o StrictMode monta cada efeito duas vezes em
 * desenvolvimento, e telas que carregam lista e catálogo em paralelo acabam
 * pedindo o mesmo perfil de acesso por dois caminhos. Duas respostas idênticas
 * não acrescentam nada, e cada chamada extra custa uma conexão nova no serviço.
 *
 * O token entra na chave porque a resposta depende de quem pergunta: a leitura
 * feita antes de entrar não pode ser entregue a quem já entrou.
 */
const inFlightReads = new Map<string, Promise<unknown>>()

/**
 * Chama uma rota do serviço e devolve o corpo já convertido de JSON.
 *
 * Duas leituras IDÊNTICAS e SIMULTÂNEAS compartilham uma única ida à rede. Só
 * isso: uma leitura pedida depois que a anterior respondeu vai à rede de novo,
 * porque isto não é cache e não guarda resposta nenhuma.
 *
 * ESCRITA NUNCA É COMPARTILHADA, e ainda descarta as leituras em voo, antes e
 * depois. Sem esse descarte, uma leitura iniciada ANTES da gravação poderia ser
 * entregue a quem pediu DEPOIS dela, e a tela mostraria o estado anterior como
 * se fosse o atual.
 */
export async function requestCoreApi<T>(
  path: string,
  request: CoreApiRequest = {},
): Promise<T> {
  const { method = 'GET' } = request

  if (method !== 'GET') {
    inFlightReads.clear()
    try {
      return await performCoreRequest<T>(path, request)
    } finally {
      inFlightReads.clear()
    }
  }

  const chave = `${authService.getToken() ?? ''}|${buildUrl(path, request.params)}`

  const emCurso = inFlightReads.get(chave)
  if (emCurso !== undefined) return emCurso as Promise<T>

  // A entrada sai do mapa assim que a resposta chega, com sucesso ou sem ele: a
  // leitura seguinte precisa poder ir à rede, e uma falha presa aqui seria
  // devolvida a quem só tentou de novo depois.
  const leitura = performCoreRequest<T>(path, request).finally(() => {
    if (inFlightReads.get(chave) === leitura) inFlightReads.delete(chave)
  })

  inFlightReads.set(chave, leitura)

  return leitura
}

/** Maior página que o serviço aceita. */
const PAGE_SIZE = 100

/**
 * Todas as páginas de uma listagem do serviço, até a última.
 *
 * O portal pagina no navegador, sobre a coleção inteira, como sempre fez.
 * Enquanto for assim, as listas precisam vir completas. Uma página vazia com
 * `next` verdadeiro seria um serviço inconsistente; parar nela evita um laço
 * sem fim por causa dele.
 */
export async function fetchAllCorePages<T>(path: string, params: QueryParams = {}): Promise<T[]> {
  const items: T[] = []
  let page = 1

  for (;;) {
    const result = await requestCoreApi<{ pagination: { next: boolean }; list: T[] }>(path, {
      params: { ...params, page, size: PAGE_SIZE },
    })

    items.push(...result.list)

    if (!result.pagination.next || result.list.length === 0) break
    page += 1
  }

  return items
}
