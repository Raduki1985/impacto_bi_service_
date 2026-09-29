/**
 * A versão do portal que está PUBLICADA agora, lida de `/version.json`.
 *
 * Não é o serviço: é um arquivo estático do próprio portal, escrito pelo
 * plugin `impacto-version-file` do `vite.config.ts` a cada compilação. Mora
 * aqui porque é uma ida à rede com a mesma natureza da de `biHealthSource.ts`
 * — acessória, com tempo limite curto e falha calada.
 *
 * O par dela é o `src/lib/appVersion.ts`, que carrega a versão EMBUTIDA no
 * arquivo que o navegador baixou. Uma é do servidor, a outra é da aba aberta;
 * a diferença entre as duas é o deploy que a pessoa ainda não recebeu.
 */

/** O arquivo mora na raiz servida, ao lado do `index.html`. */
const VERSION_FILE_PATH = '/version.json'

/**
 * Tempo limite curto, pelo mesmo motivo do health check: é uma leitura sobre
 * nada. Se o servidor não responde de pronto, o próximo ciclo pergunta de novo.
 */
const VERSION_TIMEOUT_MS = 5_000

/**
 * O endereço com o cache-buster do momento.
 *
 * O `nginx.conf` já serve este arquivo com `no-store`, e o `fetch` abaixo pede
 * `no-store` também. O `?t=` é a terceira trava, e a única que funciona quando
 * há uma CDN ou um proxy no caminho ignorando o `Cache-Control` do origin:
 * para eles, cada minuto é um endereço que nunca foi pedido antes.
 *
 * Sem isso o mecanismo inteiro falha CALADO — o portal pergunta, recebe o
 * carimbo antigo do cache e conclui, para sempre, que está atualizado.
 */
export function buildVersionFileUrl(now: number): string {
  return `${VERSION_FILE_PATH}?t=${now}`
}

/**
 * A versão dentro do corpo do arquivo, ou null quando não há uma.
 *
 * O corpo esperado é `{"version":"0.1.0"}`. Qualquer outra coisa é null, e a
 * mais provável delas não é um JSON estranho: é o `index.html` que o servidor
 * devolve quando o arquivo NÃO existe e a rota cai no atalho da SPA, como
 * acontece em uma imagem compilada antes deste mecanismo existir.
 */
export function readPublishedVersion(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null

  const { version } = payload as Record<string, unknown>
  if (typeof version !== 'string') return null

  const trimmed = version.trim()
  return trimmed === '' ? null : trimmed
}

/** A versão publicada, ou null: sem arquivo, sem resposta, ou corpo inesperado. */
export async function fetchPublishedVersion(): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS)

  try {
    const response = await fetch(buildVersionFileUrl(Date.now()), {
      // Cinto e suspensório com o `?t=`: o `no-store` fala com o cache do
      // navegador, que é o único que o `?t=` não precisa enganar.
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) return null

    return readPublishedVersion(await response.json())
  } catch {
    // Servidor fora do ar, tempo esgotado, corpo que não é JSON: tudo termina
    // igual, em null, e o ciclo seguinte pergunta de novo. Uma consulta que
    // ninguém pediu não pode virar erro na tela nem ruído no console.
    return null
  } finally {
    clearTimeout(timer)
  }
}
