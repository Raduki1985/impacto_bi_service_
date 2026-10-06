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
 * Planilha das vendas do período da Visão Geral Comercial, o "Baixar N
 * vendas em Excel" do título Resultado do período, no molde do "Baixar N OS
 * em Excel" da Visão Geral de OS.
 *
 * Regra do Mário em 02/10/2026: entram só os contratos VENDIDOS no período,
 * com os filtros da página. Num mês inteiro o N fecha com o vendido da Safra
 * (setembro de 2026: 707). Uma coluna Sim/Não diz se a venda já ligou o sinal
 * dentro do período.
 *
 * De 25/09 a 02/10/2026 a planilha juntava os vendidos OU ativados no
 * período, com uma coluna Sim/Não para cada régua. Fazia as contas fecharem,
 * mas o botão dizia 774 ao lado de cards com 651 e 707, e o número não se
 * explicava sozinho. As ativações de vendas de meses anteriores, que o card
 * Vendas ativadas conta, continuam na janela da Evolução mensal.
 *
 * Desde 01/10/2026 a régua mora no serviço (`commercial_live.py`): a página
 * pede só a CONTAGEM para o texto do botão (`/period/summary`, campo `sold`),
 * e os contratos, já com os filtros da página e na ordem da planilha, só no
 * clique (`/period/records`). Essa rota ainda manda também os ativados
 * vendidos antes do período, marcados com `soldInPeriod` falso, e eles saem
 * aqui (`periodSoldRecords`). As colunas e o texto de cada célula são os da
 * planilha das listas (`todaySalesExport`).
 */

export type PeriodRange = CommercialPeriodRange

/** O período da página, nas datas que a consulta usa. */
export function periodRangeOf(filters: CommercialOverviewFilters): PeriodRange {
  return { dateFrom: filters.startDate, dateTo: filters.endDate }
}

/** Só os contratos vendidos no período, na ordem em que chegaram. */
export function periodSoldRecords(
  records: readonly CommercialPeriodSaleRecord[],
): CommercialPeriodSaleRecord[] {
  return records.filter((record) => record.soldInPeriod)
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

/** Texto do botão: diz quantas vendas e em que formato. */
export function periodSalesDownloadLabel(count: number): string {
  return count === 1 ? 'Baixar 1 venda em Excel' : `Baixar ${formatNumber(count)} vendas em Excel`
}

const yesNo = (value: boolean) => (value ? 'Sim' : 'Não')

/**
 * A coluna a mais, no fim da aba dos contratos, e o valor de cada linha,
 * como o serviço marcou cada contrato.
 */
export function periodSalesExtraColumns(records: readonly CommercialPeriodSaleRecord[]): {
  readonly columns: readonly XlsxColumn[]
  readonly values: (row: TodaySaleRow) => XlsxValue[]
} {
  const byId = new Map(records.map((record) => [record.id, record]))

  return {
    columns: [{ header: 'Ativada no período', width: 19, type: 'text' }],
    values: (row) => [yesNo(byId.get(row.id)?.activatedInPeriod ?? false)],
  }
}

/**
 * Seleção, Período e a nota de como ler a planilha, no topo da aba Filtros;
 * o resto da aba é o de toda planilha de contratos da página
 * (`salesExportInfoTail`).
 */
export function periodSalesExportHead(range: PeriodRange): [string, string][] {
  return [
    ['Seleção', 'Vendas do período'],
    [
      'Período',
      `${periodTitle(range)}: contratos vendidos de ${formatDateBr(range.dateFrom)} a ${formatDateBr(range.dateTo)}`,
    ],
    [
      'Como usar',
      'Num mês inteiro, o total fecha com o vendido da Safra. Ativada no período = Sim: a venda já ligou o sinal dentro do período. O card Vendas ativadas conta também o sinal ligado de vendas anteriores ao período, que não entram aqui',
    ],
  ]
}

/** `vendas-2026-09-01-a-2026-09-30.xlsx`, como o nome da planilha do período da OS. */
export function periodSalesFileName(range: PeriodRange): string {
  return `vendas-${range.dateFrom}-a-${range.dateTo}.xlsx`
}
