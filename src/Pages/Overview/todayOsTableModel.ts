import {
  compareBrDates,
  compareNumberedCodes,
  filterListRows,
  hasListFilters,
  listColumnOptions,
  listTableMinWidth,
  sortListRows,
  type ListColumn,
  type ListSort,
  type ListSortDirection,
  type ListTableFilters,
  type ListTableOption,
  type ListTableRules,
} from '../../components/dashboard/listTableModel'
import { formatDateBr } from '../../lib/formatters'
import type { TodayOsRow } from './todayOsModel'

/**
 * Colunas da lista de OS: a agenda de hoje e a janela de OS do período.
 *
 * A tabela ganhou a mesma experiência dos cabeçalhos de Vendas por Período
 * (pedido do Mário, 21/09/2026): um botão por coluna abre um painel com a
 * ordenação e o recorte daquela coluna. Em 24/09/2026 o recorte, a contagem
 * das opções e a ordenação viraram o modelo de lista do portal
 * (`components/dashboard/listTableModel`), e este arquivo passou a declarar
 * só o que é da OS: as colunas, o texto de cada célula, o que é ausência e o
 * desempate pelo código.
 *
 * O filtro vale SÓ para a lista aberta. Os filtros da página continuam em
 * cima, na faixa, e não são alterados por nada daqui: são dois recortes com
 * donos diferentes, e misturá-los faria o gestor mudar a página inteira
 * tentando organizar uma tabela.
 *
 * A janela de OS do período tem OS de vários dias, e a lista ganha a coluna
 * `Data` na frente; na agenda de hoje ela continua de fora, porque todas as
 * OS são do mesmo dia.
 */

/** Ausência na coluna Detalhe: traço discreto, o mesmo da tabela de Técnicos. */
export const TODAY_EMPTY_DETAIL = '·'

/**
 * Rótulo da OS sem executor na coluna Técnico. Exportado porque o atalho da
 * caixa `A fazer` abre a lista já filtrada por ele (23/09/2026): o filtro
 * precisa do MESMO texto que a célula escreve, senão não casa com linha nenhuma.
 */
export const TODAY_NO_TECHNICIAN_LABEL = 'Sem técnico'

/**
 * As colunas, na ordem da tela, sem o texto da célula, que vem abaixo.
 *
 * `Detalhe` fica sem painel de propósito: ela carrega a resolução, o motivo da
 * improdutiva ou o horário de início conforme a situação da OS, e recortar por
 * uma lista que mistura as três origens confundiria mais do que ajuda. Quem
 * quer só improdutivas abre a caixa de improdutivas. O código da OS ordena por
 * número e não filtra: uma lista com 142 códigos não recorta nada. A Data
 * ordena pelo calendário, com os nomes de calendário no painel. Categoria,
 * cidade e técnico têm busca no painel; as listas curtas não precisam.
 */
const COLUMN_SPECS = [
  { key: 'date', label: 'Data', width: 92, filterable: true, sortable: true, sortKind: 'date', compare: compareBrDates },
  { key: 'id', label: 'OS', width: 120, filterable: false, sortable: true, compare: compareNumberedCodes },
  { key: 'period', label: 'Turno', width: 78, filterable: true, sortable: true },
  { key: 'serviceType', label: 'Tipo', width: 118, filterable: true, sortable: true },
  { key: 'category', label: 'Categoria', width: 150, filterable: true, sortable: true, searchable: true },
  { key: 'city', label: 'Cidade', width: 104, filterable: true, sortable: true, searchable: true },
  { key: 'technician', label: 'Técnico', width: 146, filterable: true, sortable: true, searchable: true },
  { key: 'team', label: 'Equipe', width: 112, filterable: true, sortable: true },
  { key: 'status', label: 'Status', width: 138, filterable: true, sortable: true },
  { key: 'detail', label: 'Detalhe', width: 142, filterable: false, sortable: false },
] as const satisfies readonly Omit<ListColumn<TodayOsRow>, 'text'>[]

