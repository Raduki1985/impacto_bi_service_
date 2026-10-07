import type {
  CommercialPeriodRange,
  CommercialPeriodSaleRecord,
} from '../../../data/api/commercialRecordsSource'
import { periodTitle } from '../../../data/overviewOsFilters'
import { formatDateBr } from '../../../lib/formatters'
import type { XlsxColumn, XlsxValue } from '../../../lib/xlsxWriter'
import type { CommercialOverviewFilters } from './overviewModel'
import { toSaleRow, type TodaySaleRow } from './todaySalesModel'

/**
 * A planilha dos contratos do período, baixada pelo botão do título
 * "Resultado do período" (decisão do Mário em 06/10/2026, à noite).
 *
 * Leva os contratos vendidos OU ativados no período, com os filtros da
 * página, e duas colunas Sim/Não no fim: "Vendida no período" e "Ativada no
 * período". Com elas a tabela dinâmica refaz os dois cards da fileira:
 * Vendida = Sim dá o Total de Vendas; Ativada = Sim dá o Vendas ativadas;
 * as duas, as vendidas e ativadas no período; só Ativada, as vendidas antes
 * do período. É por isso que a planilha é do título, e não de um card: ela
 * é dos dois.
 *
 * O caminho até aqui, tudo em 2026: de 25/09 a 02/10 o botão dizia "Baixar
 * N vendas em Excel" com os vendidos OU ativados (774 em setembro); de 02 a
 * 06/10, "Baixar as N vendidas em Excel" só com os vendidos (707). Nenhum N
 * era o de um card, e o botão saiu; a lista passou a um ícone no card Vendas
 * ativadas, abrindo uma janela com atalhos. Na mesma noite, com o Total de
 * Vendas na fileira e os dois números com casa, o Mário trouxe o botão de
 * volta, sem número no rótulo, e a janela e o ícone saíram: um lugar só
 * para baixar, e card não abre lista.
 *
 * Os contratos vêm do serviço só no clique (`/period/records`), cada um
 * marcado com as duas réguas pelo próprio serviço. As colunas e o texto de
 * cada célula são os da planilha das listas (`todaySalesExport`).
 */

export type PeriodRange = CommercialPeriodRange

/** O período da página, nas datas que a consulta usa. */
export function periodRangeOf(filters: CommercialOverviewFilters): PeriodRange {
  return { dateFrom: filters.startDate, dateTo: filters.endDate }
}

/** Texto do botão: sem número, de propósito. O número de cada régua está nos cards. */
export const PERIOD_DOWNLOAD_LABEL = 'Baixar contratos do período em Excel'

/** Dica do botão. */
export const PERIOD_DOWNLOAD_TITLE =
  'Baixa os contratos vendidos ou ativados no período, com os filtros da página, numa planilha do Excel pronta para tabela dinâmica'

/**
 * Linhas da planilha, na ordem em que o serviço manda: a venda mais recente
 * primeiro, como a planilha do período da OS.
 */
export function buildPeriodSalesRows(records: readonly CommercialPeriodSaleRecord[], today: string): TodaySaleRow[] {
  return records.map((record) => toSaleRow(record, today))
}

const yesNo = (value: boolean) => (value ? 'Sim' : 'Não')

/**
 * As duas colunas a mais, no fim da aba dos contratos: por qual régua o
 * contrato está no período, como o serviço marcou.
 */
export function periodSalesExtraColumns(records: readonly CommercialPeriodSaleRecord[]): {
  readonly columns: readonly XlsxColumn[]
  readonly values: (row: TodaySaleRow) => XlsxValue[]
} {
  const byId = new Map(records.map((record) => [record.id, record]))

  return {
    columns: [
      { header: 'Vendida no período', width: 19, type: 'text' },
      { header: 'Ativada no período', width: 19, type: 'text' },
    ],
    values: (row) => [
      yesNo(byId.get(row.id)?.soldInPeriod ?? false),
      yesNo(byId.get(row.id)?.activatedInPeriod ?? false),
    ],
  }
}

/**
 * Seleção, Período e a nota de como ler a planilha, no topo da aba Filtros;
 * o resto da aba é o de toda planilha de contratos da página
 * (`salesExportInfoTail`).
 */
export function periodSalesExportHead(range: PeriodRange): [string, string][] {
  return [
    ['Seleção', 'Contratos do período'],
    [
      'Período',
      `${periodTitle(range)}: contratos vendidos ou ativados de ${formatDateBr(range.dateFrom)} a ${formatDateBr(range.dateTo)}`,
    ],
    [
      'Como usar',
      'Vendida no período = Sim refaz o Total de Vendas (pela data da venda). Ativada no período = Sim refaz o Vendas ativadas (pelo dia do sinal ligado). As duas = Sim são as vendidas e ativadas no período; só Ativada = Sim são as ativadas de vendas anteriores ao período',
    ],
  ]
}

/** `contratos-2026-10-01-a-2026-10-05.xlsx`, como o nome da planilha do período da OS. */
export function periodSalesFileName(range: PeriodRange): string {
  return `contratos-${range.dateFrom}-a-${range.dateTo}.xlsx`
}
