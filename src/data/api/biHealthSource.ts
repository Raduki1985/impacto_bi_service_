/**
 * Versão do `impacto-bi-service`, lida da rota de saúde dele.
 *
 * Serve à linha de versão do menu do usuário: o portal mostra a própria versão
 * (`src/lib/appVersion.ts`, resolvida na compilação) e, ao lado, a do serviço
 * que responde por ela naquele ambiente. É o que permite dizer, num relato de
 * problema, EXATAMENTE quais dois lados estavam no ar.
 *
 * NÃO passa pelo `fetchFromBiApi` de propósito, por dois motivos:
 *
 * - `/health` mora FORA do caminho versionado (ver `buildHealthUrl` abaixo), e
 *   aquele transporte sempre prefixa a base versionada;
 * - falha aqui é silenciosa. O `fetchFromBiApi` traduz o erro para uma frase em
 *   português porque a página precisa exibi-la; esta leitura é acessória, e uma
 *   recusa dela não pode virar aviso nenhum na tela.
 */

import { BI_API_BASE_URL } from './biApiClient'

/**
 * Tempo limite bem curto.
 *
 * É um health check sobre nada: ou o serviço responde de imediato, ou a
 * resposta já não interessa. O limite generoso das consultas de BI aqui só
 * seguraria uma promessa parada por meio minuto.
 */
const HEALTH_TIMEOUT_MS = 5_000

/**
 * Endereço de `/health` a partir da base configurada em `VITE_BI_API_URL`.
 *
 * A base aponta para a SUPERFÍCIE VERSIONADA das rotas de BI
 * (`.../api/bi/v1`), que é de onde saem `/bi/os/...` e `/bi/commercial/...`.
 * A rota de saúde não está lá dentro: no serviço ela é declarada direto no
 * aplicativo, em `/api/bi/health` (ver `app/main.py` do `impacto-bi-service`),
 * ou seja, um nível ACIMA do `/v1`. Por isso o segmento de versão sai antes.
 *
 * A remoção é condicional para que uma base já sem `/v1` continue funcionando:
 * o endereço dessa variável mudou mais de uma vez, e esta leitura não é lugar
 * para quebrar por causa disso.
 */
export function buildHealthUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/v\d+$/, '')}/health`
}

/**
 * A versão dentro do corpo do health check, ou null quando não há uma.
 *
 * Aceita os dois nomes de campo de propósito. `apiVersion` é o nome do
 * contrato combinado; `version` é o que as rotas de saúde do
 * `impacto-bi-service` devolvem hoje. Ler os dois evita que a linha da tela
 * dependa de uma mudança no serviço para começar a aparecer.
 */
export function readApiVersion(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null

  const { apiVersion, version } = payload as Record<string, unknown>
  const value = typeof apiVersion === 'string' ? apiVersion : version

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * A leitura em curso, ou a já concluída, guardada pelo tempo que a página
 * viver.
 *
 * A versão do serviço não muda enquanto ele não reinicia, então uma ida à rede
 * por carga de página basta. Sem isto seria uma por navegação: o menu do
 * usuário é remontado a cada troca de página do dashboard, e o StrictMode
 * ainda monta cada efeito duas vezes em desenvolvimento.
 *
 * A RECUSA também fica guardada. Se o serviço estava fora do ar, a linha mostra
 * só a versão do portal até alguém recarregar — insistir a cada navegação
 * gastaria uma conexão nova por página para uma informação acessória.
 */
let pendingVersion: Promise<string | null> | null = null

/** Versão do serviço, ou null: sem endereço configurado, sem resposta, ou recusada. */
export function fetchBiApiVersion(): Promise<string | null> {
  if (BI_API_BASE_URL === null) return Promise.resolve(null)

  pendingVersion ??= requestVersion(buildHealthUrl(BI_API_BASE_URL))
  return pendingVersion
}

async function requestVersion(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) return null

    return readApiVersion(await response.json())
  } catch {
    // Serviço fora do ar, CORS, tempo esgotado, corpo que não é JSON: tudo
    // termina igual, em null. Nada nesta leitura justifica interromper quem
    // está usando o portal.
    return null
  } finally {
    clearTimeout(timer)
  }
}