/**
 * Chave de coluna. Sai da PRÓPRIA lista acima, e não de uma união escrita à
 * mão: assim não existe chave declarada sem coluna declarada, caso em que um
 * filtro aplicado nela seria ignorado em silêncio e o cabeçalho continuaria
 * dizendo que a lista está inteira.
 */
export type TodayColumnKey = (typeof COLUMN_SPECS)[number]['key']

export type TodayColumn = ListColumn<TodayOsRow, TodayColumnKey>

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

const COLUMNS: readonly TodayColumn[] = COLUMN_SPECS.map((spec) => ({
  ...spec,
  text: (row: TodayOsRow) => todayCellText(row, spec.key),
}))

/** Todas as colunas, com a Data na frente: a lista da janela de OS do período. */
export const OS_LIST_COLUMNS: readonly TodayColumn[] = COLUMNS

/** As nove colunas da agenda de hoje: sem a Data, porque todas as OS são do dia. */
export const TODAY_COLUMNS: readonly TodayColumn[] = COLUMNS.filter(
  (column) => column.key !== 'date',
)

/** Soma das larguras: é o piso da tabela, abaixo dele ela rola na horizontal. */
export function tableMinWidth(columns: readonly TodayColumn[]): number {
  return listTableMinWidth(columns)
}

export const TODAY_TABLE_MIN_WIDTH = tableMinWidth(TODAY_COLUMNS)

export type TodayOsSortDirection = ListSortDirection

export type TodayOsSort = ListSort<TodayColumnKey>

/**
 * Valores escolhidos por coluna. Lista ausente ou vazia significa SEM FILTRO,
 * e não "nenhum valor selecionado": é a mesma convenção da tabela de Vendas.
 */
export type TodayOsTableFilters = ListTableFilters<TodayColumnKey>

export type TodayTableOption = ListTableOption

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

/**
 * O que a lista de OS sabe das próprias linhas: a ausência vai para o fim, e
 * o empate na ordenação volta ao código da OS, para a ordem não depender do
 * acaso.
 */
export const TODAY_TABLE_RULES: ListTableRules<TodayOsRow> = {
  missing: MISSING_LABELS,
  tieBreak: (a, b) => compareNumberedCodes(a.id, b.id),
}

/**
 * Linhas que passam nos filtros de coluna. Devolve o MESMO tipo de linha que
 * recebeu: a janela do período guarda na linha a OS de origem, e é dela que a
 * planilha sai, na ordem e no recorte da tela.
 *
 * Os filtros são procurados em TODAS as colunas, e não só nas da agenda de
 * hoje: um filtro na Data da janela do período ficaria ignorado em silêncio,
 * com o cabeçalho dizendo que a lista está inteira.
 */
export function filterTodayRows<Row extends TodayOsRow>(
  rows: readonly Row[],
  filters: TodayOsTableFilters,
): Row[] {
  return filterListRows(rows, OS_LIST_COLUMNS, filters)
}

export function hasTodayTableFilters(filters: TodayOsTableFilters): boolean {
  return hasListFilters(OS_LIST_COLUMNS, filters)
}

/** Opções de uma coluna, no contexto dos DEMAIS filtros, com a ausência no fim. */
export function todayColumnOptions(
  rows: readonly TodayOsRow[],
  column: TodayColumnKey,
  filters: TodayOsTableFilters,
): TodayTableOption[] {
  return listColumnOptions(rows, OS_LIST_COLUMNS, column, filters, TODAY_TABLE_RULES)
}

/**
 * Ordena pela coluna escolhida. Sem escolha, devolve a lista como veio: a
 * ordem da operação (turno, técnico, código) na agenda de hoje, decidida em
 * `buildTodayRows`, e a data mais recente primeiro na janela do período,
 * decidida em `buildOsListRows`.
 */
export function sortTodayRows<Row extends TodayOsRow>(rows: readonly Row[], sort: TodayOsSort): Row[] {
  return sortListRows(rows, OS_LIST_COLUMNS, sort, TODAY_TABLE_RULES)
}
