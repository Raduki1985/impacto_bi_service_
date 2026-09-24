import { formatDateBr } from '../../lib/formatters'
import type { TodayOsRow } from './todayOsModel'

/**
 * Colunas, filtros e ordenação da lista de OS da agenda de hoje.
 *
 * A tabela ganhou a mesma experiência dos cabeçalhos de Vendas por Período
 * (pedido do Mário, 21/09/2026): um botão por coluna abre um painel com a
 * ordenação e o recorte daquela coluna. O que muda aqui é o tipo do dado: na
 * lista de OS toda coluna é texto, então existe um único painel, o de lista
 * com busca, e nenhum de data ou de valor.
 *
 * O filtro vale SÓ para a lista aberta. Os filtros da página continuam em
 * cima, na faixa, e não são alterados por nada daqui: são dois recortes com
 * donos diferentes, e misturá-los faria o gestor mudar a página inteira
 * tentando organizar uma tabela.
 *
 * As larguras são fixas, em pixels, e é o que mantém a tabela parada quando o
 * gestor troca de caixa: com largura automática, cada situação tinha textos de
 * tamanhos diferentes e as colunas dançavam a cada clique.
 *
 * Desde 24/09/2026 a mesma tabela serve à janela de OS do período, aberta pelo
 * clique nos painéis Motivos de improdutiva e Destino das OS. Lá as OS são de
 * vários dias, e a lista ganha a coluna `Data` na frente; na agenda de hoje
 * ela continua de fora, porque todas as OS são do mesmo dia.
 */

/**
 * As colunas, na ordem da tela.
 *
 * `Detalhe` fica sem painel de propósito: ela carrega a resolução, o motivo da
 * improdutiva ou o horário de início conforme a situação da OS, e recortar por
 * uma lista que mistura as três origens confundiria mais do que ajuda. Quem
 * quer só improdutivas abre a caixa de improdutivas.
 */
const COLUMNS = [
  { key: 'date', label: 'Data', width: 92, filterable: true, sortable: true },
  { key: 'id', label: 'OS', width: 120, filterable: false, sortable: true },
  { key: 'period', label: 'Turno', width: 78, filterable: true, sortable: true },
  { key: 'serviceType', label: 'Tipo', width: 118, filterable: true, sortable: true },
  { key: 'category', label: 'Categoria', width: 150, filterable: true, sortable: true },
  { key: 'city', label: 'Cidade', width: 104, filterable: true, sortable: true },
  { key: 'technician', label: 'Técnico', width: 146, filterable: true, sortable: true },
  { key: 'team', label: 'Equipe', width: 112, filterable: true, sortable: true },
  { key: 'status', label: 'Status', width: 138, filterable: true, sortable: true },
  { key: 'detail', label: 'Detalhe', width: 142, filterable: false, sortable: false },
] as const

/**
 * Chave de coluna. Sai da PRÓPRIA lista acima, e não de uma união escrita à
 * mão: assim não existe chave declarada sem coluna declarada, caso em que um
 * filtro aplicado nela seria ignorado em silêncio e o cabeçalho continuaria
 * dizendo que a lista está inteira.
 */
export type TodayColumnKey = (typeof COLUMNS)[number]['key']

export type TodayColumn = {
  readonly key: TodayColumnKey
  readonly label: string
  /** Largura fixa da coluna, em pixels. */
  readonly width: number
  /** A coluna abre a lista de valores para recortar. */
  readonly filterable: boolean
  /**
   * A coluna pode ordenar a lista. É separado de `filterable` porque as duas
   * coisas não andam juntas: o código da OS ordena e não filtra (uma lista de
   * 142 códigos não recorta nada), e `Detalhe` não faz nem uma nem outra.
   */
  readonly sortable: boolean
}

/** Todas as colunas, com a Data na frente: a lista da janela de OS do período. */
export const OS_LIST_COLUMNS: readonly TodayColumn[] = COLUMNS

/** As nove colunas da agenda de hoje: sem a Data, porque todas as OS são do dia. */
export const TODAY_COLUMNS: readonly TodayColumn[] = COLUMNS.filter(
  (column) => column.key !== 'date',
)

/** Soma das larguras: é o piso da tabela, abaixo dele ela rola na horizontal. */
export function tableMinWidth(columns: readonly TodayColumn[]): number {
  return columns.reduce((total, column) => total + column.width, 0)
}

