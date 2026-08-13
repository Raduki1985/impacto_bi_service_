/**
 * Concordância de número dos textos da página.
 *
 * Alertas, leitura do período, KPIs e filtros montam frases a partir de
 * quantidades calculadas, e quantidade 1 aparece de verdade: uma cidade com um
 * único vendedor interno, um vendedor selecionado, uma venda faltando para a
 * meta. Sem estas funções, a tela escreve "1 vendas" e "1 ficaram".
 *
 * Módulo puro, usado tanto pelo modelo quanto pelos componentes.
 */

import { formatNumber } from '../../../lib/formatters'
import type { CommercialGoalScope } from './commercialGoalsModel'

/** `1 venda`, `12 vendas`. A forma vem da quantidade, não de um texto fixo. */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}

/** Escolhe a forma sem repetir o número: `Falta` ou `Faltam`. */
export function agreeWith(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

/** `1 venda` / `12 vendas`. */
export function salesText(count: number): string {
  return pluralize(count, 'venda', 'vendas')
}

/** `1 venda ativa` / `12 vendas ativas`. */
export function activeSalesText(count: number): string {
  return pluralize(count, 'venda ativa', 'vendas ativas')
}

/** `1 vendedor interno` / `8 vendedores internos`. */
export function internalSellersText(count: number): string {
  return pluralize(count, 'vendedor interno', 'vendedores internos')
}

/**
 * Origem da meta do recorte, em uma linha curta para o KPI Meta.
 *
 * Fica aqui porque é texto derivado de quantidade: Joanópolis tem um único
 * vendedor interno, e a linha precisa dizer "1 vendedor interno na cidade".
 * O tipo do escopo entra como importação de tipo, que some na compilação e não
 * cria dependência de execução com o modelo.
 */
export function goalScopeSummary(scope: CommercialGoalScope, internalSellers: number): string {
  switch (scope) {
    case 'consolidado':
      return 'Meta empresarial fixa do mês'
    case 'cidade':
      return `${internalSellersText(internalSellers)} na cidade`
    case 'selecao':
      return pluralize(
        internalSellers,
        'vendedor interno selecionado',
        'vendedores internos selecionados',
      )
    default:
      return 'Sem vendedor interno elegível'
  }
}
