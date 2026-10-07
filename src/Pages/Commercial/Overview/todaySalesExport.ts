import { formatDateBr, formatIsoDateTimeBr, formatNumber } from '../../../lib/formatters'
import { buildXlsx, type XlsxColumn, type XlsxValue } from '../../../lib/xlsxWriter'
import type { CommercialOverviewFilters } from './overviewModel'
import {
  isQueueBoxKey,
  queueBoxOf,
  teamLabelOf,
  todaySalesListLabel,
  type TodaySaleRow,
  type TodaySalesQueueBoxKey,
  type TodaySalesSelection,
} from './todaySalesModel'
import {
  PERSON_TYPE_LABELS,
  TODAY_SALES_COLUMNS,
  todaySalesCellText,
  type TodaySalesTableFilters,
} from './todaySalesTableModel'

/**
 * Planilha dos contratos da faixa Hoje ao vivo da Visão Geral Comercial
 * (25/09/2026, pedido do Mário: "a exportação em Excel como em OS").
 *
 * É o `Baixar Excel` da lista aberta embaixo de uma caixa, e desde
 * 25/09/2026 também o da janela de contratos (Safra e Evolução mensal), no molde da
 * planilha de OS (`osListExport`): as linhas VISÍVEIS, na ordem da tela, numa
 * Tabela do Excel, e uma segunda aba dizendo de que recorte ela saiu. O que
 * ela congela:
 *
 * - uma linha por contrato, com mais colunas do que a tela: a planilha é
 *   para tabela dinâmica, e o gestor precisa do Mês da venda para ver de que
 *   meses é a esteira, e das datas de assinatura e visita para medir o que a
 *   tela só resume no Detalhe;
 * - Hora, Vendedor, Time, Tipo de cliente, Situação e Detalhe com o MESMO
 *   texto da lista (`todaySalesCellText`), inclusive "Sem vendedor" e "Sem
 *   time": a ausência é resposta, e a tabela dinâmica a conta. O traço do
 *   Detalhe vazio é só desenho da tela, e na planilha a célula fica vazia;
 * - a marca de atenção vira a coluna "Fora do prazo", Sim ou Não, só nos
 *   contratos da esteira: cor não viaja para o Excel, e fora da esteira não
 *   existe prazo;
 * - "Sinal ligado em" só no contrato que conta como ativado, pela regra da
 *   página: o SGI grava início de sinal em contrato que ainda está na fila, e
 *   a planilha não pode dizer que ele virou cliente;
 * - "Indicação" existe porque venda com código de indicação é da indicação, e
 *   não do vendedor (cards e Top 5): somar a coluna Vendedor sem ela daria ao
 *   vendedor vendas que a página não dá;
 * - o valor em reais com duas casas (`money`), para somar na tabela dinâmica;
 * - nada de nome, documento, endereço ou telefone do cliente: a planilha
 *   leva o que o serviço já entrega ao portal, e nada além.
 */

export const TODAY_SALES_EXPORT_COLUMNS = [
  { header: 'Contrato', width: 12, type: 'text' },
  { header: 'Data da venda', width: 14, type: 'date' },
  { header: 'Mês da venda', width: 13, type: 'text' },
  { header: 'Hora da venda', width: 13, type: 'text' },
  { header: 'Situação', width: 18, type: 'text' },
  { header: 'Detalhe', width: 30, type: 'text' },
  { header: 'Fora do prazo', width: 14, type: 'text' },
  { header: 'Vendedor', width: 30, type: 'text' },
  { header: 'Indicação', width: 11, type: 'text' },
  { header: 'Time', width: 13, type: 'text' },
  { header: 'Cidade', width: 22, type: 'text' },
  { header: 'Plano', width: 30, type: 'text' },
  { header: 'Valor mensal (R$)', width: 17, type: 'money' },
  { header: 'Tipo de cliente', width: 15, type: 'text' },
  { header: 'Data da assinatura', width: 18, type: 'date' },
  { header: 'Última visita', width: 14, type: 'date' },
  { header: 'Próxima visita', width: 15, type: 'date' },
  { header: 'Sinal ligado em', width: 16, type: 'date' },
] as const satisfies readonly XlsxColumn[]

