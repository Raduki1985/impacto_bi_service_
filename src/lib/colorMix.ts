/**
 * Mistura de cores sólidas, para o destaque dos gráficos.
 *
 * Existe porque esmaecer por TRANSPARÊNCIA cria um defeito visual: a forma fica
 * translúcida e deixa passar o que está desenhado atrás dela. Nas barras, o que
 * está atrás são as linhas de grade do eixo, que apareciam como riscos verticais
 * dentro da barra esmaecida.
 *
 * A mistura resolve na origem: a forma continua opaca e recebe a cor que ela
 * PARECERIA ter se estivesse translúcida sobre o painel. O resultado na tela é
 * o mesmo, sem nada atravessando.
 *
 * Módulo puro, em `lib` e não dentro de um gerador de gráfico, porque três
 * geradores irmãos precisam dele e eles não importam um do outro.
 */

/** Um canal de cor, preso ao intervalo válido e arredondado. */
function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

/**
 * Canais de uma cor hexadecimal de seis dígitos, com ou sem `#`.
 *
 * Devolve null para qualquer coisa fora desse formato: abreviações de três
 * dígitos, `rgba()` e nomes de cor não são usados como identidade de série
 * neste projeto, e adivinhar o valor de uma entrada inesperada esconderia o erro
 * em vez de deixá-lo aparecer.
 */
function channelsOf(color: string): [number, number, number] | null {
  const hex = color.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null

  const [r, g, b] = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16))

  return [r, g, b]
}

/** Dois dígitos hexadecimais de um canal. */
function toHex(channel: number): string {
  return clampChannel(channel).toString(16).padStart(2, '0')
}

/**
 * A cor que `color` aparenta ter sobre `background` com a opacidade `ratio`.
 *
 * `ratio` é a presença da cor original, de 0 a 1: 1 devolve a própria cor e 0
 * devolve o fundo. Valores fora do intervalo são presos nele, e entrada fora do
 * formato hexadecimal devolve a cor original intocada, para um dado inesperado
 * nunca apagar uma série do gráfico.
 */
export function mixHexColors(color: string, background: string, ratio: number): string {
  const front = channelsOf(color)
  const back = channelsOf(background)
  if (!front || !back) return color

  const presence = Math.max(0, Math.min(1, ratio))
  const channels = front.map((value, index) => value * presence + back[index] * (1 - presence))

  return `#${channels.map(toHex).join('')}`
}