export const TODAY_TABLE_MIN_WIDTH = tableMinWidth(TODAY_COLUMNS)

export type TodayOsSortDirection = 'asc' | 'desc'

export type TodayOsSort = {
  readonly column: TodayColumnKey
  readonly direction: TodayOsSortDirection
} | null

/**
 * Valores escolhidos por coluna. Lista ausente ou vazia significa SEM FILTRO,
 * e não "nenhum valor selecionado": é a mesma convenção da tabela de Vendas.
 */
export type TodayOsTableFilters = Readonly<Partial<Record<TodayColumnKey, readonly string[]>>>

export type TodayTableOption = {
  readonly value: string
  /** Quantas OS do recorte atual têm este valor. */
  readonly count: number
}

/**
 * Texto que a célula mostra, e também o valor pelo qual a coluna filtra e
 * ordena. Um só lugar decide isso: tela, filtro e ordenação nunca divergem
 * sobre o que está escrito na linha.
 *
 * A ausência é escrita por extenso, porque ela também é resposta: "Sem equipe"
 * é uma opção legítima de filtro quando o gestor procura justamente o técnico
 * que ninguém vinculou no cadastro do SGI.
 */
export function todayCellText(row: TodayOsRow, column: TodayColumnKey): string {
  switch (column) {
    case 'date':
      return row.date === undefined ? TODAY_EMPTY_DETAIL : formatDateBr(row.date)
    case 'id':
      return row.id
    case 'period':
      return row.period ?? 'Sem turno'
    case 'serviceType':
      return row.serviceType
    case 'category':
      return row.category
    case 'city':
      return row.city
    case 'technician':
      return row.technician ?? (row.hasTechnician ? 'Técnico sem nome' : TODAY_NO_TECHNICIAN_LABEL)
    case 'team':
      return row.team ?? 'Sem equipe'
    case 'status':
      return row.status
    case 'detail':
      return row.detail ?? TODAY_EMPTY_DETAIL
  }
}

/** Ausência na coluna Detalhe: traço discreto, o mesmo da tabela de Técnicos. */
export const TODAY_EMPTY_DETAIL = '·'

/**
 * Rótulo da OS sem executor na coluna Técnico. Exportado porque o atalho da
 * caixa `A fazer` abre a lista já filtrada por ele (23/09/2026): o filtro
 * precisa do MESMO texto que a célula escreve, senão não casa com linha nenhuma.
 */
export const TODAY_NO_TECHNICIAN_LABEL = 'Sem técnico'

const byPtBr = (a: string, b: string) => a.localeCompare(b, 'pt-BR')

/** Uma lista vazia é "sem filtro"; fora disso, o valor precisa estar nela. */
function matchesColumn(row: TodayOsRow, column: TodayColumnKey, selected: readonly string[]) {
  return selected.length === 0 || selected.includes(todayCellText(row, column))
}

/**
 * Linhas que passam nos filtros de coluna. Devolve o MESMO tipo de linha que
 * recebeu: a janela do período guarda na linha a OS de origem, e é dela que a
 * planilha sai, na ordem e no recorte da tela.
 */
export function filterTodayRows<Row extends TodayOsRow>(
  rows: readonly Row[],
  filters: TodayOsTableFilters,
): Row[] {
  const active = activeColumns(filters)

  return rows.filter((row) =>
    active.every((column) => matchesColumn(row, column, filters[column] ?? [])),
  )
}

/**
 * Colunas com filtro, procuradas em TODAS as colunas, e não só nas da agenda
 * de hoje: um filtro na Data da janela do período ficaria ignorado em
 * silêncio, com o cabeçalho dizendo que a lista está inteira.
 */
function activeColumns(filters: TodayOsTableFilters): TodayColumnKey[] {
  return OS_LIST_COLUMNS.filter((column) => (filters[column.key] ?? []).length > 0).map(
    (column) => column.key,
  )
}

export function hasTodayTableFilters(filters: TodayOsTableFilters): boolean {
  return activeColumns(filters).length > 0
}

