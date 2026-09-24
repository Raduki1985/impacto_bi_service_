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
