/**
 * Regra de colunas do painel de cobertura do label de departamento.
 *
 * Mora em módulo próprio, e não dentro de `DepartmentCoverageChip`, pelo mesmo
 * motivo de `coverageTooltipState`: é lógica pura, precisa de teste espelho, e
 * exportá-la do arquivo do componente quebraria a atualização instantânea do
 * ambiente de desenvolvimento.
 */

/** Largura do painel quando todas as seções cabem em uma coluna. */
export const ONE_COLUMN_WIDTH = 248
/** Largura do painel quando alguma seção vai para duas colunas. */
export const TWO_COLUMN_WIDTH = 372
/** A partir daqui a lista em coluna única fica mais alta que larga sem motivo. */
export const TWO_COLUMN_THRESHOLD = 7

/** Quantas páginas cada seção do painel lista. */
export type CoveragePanelCounts = {
  readonly granted: number
  readonly pending: number
  readonly denied: number
}

export type CoveragePanelColumns = {
  readonly granted: boolean
  readonly pending: boolean
  readonly denied: boolean
  /** true quando o painel precisa da largura de duas colunas. */
  readonly wide: boolean
}

/**
 * Quais seções do painel vão em duas colunas, e se o painel usa a largura
 * maior.
 *
 * A regra do limite sempre foi por LISTA, mas só a seção das páginas liberadas
 * a aplicava: um perfil com uma página liberada e dez negadas abria um painel
 * estreito e altíssimo, enquanto o perfil ao lado, com oito liberadas, abria em
 * duas colunas. Agora as três seções seguem o mesmo critério, e a largura do
 * painel acompanha a primeira que precisar dela.
 */
export function coveragePanelColumns(counts: CoveragePanelCounts): CoveragePanelColumns {
  const granted = counts.granted >= TWO_COLUMN_THRESHOLD
  const pending = counts.pending >= TWO_COLUMN_THRESHOLD
  const denied = counts.denied >= TWO_COLUMN_THRESHOLD

  return { granted, pending, denied, wide: granted || pending || denied }
}