/** Cabeçalho da coluna do valor, citado também na aba Filtros quando ele sai oculto. */
const MONEY_COLUMN_HEADER = 'Valor mensal (R$)'

/** Nome da aba e da Tabela do Excel com os contratos. */
export const TODAY_SALES_EXPORT_SHEET = 'Contratos'
export const TODAY_SALES_EXPORT_TABLE = 'Contratos'

const yesNo = (value: boolean) => (value ? 'Sim' : 'Não')

/**
 * Um contrato da lista como linha da planilha, na ordem de
 * `TODAY_SALES_EXPORT_COLUMNS`. Com os R$ escondidos (`moneyVisibility`), a
 * coluna do valor sai vazia.
 */
export function todaySalesExportRow(row: TodaySaleRow, moneyShown = true): XlsxValue[] {
  const record = row.source

  return [
    row.id,
    row.soldOn,
    row.soldOn === null ? null : row.soldOn.slice(0, 7),
    todaySalesCellText(row, 'time'),
    todaySalesCellText(row, 'status'),
    row.detail,
    queueBoxOf(record) === null ? null : yesNo(row.late),
    todaySalesCellText(row, 'seller'),
    yesNo(record.indicated),
    todaySalesCellText(row, 'team'),
    todaySalesCellText(row, 'city'),
    todaySalesCellText(row, 'plan'),
    moneyShown ? row.value : null,
    todaySalesCellText(row, 'personType'),
    record.signedOn,
    record.lastVisitOn,
    record.nextVisitOn,
    record.activated ? record.startedOn : null,
  ]
}

/** De que recorte a planilha saiu, escrito para quem abre o arquivo longe da tela. */
export type TodaySalesExportContext = {
  readonly selection: TodaySalesSelection
  /** O dia da faixa, ISO. */
  readonly today: string
  /** Data de venda a partir da qual a esteira vale, ISO; null quando o serviço não diz. */
  readonly queueFrom: string | null
  /** Prazo da etapa da caixa, em dias de trabalho, como o serviço mede; null fora da esteira. */
  readonly deadlineDays: number | null
  /** Filtros da faixa da página que valem para a lista; null sem nenhum. */
  readonly pageFilters: string | null
  /** Filtros de coluna da lista; null sem nenhum. */
  readonly listFilters: string | null
  /** Hora em que o serviço leu o banco, ISO com fuso; null sem a informação. */
  readonly readAt: string | null
  /** Hora do clique em Baixar, já escrita. */
  readonly generatedAt: string
}

/**
 * Janela de datas do que a lista contém. A faixa é sempre de hoje, e o
 * período escolhido na página não vale para ela; a esteira alcança toda
 * venda ainda não ativada desde o início da base comercial.
 */
export function todaySalesExportPeriod(
  selection: TodaySalesSelection,
  today: string,
  queueFrom: string | null,
): string {
  const day = formatDateBr(today)
  if (selection.box === 'sold') return `Vendas de hoje, ${day}`
  if (selection.box === 'activated') return `Sinal ligado hoje, ${day}`

  return queueFrom === null
    ? `Vendas ainda não ativadas em ${day}`
    : `Vendas desde ${formatDateBr(queueFrom)}, ainda não ativadas em ${day}`
}

/** O que "Fora do prazo" quer dizer em cada etapa, pela regra do serviço (`commercial_live.py`). */
const DEADLINE_RULES: Readonly<Record<TodaySalesQueueBoxKey, (days: string) => string>> = {
  pending: (days) => `${days} depois da venda sem assinatura`,
  signed: (days) => `${days} depois da assinatura sem instalação marcada`,
  scheduled: (days) => `${days} depois da data da visita, sem sinal e sem outra visita marcada`,
}

