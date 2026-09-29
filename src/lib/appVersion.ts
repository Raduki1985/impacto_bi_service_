/**
 * Versão do portal, resolvida na COMPILAÇÃO.
 *
 * A fonte é única e é o campo `version` do `package.json`: subir a versão é
 * editar aquele campo (ou rodar `npm version`), e nada mais. O Vite embute o
 * texto no arquivo final, então a tela não pede nada à rede para saber em que
 * versão do portal a pessoa está.
 *
 * Isto responde só pela METADE do que o portal exibe. A outra metade é a versão
 * do `impacto-bi-service`, que só se sabe perguntando a ele, e mora em
 * `src/data/api/biHealthSource.ts`.
 */

import { version as packageVersion } from '../../package.json'

/**
 * Como cada ambiente se apresenta ao lado do número.
 *
 * As chaves são os modos que o projeto realmente usa: `vite` sobe em
 * `development`, e o `Dockerfile` compila com `--mode staging` ou
 * `--mode production` (ver `VITE_BUILD_MODE` no `.gitlab-ci.yml`).
 *
 * Produção não está aqui de propósito: lá o número aparece sozinho. Quem lê a
 * tela de produção não precisa ser lembrado de que está em produção, e o
 * sufixo existe justamente para que homologação e a máquina de quem
 * desenvolve NUNCA sejam confundidas com ela.
 */
const ENVIRONMENT_SUFFIX: Readonly<Record<string, string>> = {
  development: 'dev',
  staging: 'homolog',
}

/**
 * O texto que vai à tela: `0.1.0` em produção, `0.1.0 - homolog` fora dela.
 *
 * Separado da constante abaixo para poder ser testado sem depender do modo em
 * que a suíte roda.
 */
export function buildVersionLabel(version: string, mode: string): string {
  const suffix = ENVIRONMENT_SUFFIX[mode]
  return suffix === undefined ? version : `${version} - ${suffix}`
}

/** Versão crua do portal, sem ambiente. */
export const APP_VERSION = packageVersion

/** Versão do portal já com o ambiente, pronta para exibição. */
export const APP_VERSION_LABEL = buildVersionLabel(packageVersion, import.meta.env.MODE)

/**
 * Os números de `1.4.2`, ou null quando o texto não é uma versão assim.
 *
 * Cada parte precisa ser só dígitos. `Number('')` é zero, então um `1..2`
 * passaria por uma conversão ingênua e viraria `1.0.2`; aqui ele é recusado,
 * junto com `1.4.2-rc1` e com o HTML que um proxy devolve no lugar do JSON.
 */
function parseVersion(value: string): number[] | null {
  const parts = value.trim().split('.')
  if (parts.some((part) => !/^\d+$/.test(part))) return null
  return parts.map(Number)
}

/**
 * true somente quando `published` é uma versão POSTERIOR a `current`.
 *
 * Existe para o aviso de versão nova, e a comparação é numérica de propósito.
 * Um `published !== current` bastaria enquanto tudo só avança, mas um
 * rollback em produção deixaria o carimbo publicado ATRÁS do que está na aba
 * de quem abriu antes, e o portal passaria a insistir que a pessoa
 * "atualizasse" para uma versão mais velha, recarregando para receber o mesmo
 * aviso de novo.
 *
 * Números faltando contam como zero (`1.4` contra `1.4.0` é igual), e
 * qualquer um dos lados ilegível devolve false: quando não dá para AFIRMAR que
 * há versão nova, não há aviso. O erro caro aqui é o aviso indevido, não o
 * aviso que demora um ciclo.
 */
export function isNewerVersion(published: string, current: string): boolean {
  const remote = parseVersion(published)
  const local = parseVersion(current)
  if (remote === null || local === null) return false

  const length = Math.max(remote.length, local.length)

  for (let index = 0; index < length; index += 1) {
    const remotePart = remote[index] ?? 0
    const localPart = local[index] ?? 0
    if (remotePart !== localPart) return remotePart > localPart
  }

  return false
}
