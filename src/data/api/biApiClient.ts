/**
 * Acesso HTTP às rotas de BI do `impacto-bi-service`.
 *
 * Uma única porta de entrada para as três rotas de BI, para que endereço,
 * tempo limite e tradução de erro existam em um lugar só. Cada página tem o
 * próprio módulo de fonte, que sabe converter a resposta; aqui só mora o
 * transporte.
 *
 * Sem `VITE_BI_API_URL` configurada, nada é chamado: as páginas seguem na base
 * local, exatamente como antes. É a mesma chave de liga e desliga que
 * `orderRepository.ts` já usa para as demais páginas de OS.
 */

import {authService} from "../../services/auth/authService";

/** Endereço base do serviço, por exemplo `http://localhost:8000/api/core/v1`. */
const rawBaseUrl = import.meta.env.VITE_BI_API_URL as string | undefined

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '') return null
  // Barra final duplicaria a barra do caminho e quebraria rotas em servidores
  // que não normalizam o caminho.
  return trimmed.replace(/\/+$/, '')
}

export const BI_API_BASE_URL = normalizeBaseUrl(rawBaseUrl)

/** true somente quando o portal foi configurado para falar com o serviço. */
export const isBiApiConfigured = BI_API_BASE_URL !== null

/**
 * Tempo limite de uma consulta.
 *
 * A agregação da Visão Geral roda sobre a base inteira do SGI, então o limite
 * é generoso; o que ele evita é a página ficar presa para sempre quando o
 * serviço não responde.
 */
const REQUEST_TIMEOUT_MS = 30_000

/** Erro já traduzido para o português da interface. */
export class BiApiError extends Error {
  /** Código HTTP quando houve resposta; null quando a chamada nem completou. */
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'BiApiError'
    this.status = status
  }
}

function describeStatus(status: number): string {
  if (status === 503) {
    return 'O serviço respondeu que o banco do SGI está indisponível.'
  }
  if (status === 422) {
    return 'O serviço recusou os parâmetros da consulta.'
  }
  if (status === 401 || status === 403) {
    return 'O serviço recusou o acesso a esta consulta.'
  }
  if (status === 404) {
    return 'A rota consultada não existe no serviço.'
  }
  return `O serviço respondeu com o código ${status}.`
}

type QueryParams = Readonly<Record<string, string | number | null | undefined>>

function buildUrl(path: string, params?: QueryParams): string {
  const url = `${BI_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  if (params === undefined) return url

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    // Parâmetro vazio é o mesmo que ausente para o serviço, então nem é
    // enviado: mantém a URL legível e o cache de resposta mais estável.
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }

  const query = search.toString()
  return query === '' ? url : `${url}?${query}`
}

/**
 * Consulta uma rota do serviço e devolve o corpo já convertido de JSON.
 *
 * Não tem tentativa automática nem valor de reserva: quem chama decide o que
 * fazer com a falha. Num portal de BI, cair calado na base local seria pior do
 * que falhar, porque o gestor leria número de estudo achando que é do banco.
 */
export async function fetchFromBiApi<T>(path: string, params?: QueryParams): Promise<T> {
  if (BI_API_BASE_URL === null) {
    throw new BiApiError('O endereço da API de BI não está configurado neste ambiente.')
  }

  const token = authService.getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token !== null) headers.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(buildUrl(path, params), {
      headers,
      signal: controller.signal,
    })
  } catch (cause) {
    const aborted = cause instanceof DOMException && cause.name === 'AbortError'
    throw new BiApiError(
      aborted
        ? 'A consulta ao serviço demorou demais e foi interrompida.'
        : 'Não foi possível falar com o serviço de BI.',
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new BiApiError(describeStatus(response.status), response.status)
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new BiApiError('O serviço respondeu em um formato que o portal não reconhece.')
  }
}
