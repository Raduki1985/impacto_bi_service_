/**
 * Modelo da lista com filtro e ordenação por coluna, a parte sem tela.
 *
 * Nasceu como `todayOsTableModel` na Visão Geral de OS (a lista da faixa Hoje
 * ao vivo e a janela de OS do período) e virou modelo do portal em
 * 24/09/2026, quando o Mário definiu aquela página como modelo das seguintes.
 * O que uma página declara é a LISTA DE COLUNAS: chave, nome, largura, se
 * filtra, se ordena e o texto de cada célula. O resto, recorte, contagem das
 * opções e ordenação, é o mesmo em qualquer lista.
 *
 * O que ele congela:
 *
 * - o texto que a célula mostra é o MESMO pelo qual a coluna filtra e ordena
 *   (`column.text`): tela, filtro e ordenação nunca divergem sobre o que
 *   está escrito na linha;
 * - lista de valores vazia é "sem filtro", e não "nenhum valor";
 * - as opções de uma coluna saem do recorte das OUTRAS colunas, como no
 *   Excel: escolher "Atibaia" em Cidade não apaga as outras cidades da lista,
 *   e a contagem ao lado diz quantas linhas aparecem ao marcar o valor;
 * - a ausência ("Sem técnico", "Sem equipe") é valor escolhível como outro
 *   qualquer, e vai para o FIM das listas e das ordenações nos dois sentidos,
 *   fora do alfabeto. Quais textos são ausência é a página que declara
 *   (`rules.missing`), e não uma regra por prefixo: "sem conexão" é
 *   categoria de verdade do SGI. Na coluna de data, qualquer texto que não
 *   seja uma data também é ausência, sem a página precisar declarar: uma
 *   célula vazia não pode abrir a lista "mais recente primeiro";
 * - sem ordenação escolhida, a lista fica na ordem em que veio, que é a que
 *   a página decidiu; o desempate na ordenação é da página
 *   (`rules.tieBreak`) e acompanha o sentido, para a lista decrescente ser o
 *   espelho exato da crescente;
 * - as larguras são fixas, em pixels: a tabela não muda de tamanho ao trocar
 *   de lista.
 */

export type ListSortDirection = 'asc' | 'desc'

export type ListColumn<Row, Key extends string = string> = {
  readonly key: Key
  readonly label: string
  /** Largura fixa da coluna, em pixels. */
  readonly width: number
  /** A coluna abre a lista de valores para recortar. */
  readonly filterable: boolean
  /**
   * A coluna pode ordenar a lista. É separado de `filterable` porque as duas
   * coisas não andam juntas: o código da OS ordena e não filtra (uma lista
   * com 142 códigos não recorta nada), e `Detalhe` não faz nem uma nem outra.
   */
  readonly sortable: boolean
  /** Texto da célula: é também o valor pelo qual a coluna filtra e ordena. */
  readonly text: (row: Row) => string
  /**
   * Ordem natural crescente entre dois textos da coluna. Sem ela, alfabética
   * em português. A Data ordena pelo calendário (`compareBrDates`) e o código
   * da OS pelo número (`compareNumberedCodes`).
   */
  readonly compare?: (a: string, b: string) => number
  /** Busca no painel de filtro; as colunas de lista curta não precisam. */
  readonly searchable?: boolean
  /**
   * Nomes da ordenação no painel: crescente e decrescente, ou o calendário.
   * Na coluna `date`, texto que não é data (`dd/mm/aaaa`) conta como ausência.
   */
  readonly sortKind?: 'text' | 'date'
}

export type ListSort<Key extends string = string> = {
  readonly column: Key
  readonly direction: ListSortDirection
} | null

/**
 * Valores escolhidos por coluna. Lista ausente ou vazia significa SEM FILTRO,
 * e não "nenhum valor selecionado".
 */
export type ListTableFilters<Key extends string = string> = Readonly<
  Partial<Record<Key, readonly string[]>>
>

export type ListTableOption = {
  readonly value: string
  /** Quantas linhas do recorte atual têm este valor. */
  readonly count: number
}

