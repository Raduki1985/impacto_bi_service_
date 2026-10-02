/**
 * Opções do seletor da faixa de filtros, a parte sem tela.
 *
 * Em arquivo próprio, e não junto do `FilterSelectField`, porque exportar
 * função de um arquivo de componente quebra a atualização instantânea do
 * `npm run dev` (aviso `react-refresh/only-export-components`).
 */

/** Uma opção do seletor: o valor que o filtro guarda e o texto que a lista mostra. */
export type FilterSelectOption = {
  readonly value: string
  readonly label: string
}

/**
 * Opções em que o texto é o próprio valor, o caso da maioria dos filtros
 * (Equipe, Tipo de OS, Cidade). O Técnico é a exceção: o filtro guarda o
 * identificador e a lista mostra o nome do catálogo, e aí a página monta as
 * opções à mão.
 */
export function plainOptions(values: readonly string[]): FilterSelectOption[] {
  return values.map((value) => ({ value, label: value }))
}

/** Texto para busca tolerante: sem acento, sem caixa, sem espaço sobrando. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Linha da lista do campo de escolha múltipla: uma opção, ou o neutro (`value` nulo). */
export type MultiSelectRow = {
  readonly value: string | null
  readonly label: string
}

/**
 * Linhas da lista do campo de escolha múltipla. Sem busca, o neutro vem na
 * primeira linha e depois todas as opções; com busca, só as opções que casam,
 * sem acento e sem caixa, e o neutro sai.
 */
export function multiSelectRows(
  options: readonly FilterSelectOption[],
  placeholder: string,
  query: string,
): MultiSelectRow[] {
  const typed = normalizeSearchText(query)
  if (typed === '') return [{ value: null, label: placeholder }, ...options]
  return options.filter((option) => normalizeSearchText(option.label).includes(typed))
}

/**
 * Marcadas depois de um clique numa linha: o neutro desmarca tudo, e uma
 * opção entra ou sai da seleção, sem mexer nas outras.
 */
export function toggleMultiSelectValue(
  selected: readonly string[],
  value: string | null,
): string[] {
  if (value === null) return []
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value]
}

/**
 * Valor do chip de um filtro com várias opções marcadas, no resumo da faixa:
 * até duas por extenso (`Manutenção, Auditoria`); com três ou mais, a
 * primeira e quantas faltam (`Manutenção +2`), para o chip não virar uma
 * frase. A lista inteira fica na dica do chip.
 */
export function selectionChipValue(labels: readonly string[]): string {
  if (labels.length <= 2) return labels.join(', ')
  return `${labels[0]} +${labels.length - 1}`
}