/**
 * Opções de uma coluna, no contexto dos DEMAIS filtros.
 *
 * O filtro da própria coluna fica de fora do recorte, como no Excel: sem isso,
 * escolher "Atibaia" em Cidade apagaria as outras cidades da lista e o gestor
 * não conseguiria acrescentar uma segunda. A contagem ao lado é do recorte já
 * filtrado pelas outras colunas, então ela diz o que vai aparecer de fato.
 */
export function todayColumnOptions(
  rows: readonly TodayOsRow[],
  column: TodayColumnKey,
  filters: TodayOsTableFilters,
): TodayTableOption[] {
  const others = { ...filters, [column]: [] }
  const counts = new Map<string, number>()

  for (const row of filterTodayRows(rows, others)) {
    const value = todayCellText(row, column)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    // Ordem alfabética, com as ausências no fim: elas não competem com os
    // valores reais no topo da lista. A Data vai em ordem de CALENDÁRIO: em
    // ordem de texto, 02/09 viria antes de 30/08.
    .sort(
      (a, b) =>
        Number(isMissing(a.value)) - Number(isMissing(b.value)) ||
        (column === 'date'
          ? compareIso(isoOfBrDate(a.value), isoOfBrDate(b.value))
          : byPtBr(a.value, b.value)),
    )
}

/** `30/08/2026` → `2026-08-30`, a forma em que a data ordena como calendário. */
function isoOfBrDate(text: string): string {
  const [day, month, year] = text.split('/')

  return `${year}-${month}-${day}`
}

/** Datas ISO comparadas caractere a caractere, que é a ordem do calendário. */
function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Rótulos de ausência, os MESMOS que `todayCellText` escreve. Declarados, e
 * não adivinhados por prefixo: "sem conexão" é categoria de verdade do SGI, e
 * uma regra por texto a trataria como buraco.
 */
const MISSING_LABELS: ReadonlySet<string> = new Set([
  'Sem turno',
  TODAY_NO_TECHNICIAN_LABEL,
  'Técnico sem nome',
  'Sem equipe',
  TODAY_EMPTY_DETAIL,
])

function isMissing(value: string): boolean {
  return MISSING_LABELS.has(value)
}

/**
 * Ordena pela coluna escolhida. Sem escolha, devolve a lista como veio: a
 * ordem da operação (turno, técnico, código) na agenda de hoje, decidida em
 * `buildTodayRows`, e a data mais recente primeiro na janela do período,
 * decidida em `buildOsListRows`.
 *
 * O código da OS ordena por NÚMERO quando os dois lados seguem o padrão do
 * SGI (`OS-2026-1234`): em ordem de texto, OS-2026-98 cairia depois de
 * OS-2026-1234, que não é o que o gestor procura numa lista de códigos. A
 * Data ordena pelo calendário, pela data ISO da linha, e não pelo texto
 * `dd/mm/aaaa` da célula.
 */
export function sortTodayRows<Row extends TodayOsRow>(rows: readonly Row[], sort: TodayOsSort): Row[] {
  if (sort === null) return [...rows]

  const factor = sort.direction === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    const left = todayCellText(a, sort.column)
    const right = todayCellText(b, sort.column)

    // Ausência vai para o FIM nos dois sentidos, fora do `factor`: é a mesma
    // regra da lista do painel e da ordem padrão da tabela. Sem isto, ordenar
    // Turno colocava "Sem turno" entre Manhã e Tarde, no meio dos turnos de
    // verdade, só porque o S cai ali no alfabeto.
    const missing = Number(isMissing(left)) - Number(isMissing(right))
    if (missing !== 0) return missing

    const compared =
      sort.column === 'id'
        ? compareOsCode(left, right)
        : sort.column === 'date'
          ? compareIso(a.date ?? '', b.date ?? '')
          : byPtBr(left, right)

    // Empate volta ao código, e ele acompanha o sentido escolhido: numa lista
    // ordenada de trás para frente, o desempate invertido é o que mantém a
    // leitura do espelho exato da ordem crescente.
    return factor * (compared || compareOsCode(a.id, b.id))
  })
}

const OS_CODE = /^(.*?)(\d+)$/

function compareOsCode(a: string, b: string): number {
  const left = OS_CODE.exec(a)
  const right = OS_CODE.exec(b)
  if (left !== null && right !== null && left[1] === right[1]) {
    return Number(left[2]) - Number(right[2])
  }

  return byPtBr(a, b)
}