export function todaySalesDeadlineText(box: TodaySalesQueueBoxKey, days: number): string {
  const span = days === 1 ? '1 dia de trabalho ou mais' : `${formatNumber(days)} dias de trabalho ou mais`

  // A exceção de 28/09/2026 vai por extenso: a planilha viaja sem a dica da tela.
  return (
    `Fora do prazo com ${DEADLINE_RULES[box](span)}, sem contar domingo; não conta como fora do ` +
    'prazo a venda com sinal ligado no próprio contrato nem a refeita em outro contrato do cliente, ' +
    'no mesmo endereço, que já está com sinal'
  )
}

/** Rótulo em negrito à esquerda e o valor à direita, sem cabeçalho. */
const INFO_COLUMNS: readonly XlsxColumn[] = [
  { header: 'Item', width: 22, type: 'text', bold: true },
  { header: 'Valor', width: 100, type: 'text' },
]

/**
 * O fim da aba Filtros, igual em toda planilha de contratos da página: os
 * filtros, a contagem, a fonte e as horas. Quem monta a planilha escreve o
 * topo da aba (Seleção, Período e o que mais for dela, como o Prazo).
 */
export function salesExportInfoTail(
  context: Pick<TodaySalesExportContext, 'pageFilters' | 'readAt' | 'generatedAt'> & {
    /** Filtros de coluna da lista de onde a planilha sai; ausente quando ela não sai de lista. */
    readonly listFilters?: string | null
  },
  count: number,
): [string, string][] {
  const rows: [string, string][] = [['Filtros da página', context.pageFilters ?? 'Nenhum']]
  if (context.listFilters !== undefined) rows.push(['Filtros da lista', context.listFilters ?? 'Nenhum'])
  rows.push(['Contratos na planilha', formatNumber(count)], ['Fonte', 'SGI, pelo serviço de BI'])
  const readAt = context.readAt === null ? null : formatIsoDateTimeBr(context.readAt)
  if (readAt !== null) rows.push(['Dados lidos em', readAt])
  rows.push(['Gerada em', context.generatedAt])

  return rows
}

export function todaySalesExportInfoRows(
  context: TodaySalesExportContext,
  count: number,
): [string, string][] {
  const { selection } = context
  const rows: [string, string][] = [
    ['Seleção', `Hoje ao vivo · ${todaySalesListLabel(selection)}`],
    ['Período', todaySalesExportPeriod(selection, context.today, context.queueFrom)],
  ]
  if (isQueueBoxKey(selection.box) && context.deadlineDays !== null) {
    rows.push(['Prazo', todaySalesDeadlineText(selection.box, context.deadlineDays)])
  }

  return [...rows, ...salesExportInfoTail(context, count)]
}

/**
 * Uma planilha de contratos: a aba dos contratos, como Tabela do Excel, e a
 * aba Filtros com as linhas que dizem de que recorte ela saiu. É a mesma
 * planilha na faixa Hoje ao vivo e na janela de contratos (Safra e Evolução mensal).
 */
export function buildSalesWorkbook(
  rows: readonly TodaySaleRow[],
  infoRows: readonly (readonly [string, string])[],
  /**
   * Colunas a mais no fim da aba dos contratos, com o valor de cada linha. A
   * planilha das vendas do período traz "Ativada no período" (desde
   * 02/10/2026; antes também "Vendida no período"); as listas abertas não
   * precisam.
   */
  extra?: {
    readonly columns: readonly XlsxColumn[]
    readonly values: (row: TodaySaleRow) => XlsxValue[]
  },
  /**
   * Os R$ à vista na página. Escondidos, a coluna do valor sai vazia e a aba
   * Filtros diz por quê, para a planilha não parecer quebrada.
   */
  moneyShown = true,
): Uint8Array<ArrayBuffer> {
  const info = moneyShown ? infoRows : [...infoRows, [MONEY_COLUMN_HEADER, 'Oculto nesta planilha'] as const]

  return buildXlsx([
    {
      name: TODAY_SALES_EXPORT_SHEET,
      table: TODAY_SALES_EXPORT_TABLE,
      columns: extra === undefined ? TODAY_SALES_EXPORT_COLUMNS : [...TODAY_SALES_EXPORT_COLUMNS, ...extra.columns],
      rows: rows.map((row) =>
        extra === undefined
          ? todaySalesExportRow(row, moneyShown)
          : [...todaySalesExportRow(row, moneyShown), ...extra.values(row)],
      ),
    },
    { name: 'Filtros', columns: INFO_COLUMNS, rows: info.map((row) => [...row]) },
  ])
}

