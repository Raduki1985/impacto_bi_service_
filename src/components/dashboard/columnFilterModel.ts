/**
 * Modelo dos filtros de cabeçalho de tabela, a parte sem tela.
 *
 * Vive em `components/dashboard` porque duas tabelas já dependem dele: a de
 * Vendas por Período, onde o padrão nasceu, e a lista de OS da agenda de hoje
 * na Visão Geral. Promovido a compartilhado em 22/09/2026, com aprovação do
 * Mário, depois de a segunda tabela provar que o comportamento se repete.
 */

/** Um valor escolhível na lista de uma coluna. */
export type ColumnFilterOption = {
  readonly value: string
  readonly label: string
  /** Texto secundário, exibido abaixo do rótulo e também pesquisável. */
  readonly hint?: string
  /** Número à direita do rótulo, quando a coluna conta ocorrências. */
  readonly count?: number
}

/**
 * Busca do painel: sem acento e sem caixa, procurando no rótulo e na dica.
 *
 * Quem digita "sao paulo" precisa achar "São Paulo", e quem digita o CPF
 * precisa achar o cliente pela dica, e não só pelo nome.
 */
export function matchesColumnOption(option: ColumnFilterOption, search: string): boolean {
  const term = normalizeSearch(search)
  if (term === '') return true

  return (
    normalizeSearch(option.label).includes(term) ||
    normalizeSearch(option.hint ?? '').includes(term)
  )
}

/** Faixa de diacríticos combinantes do Unicode, separada de NFD pelo normalize. */
const DIACRITICS = /[̀-ͯ]/g

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim()
}
