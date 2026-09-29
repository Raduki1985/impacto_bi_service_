/**
 * Classes das pílulas do portal.
 *
 * A mesma pílula aparece em quatro lugares da Visão Geral de OS: o chip de
 * filtro ativo na faixa, o atalho de período aceso, a etiqueta do período em
 * "Resultado do período" e o atalho aceso da janela de OS. Até 24/09/2026 cada
 * um repetia as classes e ganhava a própria regra de tema escuro em
 * `styles.css`; agora todos partem daqui, e `.impacto-chip` é o único gancho
 * que o tema escuro pinta de verde (o azul do acento não alcança contraste
 * sobre a superfície escura, ver o bloco da faixa de filtros em `styles.css`).
 *
 * Em arquivo próprio, e não junto de um componente, porque exportar valor de
 * um arquivo de componente quebra a atualização instantânea do `npm run dev`.
 */

/**
 * A cor e a forma da pílula tingida, sem o respiro interno: o chip de filtro
 * ativo da faixa precisa de um respiro diferente à direita, onde fica o "x".
 *
 * A borda discreta derivada do acento é a mesma conta do tema escuro (38% da
 * cor): o contorno do verde agradou, e o azul do claro ganhou o seu (pedido do
 * Mário em 28/09/2026).
 */
export const tintedChipToneClass =
  'impacto-chip rounded-full border border-[color:color-mix(in_srgb,var(--accent)_38%,transparent)] bg-[var(--accent-weak)] text-[11.5px] font-medium text-[var(--accent)]'

/** Pílula tingida no acento: filtro ativo, atalho aceso, etiqueta do período. */
export const tintedChipClass = `${tintedChipToneClass} px-2.5 py-0.5`

/** Pílula de escolha apagada: só a borda, e acende com `tintedChipClass`. */
export const outlineChipClass =
  'rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--text-secondary)] hover:border-[var(--text-disabled)] hover:text-[var(--text-heading)]'
