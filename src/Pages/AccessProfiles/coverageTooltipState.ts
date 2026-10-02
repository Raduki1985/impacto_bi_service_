/**
 * Regra de exclusividade dos detalhamentos de cobertura.
 *
 * Só um label de cobertura pode estar aberto por vez na tela inteira, e o estado
 * que decide isso é apenas um: o identificador do label ativo. Ele mora aqui, em
 * função pura, e não dentro de nenhum componente, porque a regra que importa não
 * é "abrir": é QUEM pode fechar.
 *
 * Um label que perdeu a vez continua existindo, montado, com ouvintes prestes a
 * serem removidos e com um `mouseleave` ainda por chegar. Se o fechamento dele
 * simplesmente zerasse o estado, ele fecharia o painel do label que acabou de
 * assumir, e o efeito visível seria um detalhamento que abre e some sozinho. Por
 * isso `releaseCoverageTooltip` só apaga quando o pedido vem de quem realmente
 * está ativo: o pedido atrasado de um label antigo não tem efeito nenhum.
 *
 * Sem estado global, sem singleton e sem evento de janela: o valor é passado
 * pela árvore do React, então os modais, que são renderizados por portal,
 * enxergam o mesmo ativo que os cards da página.
 */

/** Id do label ativo, ou null quando nenhum detalhamento está aberto. */
export type CoverageTooltipState = string | null

export type CoverageTooltipAction =
  /** Um label assume a vez. Qualquer outro perde. */
  | { type: 'claim'; id: string }
  /** Um label pede para fechar. Só vale se ele ainda for o ativo. */
  | { type: 'release'; id: string }
  /** Fecha o que estiver aberto, sem perguntar de quem é. */
  | { type: 'releaseAll' }

export const initialCoverageTooltipState: CoverageTooltipState = null

export function coverageTooltipReducer(
  state: CoverageTooltipState,
  action: CoverageTooltipAction,
): CoverageTooltipState {
  switch (action.type) {
    case 'claim':
      return action.id

    case 'release':
      // A guarda inteira do bloco está nesta linha: o release de um label que já
      // não é o ativo é ignorado, e o painel recém-aberto sobrevive.
      return state === action.id ? null : state

    case 'releaseAll':
      return null
  }
}

/** true quando aquele label é o dono do único detalhamento aberto. */
export function isCoverageTooltipActive(state: CoverageTooltipState, id: string): boolean {
  return state !== null && state === id
}
