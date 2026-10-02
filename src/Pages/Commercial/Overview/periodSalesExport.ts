import type {
  CommercialPeriodRange,
  CommercialPeriodSaleRecord,
} from '../../../data/api/commercialRecordsSource'
import { periodTitle } from '../../../data/overviewOsFilters'
import { formatDateBr, formatNumber } from '../../../lib/formatters'
import type { XlsxColumn, XlsxValue } from '../../../lib/xlsxWriter'
import type { CommercialOverviewFilters } from './overviewModel'
import { toSaleRow, type TodaySaleRow } from './todaySalesModel'

/**
 * Planilha de TODOS os contratos do período da Visão Geral Comercial, o
 * "Baixar N contratos em Excel" do título Resultado do período, no molde do
 * "Baixar N OS em Excel" da Visão Geral de OS.
 *
 * Regra decidida pelo Mário em 25/09/2026, entre três caminhos (só as
 * ativadas, só as vendidas, ou as duas): entram os contratos VENDIDOS no
 * período OU com o sinal ligado no período, cada um uma vez, com os filtros
 * da página. Duas colunas Sim/Não dizem por qual régua o contrato entrou, e
 * filtrando uma delas no Excel o gestor chega ao número de cada card:
 *
 * - "Ativada no período" = Sim: o card Vendas ativadas (sinal ligado no
 *   período, pela regra da venda ativada);
 * - "Vendida no período" = Sim: os vendidos do período, o vendido da Safra
 *   quando o período é um mês inteiro (até 28/09/2026, a base do card
 *   Aguardando Ativação, que saiu da página).
 *
 * Contrato com sinal gravado no período que o serviço não conta como
 * ativado, vendido antes do período, não entra: não pertence a card nenhum.
 *
 * Desde 01/10/2026 a régua mora no serviço (`commercial_live.py`): a página
 * pede só a CONTAGEM para o texto do botão (`/period/summary`), e os
 * contratos, já com os filtros da página, na ordem da planilha e com as duas
 * réguas marcadas, só no clique (`/period/records`). Antes ela baixava o
 * período inteiro a cada troca de filtro só para dizer o N. As colunas e o
 * texto de cada célula são os da planilha das listas (`todaySalesExport`).
 */

export type PeriodRange = CommercialPeriodRange

/** O período da página, nas datas que a consulta usa. */
export function periodRangeOf(filters: CommercialOverviewFilters): PeriodRange {
  return { dateFrom: filters.startDate, dateTo: filters.endDate }
}

/**
 * Linhas da planilha, na ordem em que o serviço manda: a venda mais recente
 * primeiro, como a planilha do período da OS; no mesmo dia, a hora do
 * registro, e depois o código.
 */
export function buildPeriodSalesRows(
  records: readonly CommercialPeriodSaleRecord[],
  today: string,
): TodaySaleRow[] {
  return records.map((record) => toSaleRow(record, today))
}

/** Texto do botão: diz quantos e em que formato. */
export function periodSalesDownloadLabel(count: number): string {
  return count === 1 ? 'Baixar 1 contrato em Excel' : `Baixar ${formatNumber(count)} contratos em Excel`
}

const yesNo = (value: boolean) => (value ? 'Sim' : 'Não')

/**
 * As duas colunas a mais, no fim da aba dos contratos, e o valor de cada
 * linha, como o serviço marcou cada contrato.
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
 * Seleção, Período e a nota de como chegar aos cards, no topo da aba Filtros;
 * o resto da aba é o de toda planilha de contratos da página
 * (`salesExportInfoTail`).
 */
export function periodSalesExportHead(range: PeriodRange): [string, string][] {
  return [
    ['Seleção', 'Todos os contratos do período'],
    [
      'Período',
      `${periodTitle(range)}: vendidos ou com sinal ligado de ${formatDateBr(range.dateFrom)} a ${formatDateBr(range.dateTo)}`,
    ],
    [
      'Como usar',
      'Ativada no período = Sim fecha com o card Vendas ativadas; Vendida no período = Sim fecha com o vendido da Safra quando o período é um mês inteiro',
    ],
  ]
}

/** `contratos-2026-09-01-a-2026-09-24.xlsx`, como o nome da planilha do período da OS. */
export function periodSalesFileName(range: PeriodRange): string {
  return `contratos-${range.dateFrom}-a-${range.dateTo}.xlsx`
}