/** O que só a página sabe sobre as próprias linhas. */
export type ListTableRules<Row> = {
  /** Textos que significam ausência: vão para o fim das listas e ordenações. */
  readonly missing?: ReadonlySet<string>
  /** Desempate entre duas linhas, no sentido crescente. */
  readonly tieBreak?: (a: Row, b: Row) => number
}

const EMPTY_SET: ReadonlySet<string> = new Set()

/** Ordem alfabética em português, com acento e caixa tratados como se lê. */
export function comparePtBr(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR')
}

const BR_DATE = /^\d{2}\/\d{2}\/\d{4}$/

/** O texto é uma data `dd/mm/aaaa`, como a célula de data escreve. */
export function isBrDate(text: string): boolean {
  return BR_DATE.test(text)
}

/** `30/08/2026` antes de `02/09/2026`: pelo calendário, e não pelo texto. */
export function compareBrDates(a: string, b: string): number {
  const left = isoOfBrDate(a)
  const right = isoOfBrDate(b)

  return left < right ? -1 : left > right ? 1 : 0
}

function isoOfBrDate(text: string): string {
  const [day, month, year] = text.split('/')

  return `${year}-${month}-${day}`
}

const NUMBERED_CODE = /^(.*?)(\d+)$/

/**
 * `OS-2026-98` antes de `OS-2026-1234`: código com prefixo igual ordena pelo
 * número do fim, e não como texto, que é o que o gestor procura numa lista
 * de códigos. Prefixos diferentes, ou código sem número, voltam ao alfabeto.
 */
export function compareNumberedCodes(a: string, b: string): number {
  const left = NUMBERED_CODE.exec(a)
  const right = NUMBERED_CODE.exec(b)
  if (left !== null && right !== null && left[1] === right[1]) {
    return Number(left[2]) - Number(right[2])
  }

  return comparePtBr(a, b)
}

/** Soma das larguras: é o piso da tabela, abaixo dele ela rola na horizontal. */
export function listTableMinWidth(columns: readonly { readonly width: number }[]): number {
  return columns.reduce((total, column) => total + column.width, 0)
}

/**
 * O que conta como ausência NESTA coluna: o que a página declarou e, na
 * coluna de data, qualquer texto que não seja data. Um lugar só para a
 * lista do painel e a ordenação concordarem sobre o que vai para o fim.
 */
function missingIn<Row, Key extends string>(
  column: ListColumn<Row, Key>,
  rules: ListTableRules<Row>,
): (text: string) => boolean {
  const declared = rules.missing ?? EMPTY_SET

  return column.sortKind === 'date'
    ? (text) => declared.has(text) || !isBrDate(text)
    : (text) => declared.has(text)
}

function activeColumns<Row, Key extends string>(
  columns: readonly ListColumn<Row, Key>[],
  filters: ListTableFilters<Key>,
): ListColumn<Row, Key>[] {
  return columns.filter((column) => (filters[column.key] ?? []).length > 0)
}

export function hasListFilters<Row, Key extends string>(
  columns: readonly ListColumn<Row, Key>[],
  filters: ListTableFilters<Key>,
): boolean {
  return activeColumns(columns, filters).length > 0
}

/**
 * Linhas que passam nos filtros de coluna. Devolve o MESMO tipo de linha que
 * recebeu: a janela de OS guarda na linha a OS de origem, e é dela que a
 * planilha sai, na ordem e no recorte da tela.
 */
export function filterListRows<Row, Key extends string>(
  rows: readonly Row[],
  columns: readonly ListColumn<NoInfer<Row>, Key>[],
  filters: ListTableFilters<Key>,
): Row[] {
  const active = activeColumns(columns, filters)

  return rows.filter((row) =>
    active.every((column) => (filters[column.key] ?? []).includes(column.text(row))),
  )
}

/**
 * Texto em forma de busca: sem acento, em minúsculas e com os espaços
 * normalizados. "Instalação" e "instalacao" se encontram, e "OS-2026-8739"
 * aparece digitando só "8739".
 */