/** O arquivo da faixa Hoje ao vivo. */
export function buildTodaySalesWorkbook(
  rows: readonly TodaySaleRow[],
  context: TodaySalesExportContext,
  moneyShown = true,
): Uint8Array<ArrayBuffer> {
  return buildSalesWorkbook(rows, todaySalesExportInfoRows(context, rows.length), undefined, moneyShown)
}

/** Nomes de cidade e vendedor, dos catálogos que a página já tem para os seletores. */
export type SalesFilterNames = {
  readonly cities: readonly { readonly id: string; readonly name: string }[]
  readonly sellers: readonly { readonly id: string; readonly name: string }[]
}

/** Nomes das opções marcadas, na ordem do catálogo; id fora dele vai cru, no fim. */
function namesOf(
  ids: readonly string[],
  catalog: readonly { readonly id: string; readonly name: string }[],
): string {
  const known = catalog.filter((item) => ids.includes(item.id)).map((item) => item.name)
  const unknown = ids.filter((id) => !catalog.some((item) => item.id === id))
  return [...known, ...unknown].join(', ')
}

/**
 * Filtros da página que valem para a faixa (todos menos o período), em
 * texto; null sem nenhum. Cidade e vendedor viajam por id, e o nome sai do
 * catálogo dos seletores da página (desde 01/10/2026 a lista não traz mais
 * todos os contratos para procurar o nome neles); fora do catálogo, o id
 * cru, como o chip da faixa de filtros faz. Com várias opções marcadas, vão
 * todas por extenso (`Cidade: Atibaia, Piracaia`): a planilha não tem dica de
 * mouse para guardar o resto.
 */
export function todaySalesPageFilters(
  filters: CommercialOverviewFilters,
  names: SalesFilterNames,
): string | null {
  const parts: string[] = []
  if (filters.cityIds.length > 0) {
    parts.push(`Cidade: ${namesOf(filters.cityIds, names.cities)}`)
  }
  if (filters.team !== 'todos') parts.push(`Time: ${teamLabelOf(filters.team) ?? filters.team}`)
  if (filters.sellerIds.length > 0) {
    parts.push(`Vendedor: ${namesOf(filters.sellerIds, names.sellers)}`)
  }
  if (filters.personType !== 'todos') {
    parts.push(`Tipo de cliente: ${PERSON_TYPE_LABELS[filters.personType]}`)
  }

  return parts.length === 0 ? null : parts.join(' · ')
}

/**
 * Filtros de coluna da lista, em texto (`Cidade: Atibaia, Piracaia ·
 * Vendedor: Ana`); null sem nenhum. Só colunas com valor escolhido entram.
 */
export function describeTodaySalesListFilters(filters: TodaySalesTableFilters): string | null {
  const parts = TODAY_SALES_COLUMNS.flatMap((column) => {
    const selected = filters[column.key] ?? []

    return selected.length === 0 ? [] : [`${column.label}: ${selected.join(', ')}`]
  })

  return parts.length === 0 ? null : parts.join(' · ')
}

/** Sem acento, em minúsculas, com hífen no lugar de espaço e pontuação. */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Nome do arquivo: `contratos-pendentes-fora-do-prazo-2026-09-25.xlsx`. A
 * data em ISO para a pasta de downloads ordenar os arquivos na ordem do
 * calendário, como na planilha de OS.
 */
export function todaySalesExportFileName(selection: TodaySalesSelection, today: string): string {
  return salesExportFileName(todaySalesListLabel(selection), today)
}

/** `contratos-<o que a lista mostra>-<dia>.xlsx`, para qualquer lista de contratos da página. */
export function salesExportFileName(label: string, day: string): string {
  return `contratos-${slug(label)}-${day}.xlsx`
}