export function normalizeListSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Linhas que contêm a busca (pedido do Mário em 13/10/2026, para achar um
 * contrato, uma OS ou uma palavra do Detalhe sem abrir coluna por coluna).
 *
 * A busca olha o texto de TODAS as colunas, o mesmo que a célula mostra, e
 * mais o que a página entrega à parte (`extra`), para o que só aparece na
 * dica de mouse, como o motivo do reagendamento. Cada palavra digitada
 * precisa aparecer em algum lugar da linha, em qualquer ordem: "atibaia
 * fibra" acha a OS de fibra em Atibaia. Busca vazia devolve a lista inteira.
 * Devolve o MESMO tipo de linha que recebeu, como `filterListRows`.
 */
export function searchListRows<Row, Key extends string>(
  rows: readonly Row[],
  columns: readonly ListColumn<NoInfer<Row>, Key>[],
  query: string,
  extra?: (row: NoInfer<Row>) => string,
): Row[] {
  const words = normalizeListSearch(query).split(' ').filter((word) => word !== '')
  if (words.length === 0) return [...rows]

  return rows.filter((row) => {
    const haystack = normalizeListSearch(
      [...columns.map((column) => column.text(row)), extra?.(row) ?? ''].join(' '),
    )

    return words.every((word) => haystack.includes(word))
  })
}

/**
 * Opções de uma coluna, no contexto dos DEMAIS filtros.
 *
 * O filtro da própria coluna fica de fora do recorte, como no Excel: sem isso,
 * escolher "Atibaia" em Cidade apagaria as outras cidades da lista e o gestor
 * não conseguiria acrescentar uma segunda. A contagem ao lado é do recorte já
 * filtrado pelas outras colunas, então ela diz o que vai aparecer de fato.
 * Chave que não é coluna da lista não tem opções.
 */
export function listColumnOptions<Row, Key extends string>(
  rows: readonly Row[],
  columns: readonly ListColumn<NoInfer<Row>, Key>[],
  key: Key,
  filters: ListTableFilters<Key>,
  rules: ListTableRules<NoInfer<Row>> = {},
): ListTableOption[] {
  const column = columns.find((item) => item.key === key)
  if (column === undefined) return []

  const others = { ...filters, [key]: [] }
  const counts = new Map<string, number>()
  for (const row of filterListRows(rows, columns, others)) {
    const value = column.text(row)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  const missing = missingIn(column, rules)
  const compare = column.compare ?? comparePtBr

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    // Ordem natural da coluna, com as ausências no fim: elas não competem com
    // os valores reais no topo da lista.
    .sort(
      (a, b) =>
        Number(missing(a.value)) - Number(missing(b.value)) || compare(a.value, b.value),
    )
}

/**
 * Ordena pela coluna escolhida. Sem escolha, ou com uma chave que não é
 * coluna da lista, devolve a lista como veio, na ordem que a página decidiu
 * ao montá-la.
 */
export function sortListRows<Row, Key extends string>(
  rows: readonly Row[],
  columns: readonly ListColumn<NoInfer<Row>, Key>[],
  sort: ListSort<Key>,
  rules: ListTableRules<NoInfer<Row>> = {},
): Row[] {
  if (sort === null) return [...rows]
  const column = columns.find((item) => item.key === sort.column)
  if (column === undefined) return [...rows]

  const factor = sort.direction === 'asc' ? 1 : -1
  const missing = missingIn(column, rules)
  const compare = column.compare ?? comparePtBr
  const tieBreak = rules.tieBreak ?? (() => 0)

  return [...rows].sort((a, b) => {
    const left = column.text(a)
    const right = column.text(b)

    // Ausência vai para o FIM nos dois sentidos, fora do `factor`: é a mesma
    // regra da lista do painel. Sem isto, ordenar Turno colocava "Sem turno"
    // entre Manhã e Tarde, no meio dos turnos de verdade, só porque o S cai
    // ali no alfabeto; e a célula sem data abriria a lista "mais recente
    // primeiro".
    const missingOrder = Number(missing(left)) - Number(missing(right))
    if (missingOrder !== 0) return missingOrder

    // Empate volta ao desempate da página, e ele acompanha o sentido
    // escolhido: numa lista ordenada de trás para frente, o desempate
    // invertido é o que mantém o espelho exato da ordem crescente.
    return factor * (compare(left, right) || tieBreak(a, b))
  })
}
